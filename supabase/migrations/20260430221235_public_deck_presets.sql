create table if not exists public.public_deck_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 32),
  card_ids text[] not null check (array_length(card_ids, 1) = 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.public_deck_presets enable row level security;

drop policy if exists public_deck_presets_read_all on public.public_deck_presets;
create policy public_deck_presets_read_all
on public.public_deck_presets for select
using (true);

drop policy if exists public_deck_presets_owner_all on public.public_deck_presets;
create policy public_deck_presets_owner_all
on public.public_deck_presets for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.publish_deck_preset(p_name text, p_card_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_name, 'Preset')), 32);
  v_row public.public_deck_presets%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_name = '' then raise exception 'invalid_name'; end if;
  if p_card_ids is null or array_length(p_card_ids, 1) <> 8 then raise exception 'deck_must_have_8_cards'; end if;

  insert into public.public_deck_presets(user_id, name, card_ids, updated_at)
  values (v_uid, v_name, p_card_ids, now())
  on conflict (user_id, name) do update
    set card_ids = excluded.card_ids,
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'name', v_row.name);
end;
$function$;

create or replace function public.list_public_deck_presets()
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'name', d.name,
    'card_ids', d.card_ids,
    'user_id', d.user_id,
    'author', coalesce(p.display_name, p.username, 'player'),
    'updated_at', d.updated_at
  ) order by d.updated_at desc), '[]'::jsonb)
  from public.public_deck_presets d
  left join public.profiles p on p.user_id = d.user_id;
$function$;

grant execute on function public.publish_deck_preset(text, text[]) to authenticated;
grant execute on function public.list_public_deck_presets() to authenticated;
