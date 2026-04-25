/* ════════════════════════════════════════════════════════════
 * SHARDSTATE — ABILITY CATALOG
 * Normalized abilities + deterministic random assignment.
 * Source of truth: design doc (round_engine.js consumes this).
 * ════════════════════════════════════════════════════════════ */

(function(global){
  if (global.ABILITY_CATALOG) return;

  // ─── LOCKED CONSTANTS ─────────────────────────────────────
  const C = {
    HP_MAX: 12, HP_MIN: 0,
    PULSO_MAX: 12, PULSO_MIN: 0,
    DECK_SIZE: 8, STARTING_HAND: 4, ROUNDS: 4,
    COLLAPSE_BONUS_DMG: 2,                 // user spec: collapse adds +2 dmg to "per damage" effects
    TITANS_CLAN_KEY: 'titans',             // future-reserved clan id
  };

  // ─── ABILITY CATALOG ──────────────────────────────────────
  // Phase routing handled by round_engine via `type` and `condition`.
  // effect signatures: (ctx) => void; ctx = { self, opp, match, stack, status }
  const CAT = {

    // POISON (onWin → applies status; ticks each startRound until floor)
    POISON_2_M3: { type:'onWin',  cond:'roundWon', meta:{stat:'POISON',amount:2,floor:3}, label:'POISON 2 (min 3)' },
    POISON_1_M1: { type:'onWin',  cond:'roundWon', meta:{stat:'POISON',amount:1,floor:1}, label:'POISON 1 (min 1)' },
    POISON_3_M5: { type:'onWin',  cond:'roundWon', meta:{stat:'POISON',amount:3,floor:5}, label:'POISON 3 (min 5)' },

    // ATK reduction (opp)
    ATK_M6_F5:   { type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'ATK',amount:-6, floor:5}, label:'-6 ATQ adv (mín 5)' },
    ATK_M5_F5:   { type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'ATK',amount:-5, floor:5}, label:'-5 ATQ adv (mín 5)' },
    ATK_M12_F8:  { type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'ATK',amount:-12,floor:8}, label:'-12 ATQ adv (mín 8)' },
    ATK_M3_F9:   { type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'ATK',amount:-3, floor:9}, label:'-3 ATQ adv (mín 9)' },

    // PWR + DMG combo reduction (opp)
    PD_M3_F3:    { type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'PWR_DMG',amount:-3,floor:3}, label:'-3 PWR/-3 DMG adv (mín 3)' },

    // DMG reduction (opp)
    DMG_M2_F1:   { type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'DMG',amount:-2,floor:1}, label:'-2 DMG (mín 1)' },
    DMG_M2_F2:   { type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'DMG',amount:-2,floor:2}, label:'-2 DMG (mín 2)' },
    DMG_M3_F2:   { type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'DMG',amount:-3,floor:2}, label:'-3 DMG (mín 2)' },

    // PWR reduction (opp)
    PWR_M2_F1_ADV:{type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'PWR',amount:-2,floor:1}, label:'-2 PWR adv (mín 1)' },
    PWR_M2_F2_ADV:{type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'PWR',amount:-2,floor:2}, label:'-2 PWR adv (mín 2)' },
    PWR_M4_F1_ADV:{type:'onCompare', cond:'always', meta:{tgt:'opp',stat:'PWR',amount:-4,floor:1}, label:'-4 PWR adv (mín 1)' },

    // CANCELS (must run BEFORE other onCompare — phase 4b)
    CANCEL_ABILITY_ADV: { type:'onCompare', cond:'priorityCancel', meta:{kind:'cancelAbility'}, label:'Anular habilidad adv' },
    CANCEL_BONUS_ADV:   { type:'onCompare', cond:'priorityCancel', meta:{kind:'cancelBonus'},   label:'Anular bonus adv' },

    // COPIES (phase 4c — snapshot opp.card BEFORE other mods)
    COPY_DMG_ADV: { type:'onCompare', cond:'copy', meta:{kind:'copyStat',stat:'DMG'}, label:'Copia el DMG adv' },
    COPY_PWR_ADV: { type:'onCompare', cond:'copy', meta:{kind:'copyStat',stat:'PWR'}, label:'Copia el PWR adv' },
    COPY_ABILITY: { type:'onCompare', cond:'copy', meta:{kind:'copyAbility'},          label:'Copia habilidad' },

    // PWR self
    PWR_P2: { type:'onCompare', cond:'always', meta:{tgt:'self',stat:'PWR',amount:+2}, label:'+2 PWR' },
    PWR_P4: { type:'onCompare', cond:'always', meta:{tgt:'self',stat:'PWR',amount:+4}, label:'+4 PWR' },

    // onWin gains
    HP_P2:        { type:'onWin', cond:'roundWon', meta:{tgt:'self',stat:'HP',amount:+2},      label:'+2 HP' },
    PULSO_P2:     { type:'onWin', cond:'roundWon', meta:{tgt:'self',stat:'PULSO',amount:+2},   label:'+2 Pulsos' },
    HP_PER_DMG:   { type:'onWin', cond:'roundWon', meta:{tgt:'self',stat:'HP',perDmg:true},    label:'+HP por daño' },
    PULSO_PER_DMG:{ type:'onWin', cond:'roundWon', meta:{tgt:'self',stat:'PULSO',perDmg:true}, label:'+Pulso por daño' },

    // ATK self
    ATK_P8:  { type:'onCompare', cond:'always', meta:{tgt:'self',stat:'ATK',amount:+8 }, label:'+8 ATQ' },
    ATK_P12: { type:'onCompare', cond:'always', meta:{tgt:'self',stat:'ATK',amount:+12}, label:'+12 ATQ' },
    ATK_P16: { type:'onCompare', cond:'always', meta:{tgt:'self',stat:'ATK',amount:+16}, label:'+16 ATQ' },

    // LOSER (only if THIS card lost)
    LOSER_HP_M2:    { type:'onLose', cond:'roundLost', meta:{tgt:'opp',stat:'HP',amount:-2,floor:0},    label:'Loser: -2 HP adv' },
    LOSER_PULSO_M2: { type:'onLose', cond:'roundLost', meta:{tgt:'opp',stat:'PULSO',amount:-2,floor:0}, label:'Loser: -2 Pulso adv' },

    // ANULAR (fires only if OWN ability was canceled)
    ON_CANCEL_PWR_P3:        { type:'onCancel', cond:'selfCancelled',          meta:{tgt:'self',stat:'PWR',amount:+3}, label:'Anular: +3 PWR' },
    ON_CANCEL_DMG_P3:        { type:'onCancel', cond:'selfCancelled',          meta:{tgt:'self',stat:'DMG',amount:+3}, label:'Anular: +3 DMG' },
    ON_CANCEL_POISON_2_F0:   { type:'onCancel', cond:'selfCancelledRoundWon',  meta:{stat:'POISON',amount:2,floor:0},   label:'Anular: POISON 2 (mín 0)' },
    ON_CANCEL_ATK_M12_F1:    { type:'onCancel', cond:'selfCancelled',          meta:{tgt:'opp',stat:'ATK',amount:-12,floor:1}, label:'Anular: -12 ATQ adv (mín 1)' },

    // COMBO (only if won previous round)
    COMBO_PWR_P4:     { type:'onCombo', cond:'wonPrevRound', meta:{tgt:'self',stat:'PWR',amount:+4}, label:'COMBO: +4 PWR' },
    COMBO_PWR_P2:     { type:'onCombo', cond:'wonPrevRound', meta:{tgt:'self',stat:'PWR',amount:+2}, label:'COMBO: +2 PWR' },
    COMBO_DMG_P2:     { type:'onCombo', cond:'wonPrevRound', meta:{tgt:'self',stat:'DMG',amount:+2}, label:'COMBO: +2 DMG' },
    COMBO_PWR_M2_ADV: { type:'onCombo', cond:'wonPrevRound', meta:{tgt:'opp', stat:'PWR',amount:-2,floor:1}, label:'COMBO: -2 PWR adv (mín 1)' },

    // CONDITIONAL BUFFS
    PWR_PER_PULSO:   { type:'onCompare', cond:'always', meta:{tgt:'self',stat:'PWR',perPulso:true,max:6}, label:'+1 PWR por PULSO restante (máx 6)' },
    PWR_PER_HP_LOST: { type:'onCompare', cond:'always', meta:{tgt:'self',stat:'PWR',perHpLost:true,max:5}, label:'+1 PWR por HP perdido (máx 5)' },

    // ───── TITANS (passive, hand-based) ─────────────────────
    JUNTOS_HP_P1:       { type:'onStartRound', cond:'titansActive', titans:true, meta:{tgt:'self',stat:'HP',amount:+1},    label:'Juntos: +1 HP' },
    JUNTOS_PULSO_P1:    { type:'onStartRound', cond:'titansActive', titans:true, meta:{tgt:'self',stat:'PULSO',amount:+1}, label:'Juntos: +1 Pulso' },
    JUNTOS_ATK_P7:      { type:'passive',     cond:'titansActiveSelf', titans:true, meta:{tgt:'self',stat:'ATK',amount:+7}, label:'Juntos: +7 ATQ' },
    JUNTOS_PWR_P2:      { type:'passive',     cond:'titansActiveSelf', titans:true, meta:{tgt:'self',stat:'PWR',amount:+2}, label:'Juntos: +2 PWR' },
    JUNTOS_DMG_P2:      { type:'passive',     cond:'titansActiveSelf', titans:true, meta:{tgt:'self',stat:'DMG',amount:+2}, label:'Juntos: +2 DMG' },
    JUNTOS_DMG_M1_ADV:  { type:'passive',     cond:'titansActiveOpp',  titans:true, meta:{tgt:'opp', stat:'DMG',amount:-1,floor:1}, label:'Juntos: -1 DMG adv' },
    JUNTOS_PWR_M1_ADV:  { type:'passive',     cond:'titansActiveOpp',  titans:true, meta:{tgt:'opp', stat:'PWR',amount:-1,floor:1}, label:'Juntos: -1 PWR adv' },
    JUNTOS_ATK_M8_ADV:  { type:'passive',     cond:'titansActiveOpp',  titans:true, meta:{tgt:'opp', stat:'ATK',amount:-8,floor:5}, label:'Juntos: -8 ATQ adv (mín 5)' },
    JUNTOS_HP_M1_ADV:   { type:'passive',     cond:'titansActiveSelf', titans:true, meta:{tgt:'opp', stat:'HP',amount:-1,floor:0,everyRound:true}, label:'Juntos: -1 HP adv (mín 0)' },
    JUNTOS_TOTAL_CANCEL:{ type:'passive',     cond:'titansActiveOpp',  titans:true, meta:{kind:'cancelBoth'}, label:'Juntos: Anular hab+bonus adv' },
  };

  // ─── CLAN → BONUS ABILITY ID (per user spec) ──────────────
  const CLAN_BONUS = {
    nexus:    'PWR_PER_PULSO',
    tidecall: 'PWR_PER_HP_LOST',
    ashborn:  'POISON_2_M3',
    errvoid:  'CANCEL_BONUS_ADV',
    vault:    'DMG_M3_F2',
    mycelium: 'HP_PER_DMG',
    ironpact: 'ATK_P8',
    synthos:  'COPY_PWR_ADV',
    loopkin:  'COMBO_PWR_P4',
    phantom:  'ATK_M6_F5',
    frequenz: 'ATK_M12_F8',
    protocol: 'CANCEL_ABILITY_ADV',
    titans:   null,        // Titans bonus is the global cancel rule, not a per-card buff
  };

  // ─── ABILITY POOLS ────────────────────────────────────────
  const TITANS_POOL = Object.keys(CAT).filter(k => CAT[k].titans);
  const NORMAL_POOL = Object.keys(CAT).filter(k => !CAT[k].titans);

  // ─── DETERMINISTIC SEEDED RNG ─────────────────────────────
  function hashId(s){
    let h = 2166136261 >>> 0;
    for (let i=0; i<s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function pick(arr, seed){ return arr[seed % arr.length]; }

  /**
   * assignAbilities(cards): mutate every card to add `abilityId` and refresh `bonusId`.
   * Same card.id always picks same ability across reloads.
   * Titans cards get only Titans abilities; non-Titans get only normal abilities.
   */
  function assignAbilities(cards){
    cards.forEach(c => {
      const seed = hashId(c.id || '');
      const isTitan = (c.clan === C.TITANS_CLAN_KEY);
      const pool = isTitan ? TITANS_POOL : NORMAL_POOL;
      // Preserve admin-picked abilityId if it's a known catalog entry; otherwise hash-assign.
      const adminPicked = c.abilityId && CAT[c.abilityId];
      if (!adminPicked) c.abilityId = pick(pool, seed);
      c.bonusId   = CLAN_BONUS[c.clan] || null;
      // Mirror to text fields for legacy renderers / UI (always overwrite so old strings don't leak):
      c.ability   = CAT[c.abilityId]?.label || '';
      c.bonus     = c.bonusId ? CAT[c.bonusId].label : (c.clan==='titans' ? 'Cancela TITANS rival' : '');
    });
  }

  global.ABILITY_CATALOG = CAT;
  global.CLAN_BONUS_MAP  = CLAN_BONUS;
  global.SHS_CONST       = C;
  global.assignAbilities = assignAbilities;
  global.SHS_ABILITY_POOLS = { TITANS_POOL, NORMAL_POOL };

  // Auto-run on baseline ALL_CARDS so gamehub collection (which doesn't load
  // game/data.js) shows the catalog labels. Re-runs are idempotent — admin-
  // picked abilityIds are preserved by the guard inside assignAbilities.
  if (Array.isArray(global.ALL_CARDS)) assignAbilities(global.ALL_CARDS);
})(typeof window !== 'undefined' ? window : globalThis);
