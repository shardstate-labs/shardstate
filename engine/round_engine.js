/* ════════════════════════════════════════════════════════════
 * SHARDSTATE — ROUND ENGINE (deterministic, modular)
 * Modules: EffectStack · StatusEffectsManager · ClanBonusManager
 *          TitansManager · AbilityResolver · runRound
 *
 * Consumed by game/engine.js (resolveRound delegates here).
 * Globals exposed: window.SHS_ENGINE
 * ════════════════════════════════════════════════════════════ */

(function(global){
  if (global.SHS_ENGINE) return;
  const CAT = global.ABILITY_CATALOG;
  const CLAN_BONUS = global.CLAN_BONUS_MAP;
  const C = global.SHS_CONST;
  if (!CAT || !CLAN_BONUS || !C){
    console.error('round_engine: ability_catalog must load first');
    return;
  }
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));

  // ═══════════════════════════════════════════════════════════
  //  EffectStack — single mutation surface for round modifiers
  // ═══════════════════════════════════════════════════════════
  class EffectStack {
    constructor(){ this.mods = []; }
    add(ownerId, stat, amount, floor){ this.mods.push({ownerId, stat, amount, floor:floor|0, kind:'add'}); }
    override(ownerId, stat, value){    this.mods.push({ownerId, stat, amount:value, kind:'override'}); }
    cancelAbility(target){ target._abilityCancelled = true; }
    cancelBonus  (target){ target._bonusCancelled   = true; }
    copyAbility  (self, abilityId){ self._copiedAbility = abilityId; }
    /** Resolve a stat on an owner, applying all mods + floors. */
    resolve(owner, baseValue, stat){
      const own = this.mods.filter(m => m.ownerId === owner._id && m.stat === stat);
      const ovr = own.find(m => m.kind === 'override');
      if (ovr) return ovr.amount;
      const sum = own.filter(m => m.kind === 'add').reduce((s,m)=> s + m.amount, 0);
      const flr = own.filter(m => m.floor != null).reduce((mx,m)=> Math.max(mx, m.floor), 0);
      return Math.max(baseValue + sum, flr);
    }
    clear(){ this.mods.length = 0; }
  }

  // ═══════════════════════════════════════════════════════════
  //  StatusEffectsManager — poison stacks per-source
  // ═══════════════════════════════════════════════════════════
  class StatusEffectsManager {
    constructor(){ this.poisons = { p:[], o:[] }; }
    applyPoison(targetId, dmg, floor){ this.poisons[targetId].push({ dmg, floor }); }
    /** Returns total HP delta to apply, respecting per-entry floors. */
    tick(targetId, currentHP){
      let hp = currentHP;
      for (const p of this.poisons[targetId]){
        if (hp <= p.floor) continue;        // already at/under this source's floor
        hp = Math.max(p.floor, hp - p.dmg);
      }
      return hp;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  ClanBonusManager — eligibility + activation
  // ═══════════════════════════════════════════════════════════
  class ClanBonusManager {
    static eligible(player){
      if (!player.card) return false;
      if (player._bonusCancelled) return false;
      // ≥2 cards of the same clan in hand (played card counts toward its own clan).
      let count = 0;
      const clan = player.card.clan;
      for (const id of (player.hand || [])){
        const c = global.getCard ? global.getCard(id) : null;
        if (c && c.clan === clan) count++;
      }
      // Ensure played card is also counted if not already in hand list:
      if (player.card && !(player.hand || []).includes(player.card.id)) count++;
      return count >= 3;
    }
    static bonusFor(player){
      const id = CLAN_BONUS[player.card.clan];
      return id || null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TitansManager — global cancel + passive auras
  // ═══════════════════════════════════════════════════════════
  class TitansManager {
    static handHasTitans(player){
      return (player.hand || []).some(id => {
        const c = global.getCard ? global.getCard(id) : null;
        return c && c.clan === C.TITANS_CLAN_KEY;
      });
    }
    static evalGlobalCancel(p, o){
      return TitansManager.handHasTitans(p) && TitansManager.handHasTitans(o);
    }
    /** Apply Titans hand-passive auras for one player. */
    static apply(player, opp, ctx){
      if (ctx.match.cancelAllTitans) return;
      for (const id of (player.hand || [])){
        const c = global.getCard ? global.getCard(id) : null;
        if (!c || c.clan !== C.TITANS_CLAN_KEY) continue;
        const ab = CAT[c.abilityId];
        if (!ab || !ab.titans) continue;
        AbilityResolver.runOne(ab, { ...ctx, self:player, opp });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  AbilityResolver — single dispatch surface
  // ═══════════════════════════════════════════════════════════
  class AbilityResolver {
    static runOne(ab, ctx){
      if (!ab) return;
      if (!AbilityResolver.evalCond(ab.cond, ctx)) return;
      AbilityResolver.applyMeta(ab.meta, ctx);
    }
    static evalCond(cond, ctx){
      switch(cond){
        case 'always':                return true;
        case 'priorityCancel':        return true;   // gate is phase, not state
        case 'copy':                  return true;
        case 'roundWon':              return ctx.self._id === ctx.match.winner;
        case 'roundLost':             return ctx.self._id !== ctx.match.winner;
        case 'selfCancelled':         return !!ctx.self._abilityCancelled;
        case 'selfCancelledRoundWon': return !!ctx.self._abilityCancelled && ctx.self._id === ctx.match.winner;
        case 'wonPrevRound':          return ctx.match.lastWinner === ctx.self._id;
        case 'titansActive':          return !ctx.match.cancelAllTitans;
        case 'titansActiveSelf':      return !ctx.match.cancelAllTitans && !!ctx.self.card;
        case 'titansActiveOpp':       return !ctx.match.cancelAllTitans && !!ctx.opp.card;
        default: return true;
      }
    }
    static applyMeta(m, ctx){
      if (!m) return;
      const target = m.tgt === 'opp' ? ctx.opp : ctx.self;

      // Cancels & copies
      if (m.kind === 'cancelAbility'){ ctx.stack.cancelAbility(ctx.opp); return; }
      if (m.kind === 'cancelBonus')  { ctx.stack.cancelBonus(ctx.opp);   return; }
      if (m.kind === 'cancelBoth')   { ctx.stack.cancelAbility(ctx.opp); ctx.stack.cancelBonus(ctx.opp); return; }
      if (m.kind === 'copyStat')     { ctx.stack.override(ctx.self._id, m.stat, ctx.opp.card[m.stat==='PWR'?'pow':'dmg']); return; }
      if (m.kind === 'copyAbility')  { ctx.stack.copyAbility(ctx.self, ctx.opp.card.abilityId); return; }

      // Conditional buffs (read live state, snapshot to amount)
      let amount = m.amount;
      if (m.perPulso)  amount = Math.min(ctx.self.pulsos, m.max || 99);
      if (m.perHpLost) amount = Math.min(C.HP_MAX - ctx.self.hp, m.max || 99);
      if (m.perDmg)    amount = ctx.match.dmgDealtThisRound | 0;

      // Stat application
      if (m.stat === 'POISON'){ ctx.status.applyPoison(ctx.opp._id, m.amount, m.floor|0); return; }
      if (m.stat === 'HP')    { target.hp     = clamp(target.hp     + amount, m.floor|0, C.HP_MAX);    return; }
      if (m.stat === 'PULSO') { target.pulsos = clamp(target.pulsos + amount, m.floor|0, C.PULSO_MAX); return; }
      if (m.stat === 'PWR_DMG'){
        ctx.stack.add(target._id, 'PWR', amount, m.floor|0);
        ctx.stack.add(target._id, 'DMG', amount, m.floor|0);
        return;
      }
      if (m.stat === 'PWR' || m.stat === 'DMG' || m.stat === 'ATK'){
        ctx.stack.add(target._id, m.stat, amount, m.floor|0);
        return;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  runRound — orchestrator (PHASE 1..9)
  // ═══════════════════════════════════════════════════════════
  /**
   * Returns: { winner:'p'|'o', dmg, collapse, p:{atk,pow,bonus}, o:{...} }
   * Inputs:
   *   match: { round, lastWinner, starter, p, o, dmgDealtThisRound, collapseTriggered, cancelAllTitans }
   *   p, o : { _id:'p'|'o', card, hand, hp, pulsos, colapso, _abilityCancelled, _bonusCancelled, _copiedAbility }
   */
  function runRound(match){
    const stack  = new EffectStack();
    const status = match._status || (match._status = new StatusEffectsManager());
    match.cancelAllTitans = TitansManager.evalGlobalCancel(match.p, match.o);

    const ctxFor = (self, opp) => ({ self, opp, match, stack, status });

    // ─── PHASE 1: startRound ─────────────────────────────────
    stack.clear();
    match.p._abilityCancelled = match.p._bonusCancelled = match.p._copiedAbility = null;
    match.o._abilityCancelled = match.o._bonusCancelled = match.o._copiedAbility = null;

    // ─── PHASE 2: applyStartRoundEffects ─────────────────────
    if (match.round > 0){
      match.p.hp = status.tick('p', match.p.hp);
      match.o.hp = status.tick('o', match.o.hp);
    }
    if (match.p.hp <= 0 || match.o.hp <= 0) return earlyEnd(match);

    // Titans onStartRound abilities (JUNTOS_HP_P1, JUNTOS_PULSO_P1)
    for (const [s,o] of [[match.p,match.o],[match.o,match.p]]){
      for (const id of (s.hand || [])){
        const card = global.getCard ? global.getCard(id) : null;
        if (!card || card.clan !== C.TITANS_CLAN_KEY) continue;
        const ab = CAT[card.abilityId];
        if (ab && ab.type === 'onStartRound') AbilityResolver.runOne(ab, ctxFor(s,o));
      }
    }

    // ─── PHASE 3: cardReveal (cards already chosen by caller) ──
    // ─── PHASE 4: preCompareEffects (deterministic order) ────
    const phasesOrder = [
      ['titansPassive', s => TitansManager.apply(s.self, s.opp, s)],
      ['cancel',        s => runAbilityIfPhase(s, 'priorityCancel')],
      ['copy',          s => runAbilityIfPhase(s, 'copy')],
      ['combo',         s => runComboIfElig(s)],
      ['modifiers',     s => runOnCompareGeneric(s)],
      ['clanBonus',     s => runClanBonus(s)],
    ];
    for (const [, fn] of phasesOrder){
      fn(ctxFor(match.p, match.o));
      fn(ctxFor(match.o, match.p));
    }

    // ─── PHASE 5: compare ────────────────────────────────────
    const atkP = computeAttack(match.p, stack);
    const atkO = computeAttack(match.o, stack);
    let winner;
    if (atkP > atkO) winner = 'p';
    else if (atkO > atkP) winner = 'o';
    else winner = match.starter || 'p';            // tie → starter
    match.winner = winner;

    // ─── PHASE 6: winnerResolution ───────────────────────────
    const W = winner === 'p' ? match.p : match.o;
    const L = winner === 'p' ? match.o : match.p;
    const baseDmg = stack.resolve(W, W.card.dmg, 'DMG');
    const collapse = !!W.colapso;
    const dmg = baseDmg + (collapse ? C.COLLAPSE_BONUS_DMG : 0);
    match.dmgDealtThisRound = dmg;
    match.collapseTriggered = collapse;
    L.hp = clamp(L.hp - dmg, C.HP_MIN, C.HP_MAX);

    // ─── PHASE 7: onWinEffects ───────────────────────────────
    runByType(W, L, ctxFor, 'onWin');

    // ─── PHASE 8: onLoseEffects ──────────────────────────────
    runByType(L, W, ctxFor, 'onLose');

    // onCancel-postCompare (POISON-on-cancel needs winner known)
    [match.p, match.o].forEach(p => {
      if (!p._abilityCancelled || !p.card) return;
      const ab = CAT[p.card.abilityId];
      if (ab && ab.type === 'onCancel') AbilityResolver.runOne(ab, ctxFor(p, p === match.p ? match.o : match.p));
    });

    // ─── PHASE 9: endRound ───────────────────────────────────
    match.lastWinner = winner;
    match.starter = (match.starter === 'p') ? 'o' : 'p';

    return {
      winner, dmg, collapse,
      p: { atk: atkP, pow: stack.resolve(match.p, match.p.card.pow, 'PWR'), dmg: stack.resolve(match.p, match.p.card.dmg, 'DMG'), bonus: ClanBonusManager.eligible(match.p) },
      o: { atk: atkO, pow: stack.resolve(match.o, match.o.card.pow, 'PWR'), dmg: stack.resolve(match.o, match.o.card.dmg, 'DMG'), bonus: ClanBonusManager.eligible(match.o) },
    };

    // ── helpers (closure) ────────────────────────────────────
    function runAbilityIfPhase(ctx, condFilter){
      const card = ctx.self.card; if (!card) return;
      const abId = ctx.self._copiedAbility || card.abilityId;
      const ab = CAT[abId];
      if (!ab || ab.cond !== condFilter) return;
      if (ctx.self._abilityCancelled && condFilter !== 'priorityCancel') return;
      AbilityResolver.runOne(ab, ctx);
    }
    function runComboIfElig(ctx){
      const card = ctx.self.card; if (!card) return;
      const abId = ctx.self._copiedAbility || card.abilityId;
      const ab = CAT[abId];
      if (!ab || ab.type !== 'onCombo') return;
      if (ctx.self._abilityCancelled) return;
      AbilityResolver.runOne(ab, ctx);
    }
    function runOnCompareGeneric(ctx){
      const card = ctx.self.card; if (!card) return;
      const abId = ctx.self._copiedAbility || card.abilityId;
      const ab = CAT[abId];
      if (!ab || ab.type !== 'onCompare') return;
      if (['priorityCancel','copy'].includes(ab.cond)) return;  // already handled
      if (ctx.self._abilityCancelled) return;
      AbilityResolver.runOne(ab, ctx);
    }
    function runClanBonus(ctx){
      if (!ClanBonusManager.eligible(ctx.self)) return;
      const bonusId = ClanBonusManager.bonusFor(ctx.self);
      if (!bonusId) return;
      const ab = CAT[bonusId];
      if (!ab) return;
      AbilityResolver.runOne(ab, ctx);
    }
    function runByType(self, opp, _ctxFor, typeKey){
      const card = self.card; if (!card) return;
      const abId = self._copiedAbility || card.abilityId;
      const ab = CAT[abId];
      if (!ab || ab.type !== typeKey) return;
      if (self._abilityCancelled) return;          // cancelled abilities don't fire onWin/onLose
      AbilityResolver.runOne(ab, _ctxFor(self, opp));
      // Bonus-driven onWin (e.g. mycelium HP_PER_DMG): fire bonus too
      if (typeKey === 'onWin' && ClanBonusManager.eligible(self)){
        const bId = ClanBonusManager.bonusFor(self);
        const bAb = bId && CAT[bId];
        if (bAb && bAb.type === typeKey) AbilityResolver.runOne(bAb, _ctxFor(self, opp));
      }
    }
  }

  function computeAttack(player, stack){
    const basePow = player.card.pow|0;
    const baseDmg = player.card.dmg|0;
    const pow = stack.resolve(player, basePow, 'PWR');
    stack.resolve(player, baseDmg, 'DMG');
    // ATQ = final PWR * pulsos spent + ATK modifiers. DMG resolves separately after the winner is known.
    // `player.pulsos` is the remaining pool (read by PWR_PER_PULSO etc.).
    const spend = (player.spend != null ? player.spend : player.pulsos) | 0;
    const atkMod = stack.resolve(player, 0, 'ATK');
    return Math.max(0, pow * spend + atkMod);
  }
  function earlyEnd(match){
    const winner = match.p.hp > match.o.hp ? 'p' : (match.o.hp > match.p.hp ? 'o' : (match.starter||'p'));
    match.winner = winner;
    return { winner, dmg:0, collapse:false, p:{atk:0,pow:match.p.card?.pow||0,bonus:false}, o:{atk:0,pow:match.o.card?.pow||0,bonus:false} };
  }

  global.SHS_ENGINE = {
    EffectStack, StatusEffectsManager, ClanBonusManager, TitansManager, AbilityResolver,
    runRound, computeAttack, CONST: C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
