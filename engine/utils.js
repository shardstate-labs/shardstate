// ═══════════════════════════════════════════════════════════
// ENGINE UTILS — pure helpers (no DOM)
// ═══════════════════════════════════════════════════════════
function getCard(id){ return ALL_CARDS.find(c=>c.id===id) }
function getClan(id){ return CLANS[id] }
function rarColor(r){ return {C:'#8892A4',U:'#009B83',R:'#A89FF0',M:'#FF6B35'}[r]||'#fff' }
function rarLabel(r){ return {C:'Common',U:'Uncommon',R:'Rare',M:'Mythic'}[r]||r }
function starsStr(n){ return '★'.repeat(n)+'☆'.repeat(Math.max(0,5-n)) }
function lerp(a,b,t){ return a+(b-a)*t }

// ── LEVEL SYSTEM ─────────────────────────────────────────────
// Stars = max level (2–5). Stats interpolate linearly from pow[0]/dmg[0] (lv1) to pow[last]/dmg[last] (max).
// XP needed to advance from level N to N+1 (index 0 = lv1→lv2, etc.)
const LEVEL_XP = [50, 120, 220, 350];

function abilityUnlockLevel(stars){
  return (stars >= 5) ? 4 : 2;
}

function getCardStatsAtLevel(card, lv){
  if(!card) return {pow:0, dmg:0};
  const maxLv = card.stars || 2;
  const clampedLv = Math.max(1, Math.min(lv || 1, maxLv));
  const pow0   = card.pow[0];
  const powMax = card.pow[card.pow.length - 1];
  const dmg0   = card.dmg[0];
  const dmgMax = card.dmg[card.dmg.length - 1];
  if(maxLv <= 1) return {pow: powMax, dmg: dmgMax};
  const t = (clampedLv - 1) / (maxLv - 1);
  return {
    pow: Math.round(lerp(pow0, powMax, t)),
    dmg: Math.round(lerp(dmg0, dmgMax, t)),
  };
}

function getCardArt(card, lv){
  if(!card) return '';
  const maxLv = card.stars || 2;
  if(lv >= maxLv && card.visual?.image) return card.visual.image;
  return card.visual?.imageLv1 || card.visual?.image || '';
}

function cardHasAbility(card, lv){
  if(!card) return false;
  return lv >= abilityUnlockLevel(card.stars || 2);
}

// Add XP to a card in STATE.collection; handles level-ups up to card.stars
function addCardXp(cardId, xp){
  const card = getCard(cardId);
  if(!card) return;
  const maxLv = card.stars || 2;
  const entry = STATE.collection[cardId];
  if(!entry || entry.lv >= maxLv) return;
  entry.xp = (entry.xp || 0) + xp;
  while(entry.lv < maxLv){
    const threshold = LEVEL_XP[entry.lv - 1] || 50;
    if(entry.xp >= threshold){ entry.xp -= threshold; entry.lv++; }
    else break;
  }
}
