alter table public.game_state
  add column if not exists owned_profile_frames text[] not null default array['basic']::text[];

with latest_bp as (
  select distinct on (user_id) user_id, is_premium, xp
    from public.battle_pass
   order by user_id, season desc
)
update public.game_state gs
   set owned_profile_frames = (
     select array_agg(distinct frame_id)
       from unnest(array[
         'basic',
         case when coalesce(bp.is_premium,false) and coalesce(bp.xp,0) >= 4  * 200 then 'premium-circuit' end,
         case when coalesce(bp.is_premium,false) and coalesce(bp.xp,0) >= 8  * 200 then 'premium-prism' end,
         case when coalesce(bp.is_premium,false) and coalesce(bp.xp,0) >= 14 * 200 then 'premium-gold' end,
         case when coalesce(bp.is_premium,false) and coalesce(bp.xp,0) >= 22 * 200 then 'premium-void' end,
         case when coalesce(bp.is_premium,false) and coalesce(bp.xp,0) >= 28 * 200 then 'premium-singularity' end
       ]::text[]) frame_id
      where frame_id is not null
   )
  from latest_bp bp
 where bp.user_id = gs.user_id
   and coalesce(bp.is_premium,false);

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
  v_frames constant text[] := array[
    'basic',
    'premium-circuit',
    'premium-prism',
    'premium-gold',
    'premium-void',
    'premium-singularity'
  ];
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth_required');
  end if;

  perform set_config('app.shardstate_internal', '1', true);

  insert into public.game_state (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select *
    into v_state
    from public.game_state
   where user_id = v_uid
   for update;

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
    if not (p_frame = any(v_frames)) then
      return jsonb_build_object('error', 'invalid_frame');
    end if;

    if not (p_frame = any(coalesce(v_state.owned_profile_frames, array['basic']::text[]))) then
      return jsonb_build_object('error', 'frame_not_owned');
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
    'owned_avatars', v_state.owned_avatars,
    'owned_profile_frames', v_state.owned_profile_frames
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
  v_price integer := 1;
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
    return jsonb_build_object('error', 'not_enough_flux', 'required', v_price, 'flux', coalesce(v_state.flux, 0));
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

create or replace function public.claim_battle_pass(p_tier integer, p_track text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_season public.battle_pass_seasons%rowtype;
  v_bp record;
  v_xp_per_tier int := 200;
  v_required_xp int;
  v_already_claimed bool;
  v_reward jsonb;
  v_shards int := 0;
  v_flux int := 0;
  v_card_id text := null;
  v_frame_id text := null;
  v_common_uncommon text[] := array[
    'skrell','nyx','denza','patch','krex','lyrae','shrae','drix','calyx','brine','tessara','undrek','coa','drifta','pelagia','swell','korai','ignar','vestara','pyrex','comb','flare','char','smolder','soot','pyress','void','kernel','raze','blk','patch_exe','erase','override','vex0','malware','valdric','seraphine','auris','caela','renaud','isolde','bertrand','duval','celestine','myc','rhizo','luxen','bract','molder','sprika','verdex','ferma','hyphae','skar','druun','vael','mox','wrekk','thurak','grael','braxa','dravox','axiom','tessla','vren','lira','drix7','arka','syntex','caliber','praxis','chrono','loopex','deja','rift','warp','echon','stasis','phase','paradox','mirage','spectr','kaen','fader','cipher_s','wraith','trace','whisper','shade','haze','chromex','riff','spark','beat','strobo','verse','echo_p','resonant','marshal','decree','axiarch','legate','praetor','edikt','tribunal','sentinel_x','mandate'
  ];
  v_grands text[] := array[
    'grand_raijin','grand_ryujin','grand_kagutsuchi','grand_yamiyo','grand_inari','grand_konohana','grand_hachiman','grand_omoikane','grand_tsukuyomi','grand_yurei','grand_benzaiten','grand_susanoo'
  ];
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;
  if p_track not in ('free','premium') then return jsonb_build_object('error','invalid_track'); end if;
  if p_tier < 1 or p_tier > 30 then return jsonb_build_object('error','invalid_tier'); end if;

  select * into v_season from public.current_battle_pass_season();
  if v_season.season is null then return jsonb_build_object('error','season_not_configured'); end if;

  v_required_xp := p_tier * v_xp_per_tier;

  insert into public.battle_pass (user_id, season, xp, is_premium, claimed_free, claimed_premium, started_at)
    values (v_uid, v_season.season, 0, false, '{}'::int[], '{}'::int[], v_season.starts_at)
    on conflict (user_id, season) do nothing;

  select * into v_bp from public.battle_pass where user_id = v_uid and season = v_season.season;

  if coalesce(v_bp.xp, 0) < v_required_xp then
    return jsonb_build_object('error','not_enough_xp');
  end if;

  if p_track = 'free' then
    v_already_claimed := p_tier = any(coalesce(v_bp.claimed_free, '{}'::int[]));
  else
    if not coalesce(v_bp.is_premium, false) then return jsonb_build_object('error','not_premium'); end if;
    v_already_claimed := p_tier = any(coalesce(v_bp.claimed_premium, '{}'::int[]));
  end if;
  if v_already_claimed then return jsonb_build_object('error','already_claimed'); end if;

  if p_track = 'free' then
    if p_tier % 3 <> 0 then return jsonb_build_object('error','no_reward'); end if;
    v_shards := case when p_tier = 30 then 120 when p_tier % 9 = 0 then 75 else 45 end;
    v_reward := jsonb_build_object('kind','shards','amount',v_shards);
  else
    v_frame_id := case p_tier
      when 4 then 'premium-circuit'
      when 8 then 'premium-prism'
      when 14 then 'premium-gold'
      when 22 then 'premium-void'
      when 28 then 'premium-singularity'
      else null
    end;

    if p_tier = 30 then
      v_card_id := v_grands[1 + floor(random() * array_length(v_grands, 1))::int];
      v_reward := jsonb_build_object('kind','grand_card','card_id',v_card_id);
    elsif v_frame_id is not null then
      v_reward := jsonb_build_object('kind','profile_frame','frame_id',v_frame_id);
    elsif p_tier % 9 = 0 then
      v_card_id := v_common_uncommon[1 + floor(random() * array_length(v_common_uncommon, 1))::int];
      v_reward := jsonb_build_object('kind','random_card','card_id',v_card_id);
    elsif p_tier % 5 = 0 then
      v_flux := 1;
      v_reward := jsonb_build_object('kind','flux','amount',v_flux);
    else
      v_shards := case when p_tier % 10 = 0 then 140 when p_tier % 4 = 0 then 100 else 60 end;
      v_reward := jsonb_build_object('kind','shards','amount',v_shards);
    end if;
  end if;

  if v_shards > 0 or v_flux > 0 then
    insert into public.game_state (user_id, shards, flux, updated_at)
      values (v_uid, v_shards, v_flux, now())
      on conflict (user_id) do update
        set shards = coalesce(game_state.shards,0) + excluded.shards,
            flux = coalesce(game_state.flux,0) + excluded.flux,
            updated_at = now();
  end if;

  if v_frame_id is not null then
    insert into public.game_state (user_id, owned_profile_frames, updated_at)
      values (v_uid, array['basic', v_frame_id]::text[], now())
      on conflict (user_id) do update
        set owned_profile_frames = case
              when v_frame_id = any(coalesce(game_state.owned_profile_frames, array['basic']::text[]))
                then coalesce(game_state.owned_profile_frames, array['basic']::text[])
              else array_append(coalesce(game_state.owned_profile_frames, array['basic']::text[]), v_frame_id)
            end,
            updated_at = now();
  end if;

  if v_card_id is not null then
    insert into public.cards_owned (user_id, card_id, qty, acquired_at)
      values (v_uid, v_card_id, 1, now())
      on conflict (user_id, card_id) do update
        set qty = cards_owned.qty + 1,
            acquired_at = now();
  end if;

  if p_track = 'free' then
    update public.battle_pass
      set claimed_free = array_append(coalesce(claimed_free, '{}'::int[]), p_tier)
      where user_id = v_uid and season = v_season.season;
  else
    update public.battle_pass
      set claimed_premium = array_append(coalesce(claimed_premium, '{}'::int[]), p_tier)
      where user_id = v_uid and season = v_season.season;
  end if;

  return jsonb_build_object('ok', true, 'reward', v_reward, 'tier', p_tier, 'track', p_track);
end $$;

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
        or coalesce(new.welcome_pack_claimed, false) <> false
        or coalesce(new.selected_avatar, 'protocol-seed') <> 'protocol-seed'
        or coalesce(new.selected_profile_frame, 'basic') <> 'basic'
        or coalesce(new.owned_avatars, array['protocol-seed']::text[]) <> array['protocol-seed']::text[]
        or coalesce(new.owned_profile_frames, array['basic']::text[]) <> array['basic']::text[]
        or coalesce(new.abandon_streak, 0) <> 0
        or new.lockout_until is not null
        or coalesce(new.reward_penalty_games, 0) <> 0
        or coalesce(new.reward_penalty_mult, 1) <> 1
        or coalesce(new.elo_penalty_mult, 1) <> 1 then
        raise exception 'protected_game_state_write';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.shards is distinct from old.shards
        or new.flux is distinct from old.flux
        or new.shs is distinct from old.shs
        or new.elo is distinct from old.elo
        or new.xp is distinct from old.xp
        or new.level is distinct from old.level
        or new.welcome_pack_claimed is distinct from old.welcome_pack_claimed
        or new.selected_avatar is distinct from old.selected_avatar
        or new.selected_profile_frame is distinct from old.selected_profile_frame
        or new.owned_avatars is distinct from old.owned_avatars
        or new.owned_profile_frames is distinct from old.owned_profile_frames
        or new.abandon_streak is distinct from old.abandon_streak
        or new.lockout_until is distinct from old.lockout_until
        or new.reward_penalty_games is distinct from old.reward_penalty_games
        or new.reward_penalty_mult is distinct from old.reward_penalty_mult
        or new.elo_penalty_mult is distinct from old.elo_penalty_mult then
        raise exception 'protected_game_state_write';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.set_profile_cosmetic(text, text) from public, anon;
revoke all on function public.purchase_profile_avatar(text) from public, anon;
revoke all on function public.claim_battle_pass(integer, text) from public, anon;
grant execute on function public.set_profile_cosmetic(text, text) to authenticated;
grant execute on function public.purchase_profile_avatar(text) to authenticated;
grant execute on function public.claim_battle_pass(integer, text) to authenticated;
