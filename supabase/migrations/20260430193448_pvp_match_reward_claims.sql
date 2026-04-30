-- PvP matches are finalized by whichever participant observes the end first.
-- Keep a per-player claim ledger so the other participant can still reconcile
-- rewards after the match row has already moved to finished, without double
-- paying on reloads or duplicate realtime events.

create table if not exists public.pvp_match_reward_claims (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  result text not null check (result in ('win','loss','draw','abandon')),
  reward jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.pvp_match_reward_claims enable row level security;

create or replace function public.finalize_pvp_match(
  p_match_id uuid,
  p_winner_uid uuid,
  p_rounds jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_winner_uid uuid;
  v_result text;
  v_opponent uuid;
  v_reward jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if v_uid not in (v_match.p1_user_id, v_match.p2_user_id) then
    raise exception 'not a participant';
  end if;
  if p_winner_uid is not null and p_winner_uid not in (v_match.p1_user_id, v_match.p2_user_id) then
    raise exception 'invalid winner';
  end if;

  v_winner_uid := coalesce(p_winner_uid, v_match.winner_user_id);

  if v_match.status = 'active' then
    update public.matches
    set status = 'finished',
        winner_user_id = p_winner_uid,
        finished_at = now()
    where id = p_match_id;
    v_winner_uid := p_winner_uid;
  end if;

  if v_winner_uid is null then
    v_result := 'draw';
  elsif v_winner_uid = v_uid then
    v_result := 'win';
  else
    v_result := 'loss';
  end if;

  select reward into v_reward
  from public.pvp_match_reward_claims
  where match_id = p_match_id
    and user_id = v_uid;

  if found then
    return v_reward
      || jsonb_build_object(
        'already_claimed', true,
        'finished', true,
        'winner', v_winner_uid,
        'result', v_result
      );
  end if;

  v_opponent := case
    when v_uid = v_match.p1_user_id then v_match.p2_user_id
    else v_match.p1_user_id
  end;

  v_reward := public.finalize_battle(
    v_match.mode,
    v_result,
    '@' || v_opponent::text,
    p_rounds
  );

  insert into public.pvp_match_reward_claims(match_id, user_id, result, reward)
  values (p_match_id, v_uid, v_result, v_reward);

  return v_reward
    || jsonb_build_object(
      'finished', true,
      'winner', v_winner_uid,
      'result', v_result
    );
end;
$function$;

grant execute on function public.finalize_pvp_match(uuid, uuid, jsonb) to authenticated;
