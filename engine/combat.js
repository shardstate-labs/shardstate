// ═══════════════════════════════════════════════════════════
// COMBAT ENGINE — pure logic, no DOM
// Depends on: engine/data.js (ALL_CARDS, CLANS), engine/state.js (STATE)
// ═══════════════════════════════════════════════════════════

const MODE_CONFIG = {
  casual: {
    label: 'CASUAL',
    pvp: true,
    queueText: 'Buscando rival casual...',
    matchText: 'Rival casual enlazado.',
    shardsWin:[18,30], shardsLoss:[3,8], shardsDraw:[8,12],
    xpWin:22, xpLoss:8, xpDraw:12,
    eloWin:0, eloLoss:0, drawElo:0,
    eloKey:null,
    useTrainingDeck:false,
    academy:false
  },
  training: {
    label: 'TRAINING',
    pvp: false,
    queueText: 'Configurando sparring de entrenamiento...',
    matchText: 'Entrenamiento listo.',
    shardsWin:[3,8], shardsLoss:[1,3], shardsDraw:[2,4],
    xpWin:6, xpLoss:2, xpDraw:3,
    eloWin:0, eloLoss:0, drawElo:0,
    eloKey:null,
    useTrainingDeck:true,
    academy:false
  },
  ranked: {
    label: 'RANKED',
    pvp: true,
    queueText: 'Buscando rival Ranked...',
    matchText: 'Rival Ranked enlazado.',
    shardsWin:[35,60], shardsLoss:[8,14], shardsDraw:[16,24],
    xpWin:40, xpLoss:14, xpDraw:20,
    eloWin:12, eloLoss:10, drawElo:2,
    eloKey:'elo',
    useTrainingDeck:false,
    academy:false
  }
};

const ACADEMY_LESSONS = [
  'Leccion 1: PODER x (Pulsos + 1) define tu ATQ final.',
  'Leccion 2: El DANIO solo entra si ganas la ronda.',
  'Leccion 3: Bonus de clan se activa con 2+ cartas del mismo clan en mano.',
  'Leccion 4: COLAPSO consume pulsos pero suma dano explosivo.',
  'Leccion 5: Gestiona pulsos por ronda: sin recursos no hay cierre.'
];

function getModeConfig(mode){
  return MODE_CONFIG[mode] || MODE_CONFIG.casual;
}
function randomBetween(min,max){
  return min + Math.floor(Math.random() * (Math.max(min,max)-Math.min(min,max)+1));
}
function pickDeckPoolForMode(mode){
  const cfg = getModeConfig(mode);
  if(cfg.useTrainingDeck){
    return [...ALL_CARDS].sort(()=>Math.random()-.5).slice(0,8).map(c=>c.id);
  }
  const ownedDeck = (STATE.deck||[]).filter(Boolean).slice(0,8);
  if(ownedDeck.length===8) return ownedDeck;
  const fromCollection = Object.keys(STATE.collection||{}).slice(0,8);
  if(fromCollection.length===8) return fromCollection;
  return [...ALL_CARDS].sort(()=>Math.random()-.5).slice(0,8).map(c=>c.id);
}
function buildOpponentDeckPool(mode){
  return [...ALL_CARDS].sort(()=>Math.random()-.5).slice(0,8).map(c=>c.id);
}
function academyHintAtRound(round){
  return ACADEMY_LESSONS[Math.min(round|0, ACADEMY_LESSONS.length-1)];
}

// ─── Pure battle math ────────────────────────────────────────
function getBaseCardStats(card, isPlayerSide){
  if(!card) return {pow:0,dmg:0};
  if(isPlayerSide){
    const s = STATE.collection[card.id] || {lv:1};
    return getCardStatsAtLevel(card, s.lv);
  }
  // Opponent always plays at max level (card.stars)
  return getCardStatsAtLevel(card, card.stars || 2);
}
function buildBattleSide(side, entry, pillzUsed, colapsoUsed, roundIndex, hasClanBonus){
  const card = getCard(entry.id);
  const isPlayerSide = side === 'player';
  const base = getBaseCardStats(card, isPlayerSide);
  const lv = isPlayerSide
    ? (STATE.collection[card?.id]?.lv || 1)
    : (card?.stars || 2);
  return {
    side, card, pillzUsed: pillzUsed|0, colapsoUsed: !!colapsoUsed, roundIndex,
    hasClanBonus: !!hasClanBonus,
    basePow: base.pow|0, baseDmg: base.dmg|0,
    powMod: 0, dmgMod: 0, atkMod: 0,
    enemyPowMod: 0, enemyAtkMod: 0,
    stopAbility: false, stopBonus: false,
    abilityLocked: card ? !cardHasAbility(card, lv) : true,
    copyEnemyBonus: false, copyEnemyAbility: false,
    poisonOnWin: null, poisonOnLose: null,
    regenOnWin: 0, gainPillzOnWin: 0, gainPillzOnKo: 0,
    immuneToStop: card && card.clan==='protocol',
  };
}
function applyClanBonusEffects(self, enemy){
  if(!self.card || !self.hasClanBonus || enemy.stopBonus) return;
  switch(self.card.clan){
    case 'nexus': enemy.enemyAtkMod -= 2; break;
    case 'tidecall': self.gainPillzOnWin += 1; break;
    case 'ashborn': self.dmgMod += 2; break;
    case 'errvoid': enemy.stopAbility = !enemy.immuneToStop; break;
    case 'vault': self.atkMod += 8; break;
    case 'mycelium': self.poisonOnWin = {dmg:1, turns:2}; break;
    case 'ironpact': if(self.baseDmg < enemy.baseDmg) self.powMod += 2; break;
    case 'synthos': self.copyEnemyAbility = true; break;
    case 'loopkin': if(self.roundIndex>=1) self.gainPillzOnWin += 1; break;
    case 'phantom': enemy.enemyPowMod -= 1; break;
    case 'frequenz': self.gainPillzOnKo += 2; break;
    case 'protocol': self.immuneToStop = true; break;
    default: break;
  }
}
function applyCardAbilityEffects(self, enemy){
  if(!self.card || self.stopAbility || self.abilityLocked) return;
  switch(self.card.id){
    case 'skrell': enemy.enemyAtkMod -= 1; break;
    case 'nyx': self.poisonOnWin = {dmg:1, turns:2}; break;
    case 'grimore': self.copyEnemyBonus = true; break;
    case 'voltz': enemy.enemyAtkMod -= 3; break;
    case 'axiarch0': enemy.enemyAtkMod -= 5; self.gainPillzOnKo += 3; break;
    case 'calyx': if(self.roundIndex===0) self.powMod += 2; break;
    case 'mara': if(self.roundIndex===0) self.powMod += 2; self.regenOnWin = Math.max(self.regenOnWin,2); break;
    case 'thalassa': self.regenOnWin = Math.max(self.regenOnWin,3); self.gainPillzOnWin += 2; break;
    case 'ignar': break; // handled during Colapso toggle cost
    case 'ashrel': self.dmgMod += 3; break;
    case 'infernus': self.dmgMod += self.colapsoUsed ? 7 : 5; break;
    case 'kernel': enemy.stopBonus = true; break;
    case 'nullify': enemy.stopBonus = true; enemy.stopAbility = !enemy.immuneToStop; break;
    case 'nvoid': enemy.stopBonus = true; enemy.stopAbility = !enemy.immuneToStop; self.copyEnemyBonus = true; break;
    case 'monnet': self.atkMod += 8; enemy.stopBonus = true; break;
    case 'legrand': self.atkMod += 8; enemy.stopBonus = true; enemy.stopAbility = !enemy.immuneToStop; break;
    case 'tendra': self.poisonOnWin = {dmg: self.hasClanBonus ? 4 : 3, turns:3}; break;
    case 'sporicus': self.poisonOnWin = {dmg:5, turns:3}; self.immuneToStop = true; break;
    case 'ripper': if(enemy.baseDmg > self.baseDmg) self.powMod += 4; break;
    case 'wkhor': if(enemy.baseDmg >=3) self.powMod += 6; break;
    case 'quanta': self.copyEnemyAbility = true; self.atkMod += 3; break;
    case 'archon': self.copyEnemyAbility = true; self.copyEnemyBonus = true; break;
    case 'chronovex': if(self.roundIndex>=1) self.gainPillzOnWin += 2; self.powMod += Math.max(0, 12 - self.pillzUsed)*2; break;
    case 'nullshadow': enemy.enemyPowMod -= 4; enemy.stopBonus = true; break;
    case 'maestra': self.gainPillzOnKo += 6; break;
    case 'imperator': self.immuneToStop = true; self.powMod += 2; enemy.stopBonus = true; enemy.stopAbility = true; break;
    default: break;
  }
}
function computeBattleNumbers(side){
  const pow = Math.max(1, (side.basePow + side.powMod + side.enemyPowMod)|0);
  const dmg = Math.max(0, (side.baseDmg + side.dmgMod + (side.colapsoUsed?2:0))|0);
  const atk = Math.max(0, (pow * ((side.pillzUsed|0)+1) + side.atkMod + side.enemyAtkMod)|0);
  return {pow, dmg, atk};
}
function applyPoisonAndRegenTick(B){
  const chunks = [];
  const pp=B.playerStatus?.poison;
  const op=B.oppStatus?.poison;
  const pr=B.playerStatus?.regen;
  const or=B.oppStatus?.regen;
  if(pp && pp.turns>0){ B.playerLife=Math.max(0,B.playerLife-pp.dmg); pp.turns--; chunks.push(`Sufres veneno (${pp.dmg})`); }
  if(op && op.turns>0){ B.oppLife=Math.max(0,B.oppLife-op.dmg); op.turns--; chunks.push(`Rival sufre veneno (${op.dmg})`); }
  if(pr && pr.turns>0){ B.playerLife=Math.min(12,B.playerLife+pr.heal); pr.turns--; chunks.push(`Regeneras ${pr.heal}`); }
  if(or && or.turns>0){ B.oppLife=Math.min(12,B.oppLife+or.heal); or.turns--; chunks.push(`Rival regenera ${or.heal}`); }
  return chunks.join(' · ');
}
