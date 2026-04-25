// SHARDSTATE — DATA: adapter on top of engine/cards.js (source of truth)
// engine/cards.js must be loaded BEFORE this file. It exposes globals:
//   ALL_CARDS  (rich schema, pow/dmg as [lv1,max] arrays, ability/bonus as objects)
//   CLANS      (name, emoji, color, bonus)

const RAR_COLOR  = { C:'#9CA3AF', U:'#22C55E', R:'#A78BFA', M:'#F97316' };
const RARITY_LABEL = { C:'COMMON', U:'UNCOMMON', R:'RARE', M:'MYTHIC' };

(function mergeCustomCards(){
  try {
    const raw = localStorage.getItem('shs_custom_cards');
    if(!raw) return;
    const customs = JSON.parse(raw);
    if(!Array.isArray(customs) || !customs.length) return;
    const idx = new Map(ALL_CARDS.map((c,i)=>[c.id,i]));
    customs.forEach(c => {
      if(idx.has(c.id)) ALL_CARDS[idx.get(c.id)] = c;
      else              ALL_CARDS.push(c);
    });
  } catch(_){}
})();

(function darkenClansForUI(){
  const darken = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n>>16)&255) - 80);
    const g = Math.max(0, ((n>>8)&255)  - 80);
    const b = Math.max(0,  (n&255)      - 80);
    return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
  };
  Object.values(CLANS).forEach(c => {
    if(!c.glyph) c.glyph = c.emoji || '◆';
    if(!c.hex2)  c.hex2  = darken(c.color);
  });
})();

(function normalizeCards(){
  ALL_CARDS.forEach(c => {
    if(Array.isArray(c.pow)) c.pow = c.pow[0];
    if(Array.isArray(c.dmg)) c.dmg = c.dmg[0];
    if(c.rarity && c.rarity.length > 1){
      c.rarity = ({common:'C',uncommon:'U',rare:'R',mythic:'M'})[c.rarity] || c.rarity;
    }
    if(c.bonus && typeof c.bonus === 'object') c.bonus = c.bonus.text || '';
    if(c.ability && typeof c.ability === 'object') c.ability = c.ability.text || '';
  });
  // Apply normalized ability + clan-bonus mapping (deterministic per card.id).
  if (typeof assignAbilities === 'function') assignAbilities(ALL_CARDS);
})();

const ARENA_BG = [
  '17f4c439-bda7-438f-a9ed-afc78fc234d9.jpg',
  '1f047c25-b587-46af-8a92-419d6231931c.jpg',
  '25882dfb-6e22-4abb-90f4-9295833b2f1f.jpg',
  '33f7b69f-ea00-48a7-84e7-fc4599a498fb.jpg',
  '340fdee8-9fb0-40fe-975e-845d35ec66bd.jpg',
  '356166f7-cf56-480a-a6e9-e57f997f12ed.jpg',
  '440225c4-cbc7-4c3a-b76c-f68fc0710f8c.jpg',
  '4f802a8b-75de-468c-ad6a-9b764c5ff3fb.jpg',
  '5af12af4-d7e5-4e48-8a85-34ad544ee9b9.jpg',
  '6b32a3c6-4628-4d3f-82af-20ab6a18e8b1.jpg',
  '70dd9c2d-d25b-4b9e-bf41-244d9afde64c.jpg',
  'cd0e7088-ad90-402e-bc64-29122d85321b.jpg',
];
function pickArena(){ return '../Assets/Battle-Arenas/' + ARENA_BG[Math.floor(Math.random()*ARENA_BG.length)]; }

function randomDeck(){
  const pool = [...ALL_CARDS].sort(()=>Math.random()-0.5);
  return pool.slice(0,8).map(c=>c.id);
}
function getCard(id){ return ALL_CARDS.find(c=>c.id===id); }
function getClan(id){ return CLANS[id]; }
