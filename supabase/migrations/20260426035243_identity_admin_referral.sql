-- Identity hardening: normalized usernames, second admin email, and referral bonus ledger.

create or replace function public.is_shardstate_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email','')) in (
    'faxie.contact@gmail.com',
    'shardstate.game@gmail.com'
  )
$$;

-- Normalize existing usernames before enforcing case-insensitive uniqueness.
with ranked as (
  select
    user_id,
    row_number() over (
      partition by lower(btrim(username))
      order by created_at nulls last, user_id
    ) as rn
  from public.profiles
  where username is not null and btrim(username) <> ''
)
update public.profiles p
set username = lower(left(regexp_replace(p.username, '[^a-zA-Z0-9_]', '', 'g'), 11)) || '_' || left(p.user_id::text, 4),
    updated_at = now()
from ranked r
where p.user_id = r.user_id
  and r.rn > 1;

update public.profiles
set username = lower(left(regexp_replace(btrim(username), '[^a-zA-Z0-9_]', '', 'g'), 16)),
    updated_at = now()
where username is not null
  and username <> lower(left(regexp_replace(btrim(username), '[^a-zA-Z0-9_]', '', 'g'), 16));

create unique index if not exists profiles_username_lower_uidx
on public.profiles (lower(username))
where username is not null and btrim(username) <> '';

alter table public.profiles
  drop constraint if exists profiles_username_format_chk;

alter table public.profiles
  add constraint profiles_username_format_chk
  check (username is null or username ~ '^[a-z0-9_]{3,16}$');

alter table public.profiles
  add column if not exists referred_by uuid references auth.users(id) on delete set null,
  add column if not exists referral_code text,
  add column if not exists referral_flux_paid boolean not null default false;

create unique index if not exists profiles_referral_code_uidx
on public.profiles (referral_code)
where referral_code is not null and referral_code <> '';

create table if not exists public.referral_rewards (
  sponsor_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid,
  flux_amount integer not null default 1,
  granted_at timestamptz not null default now(),
  primary key (sponsor_user_id, referred_user_id)
);

alter table public.referral_rewards enable row level security;

drop policy if exists referral_rewards_self_read on public.referral_rewards;
create policy referral_rewards_self_read
on public.referral_rewards for select
to authenticated
using (auth.uid() = sponsor_user_id or auth.uid() = referred_user_id);

create or replace function public.grant_referral_flux_once(
  p_referred_uid uuid,
  p_purchase_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sponsor uuid;
begin
  select referred_by
    into v_sponsor
  from public.profiles
  where user_id = p_referred_uid
    and coalesce(referral_flux_paid, false) = false;

  if v_sponsor is null or v_sponsor = p_referred_uid then
    return false;
  end if;

  insert into public.referral_rewards(sponsor_user_id, referred_user_id, purchase_id, flux_amount)
  values (v_sponsor, p_referred_uid, p_purchase_id, 1)
  on conflict do nothing;

  if not found then
    update public.profiles set referral_flux_paid = true, updated_at = now()
    where user_id = p_referred_uid;
    return false;
  end if;

  update public.game_state
  set flux = coalesce(flux, 0) + 1,
      updated_at = now()
  where user_id = v_sponsor;

  if not found then
    insert into public.game_state(user_id, flux, updated_at)
    values (v_sponsor, 1, now())
    on conflict (user_id) do update
      set flux = coalesce(public.game_state.flux, 0) + 1,
          updated_at = now();
  end if;

  update public.profiles
  set referral_flux_paid = true,
      updated_at = now()
  where user_id = p_referred_uid;

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    v_sponsor,
    'referral_reward',
    'Bonus de referido',
    'Tu referido compró FLUX. Recibiste +1 FLUX.',
    jsonb_build_object('referred_user_id', p_referred_uid, 'flux', 1)
  );

  return true;
end;
$$;

grant execute on function public.is_shardstate_admin() to authenticated;
revoke all on function public.grant_referral_flux_once(uuid, uuid) from public;
grant execute on function public.grant_referral_flux_once(uuid, uuid) to service_role;
