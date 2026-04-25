-- Battle Pass economy refresh.
-- Free track: low SHARDS every 3 levels.
-- Premium track: 1 FLUX every 5 levels, random common/uncommon card every 9 levels,
-- and one random GRAND card at level 30.

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
      return jsonb_build_object('error','no_reward');
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

create or replace function public.buy_battle_pass_with_flux()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_flux int;
begin
  if v_uid is null then return jsonb_build_object('error','not_authenticated'); end if;

  insert into public.game_state (user_id, flux, updated_at)
    values (v_uid, 0, now())
    on conflict (user_id) do nothing;

  select coalesce(flux, 0) into v_flux
    from public.game_state
    where user_id = v_uid
    for update;

  if exists (select 1 from public.battle_pass where user_id = v_uid and coalesce(is_premium,false)) then
    return jsonb_build_object('error','already_premium');
  end if;

  if coalesce(v_flux, 0) < 20 then
    return jsonb_build_object('error','not_enough_flux','required',20,'flux',coalesce(v_flux,0));
  end if;

  update public.game_state
    set flux = coalesce(flux, 0) - 20,
        updated_at = now()
    where user_id = v_uid
    returning flux into v_flux;

  insert into public.battle_pass (user_id, season, xp, is_premium, claimed_free, claimed_premium, started_at)
    values (v_uid, 1, 0, true, '{}'::int[], '{}'::int[], now())
    on conflict (user_id) do update
      set is_premium = true;

  return jsonb_build_object('ok',true,'flux',v_flux,'premium',true);
end $$;

revoke all on function public.buy_battle_pass_with_flux() from public;
grant execute on function public.buy_battle_pass_with_flux() to authenticated;
