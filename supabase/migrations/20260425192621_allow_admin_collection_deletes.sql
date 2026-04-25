-- Keep the collection wipe guard for players, but allow admin reset/delete RPCs.

create or replace function public.prevent_collection_wipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_count integer;
begin
  if public.is_shardstate_admin() then
    return old;
  end if;

  select count(*)
    into remaining_count
  from public.cards_owned
  where user_id = old.user_id
    and card_id <> old.card_id;

  if remaining_count < 8 then
    raise exception 'collection_minimum_required'
      using hint = 'Deleting this card would leave the account with fewer than 8 owned cards.';
  end if;

  return old;
end;
$$;
