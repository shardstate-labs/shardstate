-- Guild management and fixed battle-pass season timing.

alter table public.guild_members drop constraint if exists guild_members_role_check;
alter table public.guild_members
  add constraint guild_members_role_check
  check (role in ('leader','subleader','member'));

drop policy if exists guild_applications_relevant_read on public.guild_applications;
create policy guild_applications_relevant_read
on public.guild_applications
for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.guild_members gm
    where gm.guild_id = guild_applications.guild_id
      and gm.user_id = auth.uid()
      and gm.role in ('leader','subleader')
  )
);

create or replace function public.update_guild(
  p_name text,
  p_bio text default '',
  p_emoji text default '',
  p_icon_url text default '',
  p_country text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guild uuid;
  v_emoji text := left(btrim(coalesce(p_emoji,'G')), 8);
  v_icon_url text := nullif(btrim(coalesce(p_icon_url,'')), '');
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;
  if char_length(btrim(coalesce(p_name,''))) < 3 then return jsonb_build_object('error','invalid_guild_name'); end if;
  if v_icon_url is not null and v_icon_url !~* '^https://.*\.(png|jpg|jpeg|webp|gif)(\?.*)?$' then
    return jsonb_build_object('error','invalid_icon_url');
  end if;

  select guild_id into v_guild
  from public.guild_members
  where user_id = v_uid and role = 'leader'
  limit 1;

  if v_guild is null then return jsonb_build_object('error','leader_required'); end if;

  update public.guilds
  set name = left(btrim(p_name), 32),
      bio = left(btrim(coalesce(p_bio,'')), 240),
      emoji = coalesce(nullif(v_emoji,''), 'G'),
      icon_url = v_icon_url,
      country = left(btrim(coalesce(p_country,'')), 48),
      updated_at = now()
  where id = v_guild;

  return jsonb_build_object('ok', true, 'guild_id', v_guild);
end;
$$;

create or replace function public.set_guild_member_role(p_user uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guild uuid;
  v_target_role text;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;
  if p_user is null or p_user = v_uid then return jsonb_build_object('error','invalid_member'); end if;
  if p_role not in ('member','subleader') then return jsonb_build_object('error','invalid_role'); end if;

  select guild_id into v_guild
  from public.guild_members
  where user_id = v_uid and role = 'leader'
  limit 1;

  if v_guild is null then return jsonb_build_object('error','leader_required'); end if;

  select role into v_target_role
  from public.guild_members
  where guild_id = v_guild and user_id = p_user;

  if v_target_role is null then return jsonb_build_object('error','member_not_found'); end if;
  if v_target_role = 'leader' then return jsonb_build_object('error','cannot_change_leader'); end if;

  update public.guild_members
  set role = p_role
  where guild_id = v_guild and user_id = p_user;

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    p_user,
    'guild',
    'Rango de gremio actualizado',
    case when p_role = 'subleader' then 'Ahora sos sublider del gremio.' else 'Ahora sos integrante del gremio.' end,
    jsonb_build_object('guild_id', v_guild, 'role', p_role)
  );

  return jsonb_build_object('ok', true, 'guild_id', v_guild, 'user_id', p_user, 'role', p_role);
end;
$$;

create or replace function public.transfer_guild_leadership(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guild uuid;
  v_target_role text;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;
  if p_user is null or p_user = v_uid then return jsonb_build_object('error','invalid_member'); end if;

  select guild_id into v_guild
  from public.guild_members
  where user_id = v_uid and role = 'leader'
  limit 1;

  if v_guild is null then return jsonb_build_object('error','leader_required'); end if;

  select role into v_target_role
  from public.guild_members
  where guild_id = v_guild and user_id = p_user;

  if v_target_role is null then return jsonb_build_object('error','member_not_found'); end if;

  update public.guilds
  set leader_uid = p_user, updated_at = now()
  where id = v_guild;

  update public.guild_members
  set role = case when user_id = p_user then 'leader' when user_id = v_uid then 'subleader' else role end
  where guild_id = v_guild and user_id in (v_uid, p_user);

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    p_user,
    'guild',
    'Liderazgo transferido',
    'Ahora sos lider del gremio.',
    jsonb_build_object('guild_id', v_guild, 'role', 'leader')
  );

  return jsonb_build_object('ok', true, 'guild_id', v_guild, 'leader_uid', p_user);
end;
$$;

create or replace function public.respond_guild_application(p_application uuid, p_accept boolean, p_response text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  app record;
begin
  select ga.* into app
  from public.guild_applications ga
  join public.guild_members gm on gm.guild_id = ga.guild_id and gm.user_id = auth.uid() and gm.role in ('leader','subleader')
  where ga.id = p_application and ga.status = 'pending';
  if not found then raise exception 'application_not_found'; end if;

  update public.guild_applications
  set status = case when p_accept then 'accepted' else 'rejected' end,
      response = left(btrim(coalesce(p_response,'')), 240),
      updated_at = now()
  where id = p_application;

  if p_accept then
    insert into public.guild_members(guild_id, user_id, role)
    values (app.guild_id, app.user_id, 'member')
    on conflict (user_id) do nothing;
  end if;

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    app.user_id,
    'guild',
    case when p_accept then 'Solicitud de gremio aceptada' else 'Solicitud de gremio rechazada' end,
    coalesce(nullif(left(btrim(coalesce(p_response,'')), 240), ''), case when p_accept then 'Tu solicitud fue aceptada.' else 'Tu solicitud fue rechazada.' end),
    jsonb_build_object('guild_id', app.guild_id, 'application_id', app.id, 'accepted', p_accept)
  )
  on conflict do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.load_guild_state(p_query text default '')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select gm.guild_id, gm.role
    from public.guild_members gm
    where gm.user_id = auth.uid()
    limit 1
  )
  select jsonb_build_object(
    'my_guild', (
      select jsonb_build_object(
        'id', g.id, 'name', g.name, 'bio', g.bio, 'emoji', g.emoji, 'icon_url', g.icon_url, 'country', g.country, 'leader_uid', g.leader_uid, 'role', gm.role,
        'members', coalesce((
          select jsonb_agg(
            public.profile_card(x.user_id) || jsonb_build_object('role', x.role, 'joined_at', x.joined_at)
            order by case x.role when 'leader' then 0 when 'subleader' then 1 else 2 end, x.joined_at asc
          )
          from public.guild_members x
          where x.guild_id = g.id
        ), '[]'::jsonb),
        'applications', case when gm.role in ('leader','subleader') then coalesce((
          select jsonb_agg(jsonb_build_object('id', ga.id, 'message', ga.message, 'user', public.profile_card(ga.user_id), 'created_at', ga.created_at) order by ga.created_at asc)
          from public.guild_applications ga
          where ga.guild_id = g.id and ga.status = 'pending'
        ), '[]'::jsonb) else '[]'::jsonb end
      )
      from public.guild_members gm
      join public.guilds g on g.id = gm.guild_id
      where gm.user_id = auth.uid()
      limit 1
    ),
    'my_applications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ga.id,
        'guild_id', g.id,
        'guild_name', g.name,
        'message', ga.message,
        'response', ga.response,
        'status', ga.status,
        'updated_at', ga.updated_at
      ) order by ga.updated_at desc)
      from public.guild_applications ga
      join public.guilds g on g.id = ga.guild_id
      where ga.user_id = auth.uid()
        and ga.status in ('pending','accepted','rejected')
    ), '[]'::jsonb),
    'guilds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'bio', g.bio, 'emoji', g.emoji, 'icon_url', g.icon_url, 'country', g.country, 'leader_uid', g.leader_uid,
        'members_count', (select count(*) from public.guild_members gm where gm.guild_id = g.id),
        'leader', public.profile_card(g.leader_uid),
        'requested', exists(select 1 from public.guild_applications ga where ga.guild_id = g.id and ga.user_id = auth.uid() and ga.status = 'pending')
      ) order by g.created_at desc)
      from public.guilds g
      where (coalesce(p_query,'') = '' or g.name ilike '%' || p_query || '%')
        and not exists (select 1 from mine where mine.guild_id = g.id)
    ), '[]'::jsonb)
  )
$$;

create table if not exists public.battle_pass_seasons (
  season integer primary key,
  title text not null default 'Season',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.battle_pass_seasons enable row level security;

drop policy if exists battle_pass_seasons_read on public.battle_pass_seasons;
create policy battle_pass_seasons_read
on public.battle_pass_seasons
for select to authenticated
using (true);

insert into public.battle_pass_seasons(season, title, starts_at, ends_at, is_active)
values (1, 'Genesis Pass', '2026-05-01 00:00:00+00', '2026-05-31 00:00:00+00', true)
on conflict (season) do update
  set title = excluded.title,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      is_active = excluded.is_active,
      updated_at = now();

update public.battle_pass
set started_at = (select starts_at from public.battle_pass_seasons where season = public.battle_pass.season),
    season = coalesce(season, 1)
where exists (select 1 from public.battle_pass_seasons s where s.season = public.battle_pass.season);

create or replace function public.current_battle_pass_season()
returns public.battle_pass_seasons
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.battle_pass_seasons
  where is_active
  order by starts_at desc
  limit 1
$$;

create or replace function public.get_battle_pass_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_season public.battle_pass_seasons%rowtype;
  v_bp public.battle_pass%rowtype;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_season from public.current_battle_pass_season();
  if v_season.season is null then return jsonb_build_object('error','season_not_configured'); end if;

  insert into public.battle_pass(user_id, season, xp, is_premium, claimed_free, claimed_premium, started_at)
  values (v_uid, v_season.season, 0, false, '{}'::int[], '{}'::int[], v_season.starts_at)
  on conflict (user_id, season) do nothing;

  select * into v_bp
  from public.battle_pass
  where user_id = v_uid and season = v_season.season;

  return to_jsonb(v_bp) || jsonb_build_object(
    'season_title', v_season.title,
    'season_starts_at', v_season.starts_at,
    'season_ends_at', v_season.ends_at
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
    v_shards := case when p_tier = 30 then 150 when p_tier % 9 = 0 then 90 else 60 end;
    v_reward := jsonb_build_object('kind','shards','amount',v_shards);
  else
    if p_tier = 30 then
      v_card_id := v_grands[1 + floor(random() * array_length(v_grands, 1))::int];
      v_reward := jsonb_build_object('kind','grand_card','card_id',v_card_id);
    elsif p_tier % 9 = 0 then
      v_card_id := v_common_uncommon[1 + floor(random() * array_length(v_common_uncommon, 1))::int];
      v_reward := jsonb_build_object('kind','random_card','card_id',v_card_id);
    elsif p_tier % 5 = 0 then
      v_flux := 1;
      v_reward := jsonb_build_object('kind','flux','amount',v_flux);
    else
      v_shards := case when p_tier % 10 = 0 then 250 when p_tier % 4 = 0 then 200 else 100 end;
      v_reward := jsonb_build_object('kind','shards','amount',v_shards);
    end if;
  end if;

  if v_shards > 0 or v_flux > 0 then
    insert into game_state (user_id, shards, flux, updated_at)
      values (v_uid, v_shards, v_flux, now())
      on conflict (user_id) do update
        set shards = coalesce(game_state.shards,0) + excluded.shards,
            flux = coalesce(game_state.flux,0) + excluded.flux,
            updated_at = now();
  end if;

  if v_card_id is not null then
    insert into cards_owned (user_id, card_id, qty, acquired_at)
      values (v_uid, v_card_id, 1, now())
      on conflict (user_id, card_id) do update
        set qty = cards_owned.qty + 1,
            acquired_at = now();
  end if;

  if p_track = 'free' then
    update battle_pass
      set claimed_free = array_append(coalesce(claimed_free, '{}'::int[]), p_tier)
      where user_id = v_uid and season = v_season.season;
  else
    update battle_pass
      set claimed_premium = array_append(coalesce(claimed_premium, '{}'::int[]), p_tier)
      where user_id = v_uid and season = v_season.season;
  end if;

  return jsonb_build_object('ok', true, 'reward', v_reward, 'tier', p_tier, 'track', p_track);
end $$;

create or replace function public.buy_battle_pass_with_flux()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_season public.battle_pass_seasons%rowtype;
  v_flux int;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_season from public.current_battle_pass_season();
  if v_season.season is null then return jsonb_build_object('error','season_not_configured'); end if;

  insert into public.game_state (user_id, flux, updated_at)
    values (v_uid, 0, now())
    on conflict (user_id) do nothing;

  select coalesce(flux, 0) into v_flux
    from public.game_state
    where user_id = v_uid
    for update;

  if exists (select 1 from public.battle_pass where user_id = v_uid and season = v_season.season and coalesce(is_premium,false)) then
    return jsonb_build_object('error','already_premium');
  end if;

  if coalesce(v_flux, 0) < 20 then
    return jsonb_build_object('error','not_enough_flux','required',20,'flux',coalesce(v_flux,0));
  end if;

  update public.game_state
    set flux = coalesce(flux, 0) - 20,
        updated_at = now()
    where user_id = v_uid
    returning flux into v_flux;

  insert into public.battle_pass (user_id, season, xp, is_premium, claimed_free, claimed_premium, started_at)
    values (v_uid, v_season.season, 0, true, '{}'::int[], '{}'::int[], v_season.starts_at)
    on conflict (user_id, season) do update
      set is_premium = true;

  return jsonb_build_object('ok',true,'flux',v_flux,'premium',true);
end $$;

create or replace function public.grant_bp_premium(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.battle_pass_seasons%rowtype;
begin
  select * into v_season from public.current_battle_pass_season();
  if v_season.season is null then return; end if;

  insert into public.battle_pass (user_id, season, xp, is_premium, claimed_free, claimed_premium, started_at)
    values (p_uid, v_season.season, 0, true, '{}'::int[], '{}'::int[], v_season.starts_at)
    on conflict (user_id, season) do update
      set is_premium = true;
end;
$$;

revoke all on function public.update_guild(text, text, text, text, text) from public;
revoke all on function public.set_guild_member_role(uuid, text) from public;
revoke all on function public.transfer_guild_leadership(uuid) from public;
revoke all on function public.respond_guild_application(uuid, boolean, text) from public;
revoke all on function public.load_guild_state(text) from public;
revoke all on function public.current_battle_pass_season() from public;
revoke all on function public.get_battle_pass_state() from public;
revoke all on function public.claim_battle_pass(integer, text) from public;
revoke all on function public.buy_battle_pass_with_flux() from public;
revoke all on function public.grant_bp_premium(uuid) from public;

grant execute on function public.update_guild(text, text, text, text, text) to authenticated;
grant execute on function public.set_guild_member_role(uuid, text) to authenticated;
grant execute on function public.transfer_guild_leadership(uuid) to authenticated;
grant execute on function public.respond_guild_application(uuid, boolean, text) to authenticated;
grant execute on function public.load_guild_state(text) to authenticated;
grant execute on function public.current_battle_pass_season() to authenticated;
grant execute on function public.get_battle_pass_state() to authenticated;
grant execute on function public.claim_battle_pass(integer, text) to authenticated;
grant execute on function public.buy_battle_pass_with_flux() to authenticated;
grant execute on function public.grant_bp_premium(uuid) to service_role;
