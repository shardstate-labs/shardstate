-- Abandon policy:
-- - Abandon/surrender is recorded as a loss for the leaver and a win for the rival.
-- - Two consecutive abandons trigger a 5-minute PvP lockout.
-- - The leaver then receives reduced positive rewards for the next 5 completed battles.

alter table public.game_state
  add column if not exists reward_penalty_games integer not null default 0;

create or replace function public.finalize_battle(
  p_mode text,
  p_result text,
  p_opponent_name text default null::text,
  p_rounds jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_shards_d integer := 0;
  v_xp_d integer := 0;
  v_elo_d integer := 0;
  v_card_xp_d integer := 0;
  v_card_ids text[];
  v_card_xp jsonb := '[]'::jsonb;
  v_battle_id uuid;
  v_gs public.game_state%rowtype;
  v_now timestamptz := now();
  v_lockout timestamptz;
  v_penalty_games_before integer := 0;
  v_reward_penalty_applied boolean := false;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_result not in ('win','loss','draw','abandon') then raise exception 'invalid result: %', p_result; end if;
  if p_mode not in ('training','casual','ranked','onchain') then raise exception 'invalid mode: %', p_mode; end if;

  if p_mode = 'training' then
    v_shards_d := 0; v_xp_d := 5; v_elo_d := 0; v_card_xp_d := case when p_result = 'abandon' then 0 when p_result = 'win' then 4 else 2 end;
  elsif p_mode = 'casual' then
    if p_result = 'win' then v_shards_d := 10; v_xp_d := 20; v_elo_d := 0; v_card_xp_d := 12;
    elsif p_result = 'loss' then v_shards_d := 2; v_xp_d := 5; v_elo_d := 0; v_card_xp_d := 6;
    elsif p_result = 'draw' then v_shards_d := 4; v_xp_d := 8; v_elo_d := 0; v_card_xp_d := 8;
    else v_shards_d := 0; v_xp_d := 0; v_elo_d := 0; v_card_xp_d := 0; end if;
  elsif p_mode = 'ranked' then
    if p_result = 'win' then v_shards_d := 15; v_xp_d := 25; v_elo_d := 20; v_card_xp_d := 16;
    elsif p_result = 'loss' then v_shards_d := 5; v_xp_d := 10; v_elo_d := -15; v_card_xp_d := 8;
    elsif p_result = 'draw' then v_shards_d := 7; v_xp_d := 12; v_elo_d := 0; v_card_xp_d := 10;
    else v_shards_d := 0; v_xp_d := 0; v_elo_d := -25; v_card_xp_d := 0; end if;
  else
    if p_result = 'win' then v_shards_d := 25; v_xp_d := 35; v_elo_d := 25; v_card_xp_d := 20;
    elsif p_result = 'loss' then v_shards_d := 8; v_xp_d := 12; v_elo_d := -20; v_card_xp_d := 10;
    elsif p_result = 'draw' then v_shards_d := 10; v_xp_d := 15; v_elo_d := 0; v_card_xp_d := 12;
    else v_shards_d := 0; v_xp_d := 0; v_elo_d := -30; v_card_xp_d := 0; end if;
  end if;

  select * into v_gs from public.game_state where user_id = v_uid for update;
  if not found then insert into public.game_state(user_id) values (v_uid) returning * into v_gs; end if;

  v_penalty_games_before := greatest(0, coalesce(v_gs.reward_penalty_games, 0));

  if p_result = 'abandon' then
    v_gs.abandon_streak := coalesce(v_gs.abandon_streak, 0) + 1;
    v_gs.last_abandon_at := v_now;
    if v_gs.abandon_streak >= 2 then
      v_lockout := v_now + interval '5 minutes';
      v_gs.lockout_until := v_lockout;
      v_gs.reward_penalty_games := greatest(v_penalty_games_before, 5);
    end if;
    v_elo_d := v_elo_d * coalesce(v_gs.elo_penalty_mult, 1);
  else
    v_gs.abandon_streak := 0;
    if v_penalty_games_before > 0 then
      v_reward_penalty_applied := true;
      v_shards_d := case when v_shards_d > 0 then greatest(1, floor(v_shards_d * 0.5)::integer) else v_shards_d end;
      v_xp_d := case when v_xp_d > 0 then greatest(1, floor(v_xp_d * 0.5)::integer) else v_xp_d end;
      v_card_xp_d := case when v_card_xp_d > 0 then greatest(1, floor(v_card_xp_d * 0.5)::integer) else v_card_xp_d end;
      v_gs.reward_penalty_games := greatest(0, v_penalty_games_before - 1);
    end if;
  end if;

  v_gs.shards := greatest(0, coalesce(v_gs.shards,0) + v_shards_d);
  v_gs.xp := greatest(0, coalesce(v_gs.xp,0) + v_xp_d);
  v_gs.elo := greatest(0, coalesce(v_gs.elo,0) + v_elo_d);
  v_gs.level := greatest(1, 1 + (v_gs.xp / 100));
  v_gs.updated_at := v_now;

  update public.game_state set
    shards = v_gs.shards,
    xp = v_gs.xp,
    elo = v_gs.elo,
    level = v_gs.level,
    abandon_streak = v_gs.abandon_streak,
    last_abandon_at = v_gs.last_abandon_at,
    lockout_until = v_gs.lockout_until,
    reward_penalty_games = v_gs.reward_penalty_games,
    updated_at = v_now
  where user_id = v_uid;

  insert into public.battles(user_id, mode, result, shards_delta, elo_delta, xp_gain, opponent_name, rounds)
  values (v_uid, p_mode, p_result, v_shards_d, v_elo_d, v_xp_d, p_opponent_name, p_rounds)
  returning id into v_battle_id;

  update public.battle_pass set xp = greatest(0, coalesce(xp,0) + v_xp_d) where user_id = v_uid;

  if v_card_xp_d > 0 and jsonb_typeof(p_rounds) = 'array' then
    select array_agg(card_id) into v_card_ids from (
      select elem->'p'->>'cardId' as card_id from jsonb_array_elements(p_rounds) elem
      union all
      select elem->>'cardId' as card_id from jsonb_array_elements(p_rounds) elem
    ) cards where card_id is not null and length(card_id) > 0;
    if coalesce(array_length(v_card_ids, 1), 0) > 0 then v_card_xp := public.award_card_xp(v_card_ids, v_card_xp_d); end if;
  end if;

  if p_result = 'win' then
    insert into public.missions_progress(user_id, mission_id, progress) values (v_uid, 'win_any', 1)
    on conflict (user_id, mission_id) do update set progress = public.missions_progress.progress + 1;
  end if;
  insert into public.missions_progress(user_id, mission_id, progress) values (v_uid, 'play_any', 1)
  on conflict (user_id, mission_id) do update set progress = public.missions_progress.progress + 1;

  return jsonb_build_object(
    'battle_id', v_battle_id,
    'shards_delta', v_shards_d,
    'xp_delta', v_xp_d,
    'elo_delta', v_elo_d,
    'card_xp_delta', v_card_xp_d,
    'card_xp', v_card_xp,
    'shards', v_gs.shards,
    'xp', v_gs.xp,
    'elo', v_gs.elo,
    'level', v_gs.level,
    'lockout_until', v_gs.lockout_until,
    'abandon_streak', v_gs.abandon_streak,
    'reward_penalty_games', v_gs.reward_penalty_games,
    'reward_penalty_applied', v_reward_penalty_applied
  );
end;
$function$;

create or replace function public.find_or_join_match(p_mode text, p_deck text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_my_elo integer;
  v_lockout_until timestamptz;
  v_other public.match_queue%rowtype;
  v_match_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_mode not in ('casual','ranked','onchain') then raise exception 'invalid mode'; end if;
  if p_deck is null or array_length(p_deck,1) <> 8 then raise exception 'deck must contain 8 cards'; end if;

  select coalesce(elo,0), lockout_until
    into v_my_elo, v_lockout_until
  from public.game_state
  where user_id = v_uid;
  if v_my_elo is null then v_my_elo := 0; end if;
  if v_lockout_until is not null and v_lockout_until > now() then
    raise exception 'abandon lockout active until %', v_lockout_until;
  end if;

  select id into v_match_id from public.matches
   where (p1_user_id = v_uid or p2_user_id = v_uid)
     and status = 'active'
   limit 1;
  if v_match_id is not null then
    return jsonb_build_object('match_id', v_match_id, 'queued', false, 'rejoin', true);
  end if;

  delete from public.match_queue where expires_at < now();

  select * into v_other
    from public.match_queue
   where mode = p_mode and user_id <> v_uid
   order by abs(elo_at_queue - v_my_elo) asc, queued_at asc
   limit 1
   for update skip locked;

  if found then
    delete from public.match_queue where user_id = v_other.user_id;
    insert into public.matches(mode, p1_user_id, p2_user_id, p1_deck, p2_deck)
    values (p_mode, v_other.user_id, v_uid, v_other.deck_ids, p_deck)
    returning id into v_match_id;
    return jsonb_build_object(
      'match_id', v_match_id,
      'queued', false,
      'side', 'p2',
      'opponent_id', v_other.user_id,
      'opponent_deck', v_other.deck_ids
    );
  end if;

  insert into public.match_queue(user_id, mode, deck_ids, elo_at_queue)
  values (v_uid, p_mode, p_deck, v_my_elo)
  on conflict (user_id) do update
    set mode = excluded.mode,
        deck_ids = excluded.deck_ids,
        elo_at_queue = excluded.elo_at_queue,
        queued_at = now(),
        expires_at = now() + interval '2 minutes';
  return jsonb_build_object('queued', true);
end;
$function$;

grant execute on function public.finalize_battle(text, text, text, jsonb) to authenticated;
grant execute on function public.find_or_join_match(text, text[]) to authenticated;

drop function if exists public.finalize_pvp_match(uuid, uuid, jsonb);

create or replace function public.finalize_pvp_match(
  p_match_id uuid,
  p_winner_uid uuid,
  p_rounds jsonb default '[]'::jsonb,
  p_reason text default 'end'
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

  if p_reason in ('abandon','surrender','pagehide') and v_winner_uid is not null and v_winner_uid <> v_uid then
    v_result := 'abandon';
  elsif v_winner_uid is null then
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

grant execute on function public.finalize_pvp_match(uuid, uuid, jsonb, text) to authenticated;
