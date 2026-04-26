-- Admin-only custom card publishing surface.

create table if not exists public.custom_cards (
  id text primary key,
  data jsonb not null,
  is_published boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.custom_cards enable row level security;

drop policy if exists custom_cards_read_published_or_admin on public.custom_cards;
create policy custom_cards_read_published_or_admin
on public.custom_cards for select
to authenticated, anon
using (is_published = true or public.is_shardstate_admin());

drop policy if exists custom_cards_admin_insert on public.custom_cards;
create policy custom_cards_admin_insert
on public.custom_cards for insert
to authenticated
with check (public.is_shardstate_admin());

drop policy if exists custom_cards_admin_update on public.custom_cards;
create policy custom_cards_admin_update
on public.custom_cards for update
to authenticated
using (public.is_shardstate_admin())
with check (public.is_shardstate_admin());

drop policy if exists custom_cards_admin_delete on public.custom_cards;
create policy custom_cards_admin_delete
on public.custom_cards for delete
to authenticated
using (public.is_shardstate_admin());
