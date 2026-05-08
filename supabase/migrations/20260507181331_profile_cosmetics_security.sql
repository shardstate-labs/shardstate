alter table public.game_state
  add column if not exists selected_avatar text not null default 'protocol-seed',
  add column if not exists selected_profile_frame text not null default 'basic',
  add column if not exists owned_avatars text[] not null default array['protocol-seed']::text[];

create or replace function public.set_profile_cosmetic(
  p_avatar text default null,
  p_frame text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_state public.game_state%rowtype;
  v_basic_avatars constant text[] := array[
    'protocol-seed',
    'nexus-orb',
    'tide-sigil',
    'ash-spark'
  ];
  v_premium_avatars constant text[] := array[
    'void-eye',
    'mycel-spore',
    'iron-crest',
    'singularity-core'
  ];
  v_premium_frames constant text[] := array[
    'premium-circuit',
    'premium-prism',
    'premium-gold',
    'premium-void',
    'premium-singularity'
  ];
  v_has_premium boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth_required');
  end if;

  insert into public.game_state (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select *
    into v_state
    from public.game_state
   where user_id = v_uid
   for update;

  select exists (
    select 1
      from public.battle_pass bp
     where bp.user_id = v_uid
       and bp.is_premium = true
     order by bp.season desc
     limit 1
  ) into v_has_premium;

  if p_avatar is not null then
    if not (p_avatar = any(v_basic_avatars) or p_avatar = any(v_premium_avatars)) then
      return jsonb_build_object('error', 'invalid_avatar');
    end if;

    if p_avatar = any(v_premium_avatars) and not (p_avatar = any(coalesce(v_state.owned_avatars, array['protocol-seed']::text[]))) then
      return jsonb_build_object('error', 'avatar_not_owned');
    end if;

    update public.game_state
       set selected_avatar = p_avatar,
           updated_at = now()
     where user_id = v_uid;
  end if;

  if p_frame is not null then
    if not (p_frame = 'basic' or p_frame = any(v_premium_frames)) then
      return jsonb_build_object('error', 'invalid_frame');
    end if;

    if p_frame = any(v_premium_frames) and not v_has_premium then
      return jsonb_build_object('error', 'premium_required');
    end if;

    update public.game_state
       set selected_profile_frame = p_frame,
           updated_at = now()
     where user_id = v_uid;
  end if;

  select *
    into v_state
    from public.game_state
   where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'selected_avatar', v_state.selected_avatar,
    'selected_profile_frame', v_state.selected_profile_frame,
    'owned_avatars', v_state.owned_avatars
  );
end;
$$;

create or replace function public.purchase_profile_avatar(p_avatar text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_state public.game_state%rowtype;
  v_price integer;
  v_premium_avatars constant text[] := array[
    'void-eye',
    'mycel-spore',
    'iron-crest',
    'singularity-core'
  ];
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth_required');
  end if;

  perform set_config('app.shardstate_internal', '1', true);

  if not (p_avatar = any(v_premium_avatars)) then
    return jsonb_build_object('error', 'invalid_avatar');
  end if;

  v_price := case p_avatar
    when 'singularity-core' then 5
    else 3
  end;

  insert into public.game_state (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select *
    into v_state
    from public.game_state
   where user_id = v_uid
   for update;

  if p_avatar = any(coalesce(v_state.owned_avatars, array['protocol-seed']::text[])) then
    update public.game_state
       set selected_avatar = p_avatar,
           updated_at = now()
     where user_id = v_uid;

    return jsonb_build_object(
      'ok', true,
      'owned', true,
      'flux', v_state.flux,
      'owned_avatars', v_state.owned_avatars,
      'selected_avatar', p_avatar
    );
  end if;

  if v_state.flux < v_price then
    return jsonb_build_object('error', 'not_enough_flux');
  end if;

  update public.game_state
     set flux = flux - v_price,
         owned_avatars = array_append(
           coalesce(owned_avatars, array['protocol-seed']::text[]),
           p_avatar
         ),
         selected_avatar = p_avatar,
         updated_at = now()
   where user_id = v_uid
   returning * into v_state;

  return jsonb_build_object(
    'ok', true,
    'flux', v_state.flux,
    'owned_avatars', v_state.owned_avatars,
    'selected_avatar', v_state.selected_avatar
  );
end;
$$;

create or replace function public.guard_game_state_client_protected_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') and coalesce(current_setting('app.shardstate_internal', true), '') <> '1' then
    if tg_op = 'INSERT' then
      if coalesce(new.shards, 0) <> 0
        or coalesce(new.flux, 0) <> 0
        or coalesce(new.shs, 0) <> 0
        or coalesce(new.elo, 0) <> 0
        or coalesce(new.xp, 0) <> 0
        or coalesce(new.level, 1) <> 1
        or coalesce(new.abandon_streak, 0) <> 0
        or new.last_abandon_at is not null
        or new.lockout_until is not null
        or coalesce(new.reward_penalty_games, 0) <> 0
        or coalesce(new.elo_penalty_mult, 1) <> 1
        or coalesce(new.owned_avatars, array['protocol-seed']::text[]) <> array['protocol-seed']::text[] then
        raise exception 'protected_game_state_write';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.shards is distinct from old.shards
        or new.flux is distinct from old.flux
        or new.shs is distinct from old.shs
        or new.elo is distinct from old.elo
        or new.xp is distinct from old.xp
        or new.level is distinct from old.level
        or new.abandon_streak is distinct from old.abandon_streak
        or new.last_abandon_at is distinct from old.last_abandon_at
        or new.lockout_until is distinct from old.lockout_until
        or new.reward_penalty_games is distinct from old.reward_penalty_games
        or new.elo_penalty_mult is distinct from old.elo_penalty_mult
        or new.owned_avatars is distinct from old.owned_avatars then
        raise exception 'protected_game_state_write';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists game_state_client_protected_columns_trg on public.game_state;
create trigger game_state_client_protected_columns_trg
before insert or update on public.game_state
for each row
execute function public.guard_game_state_client_protected_columns();

revoke all on function public.set_profile_cosmetic(text, text) from public;
revoke all on function public.purchase_profile_avatar(text) from public;
revoke all on function public.set_profile_cosmetic(text, text) from anon;
revoke all on function public.purchase_profile_avatar(text) from anon;
grant execute on function public.set_profile_cosmetic(text, text) to authenticated;
grant execute on function public.purchase_profile_avatar(text) to authenticated;

do $$
declare
  fn record;
begin
  for fn in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef = true
  loop
    execute format('revoke execute on function %I.%I(%s) from anon', fn.nspname, fn.proname, fn.args);
  end loop;
end;
$$;

revoke execute on function public.create_referral_friend_request() from public, anon;
revoke execute on function public.finalize_pvp_match(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.list_public_deck_presets() from public, anon;
revoke execute on function public.publish_deck_preset(text, text[]) from public, anon;
grant execute on function public.create_referral_friend_request() to authenticated;
grant execute on function public.finalize_pvp_match(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.list_public_deck_presets() to authenticated;
grant execute on function public.publish_deck_preset(text, text[]) to authenticated;
