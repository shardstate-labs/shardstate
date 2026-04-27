-- Lightweight social notifications for friend requests and DMs.

create or replace function public.send_friend_request(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
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

  select username into sender_name from public.profiles where user_id = auth.uid();

  insert into public.friend_requests(sender_uid, receiver_uid, status, updated_at)
  values (auth.uid(), p_target, 'pending', now())
  on conflict (sender_uid, receiver_uid) do update
    set status = 'pending', updated_at = now()
  where public.friend_requests.status in ('declined','cancelled');

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    p_target,
    'friend_request',
    'Nueva solicitud de amistad',
    coalesce(sender_name, 'Un jugador') || ' quiere agregarte.',
    jsonb_build_object('from_user_id', auth.uid(), 'from_username', sender_name)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.send_dm(p_friend uuid, p_body text, p_gif_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  msg_body text;
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

  msg_body := coalesce(nullif(left(btrim(coalesce(p_body,'')), 800), ''), '[GIF]');
  select username into sender_name from public.profiles where user_id = auth.uid();

  insert into public.direct_messages(sender_uid, receiver_uid, body, gif_url)
  values (
    auth.uid(),
    p_friend,
    msg_body,
    nullif(btrim(coalesce(p_gif_url,'')), '')
  );

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    p_friend,
    'dm',
    coalesce(sender_name, 'Mensaje nuevo'),
    left(msg_body, 120),
    jsonb_build_object('from_user_id', auth.uid(), 'from_username', sender_name)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.send_dm(uuid, text, text) to authenticated;
