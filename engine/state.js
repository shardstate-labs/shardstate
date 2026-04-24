// ═══════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════
const STATE = {
  shards: 1240, flux: 3, shs: 0,
  collection: {}, // cardId -> {lv, xp}
  deck: [],       // array of cardIds (max 8)
  selectedMode: 'casual',
  wallet: null,
  marketFilter: 'cards',
  clanFilter: 'all',
  collectionFilters: {clan:'all', stars:'all', rarity:'all', owned:'all', page:1, pageSize:15},
  deckPresets: [],
  battle: {
    active: false, round:0, playerLife:12, oppLife:12,
    playerPillz:12, oppPillz:12,
    selectedCard:null, selectedPillz:0, colapso:false,
    playerHand:[], oppHand:[],
    playerDeckPool: [],
    oppDeckPool: [],
    mode: 'casual',
    modeLabel: 'CASUAL',
    pvp: false,
    academyLessonIdx: 0,
    academyRoundHintShown: false,
    roundResults: [],
    playerNoActionRounds: 0,
    turnMsLeft: 180000,
    turnTimer: null,
  }
};

// ═══════════════════════════════════════════════════════════
// BATTLE ARENAS (random background per battle)
// NOTE: This build runs locally; arenas are loaded via relative path.
// ═══════════════════════════════════════════════════════════
const BATTLE_ARENA_BASES = [
  'Assets/Battle-Arenas/',
  './Assets/Battle-Arenas/',
  '/Assets/Battle-Arenas/',
  '../Assets/Battle-Arenas/',
  '../../Assets/Battle-Arenas/',
];
const BATTLE_ARENAS = [
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
let _lastArenaFile = null;
function pickRandomArenaUrl(){
  if(!BATTLE_ARENAS.length) return null;
  const maxTries = 6;
  let file = BATTLE_ARENAS[Math.floor(Math.random()*BATTLE_ARENAS.length)];
  for(let i=0;i<maxTries && BATTLE_ARENAS.length>1 && file===_lastArenaFile;i++){
    file = BATTLE_ARENAS[Math.floor(Math.random()*BATTLE_ARENAS.length)];
  }
  _lastArenaFile = file;
  return file;
}
function applyBattleArenaBg(file){
  const bg = document.getElementById('battle-arena-bg');
  if(!bg) return;
  if(!file){
    bg.style.removeProperty('--arena-img');
    return;
  }
  const cacheKey = 'ss_arena_cache_v1:' + file;
  try{
    const cached = localStorage.getItem(cacheKey);
    if(cached && cached.startsWith('data:image/')){
      bg.style.setProperty('--arena-img', `url('${cached}')`);
      return;
    }
  }catch(_e){}

  const bases = (Array.isArray(BATTLE_ARENA_BASES) && BATTLE_ARENA_BASES.length) ? BATTLE_ARENA_BASES : ['Assets/Battle-Arenas/'];
  let idx = 0;
  const tryLoad = ()=>{
    if(idx>=bases.length){
      bg.style.removeProperty('--arena-img');
      return;
    }
    const url = bases[idx] + file;
    const img = new Image();
    img.onload = ()=>{
      bg.style.setProperty('--arena-img', `url('${url}')`);
      try{
        const c = document.createElement('canvas');
        c.width = img.naturalWidth||1;
        c.height = img.naturalHeight||1;
        const ctx = c.getContext('2d');
        if(ctx){
          ctx.drawImage(img,0,0);
          const data = c.toDataURL('image/jpeg', 0.85);
          if(data && data.length < 2_000_000){
            localStorage.setItem(cacheKey, data);
          }
        }
      }catch(_e){}
    };
    img.onerror = ()=>{ idx++; tryLoad(); };
    img.src = url;
  };
  tryLoad();
}

function applyStarterCollection(){
  STATE.collection = {};
  ['skrell','nyx','ignar','kernel','calyx','ripper','quanta','maestra',
   'monnet','tendra','grimore','nullify'].forEach((id,i)=>{
    STATE.collection[id] = {lv:i<4?1:2, xp: i<4?30:80};
  });
}
applyStarterCollection();
