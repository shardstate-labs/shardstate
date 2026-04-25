-- Admin user control, account flags, user notifications and audit log.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.account_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active','paused','blocked','deleted')),
  reason text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'admin_reward',
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
alter table public.account_flags enable row level security;
alter table public.user_notifications enable row level security;

create or replace function public.is_shardstate_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email','')) = 'faxie.contact@gmail.com'
$$;

drop policy if exists admin_read_audit_log on public.admin_audit_log;
create policy admin_read_audit_log
on public.admin_audit_log for select
to authenticated
using (public.is_shardstate_admin());

drop policy if exists account_flags_self_or_admin_read on public.account_flags;
create policy account_flags_self_or_admin_read
on public.account_flags for select
to authenticated
using (auth.uid() = user_id or public.is_shardstate_admin());

drop policy if exists user_notifications_self_read on public.user_notifications;
create policy user_notifications_self_read
on public.user_notifications for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_notifications_self_ack on public.user_notifications;
create policy user_notifications_self_ack
on public.user_notifications for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.log_admin_action(
  p_target_user_id uuid,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_log(admin_user_id, target_user_id, action, details)
  values (auth.uid(), p_target_user_id, p_action, coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public.admin_search_users(p_query text)
returns table(
  user_id uuid,
  email text,
  username text,
  status text,
  cards_count integer,
  deck_count integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_shardstate_admin() then
    raise exception 'admin_only';
  end if;

  return query
  select
    au.id as user_id,
    au.email::text,
    p.username::text,
    coalesce(f.status, 'active')::text as status,
    coalesce(c.cards_count, 0)::integer as cards_count,
    coalesce(d.deck_count, 0)::integer as deck_count
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  left join public.account_flags f on f.user_id = au.id
  left join (
    select user_id, count(*)::integer cards_count
    from public.cards_owned
    group by user_id
  ) c on c.user_id = au.id
  left join (
    select user_id, count(*)::integer deck_count
    from public.decks
    group by user_id
  ) d on d.user_id = au.id
  where coalesce(p_query, '') = ''
    or au.email ilike '%' || p_query || '%'
    or p.username ilike '%' || p_query || '%'
  order by au.created_at desc
  limit 20;
end;
$$;

create or replace function public.admin_get_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_shardstate_admin() then
    raise exception 'admin_only';
  end if;

  select jsonb_build_object(
    'auth', to_jsonb(au) - 'encrypted_password' - 'confirmation_token' - 'recovery_token',
    'profile', coalesce(to_jsonb(p), '{}'::jsonb),
    'game_state', coalesce(to_jsonb(gs), '{}'::jsonb),
    'flag', coalesce(to_jsonb(f), jsonb_build_object('status','active')),
    'cards', coalesce((select jsonb_agg(to_jsonb(co) order by co.card_id) from public.cards_owned co where co.user_id = p_user_id), '[]'::jsonb),
    'decks', coalesce((select jsonb_agg(to_jsonb(de) order by de.is_active desc, de.name) from public.decks de where de.user_id = p_user_id), '[]'::jsonb),
    'recent_actions', coalesce((select jsonb_agg(to_jsonb(al) order by al.created_at desc) from (select * from public.admin_audit_log where target_user_id = p_user_id order by created_at desc limit 20) al), '[]'::jsonb)
  )
  into result
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  left join public.game_state gs on gs.user_id = au.id
  left join public.account_flags f on f.user_id = au.id
  where au.id = p_user_id;

  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.admin_reset_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_shardstate_admin() then
    raise exception 'admin_only';
  end if;

  delete from public.cards_owned where user_id = p_user_id;
  delete from public.decks where user_id = p_user_id;
  delete from public.battle_pass where user_id = p_user_id;
  delete from public.pack_openings where user_id = p_user_id;
  delete from public.battles where user_id = p_user_id;

  insert into public.game_state(user_id, shards, flux, shs, elo, level, xp, welcome_pack_claimed, updated_at)
  values (p_user_id, 0, 0, 0, 0, 1, 0, false, now())
  on conflict (user_id) do update set
    shards = 0,
    flux = 0,
    shs = 0,
    elo = 0,
    level = 1,
    xp = 0,
    welcome_pack_claimed = false,
    updated_at = now();

  insert into public.account_flags(user_id, status, reason, updated_by, updated_at)
  values (p_user_id, 'active', null, auth.uid(), now())
  on conflict (user_id) do update set status = 'active', reason = null, updated_by = auth.uid(), updated_at = now();

  perform public.log_admin_action(p_user_id, 'reset_user', '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_shardstate_admin() then
    raise exception 'admin_only';
  end if;
  if p_status not in ('active','paused','blocked','deleted') then
    raise exception 'invalid_status';
  end if;

  insert into public.account_flags(user_id, status, reason, updated_by, updated_at)
  values (p_user_id, p_status, nullif(p_reason, ''), auth.uid(), now())
  on conflict (user_id) do update set
    status = excluded.status,
    reason = excluded.reason,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  perform public.log_admin_action(p_user_id, 'set_account_status', jsonb_build_object('status', p_status, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

create or replace function public.admin_delete_user_game_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_shardstate_admin() then
    raise exception 'admin_only';
  end if;

  delete from public.cards_owned where user_id = p_user_id;
  delete from public.decks where user_id = p_user_id;
  delete from public.battle_pass where user_id = p_user_id;
  delete from public.pack_openings where user_id = p_user_id;
  delete from public.battles where user_id = p_user_id;
  delete from public.game_state where user_id = p_user_id;
  delete from public.profiles where user_id = p_user_id;

  insert into public.account_flags(user_id, status, reason, updated_by, updated_at)
  values (p_user_id, 'deleted', 'game records deleted by admin', auth.uid(), now())
  on conflict (user_id) do update set
    status = 'deleted',
    reason = excluded.reason,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  perform public.log_admin_action(p_user_id, 'delete_user_game_data', '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_grant_currency(
  p_user_id uuid,
  p_currency text,
  p_amount integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(coalesce(p_currency, ''));
begin
  if not public.is_shardstate_admin() then
    raise exception 'admin_only';
  end if;
  if normalized not in ('shards','flux') or coalesce(p_amount, 0) <= 0 then
    raise exception 'invalid_grant';
  end if;

  insert into public.game_state(user_id, shards, flux, shs, elo, level, xp, welcome_pack_claimed, updated_at)
  values (
    p_user_id,
    case when normalized = 'shards' then p_amount else 0 end,
    case when normalized = 'flux' then p_amount else 0 end,
    0, 0, 1, 0, false, now()
  )
  on conflict (user_id) do update set
    shards = public.game_state.shards + case when normalized = 'shards' then p_amount else 0 end,
    flux = public.game_state.flux + case when normalized = 'flux' then p_amount else 0 end,
    updated_at = now();

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    p_user_id,
    'admin_reward',
    'Recompensa de Admin',
    'El Admin te concedio una recompensa.',
    jsonb_build_object('currency', normalized, 'amount', p_amount, 'note', p_note)
  );

  perform public.log_admin_action(
    p_user_id,
    'grant_currency',
    jsonb_build_object('currency', normalized, 'amount', p_amount, 'note', p_note)
  );

  return jsonb_build_object('ok', true, 'currency', normalized, 'amount', p_amount);
end;
$$;

create or replace function public.get_my_account_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select to_jsonb(f) from public.account_flags f where f.user_id = auth.uid()),
    jsonb_build_object('status','active')
  )
$$;

create or replace function public.load_my_notifications()
returns setof public.user_notifications
language sql
security definer
set search_path = public
as $$
  select *
  from public.user_notifications
  where user_id = auth.uid()
    and acknowledged_at is null
  order by created_at asc
  limit 10
$$;

grant execute on function public.is_shardstate_admin() to authenticated;
grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
grant execute on function public.admin_reset_user(uuid) to authenticated;
grant execute on function public.admin_set_account_status(uuid,text,text) to authenticated;
grant execute on function public.admin_delete_user_game_data(uuid) to authenticated;
grant execute on function public.admin_grant_currency(uuid,text,integer,text) to authenticated;
grant execute on function public.get_my_account_status() to authenticated;
grant execute on function public.load_my_notifications() to authenticated;
