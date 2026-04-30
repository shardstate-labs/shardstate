-- Keep guild member lists stable: leaders first, then subleaders when present,
-- then members by join order.

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
        'members', coalesce((
          select jsonb_agg(
            public.profile_card(x.user_id) || jsonb_build_object('role', x.role, 'joined_at', x.joined_at)
            order by
              case x.role when 'leader' then 0 when 'subleader' then 1 else 2 end,
              x.joined_at asc
          )
          from public.guild_members x
          where x.guild_id = g.id
        ), '[]'::jsonb),
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

revoke all on function public.load_guild_state(text) from public;
grant execute on function public.load_guild_state(text) to authenticated;
