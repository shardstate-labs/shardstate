-- Card ownership instances + persistent card XP.
-- cards_owned remains the aggregate compatibility table; card_instances is the
-- per-copy source needed for card XP, evolution, and future per-copy market listings.

create table if not exists public.card_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  level integer not null default 1 check (level between 1 and 5),
  xp integer not null default 0 check (xp >= 0),
  locked boolean not null default false,
  source text,
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_instances_user_idx on public.card_instances(user_id);
create index if not exists card_instances_user_card_idx on public.card_instances(user_id, card_id);

alter table public.card_instances enable row level security;

drop policy if exists "card_instances_select_own" on public.card_instances;
create policy "card_instances_select_own"
  on public.card_instances for select
  using (auth.uid() = user_id);

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
       and card_id = old.card_id;
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

drop trigger if exists trg_sync_card_instances_from_owned on public.cards_owned;
create trigger trg_sync_card_instances_from_owned
after insert or update or delete on public.cards_owned
for each row execute function public.sync_card_instances_from_owned();

insert into public.card_instances(user_id, card_id, source, acquired_at, updated_at)
select co.user_id, co.card_id, 'backfill_cards_owned', co.acquired_at, now()
  from public.cards_owned co
 cross join lateral generate_series(
   1,
   greatest(
     0,
     coalesce(co.qty, 0) - (
       select count(*)
         from public.card_instances ci
        where ci.user_id = co.user_id
          and ci.card_id = co.card_id
     )
   )
 ) gs;

create or replace function public.card_xp_needed(p_level integer)
returns integer
language sql
immutable
as $$
  select case
    when p_level <= 1 then 180
    when p_level = 2 then 420
    when p_level = 3 then 800
    when p_level = 4 then 1400
    else 999999
  end
$$;

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
   order by ci.acquired_at asc, ci.card_id asc;
$$;

revoke all on function public.load_my_card_instances() from public;
grant execute on function public.load_my_card_instances() to authenticated;

create or replace function public.award_card_xp(p_card_ids text[], p_xp integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_card text;
  v_inst public.card_instances%rowtype;
  v_level integer;
  v_xp integer;
  v_need integer;
  v_out jsonb := '[]'::jsonb;
begin
  if v_uid is null or p_xp <= 0 or p_card_ids is null then
    return v_out;
  end if;

  foreach v_card in array p_card_ids loop
    if v_card is null or length(v_card) = 0 then
      continue;
    end if;

    select * into v_inst
      from public.card_instances
     where user_id = v_uid
       and card_id = v_card
     order by level asc, xp asc, acquired_at asc
     limit 1
     for update skip locked;

    if not found then
      continue;
    end if;

    v_level := coalesce(v_inst.level, 1);
    v_xp := coalesce(v_inst.xp, 0) + p_xp;

    while v_level < 5 loop
      v_need := public.card_xp_needed(v_level);
      exit when v_xp < v_need;
      v_xp := v_xp - v_need;
      v_level := v_level + 1;
    end loop;

    update public.card_instances
       set level = v_level,
           xp = case when v_level >= 5 then 0 else v_xp end,
           updated_at = now()
     where id = v_inst.id;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'instance_id', v_inst.id,
      'card_id', v_card,
      'xp_delta', p_xp,
      'level', v_level,
      'xp', case when v_level >= 5 then 0 else v_xp end
    ));
  end loop;

  return v_out;
end $$;

revoke all on function public.award_card_xp(text[], integer) from public;
grant execute on function public.award_card_xp(text[], integer) to authenticated;

create or replace function public.finalize_battle(p_mode text, p_result text, p_opponent_name text default null::text, p_rounds jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid          uuid := auth.uid();
  v_shards_d     integer := 0;
  v_xp_d         integer := 0;
  v_elo_d        integer := 0;
  v_card_xp_d    integer := 0;
  v_card_ids     text[];
  v_card_xp      jsonb := '[]'::jsonb;
  v_battle_id    uuid;
  v_gs           public.game_state%rowtype;
  v_now          timestamptz := now();
  v_lockout      timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_result not in ('win','loss','draw','abandon') then
    raise exception 'invalid result: %', p_result;
  end if;
  if p_mode not in ('training','casual','ranked','onchain') then
    raise exception 'invalid mode: %', p_mode;
  end if;

  if p_mode = 'training' then
    v_shards_d := 0; v_xp_d := 5; v_elo_d := 0;
    v_card_xp_d := case when p_result = 'abandon' then 0 when p_result = 'win' then 4 else 2 end;
  elsif p_mode = 'casual' then
    if    p_result = 'win'     then v_shards_d := 10; v_xp_d := 20; v_elo_d := 0;  v_card_xp_d := 12;
    elsif p_result = 'loss'    then v_shards_d := 2;  v_xp_d := 5;  v_elo_d := 0;  v_card_xp_d := 6;
    elsif p_result = 'draw'    then v_shards_d := 4;  v_xp_d := 8;  v_elo_d := 0;  v_card_xp_d := 8;
    else                            v_shards_d := 0;  v_xp_d := 0;  v_elo_d := 0;  v_card_xp_d := 0;
    end if;
  elsif p_mode = 'ranked' then
    if    p_result = 'win'     then v_shards_d := 15; v_xp_d := 25; v_elo_d := 20;  v_card_xp_d := 16;
    elsif p_result = 'loss'    then v_shards_d := 5;  v_xp_d := 10; v_elo_d := -15; v_card_xp_d := 8;
    elsif p_result = 'draw'    then v_shards_d := 7;  v_xp_d := 12; v_elo_d := 0;   v_card_xp_d := 10;
    else                            v_shards_d := 0;  v_xp_d := 0;  v_elo_d := -25; v_card_xp_d := 0;
    end if;
  else
    if    p_result = 'win'     then v_shards_d := 25; v_xp_d := 35; v_elo_d := 25;  v_card_xp_d := 20;
    elsif p_result = 'loss'    then v_shards_d := 8;  v_xp_d := 12; v_elo_d := -20; v_card_xp_d := 10;
    elsif p_result = 'draw'    then v_shards_d := 10; v_xp_d := 15; v_elo_d := 0;   v_card_xp_d := 12;
    else                            v_shards_d := 0;  v_xp_d := 0;  v_elo_d := -30; v_card_xp_d := 0;
    end if;
  end if;

  select * into v_gs from public.game_state where user_id = v_uid for update;
  if not found then
    insert into public.game_state(user_id) values (v_uid)
    returning * into v_gs;
  end if;

  if p_result = 'abandon' then
    v_gs.abandon_streak  := coalesce(v_gs.abandon_streak,0) + 1;
    v_gs.last_abandon_at := v_now;
    if v_gs.abandon_streak >= 3 then
      v_lockout := v_now + interval '10 minutes';
      v_gs.lockout_until := v_lockout;
    end if;
    v_elo_d := v_elo_d * coalesce(v_gs.elo_penalty_mult, 1);
  else
    v_gs.abandon_streak := 0;
  end if;

  v_gs.shards := greatest(0, coalesce(v_gs.shards,0) + v_shards_d);
  v_gs.xp     := greatest(0, coalesce(v_gs.xp,0)     + v_xp_d);
  v_gs.elo    := greatest(0, coalesce(v_gs.elo,0)    + v_elo_d);
  v_gs.level  := greatest(1, 1 + (v_gs.xp / 100));
  v_gs.updated_at := v_now;

  update public.game_state set
    shards = v_gs.shards,
    xp     = v_gs.xp,
    elo    = v_gs.elo,
    level  = v_gs.level,
    abandon_streak = v_gs.abandon_streak,
    last_abandon_at = v_gs.last_abandon_at,
    lockout_until = v_gs.lockout_until,
    updated_at = v_now
  where user_id = v_uid;

  insert into public.battles(user_id, mode, result, shards_delta, elo_delta, xp_gain, opponent_name, rounds)
  values (v_uid, p_mode, p_result, v_shards_d, v_elo_d, v_xp_d, p_opponent_name, p_rounds)
  returning id into v_battle_id;

  update public.battle_pass
     set xp = greatest(0, coalesce(xp,0) + v_xp_d)
   where user_id = v_uid;

  if v_card_xp_d > 0 and jsonb_typeof(p_rounds) = 'array' then
    select array_agg(card_id) into v_card_ids
      from (
        select elem->'p'->>'cardId' as card_id
          from jsonb_array_elements(p_rounds) elem
        union all
        select elem->>'cardId' as card_id
          from jsonb_array_elements(p_rounds) elem
      ) cards
     where card_id is not null and length(card_id) > 0;

    if coalesce(array_length(v_card_ids, 1), 0) > 0 then
      v_card_xp := public.award_card_xp(v_card_ids, v_card_xp_d);
    end if;
  end if;

  if p_result = 'win' then
    insert into public.missions_progress(user_id, mission_id, progress)
    values (v_uid, 'win_any', 1)
    on conflict (user_id, mission_id)
    do update set progress = public.missions_progress.progress + 1;
  end if;
  insert into public.missions_progress(user_id, mission_id, progress)
  values (v_uid, 'play_any', 1)
  on conflict (user_id, mission_id)
  do update set progress = public.missions_progress.progress + 1;

  return jsonb_build_object(
    'battle_id',    v_battle_id,
    'shards_delta', v_shards_d,
    'xp_delta',     v_xp_d,
    'elo_delta',    v_elo_d,
    'card_xp_delta', v_card_xp_d,
    'card_xp',      v_card_xp,
    'shards',       v_gs.shards,
    'xp',           v_gs.xp,
    'elo',          v_gs.elo,
    'level',        v_gs.level,
    'lockout_until', v_gs.lockout_until,
    'abandon_streak', v_gs.abandon_streak
  );
end $$;

revoke all on function public.finalize_battle(text, text, text, jsonb) from public;
grant execute on function public.finalize_battle(text, text, text, jsonb) to authenticated;

create or replace function public.claim_battle_pass(p_tier integer, p_track text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_bp record;
  v_xp_per_tier int := 200;
  v_required_xp int;
  v_already_claimed bool;
  v_reward jsonb;
  v_shards int := 0;
  v_flux int := 0;
  v_card_id text := null;
  v_common_uncommon text[] := array[
    'skrell','nyx','denza','patch','krex','lyrae','shrae','drix','calyx','brine','tessara','undrek','coa','drifta','pelagia','swell','korai','ignar','vestara','pyrex','comb','flare','char','smolder','soot','pyress','void','kernel','raze','blk','patch_exe','erase','override','vex0','malware','valdric','seraphine','auris','caela','renaud','isolde','bertrand','duval','celestine','myc','rhizo','luxen','bract','molder','sprika','verdex','ferma','hyphae','skar','druun','vael','mox','wrekk','thurak','grael','braxa','dravox','axiom','tessla','vren','lira','drix7','arka','syntex','caliber','praxis','chrono','loopex','deja','rift','warp','echon','stasis','phase','paradox','mirage','spectr','kaen','fader','cipher_s','wraith','trace','whisper','shade','haze','chromex','riff','spark','beat','strobo','verse','echo_p','resonant','marshal','decree','axiarch','legate','praetor','edikt','tribunal','sentinel_x','mandate'
  ];
  v_grands text[] := array[
    'grand_raijin','grand_ryujin','grand_kagutsuchi','grand_yamiyo','grand_inari','grand_konohana','grand_hachiman','grand_omoikane','grand_tsukuyomi','grand_yurei','grand_benzaiten','grand_susanoo'
  ];
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;
  if p_track not in ('free','premium') then return jsonb_build_object('error','invalid_track'); end if;
  if p_tier < 1 or p_tier > 30 then return jsonb_build_object('error','invalid_tier'); end if;

  v_required_xp := p_tier * v_xp_per_tier;

  select * into v_bp from battle_pass where user_id = v_uid;
  if not found then
    insert into battle_pass (user_id, season, xp, is_premium, claimed_free, claimed_premium, started_at)
      values (v_uid, 1, 0, false, '{}'::int[], '{}'::int[], now())
      returning * into v_bp;
  end if;

  if coalesce(v_bp.xp, 0) < v_required_xp then
    return jsonb_build_object('error','not_enough_xp');
  end if;

  if p_track = 'free' then
    v_already_claimed := p_tier = any(coalesce(v_bp.claimed_free, '{}'::int[]));
  else
    if not coalesce(v_bp.is_premium, false) then return jsonb_build_object('error','not_premium'); end if;
    v_already_claimed := p_tier = any(coalesce(v_bp.claimed_premium, '{}'::int[]));
  end if;
  if v_already_claimed then return jsonb_build_object('error','already_claimed'); end if;

  if p_track = 'free' then
    if p_tier % 3 <> 0 then return jsonb_build_object('error','no_reward'); end if;
    v_shards := case when p_tier = 30 then 150 when p_tier % 9 = 0 then 90 else 60 end;
    v_reward := jsonb_build_object('kind','shards','amount',v_shards);
  else
    if p_tier = 30 then
      v_card_id := v_grands[1 + floor(random() * array_length(v_grands, 1))::int];
      v_reward := jsonb_build_object('kind','grand_card','card_id',v_card_id);
    elsif p_tier % 9 = 0 then
      v_card_id := v_common_uncommon[1 + floor(random() * array_length(v_common_uncommon, 1))::int];
      v_reward := jsonb_build_object('kind','random_card','card_id',v_card_id);
    elsif p_tier % 5 = 0 then
      v_flux := 1;
      v_reward := jsonb_build_object('kind','flux','amount',v_flux);
    else
      v_shards := case when p_tier % 10 = 0 then 250 when p_tier % 4 = 0 then 200 else 100 end;
      v_reward := jsonb_build_object('kind','shards','amount',v_shards);
    end if;
  end if;

  if v_shards > 0 or v_flux > 0 then
    insert into game_state (user_id, shards, flux, updated_at)
      values (v_uid, v_shards, v_flux, now())
      on conflict (user_id) do update
        set shards = coalesce(game_state.shards,0) + excluded.shards,
            flux = coalesce(game_state.flux,0) + excluded.flux,
            updated_at = now();
  end if;

  if v_card_id is not null then
    insert into cards_owned (user_id, card_id, qty, acquired_at)
      values (v_uid, v_card_id, 1, now())
      on conflict (user_id, card_id) do update
        set qty = cards_owned.qty + 1,
            acquired_at = now();
  end if;

  if p_track = 'free' then
    update battle_pass
      set claimed_free = array_append(coalesce(claimed_free, '{}'::int[]), p_tier)
      where user_id = v_uid;
  else
    update battle_pass
      set claimed_premium = array_append(coalesce(claimed_premium, '{}'::int[]), p_tier)
      where user_id = v_uid;
  end if;

  return jsonb_build_object('ok', true, 'reward', v_reward, 'tier', p_tier, 'track', p_track);
end $$;

revoke all on function public.claim_battle_pass(integer, text) from public;
grant execute on function public.claim_battle_pass(integer, text) to authenticated;
