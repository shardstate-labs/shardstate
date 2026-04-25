// SHARDSTATE — ENGINE: pure combat logic
const PLAYER = {
  name:'BLAKCAAT', club:'SIN CLUB',
  shards: 1500, xp: 0, level: 1, elo: 1000,
  wins:0, losses:0, draws:0,
};
const OPPONENTS = [
  {name:'SMASH JABBER', club:'SIN CLUB'},
  {name:'PROTOCOL-9',   club:'TIDE LORDS'},
  {name:'NULL-7',       club:'GLITCH HALL'},
  {name:'IGNAR XV',     club:'PYROFAITH'},
  {name:'LOOP-Δ',       club:'TEMPO BREAK'},
];
const MODES = {
  training:{ label:'TRAINING', shardsW:[0,0],   xpW:8,  eloW:0,  ai:'easy'   },
  casual:  { label:'CASUAL',   shardsW:[20,40], xpW:25, eloW:6,  ai:'medium' },
  ranked:  { label:'RANKED',   shardsW:[50,90], xpW:60, eloW:14, ai:'hard'   },
  academia:{ label:'ACADEMIA', shardsW:[10,20], xpW:35, eloW:0,  ai:'easy'   },
  survivor:{ label:'SURVIVOR', shardsW:[30,60], xpW:40, eloW:8,  ai:'hard'   },
  free:    { label:'FREE FIGHT', shardsW:[5,10], xpW:10, eloW:0, ai:'medium' },
};

function newBattle(mode){
  return {
    mode, round:0,
    pHP:12, oHP:12, pPulses:12, oPulses:12,
    pHand:[], oHand:[],
    pDeck:[], oDeck:[],
    pStatus:{ poison:null, regen:null },
    oStatus:{ poison:null, regen:null },
    history:[], finished:false, winner:null, rewards:null,
    arenaUrl: pickArena(),
    opponent: OPPONENTS[Math.floor(Math.random()*OPPONENTS.length)],
  };
}
function dealHand(deckIds){
  const ids = [...deckIds].sort(()=>Math.random()-0.5);
  return ids.slice(0,4);
}
function clanBonusActive(hand, card){
  return hand.filter(id=> getCard(id)?.clan === card.clan).length >= 2;
}
function applyClanBonus(s, o){
  if(!s.hasBonus || o.stopBonus) return;
  switch(s.card.clan){
    case 'nexus':    o.atkD -= 2; break;
    case 'tidecall': s.pulseWin += 1; break;
    case 'ashborn':  s.dmgD += 2; break;
    case 'errvoid':  if(!o.immuneToStop) o.stopAbility = true; break;
    case 'vault':    s.atkD += 8; break;
    case 'mycelium': s.poisonOnWin = { dmg:1, turns:2 }; break;
    case 'ironpact': if(s.card.dmg < o.card.dmg) s.powD += 2; break;
    case 'synthos':  s.copyEnemyAbility = true; break;
    case 'loopkin':  if(s.round>=1) s.pulseWin += 1; break;
    case 'phantom':  o.powD -= 1; break;
    case 'frequenz': s.pulseKO += 2; break;
    case 'protocol': s.immuneToStop = true; break;
  }
}

function applyAbility(s, o){
  if(!s.card || s.stopAbility) return;
  switch(s.card.id){
    case 'skrell':     o.atkD -= 1; break;
    case 'nyx':        s.poisonOnWin = { dmg:1, turns:2 }; break;
    case 'grimore':    s.copyEnemyBonus = true; break;
    case 'voltz':      o.atkD -= 3; break;
    case 'axiarch_0':  o.atkD -= 5; s.pulseKO += 3; break;
    case 'calyx':      if(s.round===0) s.powD += 2; break;
    case 'mara':       if(s.round===0) s.powD += 2;
                       s.regenOnWin = { heal: Math.max(s.regenOnWin?.heal||0, 2), turns:2 }; break;
    case 'thalassa':   s.regenOnWin = { heal: Math.max(s.regenOnWin?.heal||0, 3), turns:2 };
                       s.pulseWin += 2; break;
    case 'ignar':      break;
    case 'ashrel':     s.dmgD += 3; break;
    case 'infernus':   s.dmgD += s.colapso ? 7 : 5; break;
    case 'kernel':     o.stopBonus = true; break;
    case 'nullify':    o.stopBonus = true; if(!o.immuneToStop) o.stopAbility = true; break;
    case 'nvoid':      o.stopBonus = true; if(!o.immuneToStop) o.stopAbility = true; s.copyEnemyBonus = true; break;
    case 'monnet':     s.atkD += 8; o.stopBonus = true; break;
    case 'legrand':    s.atkD += 8; o.stopBonus = true; if(!o.immuneToStop) o.stopAbility = true; break;
    case 'tendra':     s.poisonOnWin = { dmg: s.hasBonus ? 4 : 3, turns:3 }; break;
    case 'sporicus':   s.poisonOnWin = { dmg:5, turns:3 }; s.immuneToStop = true; break;
    case 'ripper':     if(o.card.dmg > s.card.dmg) s.powD += 4; break;
    case 'wrekk':      if(o.card.dmg >= 3) s.powD += 6; break;
    case 'quanta':     s.copyEnemyAbility = true; s.atkD += 3; break;
    case 'archon':     s.copyEnemyAbility = true; s.copyEnemyBonus = true; break;
    case 'chronovex':  if(s.round>=1) s.pulseWin += 2;
                       s.powD += Math.max(0, 12 - s.pulses) * 2; break;
    case 'nullshadow': o.powD -= 4; o.stopBonus = true; break;
    case 'maestra':    s.pulseKO += 6; break;
    case 'imperator':  s.immuneToStop = true; s.powD += 2; o.stopBonus = true;
                       if(!o.immuneToStop) o.stopAbility = true; break;
  }
}

function applyCopyEffects(s, o){
  if(s.copyEnemyAbility && o.card){
    const fake = { ...s, card: o.card, stopAbility:false, copyEnemyAbility:false, copyEnemyBonus:false };
    applyAbility(fake, o);
    s.atkD = fake.atkD; s.powD = fake.powD; s.dmgD = fake.dmgD;
    s.pulseWin = fake.pulseWin; s.pulseKO = fake.pulseKO;
    if(fake.poisonOnWin) s.poisonOnWin = fake.poisonOnWin;
    if(fake.regenOnWin)  s.regenOnWin  = fake.regenOnWin;
    if(fake.immuneToStop) s.immuneToStop = true;
    if(fake.copyEnemyBonus) s.copyEnemyBonus = true;
  }
  if(s.copyEnemyBonus && o.card && o.hasBonus){
    const fake = { ...s, card: { ...s.card, clan: o.card.clan }, hasBonus:true, copyEnemyBonus:false };
    applyClanBonus(fake, o);
    s.atkD = fake.atkD; s.powD = fake.powD; s.dmgD = fake.dmgD;
    s.pulseWin = fake.pulseWin; s.pulseKO = fake.pulseKO;
    if(fake.poisonOnWin) s.poisonOnWin = fake.poisonOnWin;
    if(fake.regenOnWin)  s.regenOnWin  = fake.regenOnWin;
    if(fake.immuneToStop) s.immuneToStop = true;
  }
}

function tickStatus(B){
  const out = [];
  const tick = (st, who, applyFn) => {
    if(st.poison && st.poison.turns>0){
      applyFn(-st.poison.dmg);
      out.push(`${who} sufre veneno (${st.poison.dmg})`);
      st.poison.turns--;
      if(st.poison.turns<=0) st.poison = null;
    }
    if(st.regen && st.regen.turns>0){
      applyFn(+st.regen.heal);
      out.push(`${who} regenera ${st.regen.heal}`);
      st.regen.turns--;
      if(st.regen.turns<=0) st.regen = null;
    }
  };
  tick(B.pStatus, 'Tu carta', d => B.pHP = Math.max(0, Math.min(12, B.pHP + d)));
  tick(B.oStatus, 'Rival',    d => B.oHP = Math.max(0, Math.min(12, B.oHP + d)));
  return out.join(' · ');
}

function resolveRound(B, pCardId, pPulses, pColapso, oCardId, oPulses, oColapso){
  // Early-exit if a player was already at 0 HP (e.g. from prior poison tick).
  if(B.pHP===0 || B.oHP===0){
    B.finished = true;
    B.winner = (B.pHP===B.oHP) ? 'draw' : (B.pHP>B.oHP ? 'p' : 'o');
    B.rewards = computeRewards(B);
    return { round:B.round, winner:B.winner, dmg:0, p:{cardId:pCardId}, o:{cardId:oCardId} };
  }

  const pCard = getCard(pCardId), oCard = getCard(oCardId);

  // Bridge to new modular RoundEngine (engine/round_engine.js).
  if (typeof window !== 'undefined' && window.SHS_ENGINE){
    const match = {
      round: B.round,
      lastWinner: B._lastWinner || null,
      starter:    B._starter    || ((B.round % 2 === 0) ? 'p' : 'o'),
      _status:    B._status,
      p: { _id:'p', card:pCard, hand:B.pHand, hp:B.pHP, pulsos:B.pPulses, spend:pPulses, colapso:pColapso },
      o: { _id:'o', card:oCard, hand:B.oHand, hp:B.oHP, pulsos:B.oPulses, spend:oPulses, colapso:oColapso },
    };
    const r = window.SHS_ENGINE.runRound(match);
    // Sync back
    B.pHP = match.p.hp;     B.oHP = match.o.hp;
    B.pPulses = match.p.pulsos;  B.oPulses = match.o.pulsos;
    B._lastWinner = match.lastWinner;
    B._starter    = match.starter;
    B._status     = match._status;

    const result = {
      round: B.round, winner: r.winner, dmg: r.dmg,
      p: { cardId:pCardId, pow:r.p.pow, atk:r.p.atk, pulses:pPulses, colapso:pColapso, bonus:r.p.bonus },
      o: { cardId:oCardId, pow:r.o.pow, atk:r.o.atk, pulses:oPulses, colapso:oColapso, bonus:r.o.bonus },
    };
    B.history.push(result);
    B.pHand = B.pHand.filter(id=>id!==pCardId);
    B.oHand = B.oHand.filter(id=>id!==oCardId);
    B.round += 1;
    if(B.round>=4 || B.pHP===0 || B.oHP===0){
      B.finished = true;
      if(B.pHP===B.oHP) B.winner='draw';
      else B.winner = (B.pHP > B.oHP) ? 'p' : 'o';
      B.rewards = computeRewards(B);
    }
    return result;
  }

  // ── Legacy fallback (only if SHS_ENGINE failed to load) ─────
  if(B.round>0) tickStatus(B);
  const sides = ['p','o'].map(side=>{
    const card = getCard(side==='p'?pCardId:oCardId);
    const pulses = side==='p'?pPulses:oPulses;
    const colapso = side==='p'?pColapso:oColapso;
    const hand = side==='p'?B.pHand:B.oHand;
    return { side, card, pulses, colapso, round:B.round,
      pow: card.pow, dmg: card.dmg, powD:0, atkD:0, dmgD:0,
      hasBonus: clanBonusActive(hand, card),
      pulseWin:0, pulseKO:0, stopAbility:false, stopBonus:false,
      copyEnemyBonus:false, copyEnemyAbility:false,
      poisonOnWin:null, regenOnWin:null,
      immuneToStop: card.clan==='protocol' };
  });
  const [P,O] = sides;
  applyClanBonus(P,O); applyClanBonus(O,P);
  applyAbility(P,O);   applyAbility(O,P);
  applyCopyEffects(P,O); applyCopyEffects(O,P);
  P.pow = Math.max(1, P.pow + P.powD);
  O.pow = Math.max(1, O.pow + O.powD);
  P.atk = Math.max(0, P.pow * (P.pulses+1) + P.atkD);
  O.atk = Math.max(0, O.pow * (O.pulses+1) + O.atkD);
  let winner;
  if(P.atk > O.atk) winner='p';
  else if(O.atk > P.atk) winner='o';
  else winner = (B.round % 2 === 0) ? 'o' : 'p';
  const W = winner==='p' ? P : O;
  const dmg = W.card.dmg + W.dmgD + (W.colapso ? W.card.dmg : 0);
  if(winner==='p'){ B.oHP = Math.max(0, B.oHP - dmg); B.pPulses += W.pulseWin||0; }
  else            { B.pHP = Math.max(0, B.pHP - dmg); B.oPulses += W.pulseWin||0; }
  const result = { round: B.round, winner, dmg,
    p: { cardId:pCardId, pow:P.pow, atk:P.atk, pulses:pPulses, colapso:pColapso, bonus:P.hasBonus },
    o: { cardId:oCardId, pow:O.pow, atk:O.atk, pulses:oPulses, colapso:oColapso, bonus:O.hasBonus } };
  B.history.push(result);
  B.pHand = B.pHand.filter(id=>id!==pCardId);
  B.oHand = B.oHand.filter(id=>id!==oCardId);
  B.round += 1;
  if(B.round>=4 || B.pHP===0 || B.oHP===0){
    B.finished = true;
    if(B.pHP===B.oHP) B.winner='draw';
    else B.winner = (B.pHP > B.oHP) ? 'p' : 'o';
    B.rewards = computeRewards(B);
  }
  return result;
}
function computeRewards(B){
  const cfg = MODES[B.mode] || MODES.casual;
  let shards=0, xp=0, elo=0;
  if(B.winner==='p'){
    shards = randInt(cfg.shardsW[0], cfg.shardsW[1]);
    xp = cfg.xpW; elo = cfg.eloW;
    PLAYER.wins++;
  } else if(B.winner==='o'){
    shards = Math.floor(cfg.shardsW[1]*0.15);
    xp = Math.floor(cfg.xpW*0.3); elo = -Math.floor(cfg.eloW*0.7);
    // Apply abandon-streak ELO penalty multiplier (consumed once, then cleared).
    try {
      const cur = JSON.parse(localStorage.getItem('shs_player') || '{}');
      if (cur.eloPenaltyMult && cur.eloPenaltyMult > 1) {
        elo = elo * cur.eloPenaltyMult;
        cur.eloPenaltyMult = 1;
        localStorage.setItem('shs_player', JSON.stringify(cur));
      }
    } catch(_){}
    PLAYER.losses++;
  } else {
    shards = Math.floor(cfg.shardsW[1]*0.4);
    xp = Math.floor(cfg.xpW*0.5); elo = 0;
    PLAYER.draws++;
  }
  PLAYER.shards += shards;
  PLAYER.xp += xp;
  PLAYER.elo = Math.max(0, PLAYER.elo + elo);
  while(PLAYER.xp >= PLAYER.level*100){
    PLAYER.xp -= PLAYER.level*100;
    PLAYER.level++;
  }
  return { shards, xp, elo };
}
function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }

function aiPickAction(B){
  const hand = B.oHand.map(id=>getCard(id));
  if(hand.length===0) return null;
  const round = B.round;
  const left = B.oPulses;
  let pulses = Math.min(left, Math.max(2, Math.floor(left/(4-round))));
  const card = hand.sort((a,b)=> (b.pow*(pulses+1)+b.dmg) - (a.pow*(pulses+1)+a.dmg))[0];
  let colapso = false;
  if(round>=2 && left >= pulses+3 && Math.random()<0.4) colapso = true;
  if(colapso) pulses = Math.min(pulses, Math.max(0, left-3));
  return { cardId: card.id, pulses, colapso };
}
