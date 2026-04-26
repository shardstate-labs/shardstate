-- Server-authoritative social graph, direct messages, and guilds.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_uid uuid not null references auth.users(id) on delete cascade,
  receiver_uid uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_uid, receiver_uid)
);

create table if not exists public.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_uid uuid not null references auth.users(id) on delete cascade,
  receiver_uid uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 800),
  gif_url text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text generated always as (lower(btrim(name))) stored,
  bio text,
  icon_url text,
  emoji text,
  country text,
  leader_uid uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name_key)
);

create table if not exists public.guild_members (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('leader','member')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id),
  unique (user_id)
);

create table if not exists public.guild_applications (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text,
  response text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, user_id)
);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.direct_messages enable row level security;
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_applications enable row level security;

drop policy if exists friend_requests_participant_read on public.friend_requests;
create policy friend_requests_participant_read on public.friend_requests
for select to authenticated
using (auth.uid() in (sender_uid, receiver_uid));

drop policy if exists friendships_self_read on public.friendships;
create policy friendships_self_read on public.friendships
for select to authenticated
using (auth.uid() in (user_a, user_b));

drop policy if exists direct_messages_participant_read on public.direct_messages;
create policy direct_messages_participant_read on public.direct_messages
for select to authenticated
using (auth.uid() in (sender_uid, receiver_uid));

drop policy if exists guilds_public_read on public.guilds;
create policy guilds_public_read on public.guilds
for select to authenticated
using (true);

drop policy if exists guild_members_public_read on public.guild_members;
create policy guild_members_public_read on public.guild_members
for select to authenticated
using (true);

drop policy if exists guild_applications_relevant_read on public.guild_applications;
create policy guild_applications_relevant_read on public.guild_applications
for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.guild_members gm
    where gm.guild_id = guild_applications.guild_id
      and gm.user_id = auth.uid()
      and gm.role = 'leader'
  )
);

create or replace function public.profile_card(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', p_uid,
    'username', coalesce(p.username, 'player'),
    'avatar_url', p.avatar_url,
    'level', coalesce(gs.level, 1),
    'xp', coalesce(gs.xp, 0),
    'elo', coalesce(gs.elo, 0),
    'cards_count', coalesce((select count(*) from public.cards_owned co where co.user_id = p_uid), 0),
    'presets_count', coalesce((select count(*) from public.decks d where d.user_id = p_uid and not d.is_active), 0),
    'deck', coalesce((select to_jsonb(d.card_ids) from public.decks d where d.user_id = p_uid and d.is_active order by d.updated_at desc limit 1), '[]'::jsonb),
    'guild', (
      select jsonb_build_object('id', g.id, 'name', g.name, 'emoji', g.emoji, 'icon_url', g.icon_url, 'country', g.country, 'role', gm.role)
      from public.guild_members gm join public.guilds g on g.id = gm.guild_id
      where gm.user_id = p_uid
      limit 1
    )
  )
  from public.profiles p
  left join public.game_state gs on gs.user_id = p.user_id
  where p.user_id = p_uid
$$;

create or replace function public.search_profiles(p_query text)
returns table(user_id uuid, username text, avatar_url text, level integer, elo integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.username, p.avatar_url, coalesce(gs.level,1), coalesce(gs.elo,0)
  from public.profiles p
  left join public.game_state gs on gs.user_id = p.user_id
  where p.user_id <> auth.uid()
    and p.username ilike '%' || coalesce(p_query,'') || '%'
  order by p.username asc
  limit 12
$$;

create or replace function public.send_friend_request(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_target = auth.uid() then raise exception 'self_request'; end if;
  if exists (
    select 1 from public.friendships
    where (user_a = least(auth.uid(), p_target) and user_b = greatest(auth.uid(), p_target))
  ) then raise exception 'already_friends'; end if;
  if exists (
    select 1 from public.friend_requests
    where sender_uid = p_target and receiver_uid = auth.uid() and status = 'pending'
  ) then raise exception 'incoming_request_exists'; end if;

  insert into public.friend_requests(sender_uid, receiver_uid, status, updated_at)
  values (auth.uid(), p_target, 'pending', now())
  on conflict (sender_uid, receiver_uid) do update
    set status = 'pending', updated_at = now()
  where public.friend_requests.status in ('declined','cancelled');

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select * into r from public.friend_requests
  where id = p_request_id and receiver_uid = auth.uid() and status = 'pending';
  if not found then raise exception 'request_not_found'; end if;

  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      updated_at = now()
  where id = p_request_id;

  if p_accept then
    insert into public.friendships(user_a, user_b)
    values (least(r.sender_uid, r.receiver_uid), greatest(r.sender_uid, r.receiver_uid))
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_friend(p_friend uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships
  where user_a = least(auth.uid(), p_friend)
    and user_b = greatest(auth.uid(), p_friend);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.load_social_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(public.profile_card(case when f.user_a = auth.uid() then f.user_b else f.user_a end))
      from public.friendships f
      where auth.uid() in (f.user_a, f.user_b)
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', fr.id, 'from', public.profile_card(fr.sender_uid), 'created_at', fr.created_at) order by fr.created_at desc)
      from public.friend_requests fr
      where fr.receiver_uid = auth.uid() and fr.status = 'pending'
    ), '[]'::jsonb),
    'sent', coalesce((
      select jsonb_agg(jsonb_build_object('id', fr.id, 'to', public.profile_card(fr.receiver_uid), 'created_at', fr.created_at) order by fr.created_at desc)
      from public.friend_requests fr
      where fr.sender_uid = auth.uid() and fr.status = 'pending'
    ), '[]'::jsonb)
  )
$$;

create or replace function public.load_dm_thread(p_friend uuid)
returns setof public.direct_messages
language sql
security definer
set search_path = public
as $$
  select *
  from public.direct_messages
  where (sender_uid = auth.uid() and receiver_uid = p_friend)
     or (sender_uid = p_friend and receiver_uid = auth.uid())
  order by created_at desc
  limit 80
$$;

create or replace function public.send_dm(p_friend uuid, p_body text, p_gif_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.friendships
    where user_a = least(auth.uid(), p_friend)
      and user_b = greatest(auth.uid(), p_friend)
  ) then raise exception 'not_friends'; end if;

  if nullif(btrim(coalesce(p_gif_url,'')), '') is not null
     and btrim(p_gif_url) !~* '^https://(media[0-9]*\.giphy\.com|i\.giphy\.com|giphy\.com|media\.tenor\.com|.*\.(gif|webp|png|jpg|jpeg)(\?.*)?)' then
    raise exception 'invalid_gif_url';
  end if;

  insert into public.direct_messages(sender_uid, receiver_uid, body, gif_url)
  values (
    auth.uid(),
    p_friend,
    coalesce(nullif(left(btrim(coalesce(p_body,'')), 800), ''), '[GIF]'),
    nullif(btrim(coalesce(p_gif_url,'')), '')
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.create_guild(p_name text, p_bio text, p_emoji text, p_icon_url text, p_country text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(btrim(coalesce(p_name,''))) < 3 then raise exception 'invalid_guild_name'; end if;
  if nullif(btrim(coalesce(p_icon_url,'')), '') is not null
     and btrim(p_icon_url) !~* '^https://.*\.(png|jpg|jpeg|webp|gif)(\?.*)?$' then
    raise exception 'invalid_icon_url';
  end if;
  if exists (select 1 from public.guild_members where user_id = auth.uid()) then raise exception 'already_in_guild'; end if;

  update public.game_state
  set flux = flux - 2, updated_at = now()
  where user_id = auth.uid() and flux >= 2;
  if not found then raise exception 'not_enough_flux'; end if;

  insert into public.guilds(name, bio, emoji, icon_url, country, leader_uid)
  values (left(btrim(p_name), 32), left(btrim(coalesce(p_bio,'')), 240), left(btrim(coalesce(p_emoji,'◆')), 8), nullif(btrim(coalesce(p_icon_url,'')), ''), left(btrim(coalesce(p_country,'')), 48), auth.uid())
  returning id into gid;

  insert into public.guild_members(guild_id, user_id, role)
  values (gid, auth.uid(), 'leader');

  return jsonb_build_object('ok', true, 'guild_id', gid);
end;
$$;

create or replace function public.apply_guild(p_guild uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.guild_members where user_id = auth.uid()) then raise exception 'already_in_guild'; end if;
  insert into public.guild_applications(guild_id, user_id, message, status, updated_at)
  values (p_guild, auth.uid(), left(btrim(coalesce(p_message,'')), 240), 'pending', now())
  on conflict (guild_id, user_id) do update
    set message = excluded.message, status = 'pending', updated_at = now()
  where public.guild_applications.status in ('rejected','cancelled');
  return jsonb_build_object('ok', true);
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
  join public.guild_members gm on gm.guild_id = ga.guild_id and gm.user_id = auth.uid() and gm.role = 'leader'
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
  select jsonb_build_object(
    'my_guild', (
      select jsonb_build_object(
        'id', g.id, 'name', g.name, 'bio', g.bio, 'emoji', g.emoji, 'icon_url', g.icon_url, 'country', g.country, 'leader_uid', g.leader_uid, 'role', gm.role,
        'members', coalesce((select jsonb_agg(public.profile_card(x.user_id) || jsonb_build_object('role', x.role) order by x.role desc, x.joined_at asc) from public.guild_members x where x.guild_id = g.id), '[]'::jsonb),
        'applications', coalesce((select jsonb_agg(jsonb_build_object('id', ga.id, 'message', ga.message, 'user', public.profile_card(ga.user_id), 'created_at', ga.created_at) order by ga.created_at asc) from public.guild_applications ga where ga.guild_id = g.id and ga.status = 'pending'), '[]'::jsonb)
      )
      from public.guild_members gm join public.guilds g on g.id = gm.guild_id
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
        and ga.status in ('pending','rejected')
    ), '[]'::jsonb),
    'guilds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'bio', g.bio, 'emoji', g.emoji, 'icon_url', g.icon_url, 'country', g.country, 'leader_uid', g.leader_uid,
        'members_count', (select count(*) from public.guild_members gm where gm.guild_id = g.id),
        'leader', public.profile_card(g.leader_uid),
        'requested', exists(select 1 from public.guild_applications ga where ga.guild_id = g.id and ga.user_id = auth.uid() and ga.status = 'pending')
      ) order by g.created_at desc)
      from public.guilds g
      where coalesce(p_query,'') = '' or g.name ilike '%' || p_query || '%'
    ), '[]'::jsonb)
  )
$$;

grant execute on function public.profile_card(uuid) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.load_social_state() to authenticated;
grant execute on function public.load_dm_thread(uuid) to authenticated;
grant execute on function public.send_dm(uuid, text, text) to authenticated;
grant execute on function public.create_guild(text, text, text, text, text) to authenticated;
grant execute on function public.apply_guild(uuid, text) to authenticated;
grant execute on function public.respond_guild_application(uuid, boolean, text) to authenticated;
grant execute on function public.load_guild_state(text) to authenticated;
