-- Per-copy deck slots and market listings.

alter table public.decks
  add column if not exists card_instance_ids uuid[];

alter table public.market_listings
  add column if not exists card_instance_id uuid references public.card_instances(id) on delete set null;

create index if not exists market_listings_card_instance_idx
  on public.market_listings(card_instance_id);

create or replace function public.sync_card_instances_from_owned()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_existing integer;
  v_missing integer;
  v_extra integer;
begin
  if tg_op = 'DELETE' then
    delete from public.card_instances
     where user_id = old.user_id
       and card_id = old.card_id
       and locked = false;
    return old;
  end if;

  select count(*) into v_existing
    from public.card_instances
   where user_id = new.user_id
     and card_id = new.card_id;

  v_missing := greatest(0, coalesce(new.qty, 0) - coalesce(v_existing, 0));
  if v_missing > 0 then
    insert into public.card_instances(user_id, card_id, source, acquired_at, updated_at)
    select new.user_id, new.card_id, 'aggregate_sync', coalesce(new.acquired_at, now()), now()
      from generate_series(1, v_missing);
  end if;

  v_extra := greatest(0, coalesce(v_existing, 0) - greatest(coalesce(new.qty, 0), 0));
  if v_extra > 0 then
    delete from public.card_instances ci
     using (
       select id
         from public.card_instances
        where user_id = new.user_id
          and card_id = new.card_id
          and locked = false
        order by level asc, xp asc, acquired_at desc
        limit v_extra
     ) doomed
     where ci.id = doomed.id;
  end if;

  return new;
end $$;

create or replace function public.load_my_card_instances()
returns table (
  id uuid,
  card_id text,
  level integer,
  xp integer,
  locked boolean,
  source text,
  acquired_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  select ci.id, ci.card_id, ci.level, ci.xp, ci.locked, ci.source, ci.acquired_at, ci.updated_at
    from public.card_instances ci
   where ci.user_id = auth.uid()
     and ci.locked = false
   order by ci.acquired_at asc, ci.card_id asc;
$$;

revoke all on function public.load_my_card_instances() from public;
grant execute on function public.load_my_card_instances() to authenticated;

create or replace function public.list_card_instance_for_sale(p_card_instance_id uuid, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_inst public.card_instances%rowtype;
  v_qty int;
  v_total_after int;
  v_in_active_deck bool;
  v_listing_id uuid;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;
  if p_price <= 0 or p_price > 1000000 then return jsonb_build_object('error','invalid_price'); end if;

  select * into v_inst
    from public.card_instances
   where id = p_card_instance_id
   for update;

  if not found or v_inst.user_id <> v_uid or coalesce(v_inst.locked,false) then
    return jsonb_build_object('error','not_owned');
  end if;

  select exists(
    select 1 from public.decks d
     where d.user_id = v_uid
       and d.is_active = true
       and p_card_instance_id = any(coalesce(d.card_instance_ids, '{}'::uuid[]))
  ) into v_in_active_deck;
  if v_in_active_deck then return jsonb_build_object('error','in_active_deck'); end if;

  select coalesce(sum(qty),0) into v_total_after from public.cards_owned where user_id = v_uid;
  if v_total_after - 1 < 8 then return jsonb_build_object('error','minimum_collection_required'); end if;

  select qty into v_qty
    from public.cards_owned
   where user_id = v_uid
     and card_id = v_inst.card_id
   for update;
  if coalesce(v_qty,0) < 1 then return jsonb_build_object('error','not_owned'); end if;

  update public.card_instances
     set locked = true,
         updated_at = now()
   where id = p_card_instance_id;

  update public.cards_owned
     set qty = greatest(0, qty - 1)
   where user_id = v_uid
     and card_id = v_inst.card_id;

  insert into public.market_listings (seller_uid, card_id, card_instance_id, price)
  values (v_uid, v_inst.card_id, p_card_instance_id, p_price)
  returning id into v_listing_id;

  return jsonb_build_object('ok',true,'listing_id',v_listing_id,'card_id',v_inst.card_id,'card_instance_id',p_card_instance_id);
end $$;

revoke all on function public.list_card_instance_for_sale(uuid, integer) from public;
grant execute on function public.list_card_instance_for_sale(uuid, integer) to authenticated;

create or replace function public.list_card_for_sale(p_card_id text, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_instance_id uuid;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;

  select ci.id into v_instance_id
    from public.card_instances ci
   where ci.user_id = v_uid
     and ci.card_id = p_card_id
     and ci.locked = false
     and not exists (
       select 1 from public.decks d
        where d.user_id = v_uid
          and d.is_active = true
          and ci.id = any(coalesce(d.card_instance_ids, '{}'::uuid[]))
     )
   order by ci.level asc, ci.xp asc, ci.acquired_at asc
   limit 1;

  if v_instance_id is null then
    return jsonb_build_object('error','not_owned');
  end if;

  return public.list_card_instance_for_sale(v_instance_id, p_price);
end $$;

revoke all on function public.list_card_for_sale(text, integer) from public;
grant execute on function public.list_card_for_sale(text, integer) to authenticated;

create or replace function public.buy_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_listing record;
  v_buyer_shards int;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_listing
    from public.market_listings
   where id = p_listing_id
   for update;

  if not found then return jsonb_build_object('error','listing_not_found'); end if;
  if v_listing.status <> 'active' then return jsonb_build_object('error','not_available'); end if;
  if v_listing.seller_uid = v_uid then return jsonb_build_object('error','cannot_buy_own'); end if;

  select shards into v_buyer_shards
    from public.game_state
   where user_id = v_uid
   for update;
  if coalesce(v_buyer_shards,0) < v_listing.price then return jsonb_build_object('error','insufficient_shards'); end if;

  update public.game_state
     set shards = shards - v_listing.price,
         updated_at = now()
   where user_id = v_uid;

  insert into public.game_state (user_id, shards, updated_at)
  values (v_listing.seller_uid, v_listing.price, now())
  on conflict (user_id) do update
     set shards = coalesce(game_state.shards,0) + v_listing.price,
         updated_at = now();

  if v_listing.card_instance_id is not null then
    update public.card_instances
       set user_id = v_uid,
           locked = false,
           updated_at = now()
     where id = v_listing.card_instance_id;
  end if;

  insert into public.cards_owned (user_id, card_id, qty)
  values (v_uid, v_listing.card_id, 1)
  on conflict (user_id, card_id) do update
     set qty = cards_owned.qty + 1;

  update public.market_listings
     set status = 'sold',
         buyer_uid = v_uid,
         closed_at = now()
   where id = p_listing_id;

  return jsonb_build_object('ok',true,'card_id',v_listing.card_id,'card_instance_id',v_listing.card_instance_id);
end $$;

revoke all on function public.buy_listing(uuid) from public;
grant execute on function public.buy_listing(uuid) to authenticated;

create or replace function public.delist_card(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_listing record;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_listing
    from public.market_listings
   where id = p_listing_id
   for update;

  if not found then return jsonb_build_object('error','listing_not_found'); end if;
  if v_listing.seller_uid <> v_uid then return jsonb_build_object('error','not_owner'); end if;
  if v_listing.status <> 'active' then return jsonb_build_object('error','not_active'); end if;

  if v_listing.card_instance_id is not null then
    update public.card_instances
       set locked = false,
           updated_at = now()
     where id = v_listing.card_instance_id
       and user_id = v_uid;
  end if;

  insert into public.cards_owned (user_id, card_id, qty)
  values (v_uid, v_listing.card_id, 1)
  on conflict (user_id, card_id) do update
     set qty = cards_owned.qty + 1;

  update public.market_listings
     set status = 'cancelled',
         closed_at = now()
   where id = p_listing_id;

  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.delist_card(uuid) from public;
grant execute on function public.delist_card(uuid) to authenticated;
