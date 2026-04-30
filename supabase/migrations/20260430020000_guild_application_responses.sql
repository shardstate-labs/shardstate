-- Surface guild application responses to applicants and create lightweight
-- notifications when leaders accept/reject requests.

create or replace function public.respond_guild_application(p_application uuid, p_accept boolean, p_response text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  app record;
  guild_name text;
  responder_name text;
  final_status text;
begin
  select ga.*, g.name as guild_name into app
  from public.guild_applications ga
  join public.guilds g on g.id = ga.guild_id
  join public.guild_members gm on gm.guild_id = ga.guild_id and gm.user_id = auth.uid() and gm.role = 'leader'
  where ga.id = p_application and ga.status = 'pending';
  if not found then raise exception 'application_not_found'; end if;

  final_status := case when p_accept then 'accepted' else 'rejected' end;
  guild_name := coalesce(app.guild_name, 'Guild');
  select username into responder_name from public.profiles where user_id = auth.uid();

  update public.guild_applications
  set status = final_status,
      response = left(btrim(coalesce(p_response,'')), 240),
      updated_at = now()
  where id = p_application;

  if p_accept then
    insert into public.guild_members(guild_id, user_id, role)
    values (app.guild_id, app.user_id, 'member')
    on conflict (user_id) do nothing;
  end if;

  insert into public.user_notifications(user_id, kind, title, body, payload)
  values (
    app.user_id,
    'guild_application',
    case when p_accept then 'Solicitud de gremio aceptada' else 'Solicitud de gremio rechazada' end,
    guild_name || ': ' || coalesce(nullif(left(btrim(coalesce(p_response,'')), 160), ''), case when p_accept then 'Aceptado' else 'Rechazado' end),
    jsonb_build_object(
      'guild_id', app.guild_id,
      'guild_name', guild_name,
      'status', final_status,
      'response', left(btrim(coalesce(p_response,'')), 240),
      'from_user_id', auth.uid(),
      'from_username', responder_name
    )
  );

  return jsonb_build_object('ok', true, 'status', final_status);
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
        and ga.status in ('pending','accepted','rejected')
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

revoke all on function public.respond_guild_application(uuid, boolean, text) from public;
revoke all on function public.load_guild_state(text) from public;
grant execute on function public.respond_guild_application(uuid, boolean, text) to authenticated;
grant execute on function public.load_guild_state(text) to authenticated;
