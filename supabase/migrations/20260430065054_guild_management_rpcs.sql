-- Guild lifecycle management:
-- - members can leave
-- - leaders can kick members
-- - leaders can disband the guild
-- If the leader leaves without disbanding, leadership passes to the oldest
-- remaining member.

create or replace function public.leave_guild()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guild uuid;
  v_role text;
  v_next_uid uuid;
begin
  if v_uid is null then
    return jsonb_build_object('error','not_authenticated');
  end if;

  select guild_id, role
    into v_guild, v_role
    from public.guild_members
   where user_id = v_uid
   limit 1;

  if v_guild is null then
    return jsonb_build_object('error','not_in_guild');
  end if;

  if v_role = 'leader' then
    select user_id
      into v_next_uid
      from public.guild_members
     where guild_id = v_guild
       and user_id <> v_uid
     order by joined_at asc
     limit 1;

    if v_next_uid is null then
      delete from public.guilds where id = v_guild and leader_uid = v_uid;
      return jsonb_build_object('ok', true, 'action', 'disbanded', 'guild_id', v_guild);
    end if;

    update public.guilds
       set leader_uid = v_next_uid, updated_at = now()
     where id = v_guild
       and leader_uid = v_uid;

    update public.guild_members
       set role = 'leader'
     where guild_id = v_guild
       and user_id = v_next_uid;
  end if;

  delete from public.guild_members
   where guild_id = v_guild
     and user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'action', case when v_role = 'leader' then 'left_promoted' else 'left' end,
    'guild_id', v_guild,
    'new_leader_uid', v_next_uid
  );
end;
$$;

create or replace function public.kick_guild_member(p_user uuid)
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
  if v_uid is null then
    return jsonb_build_object('error','not_authenticated');
  end if;
  if p_user is null then
    return jsonb_build_object('error','invalid_member');
  end if;
  if p_user = v_uid then
    return jsonb_build_object('error','cannot_kick_self');
  end if;

  select guild_id
    into v_guild
    from public.guild_members
   where user_id = v_uid
     and role = 'leader'
   limit 1;

  if v_guild is null then
    return jsonb_build_object('error','leader_required');
  end if;

  select role
    into v_target_role
    from public.guild_members
   where guild_id = v_guild
     and user_id = p_user;

  if v_target_role is null then
    return jsonb_build_object('error','member_not_found');
  end if;
  if v_target_role = 'leader' then
    return jsonb_build_object('error','cannot_kick_leader');
  end if;

  delete from public.guild_members
   where guild_id = v_guild
     and user_id = p_user;

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    p_user,
    'guild',
    'Has sido expulsado del gremio',
    'El lider te removio del gremio.',
    jsonb_build_object('guild_id', v_guild)
  )
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'guild_id', v_guild, 'removed_user_id', p_user);
end;
$$;

create or replace function public.disband_guild()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guild uuid;
begin
  if v_uid is null then
    return jsonb_build_object('error','not_authenticated');
  end if;

  select guild_id
    into v_guild
    from public.guild_members
   where user_id = v_uid
     and role = 'leader'
   limit 1;

  if v_guild is null then
    return jsonb_build_object('error','leader_required');
  end if;

  delete from public.guilds
   where id = v_guild
     and leader_uid = v_uid;

  return jsonb_build_object('ok', true, 'guild_id', v_guild, 'action', 'disbanded');
end;
$$;

revoke all on function public.leave_guild() from public;
revoke all on function public.leave_guild() from anon;
revoke all on function public.kick_guild_member(uuid) from public;
revoke all on function public.kick_guild_member(uuid) from anon;
revoke all on function public.disband_guild() from public;
revoke all on function public.disband_guild() from anon;

grant execute on function public.leave_guild() to authenticated;
grant execute on function public.kick_guild_member(uuid) to authenticated;
grant execute on function public.disband_guild() to authenticated;
