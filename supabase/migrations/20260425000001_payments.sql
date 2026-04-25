-- Phase 4 — Payments scaffold (provider-agnostic, Polar-first)
-- Tables: purchases (audit log), entitlements (granted perks)
-- RPCs: grant_flux (used by Edge Function with service_role)
--
-- Frontend reads its own rows via RLS. INSERT/UPDATE only via SECURITY DEFINER
-- functions or service_role from the polar-webhook Edge Function.

create table if not exists public.purchases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider     text not null check (provider in ('polar','stripe','mp')),
  provider_id  text not null,
  product_id   text not null,
  amount_cents int  not null,
  currency     text not null default 'USD',
  status       text not null check (status in ('pending','paid','refunded','failed')),
  raw          jsonb,
  created_at   timestamptz default now(),
  paid_at      timestamptz,
  unique (provider, provider_id)
);

create index if not exists purchases_user_id_idx on public.purchases (user_id, created_at desc);

create table if not exists public.entitlements (
  user_id          uuid not null references auth.users(id) on delete cascade,
  kind             text not null,
  value_int        int  not null default 0,
  granted_at       timestamptz default now(),
  expires_at       timestamptz,
  source_purchase  uuid references public.purchases(id) on delete set null,
  primary key (user_id, kind, source_purchase)
);

alter table public.purchases    enable row level security;
alter table public.entitlements enable row level security;

drop policy if exists "user_reads_own_purchases"    on public.purchases;
drop policy if exists "user_reads_own_entitlements" on public.entitlements;

create policy "user_reads_own_purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "user_reads_own_entitlements"
  on public.entitlements for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE policies intentionally absent: only service_role (Edge Function) writes.

-- ── grant_flux: increment FLUX balance for the given user. ─────────
-- Called by the polar-webhook Edge Function with service_role; bypass RLS via SECURITY DEFINER.
create or replace function public.grant_flux(p_uid uuid, p_amount int)
returns void language plpgsql security definer as $$
begin
  if p_amount is null or p_amount <= 0 then return; end if;
  update public.game_state
    set flux       = coalesce(flux, 0) + p_amount,
        updated_at = now()
    where user_id = p_uid;
  -- If the user has no game_state row yet, create one with the granted FLUX.
  if not found then
    insert into public.game_state (user_id, flux, updated_at)
      values (p_uid, p_amount, now())
      on conflict (user_id) do update
        set flux = coalesce(public.game_state.flux, 0) + excluded.flux,
            updated_at = now();
  end if;
end $$;

revoke all on function public.grant_flux(uuid, int) from public;
grant execute on function public.grant_flux(uuid, int) to service_role;

-- ── grant_bp_premium: flag premium pass for a user. ────────────────
create or replace function public.grant_bp_premium(p_uid uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.battle_pass (user_id, is_premium, updated_at)
    values (p_uid, true, now())
    on conflict (user_id) do update
      set is_premium = true, updated_at = now();
end $$;

revoke all on function public.grant_bp_premium(uuid) from public;
grant execute on function public.grant_bp_premium(uuid) to service_role;
