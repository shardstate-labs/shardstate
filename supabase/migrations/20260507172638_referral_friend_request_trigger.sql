-- Ensure referred accounts automatically send a friend request to their sponsor.
-- Covers OAuth/profile flows even if the browser-side RPC is interrupted.

create or replace function public.create_referral_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referred_name text;
begin
  if new.referred_by is null or new.referred_by = new.user_id then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.referred_by is not distinct from new.referred_by then
    return new;
  end if;

  if exists (
    select 1
    from public.friendships
    where user_a = least(new.user_id, new.referred_by)
      and user_b = greatest(new.user_id, new.referred_by)
  ) then
    return new;
  end if;

  select username
    into referred_name
  from public.profiles
  where user_id = new.user_id;

  insert into public.friend_requests(sender_uid, receiver_uid, status, updated_at)
  values (new.user_id, new.referred_by, 'pending', now())
  on conflict (sender_uid, receiver_uid) do update
    set status = 'pending',
        updated_at = now()
  where public.friend_requests.status in ('declined', 'cancelled');

  insert into public.user_notifications(user_id, kind, title, body, payload)
  select
    new.referred_by,
    'friend_request',
    'Nueva solicitud de amistad',
    coalesce(referred_name, 'Tu referido') || ' quiere agregarte.',
    jsonb_build_object(
      'from_user_id', new.user_id,
      'from_username', referred_name,
      'source', 'referral'
    )
  where exists (
    select 1
    from public.friend_requests
    where sender_uid = new.user_id
      and receiver_uid = new.referred_by
      and status = 'pending'
      and updated_at >= now() - interval '5 seconds'
  );

  return new;
end;
$$;

drop trigger if exists profiles_referral_friend_request_trg on public.profiles;
create trigger profiles_referral_friend_request_trg
after insert or update of referred_by on public.profiles
for each row
execute function public.create_referral_friend_request();
