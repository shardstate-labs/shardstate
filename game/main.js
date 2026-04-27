// SHARDSTATE — MAIN: bootstrap + screen flow + UI bridge
// ============================================================

function importFromWeb(){
  try {
    const raw = localStorage.getItem('shardstate_deck');
    if(raw){
      const ids = JSON.parse(raw);
      if(Array.isArray(ids) && ids.length === 8 && ids.every(id => !!getCard(id))){
        APP_IMPORT.deck = ids;
      }
    }
    const pRaw = localStorage.getItem('shardstate_player');
    if(pRaw){
      const p = JSON.parse(pRaw);
      if(p && typeof p === 'object') APP_IMPORT.player = p;
    }
  } catch(e){ /* fall back to defaults */ }
}
const APP_IMPORT = { deck: null, player: null };
importFromWeb();

// Hard gate: refuse to start if /gamehub never handed us a valid deck.
// This is the defense layer behind the gamehub launchPWA modal.
function showNoDeckOverlay(){
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;background:rgba(8,10,14,0.94);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:"Space Grotesk",system-ui,sans-serif;padding:24px;backdrop-filter:blur(8px)';
  o.innerHTML = `
    <div style="max-width:440px;background:linear-gradient(180deg,#0f1218,#0a0c10);border:1px solid #2a2f3a;border-radius:18px;padding:36px 32px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.6),0 0 0 1px rgba(255,180,0,0.18);">
      <div style="font-size:48px;line-height:1;margin-bottom:16px;color:#FFB400;text-shadow:0 0 24px rgba(255,180,0,0.5)">⚠</div>
      <div style="font-family:Orbitron,sans-serif;font-weight:900;font-size:1.05rem;letter-spacing:0.06em;color:#fff;margin-bottom:8px">DECK REQUERIDO</div>
      <div style="font-size:0.88rem;color:#a8aebb;line-height:1.5;margin-bottom:24px">Necesitás un deck de 8 cartas armado en el GAMEHUB antes de poder jugar. Volvé al hub para configurarlo.</div>
      <button id="no-deck-back" style="background:linear-gradient(180deg,#00E0FF,#0095B5);color:#001218;border:none;padding:13px 28px;border-radius:10px;font-family:Orbitron,sans-serif;font-weight:900;font-size:0.85rem;letter-spacing:0.08em;cursor:pointer;box-shadow:0 4px 16px rgba(0,224,255,0.3)">VOLVER AL GAMEHUB →</button>
    </div>`;
  document.body.appendChild(o);
  o.querySelector('#no-deck-back').addEventListener('click', () => {
    // Try to close this tab; if it was opened by gamehub it'll work.
    // Fallback: navigate back to /gamehub/ in this tab.
    try { window.close(); } catch(_){}
    setTimeout(() => { window.location.href = '../gamehub/'; }, 80);
  });
}
if(APP_IMPORT.player){
  if(APP_IMPORT.player.name)   PLAYER.name   = APP_IMPORT.player.name;
  if(APP_IMPORT.player.club)   PLAYER.club   = APP_IMPORT.player.club;
  if(APP_IMPORT.player.elo    != null) PLAYER.elo    = APP_IMPORT.player.elo;
  if(APP_IMPORT.player.shards != null) PLAYER.shards = APP_IMPORT.player.shards;
  if(APP_IMPORT.player.level  != null) PLAYER.level  = APP_IMPORT.player.level;
}

const APP = {
  screen: 'loading',
  deck: APP_IMPORT.deck || randomDeck(),
  battle: null,
  pvp: null,
  selectedCardId: null,
  pendingPulses: 0,
  pendingColapso: false,
  inputLocked: false,
  logOpen: false,
  statusKey: null,
  matchmaking: null,
  surrenderTimerId: null,
  surrenderRemaining: 10,
};

const PVP_MODES = new Set(['casual','ranked']);
const GAME_I18N = {
  es: {
    battleLog:'Registro de combate', surrender:'Rendirse', music:'Música on/off',
    round:'RONDA', yourTurn:'TU TURNO', lockMove:'ELEGÍ TU MOVIMIENTO',
    waitingRival:'RIVAL PIERDE TURNO EN', rivalLocked:'RIVAL LISTO · APURATE',
    clash:'COMBATE', roundWon:'RONDA GANADA', roundLost:'RONDA PERDIDA', draw:'EMPATE',
    pulse:'PULSOS', selected:'Seleccionada', cancel:'Cancelar', fight:'COMBATIR',
    battleStarted:'Combate iniciado', pvpReady:'PvP enlazado · broadcast listo',
    rivalAction:'Rival listo', sendFailed:'Falló envío PvP · reintenta',
    timeoutAuto:'Tiempo agotado · jugada automática', doubleTimeout:'Doble timeout · rendición forzada',
    rivalTimeout:'Rival sin respuesta · esperando cierre',
    aiBoot:'INICIANDO ENTRENAMIENTO IA', scanOpponent:'BUSCANDO RIVAL EN LA RED',
    waitingLink:'ESPERANDO LINK RIVAL', pvpOpenFailed:'No se pudo abrir la partida PvP.',
    pvpUnavailable:'PvP no disponible.', signinPvp:'Inicia sesión para jugar PvP.',
    abandonLock:'Penalización por abandonos. Vuelve a jugar en',
    onlinePlayers:'JUGADORES ONLINE', longWait:'Parece que estás esperando hace bastante.. quizás sea mejor probar con otro modo de juego',
    emptyWait:'Psssst.. no hay jugadoras a la vista. Mientras tanto podés usar el modo de entrenamiento.. PROTOCOL OBSERVA.. 010101010000010100101',
    queueClosed:'No se encontró rival. Link cerrado.',
    surrenderTitle:'¿Estás seguro que quieres rendirte?', surrenderCopy:'Cuenta como abandono. La conexión se corta y el rival gana el combate.',
    yes:'SI', no:'NO', abandon:'ABANDONAR',
    win:'VICTORIA', defeat:'DERROTA', result:'RESULTADO', shards:'SHARDS', xp:'XP', elo:'ELO',
    cardWin:'VICTORIA', cardLoss:'DERROTA',
    menu:'Menú', rematch:'Revancha', linkStable:'SHARDS ASEGURADOS · LINK ESTABLE',
    linkSevered:'LINK CORTADO · PROTOCOL OBSERVA', impasse:'IMPASSE · NADIE PREVALECE',
  },
  en: {
    battleLog:'Battle log', surrender:'Surrender', music:'Music on/off',
    round:'ROUND', yourTurn:'YOUR TURN', lockMove:'LOCK YOUR MOVE',
    waitingRival:'RIVAL LOSES TURN IN', rivalLocked:'RIVAL LOCKED · CHOOSE FAST',
    clash:'CLASH', roundWon:'ROUND WON', roundLost:'ROUND LOST', draw:'DRAW',
    pulse:'PULSE', selected:'Selected', cancel:'Cancel', fight:'FIGHT',
    battleStarted:'Battle started', pvpReady:'PvP link active · broadcast ready',
    rivalAction:'Rival action locked', sendFailed:'PvP send failed · retry',
    timeoutAuto:'Time expired · automatic move', doubleTimeout:'Double timeout · forced surrender',
    rivalTimeout:'Rival timeout · waiting close',
    aiBoot:'BOOTING AI SPARRING', scanOpponent:'SCANNING NETWORK FOR OPPONENT',
    waitingLink:'WAITING FOR RIVAL LINK', pvpOpenFailed:'Could not open PvP match.',
    pvpUnavailable:'PvP unavailable.', signinPvp:'Sign in to play PvP.',
    abandonLock:'Abandon penalty. Play again in',
    onlinePlayers:'PLAYERS ONLINE', longWait:'Looks like you have been waiting a while.. maybe try another game mode',
    emptyWait:'Psssst.. no players in sight. Meanwhile you can use training mode.. PROTOCOL OBSERVES.. 010101010000010100101',
    queueClosed:'No rival found. Link closed.',
    surrenderTitle:'Are you sure you want to surrender?', surrenderCopy:'Counts as abandon. The link breaks and your rival wins the combat.',
    yes:'YES', no:'NO', abandon:'ABANDON',
    win:'VICTORY', defeat:'DEFEAT', result:'RESULT', shards:'SHARDS', xp:'XP', elo:'ELO',
    cardWin:'VICTORY', cardLoss:'DEFEAT',
    menu:'Menu', rematch:'Rematch', linkStable:'SHARDS SECURED · LINK STABLE',
    linkSevered:'LINK SEVERED · PROTOCOL OBSERVES', impasse:'IMPASSE · NO ECHO PREVAILS',
  },
};
let GAME_LANG = localStorage.getItem('shs_lang') || 'es';
function gt(key){ return (GAME_I18N[GAME_LANG] || GAME_I18N.es)[key] || key; }
function setGameLang(lang){
  GAME_LANG = lang === 'en' ? 'en' : 'es';
  localStorage.setItem('shs_lang', GAME_LANG);
  document.documentElement.lang = GAME_LANG;
  applyGameLang();
}
function toggleGameLang(){ setGameLang(GAME_LANG === 'es' ? 'en' : 'es'); }

const MODE_ORDER = ['training','casual','ranked'];
const MODE_META = {
  training: { tag:'PRACTICE', desc:'Player deck vs IA. Muy pocas recompensas, cero ELO.' },
  casual:   { tag:'PVP',      desc:'Player vs Player off-chain. SHARDS y XP normal-bajo, sin ELO.' },
  ranked:   { tag:'RANKED',   desc:'PvP off-chain con ELO para leaderboard semanal.' },
};

function bootGame(){
  initFX();
  setGameLang(GAME_LANG);
  // Hard gate: if /gamehub didn't hand us a valid 8-card deck, refuse to start.
  if(!APP_IMPORT.deck){
    showNoDeckOverlay();
    return;
  }
  const fill = document.getElementById('loading-fill');
  if(fill) fill.style.width = '100%';
  goScreen('menu');
  renderMenu();
  applyGameLang();
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bootGame, { once:true });
} else {
  bootGame();
}

function goScreen(name){
  APP.screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const node = document.getElementById('screen-'+name);
  if(node) node.classList.add('active');
}

function applyGameLang(){
  const map = {
    '.round-tag':'round',
    '#center-status': APP.statusKey || (APP.battle?.pvp ? 'lockMove' : 'yourTurn'),
    '#ap-name': null,
    '.ap-head .lbl':'selected',
    '.btn-cancel':'cancel',
    '#btn-fight':'fight',
    '#rw-shards-box .lbl':'shards',
    '#rw-xp-box .lbl':'xp',
    '#rw-elo-box .lbl':'elo',
    '.end-actions .btn-ghost':'menu',
    '.end-actions .btn-primary':'rematch',
    '#surrender-title':'surrenderTitle',
    '#surrender-copy':'surrenderCopy',
    '#surrender-no':'no',
    '#surrender-yes':'yes',
    '.surrender-tag':'abandon',
    '.mm-cancel':'cancel',
  };
  Object.entries(map).forEach(([sel,key]) => {
    if(!key) return;
    document.querySelectorAll(sel).forEach(el => { el.textContent = gt(key); });
  });
  document.querySelectorAll('.vital-row .lbl').forEach(el => {
    if(el.textContent.trim().toUpperCase() === 'PULSE' || el.textContent.trim().toUpperCase() === 'PULSOS') {
      el.textContent = gt('pulse');
    }
  });
  const logBtn = document.querySelector('.battle-tools .tool-btn[onclick="toggleLog()"]');
  if(logBtn) logBtn.title = gt('battleLog');
  const surrenderBtn = document.querySelector('.surrender-btn');
  if(surrenderBtn) surrenderBtn.title = gt('surrender');
  const bgmBtn = document.getElementById('bgm-toggle');
  if(bgmBtn) bgmBtn.title = gt('music');
  const langBtn = document.getElementById('game-lang-toggle');
  if(langBtn) langBtn.textContent = GAME_LANG === 'es' ? 'EN' : 'ES';
  updateMatchmakingHud();
}

function fmtClock(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}

function updateMatchmakingHud(){
  const mm = APP.matchmaking;
  const timer = document.getElementById('mm-timer');
  const online = document.getElementById('mm-online');
  const hint = document.getElementById('mm-hint');
  if(!timer || !online || !hint) return;
  const elapsed = mm ? Date.now() - mm.startedAt : 0;
  timer.textContent = fmtClock(elapsed);
  online.textContent = `● ${gt('onlinePlayers')}: ${Math.max(1, mm?.online || 1)}`;
  hint.textContent = '';
  hint.classList.remove('warn');
  if(elapsed >= 180000) {
    hint.textContent = gt('emptyWait');
    hint.classList.add('warn');
  } else if(elapsed >= 120000) {
    hint.textContent = gt('longWait');
  }
}

async function startMatchmakingHud(mode, uid){
  stopMatchmakingHud(false);
  APP.matchmaking = { mode, uid, startedAt: Date.now(), online: 1, closed:false };
  updateMatchmakingHud();
  APP.matchmaking.timerId = setInterval(() => {
    updateMatchmakingHud();
    const mm = APP.matchmaking;
    if(!mm || mm.closed || APP.screen !== 'matchmaking') return;
    if(Date.now() - mm.startedAt >= 190000) {
      mm.closed = true;
      const sub = document.getElementById('mm-sub');
      if(sub) sub.textContent = gt('queueClosed');
      setTimeout(() => backToMenu(), 1200);
    }
  }, 1000);
  if(PVP_MODES.has(mode) && uid && window.SB) {
    try {
      const sb = await SB.client();
      const ch = sb.channel('mm-presence:' + mode, { config:{ presence:{ key:uid } } });
      ch.on('presence', { event:'sync' }, () => {
        const state = ch.presenceState();
        const count = Object.values(state || {}).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 1), 0);
        if(APP.matchmaking) {
          APP.matchmaking.online = Math.max(1, count);
          updateMatchmakingHud();
        }
      });
      ch.subscribe(status => {
        if(status === 'SUBSCRIBED') ch.track({ uid, mode, at: Date.now() });
      });
      APP.matchmaking.presence = { channel:ch, sb };
    } catch(err) {
      console.warn('matchmaking presence failed', err);
    }
  }
}

function stopMatchmakingHud(cancelQueue=true){
  const mm = APP.matchmaking;
  if(!mm) return;
  if(mm.timerId) clearInterval(mm.timerId);
  if(mm.pollId) clearInterval(mm.pollId);
  if(mm.presence?.sb && mm.presence?.channel) {
    try { mm.presence.sb.removeChannel(mm.presence.channel); } catch(_){}
  }
  APP.matchmaking = null;
  if(cancelQueue && APP.screen === 'matchmaking' && window.SHS_PVP) {
    try { SHS_PVP.cancelQueue(); } catch(_){}
  }
}

// ─── LOADING ─────────────────────────────────────────────────
function runLoading(done){
  const fill = document.getElementById('loading-fill');
  const sub  = document.getElementById('loading-sub');
  const steps = [
    'INITIALIZING NEURAL LINK',
    'COMPILING CLAN MANIFEST',
    'CALIBRATING PULSO RESERVES',
    'SYNCING SHARD LEDGER',
    'CONNECTING TO PROTOCOL',
  ];
  let p = 0, i = 0;
  sub.textContent = steps[0];
  const t = setInterval(()=>{
    p += 5 + Math.random()*7;
    fill.style.width = Math.min(100, p) + '%';
    if(p > (i+1) * (100/steps.length) && i < steps.length-1){
      i++; sub.textContent = steps[i];
    }
    if(p >= 100){
      clearInterval(t);
      sub.textContent = 'LINK ESTABLISHED';
      setTimeout(done, 320);
    }
  }, 90);
}

// ─── MENU ────────────────────────────────────────────────────
function renderMenu(){ renderModes(); }

const MODE_ICONS = {
  training: { glyph:'◈', title:'Entrenamiento',     lines:['TU DECK · IA RANDOM','SHARDS + XP BAJO'] },
  casual:   { glyph:'◇', title:'Casual PvP',        lines:['PLAYER VS PLAYER','SIN ELO · REWARD BAJO'] },
  ranked:   { glyph:'◆', title:'Ranked off-chain',  lines:['ELO SEMANAL','REWARD NORMAL'] },
};

function renderModes(){
  const grid = document.getElementById('modes-grid');
  grid.innerHTML = '';
  MODE_ORDER.forEach((key, i) => {
    const cfg  = MODES[key];
    const meta = MODE_META[key];
    const ico  = MODE_ICONS[key];
    const sw = (cfg.shardsW[0] || cfg.shardsW[1])
      ? `+${cfg.shardsW[0]}-${cfg.shardsW[1]}`
      : '—';
    const card = document.createElement('div');
    card.className = 'mode-card ' + key;
    card.style.animationDelay = (i * 90) + 'ms';
    card.onclick = () => startMode(key);
    card.innerHTML = `
      <div class="mc-ornament">
        <div class="mc-glyph">${ico.glyph}</div>
        <div class="mc-scan"></div>
        <div class="mc-ring"></div>
      </div>
      <div class="mc-body">
        <div class="mc-tag">${meta.tag}</div>
        <div class="mc-name">${cfg.label}</div>
        <div class="mc-sub">${ico.title}</div>
        <div class="mc-desc">${meta.desc}</div>
        <div class="mc-lines">
          ${ico.lines.map(l => `<div class="mc-line">› ${l}</div>`).join('')}
        </div>
        <div class="mc-rewards">
          <div><span class="val">${sw}</span><span class="lbl">SHARDS</span></div>
          <div><span class="val">+${cfg.xpW}</span><span class="lbl">XP</span></div>
          <div><span class="val">${cfg.eloW>=0?'+':''}${cfg.eloW}</span><span class="lbl">ELO</span></div>
        </div>
        <div class="mc-cta">
          <span>ENTRAR</span>
          <span class="mc-arrow">→</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function rerollDeck(){ APP.deck = randomDeck(); }

function seededHand(deckIds, seed){
  let h = 2166136261;
  String(seed || '').split('').forEach(ch => {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  });
  const rand = () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return [...deckIds]
    .map(id => ({ id, r: rand() }))
    .sort((a,b) => a.r - b.r)
    .slice(0,4)
    .map(x => x.id);
}

// ─── MATCHMAKING ─────────────────────────────────────────────
function startMode(mode){
  // Abandon-streak lockout (5 min after 3 abandons in a row).
  try {
    const cur = JSON.parse(localStorage.getItem('shs_player') || '{}');
    if (cur.lockoutUntil && Date.now() < cur.lockoutUntil) {
      const sec = Math.ceil((cur.lockoutUntil - Date.now())/1000);
      const mm = Math.floor(sec/60), ss = String(sec%60).padStart(2,'0');
      alert(`⛔ ${gt('abandonLock')} ${mm}:${ss}.`);
      return;
    }
  } catch(_){}
  goScreen('matchmaking');
  document.getElementById('mm-tag').textContent   = MODE_META[mode].tag;
  document.getElementById('mm-title').textContent = MODES[mode].label;
  document.getElementById('mm-sub').textContent =
    (mode === 'training') ? gt('aiBoot') : gt('scanOpponent');
  if(PVP_MODES.has(mode)){
    startPvpMode(mode);
    return;
  }
  setTimeout(()=> beginBattle(mode), 1300 + Math.random()*900);
}

async function startPvpMode(mode){
  try {
    if(!window.SHS_PVP || !window.SB) throw new Error('PvP offline');
    const user = await SB.getUser();
    const uid = user?.id || APP_IMPORT.player?.uid;
    if(!uid) throw new Error(gt('signinPvp'));
    APP.pvp = { mode, uid, localMove:null, remoteMove:null, resolving:false, matched:false };
    await startMatchmakingHud(mode, uid);
    const enterMatch = async row => {
      if(APP.pvp?.matched) return;
      APP.pvp.matched = true;
      await beginPvpBattle(mode, row, uid);
    };
    let watcher = null;
    try {
      watcher = await SHS_PVP.watchForMatch(uid, row => {
        enterMatch(row).catch(err => {
          console.warn('beginPvpBattle failed', err);
          alert(gt('pvpOpenFailed'));
          backToMenu();
        });
      });
      APP.pvp.watcher = watcher;
    } catch(err) {
      console.warn('PvP match watcher unavailable; polling fallback active', err);
    }
    const rsp = await SHS_PVP.findMatch(mode, APP.deck);
    if(rsp && !rsp.queued){
      if(watcher?.unsubscribe) await watcher.unsubscribe();
      await enterMatch(rsp);
    } else {
      document.getElementById('mm-sub').textContent = gt('waitingLink');
      const pollActive = async () => {
        if(APP.pvp?.matched || APP.screen !== 'matchmaking') return;
        try {
          const row = await SHS_PVP.myActiveMatch(uid, mode);
          if(row) await enterMatch(row);
        } catch(err) {
          console.warn('active match poll failed', err);
        }
      };
      if(APP.matchmaking) APP.matchmaking.pollId = setInterval(pollActive, 2000);
      setTimeout(pollActive, 600);
    }
  } catch(err) {
    console.warn('PvP queue failed', err);
    alert(err?.message || gt('pvpUnavailable'));
    backToMenu();
  }
}

function pickMatchValue(row, keys, fallback){
  for(const k of keys){
    if(row && row[k] != null) return row[k];
  }
  return fallback;
}

function normalizePvpMatch(row, uid){
  const p1 = pickMatchValue(row, ['p1_user_id','p1','player1_user_id','player1_id'], null);
  const p2 = pickMatchValue(row, ['p2_user_id','p2','player2_user_id','player2_id'], null);
  const side = (row.side || (uid && p2 === uid ? 'p2' : 'p1'));
  const isP1 = side === 'p1';
  return {
    id: pickMatchValue(row, ['match_id','id'], null),
    side,
    opponentId: pickMatchValue(row, ['opponent_id'], isP1 ? p2 : p1),
    opponentDeck: pickMatchValue(row, isP1
      ? ['p2_deck','player2_deck','opponent_deck','deck_p2']
      : ['p1_deck','player1_deck','opponent_deck','deck_p1'], []),
  };
}

async function beginPvpBattle(mode, row, uid){
  const match = normalizePvpMatch(row, uid);
  if(!match.id) throw new Error('Match id missing');
  stopMatchmakingHud(false);
  if(APP.pvp?.watcher?.unsubscribe) await APP.pvp.watcher.unsubscribe();
  const channel = await SHS_PVP.openMatch(match.id, match.side);
  APP.pvp = Object.assign(APP.pvp || {}, {
    mode, uid, matchId:match.id, side:match.side, opponentId:match.opponentId,
    channel, localMove:null, remoteMove:null, resolving:false, finalized:false,
  });
  channel.onMove(payload => handlePvpMove(payload));
  beginBattle(mode, {
    id: match.id,
    side: match.side,
    opponentId: match.opponentId,
    opponentDeck: match.opponentDeck,
  });
  loadPvpOpponentProfile(match.opponentId);
}

async function loadPvpOpponentProfile(uid){
  if(!uid || !window.SB || !APP.battle?.pvp) return;
  try {
    const r = await SB.loadProfile(uid);
    const name = r?.profile?.username || r?.profile?.display_name || ('RIVAL ' + String(uid).slice(0, 6).toUpperCase());
    const lvl = (r?.gameState?.level ?? r?.profile?.level ?? 1) | 0;
    const elo = (r?.gameState?.elo ?? r?.profile?.elo ?? 0) | 0;
    APP.battle.opponent.name = name;
    APP.battle.opponent.club = `LV ${Math.max(1, lvl)} · ELO ${elo}`;
    const nameEl = document.getElementById('opp-name');
    const clubEl = document.getElementById('opp-club');
    const avatarEl = document.getElementById('opp-avatar');
    if(nameEl) nameEl.textContent = APP.battle.opponent.name;
    if(clubEl) clubEl.textContent = APP.battle.opponent.club;
    if(avatarEl) avatarEl.textContent = APP.battle.opponent.name.charAt(0);
  } catch(err) {
    console.warn('Opponent profile load failed', err);
  }
}

// ─── BATTLE ──────────────────────────────────────────────────
function beginBattle(mode, pvpMatch){
  APP.battle = newBattle(mode);
  APP.battle.pvp = !!pvpMatch;
  APP.battle.matchId = pvpMatch?.id || null;
  APP.battle.pDeck = [...APP.deck];
  APP.battle.oDeck = Array.isArray(pvpMatch?.opponentDeck) && pvpMatch.opponentDeck.length
    ? pvpMatch.opponentDeck.slice(0, 8)
    : randomDeck();
  if(pvpMatch){
    const mySide = pvpMatch.side || 'p1';
    const opSide = mySide === 'p1' ? 'p2' : 'p1';
    APP.battle.pHand = seededHand(APP.battle.pDeck, pvpMatch.id + ':' + mySide);
    APP.battle.oHand = seededHand(APP.battle.oDeck, pvpMatch.id + ':' + opSide);
  } else {
    APP.battle.pHand = dealHand(APP.battle.pDeck);
    APP.battle.oHand = dealHand(APP.battle.oDeck);
  }
  if(pvpMatch){
    APP.battle.opponent = {
      name: pvpMatch.opponentId ? ('RIVAL ' + String(pvpMatch.opponentId).slice(0, 6).toUpperCase()) : 'RIVAL',
      club: 'LOADING PROFILE',
    };
  }

  goScreen('battle');

  // arena background
  const bg = document.getElementById('arena-bg');
  bg.style.backgroundImage = `url('${APP.battle.arenaUrl}')`;

  // identities
  document.getElementById('me-name').textContent  = PLAYER.name;
  document.getElementById('me-club').textContent  = PLAYER.club;
  document.getElementById('me-avatar').textContent = PLAYER.name.charAt(0);
  document.getElementById('opp-name').textContent  = APP.battle.opponent.name;
  document.getElementById('opp-club').textContent  = APP.battle.opponent.club;
  document.getElementById('opp-avatar').textContent = APP.battle.opponent.name.charAt(0);

  // Snapshot original 4-card hands so we can persist played cards visually.
  APP.handSnapshot = {
    me:  [...APP.battle.pHand],
    opp: [...APP.battle.oHand],
  };
  APP.cardOutcomes = { me:{}, opp:{} }; // {cardId: 'win'|'loss'|'draw'}
  APP.timeoutStreak = 0;
  layoutHand('me',  APP.handSnapshot.me,  false);
  layoutHand('opp', APP.handSnapshot.opp, true);
  renderHud();
  hideActionPanel();
  ensureBattleTopUI();
  appendLog(`${gt('battleStarted')} · ${MODES[mode].label}`, '');
  if(pvpMatch) appendLog(gt('pvpReady'), '');
  showTurnBanner(()=> startRoundTimer());
}

function layoutHand(side, ids, faceDown){
  const row = document.getElementById('hand-' + side);
  row.innerHTML = '';
  ids.forEach(id => {
    const c  = getCard(id);
    const el = buildCardEl(c, {});
    el.dataset.cardId = id;
    const stillInHand = (side==='me' ? APP.battle.pHand : APP.battle.oHand).includes(id);
    if(!stillInHand){
      el.classList.add('played');
      const outcome = APP.cardOutcomes[side][id];
      if (outcome === 'win')  el.classList.add('card-victory');
      if (outcome === 'loss') el.classList.add('card-loser');
      const tag = document.createElement('div');
      tag.className = 'card-result-tag ' + (outcome==='win'?'win':outcome==='loss'?'lose':'draw');
      tag.textContent = outcome === 'win' ? gt('cardWin') : outcome === 'loss' ? gt('cardLoss') : gt('draw');
      el.appendChild(tag);
    } else if(side === 'me'){
      el.onclick = () => selectCard(id);
    } else if(side === 'opp'){
      el.onclick = () => openBattleCardDetail(id);
    }
    row.appendChild(el);
  });
}

// ─── HUD ─────────────────────────────────────────────────────
function renderHud(){
  const B = APP.battle;
  document.getElementById('p-hp-fill').style.width    = (B.pHP / 12 * 100) + '%';
  document.getElementById('o-hp-fill').style.width    = (B.oHP / 12 * 100) + '%';
  document.getElementById('p-pulse-fill').style.width = (B.pPulses / 12 * 100) + '%';
  document.getElementById('o-pulse-fill').style.width = (B.oPulses / 12 * 100) + '%';
  document.getElementById('p-hp-num').textContent     = B.pHP;
  document.getElementById('o-hp-num').textContent     = B.oHP;
  document.getElementById('p-pulse-num').textContent  = B.pPulses;
  document.getElementById('o-pulse-num').textContent  = B.oPulses;
  document.getElementById('round-n').textContent      = Math.min(4, B.round + 1);
  const pPoisoned = !!B._status?.poisons?.p?.length;
  const oPoisoned = !!B._status?.poisons?.o?.length;
  document.querySelector('.battle-hud.bot .bar.hp')?.classList.toggle('poisoned', pPoisoned);
  document.querySelector('.battle-hud.top .bar.hp')?.classList.toggle('poisoned', oPoisoned);

  const dots = document.querySelectorAll('#round-dots .round-dot');
  dots.forEach((d, i) => {
    d.className = 'round-dot';
    if(i < B.history.length){
      const r = B.history[i];
      if(r.winner === 'p') d.classList.add('win');
      else if(r.winner === 'o') d.classList.add('loss');
      else d.classList.add('draw');
    } else if(i === B.round){
      d.classList.add('curr');
    }
  });
}

function setStatus(text, oppTurn, key){
  const s = document.getElementById('center-status');
  if (!s) return;
  APP.statusKey = key || null;
  s.textContent = text;
  s.className = 'center-status' + (oppTurn ? ' opp-turn' : '');
}

// ─── ROUND TIMER + TURN BANNER + AUDIO ───────────────────────
const ROUND_TIME_MS = 120 * 1000;
function ensureBattleTopUI(){
  // Stack YOUR TURN above TIMER, between decks (no card overlap).
  if (!document.getElementById('round-timer')) {
    const status = document.getElementById('center-status');
    if (status && !status.parentElement.classList.contains('turn-stack')) {
      const stack = document.createElement('div');
      stack.className = 'turn-stack';
      status.parentNode.insertBefore(stack, status);
      stack.appendChild(status);
      const t = document.createElement('div');
      t.className = 'round-timer';
      t.id = 'round-timer';
      t.textContent = '02:00';
      stack.appendChild(t);
    }
  }
  // Audio controls inline with log + surrender buttons.
  const tools = document.querySelector('.battle-tools');
  if (tools && !document.getElementById('game-lang-toggle')) {
    const lang = document.createElement('button');
    lang.className = 'tool-btn lang-btn';
    lang.id = 'game-lang-toggle';
    lang.title = 'Language / Idioma';
    lang.textContent = GAME_LANG === 'es' ? 'EN' : 'ES';
    lang.onclick = toggleGameLang;
    tools.appendChild(lang);
  }
  if (tools && !document.getElementById('bgm-toggle')) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn'; btn.id = 'bgm-toggle';
    btn.title = gt('music');
    btn.textContent = '🎵';
    btn.onclick = toggleBgm;
    const vol = document.createElement('input');
    vol.className = 'bgm-vol'; vol.id = 'bgm-vol';
    vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = '35';
    vol.oninput = (e) => setBgmVol(e.target.value);
    tools.appendChild(btn);
    tools.appendChild(vol);
    initBgm();
  }
  applyGameLang();
  // Projectile overlay (above combat-stage, below action-panel).
  if (!document.getElementById('projectile-layer')) {
    const layer = document.createElement('div');
    layer.id = 'projectile-layer';
    document.getElementById('screen-battle').appendChild(layer);
  }
}
function startRoundTimer(){
  stopRoundTimer();
  const el = document.getElementById('round-timer');
  if (!el) return;
  APP.roundDeadline = Date.now() + ROUND_TIME_MS;
  const tick = () => {
    const ms = Math.max(0, APP.roundDeadline - Date.now());
    const s = Math.ceil(ms / 1000);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    el.textContent = `${mm}:${ss}`;
    el.classList.toggle('warn', ms <= 20000);
    el.classList.toggle('crit', ms <= 10000);
    if (ms <= 0) {
      stopRoundTimer();
      handleRoundTimeout();
      return;
    }
    APP.roundTimerId = requestAnimationFrame(tick);
  };
  tick();
}
function stopRoundTimer(){
  if (APP.roundTimerId) cancelAnimationFrame(APP.roundTimerId);
  APP.roundTimerId = null;
}
function handleRoundTimeout(){
  if (APP.battle?.pvp && APP.pvp?.localMove && !APP.pvp?.remoteMove) {
    setStatus(gt('rivalTimeout'), true, 'rivalTimeout');
    appendLog(gt('rivalTimeout'), 'loss');
    return;
  }
  if (APP.inputLocked) return;
  APP.timeoutStreak = (APP.timeoutStreak||0) + 1;
  appendLog(`⏱ ${gt('timeoutAuto')} (${APP.timeoutStreak}/2)`, 'loss');
  if (APP.timeoutStreak >= 2) {
    appendLog('⛔ ' + gt('doubleTimeout'), 'loss');
    return surrenderForced();
  }
  // Auto-play: pick first available card, no pulses, no colapso.
  const id = APP.battle.pHand[0];
  if (!id) return;
  APP.selectedCardId = id;
  APP.pendingPulses = 0;
  APP.pendingColapso = false;
  confirmAction();
}
function showTurnBanner(done){
  const b = document.getElementById('round-banner');
  if (!b) { done && done(); return; }
  setStatus('', false, null);
  b.textContent = `${gt('round')} ${(APP.battle.round||0)+1}`;
  b.className = 'round-banner show turn-anim';
  setTimeout(() => {
    b.className = 'round-banner';
    setStatus(APP.battle?.pvp ? gt('lockMove') : gt('yourTurn'), false, APP.battle?.pvp ? 'lockMove' : 'yourTurn');
    done && done();
  }, 1800);
}

// Audio (lofi BGM per arena)
const BGM_TRACKS = {
  default: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e1c4be.mp3',
  ashborn: 'https://cdn.pixabay.com/download/audio/2022/10/30/audio_3e63ae3ed1.mp3',
  tidecall:'https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc56b5c0.mp3',
  nexus:   'https://cdn.pixabay.com/download/audio/2023/06/13/audio_dd02ddc049.mp3',
};
function initBgm(){
  if (APP.bgmAudio) return;
  const a = new Audio();
  a.loop = true;
  a.volume = (parseInt(localStorage.getItem('shs_bgm_vol')||'35',10))/100;
  a.src = BGM_TRACKS.default;
  APP.bgmAudio = a;
  APP.bgmOn = (localStorage.getItem('shs_bgm_on')||'1') === '1';
  if (APP.bgmOn) a.play().catch(()=>{});
  const btn = document.getElementById('bgm-toggle');
  if (btn) btn.textContent = APP.bgmOn ? '🎵' : '🔇';
}
function toggleBgm(){
  if (!APP.bgmAudio) return;
  APP.bgmOn = !APP.bgmOn;
  localStorage.setItem('shs_bgm_on', APP.bgmOn ? '1' : '0');
  if (APP.bgmOn) APP.bgmAudio.play().catch(()=>{});
  else APP.bgmAudio.pause();
  const btn = document.getElementById('bgm-toggle');
  if (btn) btn.textContent = APP.bgmOn ? '🎵' : '🔇';
}
function setBgmVol(v){
  const f = Math.max(0, Math.min(1, parseInt(v,10)/100));
  if (APP.bgmAudio) APP.bgmAudio.volume = f;
  localStorage.setItem('shs_bgm_vol', String(v));
}
window.toggleBgm = toggleBgm;
window.setBgmVol = setBgmVol;

// ─── SELECT / ACTION PANEL ───────────────────────────────────
function selectCard(cardId){
  if(APP.inputLocked) return;
  if(!APP.battle.pHand.includes(cardId)) return;
  APP.selectedCardId = cardId;
  APP.pendingPulses  = 0;
  APP.pendingColapso = false;

  document.querySelectorAll('#hand-me .card').forEach(c => {
    c.classList.toggle('selected', c.dataset.cardId === cardId);
  });
  showActionPanel();
}

function showActionPanel(){
  const card = getCard(APP.selectedCardId);
  document.getElementById('ap-name').textContent = card.name;

  const prev = document.getElementById('ap-preview');
  prev.innerHTML = '';
  prev.appendChild(buildCardEl(card, {}));

  buildPulseRow();
  refreshActionPanel();
  applyGameLang();
  document.getElementById('action-panel').classList.add('show');
}
function hideActionPanel(){
  document.getElementById('action-panel').classList.remove('show');
  document.querySelectorAll('#hand-me .card.selected').forEach(c => c.classList.remove('selected'));
  APP.selectedCardId = null;
}
function cancelAction(){ hideActionPanel(); }

function buildPulseRow(){
  const row = document.getElementById('pulse-row');
  row.innerHTML = '';
  for(let i = 0; i < 12; i++){
    const cap = document.createElement('div');
    cap.className = 'pulse-cap';
    row.appendChild(cap);
  }
}

function stepPulse(d){
  const max = APP.battle.pPulses - (APP.pendingColapso ? 3 : 0);
  APP.pendingPulses = Math.max(0, Math.min(max, APP.pendingPulses + d));
  refreshActionPanel();
}

function toggleColapso(){
  const wantOn = !APP.pendingColapso;
  if(wantOn && APP.battle.pPulses < 3) return;
  APP.pendingColapso = wantOn;
  const max = APP.battle.pPulses - (APP.pendingColapso ? 3 : 0);
  if(APP.pendingPulses > max) APP.pendingPulses = Math.max(0, max);
  refreshActionPanel();
}

function refreshActionPanel(){
  const card = getCard(APP.selectedCardId);
  if(!card) return;
  const pulses  = APP.pendingPulses;
  const colapso = APP.pendingColapso;
  const cost    = pulses + (colapso ? 3 : 0);

  const caps = document.querySelectorAll('#pulse-row .pulse-cap');
  caps.forEach((c, i) => {
    c.classList.remove('active','fury');
    if(i < pulses) c.classList.add('active');
    else if(colapso && i < pulses + 3) c.classList.add('fury');
  });

  const ct = document.getElementById('colapso-toggle');
  ct.classList.toggle('on', colapso);
  ct.querySelectorAll('.cap').forEach(c => c.classList.toggle('lit', colapso));

  const atk = Math.max(0, card.pow * (pulses + 1));
  document.getElementById('atk-val').textContent = atk;

  const ok = cost <= APP.battle.pPulses;
  document.getElementById('btn-fight').disabled = !ok;
}

// ─── CONFIRM / RESOLVE ───────────────────────────────────────
function confirmAction(){
  if(APP.inputLocked) return;
  const cardId  = APP.selectedCardId;
  if(!cardId) return;
  const pulses  = APP.pendingPulses;
  const colapso = APP.pendingColapso;
  const cost    = pulses + (colapso ? 3 : 0);
  if(cost > APP.battle.pPulses) return;

  APP.inputLocked = true;
  if(!APP.battle.pvp) stopRoundTimer();
  APP.battle.pPulses -= cost;
  hideActionPanel();
  renderHud();

  if(APP.battle.pvp){
    const move = { round:APP.battle.round, cardId, pulses, colapso, ts:Date.now() };
    APP.pvp.localMove = move;
    const meEl  = document.querySelector(`#hand-me  .card[data-card-id="${cardId}"]`);
    if(meEl) meEl.classList.add('played');
    setStatus(gt('waitingRival'), true, 'waitingRival');
    APP.pvp.channel?.send(move).catch(err => {
      console.warn('PvP move send failed', err);
      appendLog(gt('sendFailed'), 'loss');
      APP.inputLocked = false;
    });
    maybeResolvePvpRound();
    return;
  }

  const ai     = aiPickAction(APP.battle);
  const aiCost = ai.pulses + (ai.colapso ? 3 : 0);
  APP.battle.oPulses = Math.max(0, APP.battle.oPulses - aiCost);

  const meEl  = document.querySelector(`#hand-me  .card[data-card-id="${cardId}"]`);
  const oppEl = document.querySelector(`#hand-opp .card[data-card-id="${ai.cardId}"]`);
  if(meEl)  meEl.classList.add('played');
  if(oppEl) oppEl.classList.add('played');

  const result = resolveRound(APP.battle, cardId, pulses, colapso, ai.cardId, ai.pulses, ai.colapso);
  runCombatPhase(result, ()=> onRoundResolved(result));
}

function handlePvpMove(payload){
  if(!APP.battle?.pvp || !payload || payload.side === APP.pvp?.side) return;
  const action = payload.action || payload;
  if(action.round !== APP.battle.round) return;
  action.ts = action.ts || payload.ts || Date.now();
  APP.pvp.remoteMove = action;
  appendLog(gt('rivalAction'), '');
  if(!APP.pvp.localMove) setStatus(gt('rivalLocked'), false, 'rivalLocked');
  maybeResolvePvpRound();
}

function maybeResolvePvpRound(){
  if(!APP.battle?.pvp || !APP.pvp?.localMove || !APP.pvp?.remoteMove || APP.pvp.resolving) return;
  APP.pvp.resolving = true;
  const local = APP.pvp.localMove;
  const remote = APP.pvp.remoteMove;
  const remoteCost = (remote.pulses|0) + (remote.colapso ? 3 : 0);
  APP.battle.oPulses = Math.max(0, APP.battle.oPulses - remoteCost);
  const oppEl = document.querySelector(`#hand-opp .card[data-card-id="${remote.cardId}"]`);
  if(oppEl) oppEl.classList.add('played');
  renderHud();
  stopRoundTimer();
  if(!APP.battle._starter){
    APP.battle._starter = (local.ts || 0) <= (remote.ts || 0) ? 'p' : 'o';
  }
  const result = resolveRound(
    APP.battle,
    local.cardId, local.pulses|0, !!local.colapso,
    remote.cardId, remote.pulses|0, !!remote.colapso
  );
  APP.pvp.localMove = null;
  APP.pvp.remoteMove = null;
  runCombatPhase(result, ()=> {
    APP.pvp.resolving = false;
    onRoundResolved(result);
  });
}

// ─── COMBAT FOCUS PHASE ──────────────────────────────────────
function runCombatPhase(result, done){
  const stage = document.getElementById('combat-stage');
  setStatus(gt('clash'), true, 'clash');

  const pCard = getCard(result.p.cardId);
  const oCard = getCard(result.o.cardId);

  // mount cards
  const meHolder  = document.getElementById('cs-card-me');
  const oppHolder = document.getElementById('cs-card-opp');
  meHolder.innerHTML  = '';
  oppHolder.innerHTML = '';
  meHolder.appendChild(buildCardEl(pCard, {}));
  oppHolder.appendChild(buildCardEl(oCard, {}));

  // reset state
  const sideMe  = document.getElementById('cs-side-me');
  const sideOpp = document.getElementById('cs-side-opp');
  sideMe.classList.remove('winner','loser');
  sideOpp.classList.remove('winner','loser');
  stage.classList.remove('clash','lunge');
  const verdict = document.getElementById('cs-verdict');
  verdict.classList.remove('show','win','loss','draw');

  buildPulseVizBar('cs-pulse-me',  result.p.pulses, result.p.colapso);
  buildPulseVizBar('cs-pulse-opp', result.o.pulses, result.o.colapso);
  document.getElementById('cs-pulse-num-me').textContent  = '×' + (result.p.pulses + 1);
  document.getElementById('cs-pulse-num-opp').textContent = '×' + (result.o.pulses + 1);

  // bonus labels
  const bmEl = document.getElementById('cs-bonus-me');
  const boEl = document.getElementById('cs-bonus-opp');
  bmEl.textContent = result.p.bonus ? (getClan(pCard.clan).name + ' BONUS · +' + result.p.bonus) : '';
  boEl.textContent = result.o.bonus ? (getClan(oCard.clan).name + ' BONUS · +' + result.o.bonus) : '';
  bmEl.classList.remove('show');
  boEl.classList.remove('show');

  // ATK starts at raw pow (before bonus), tick to final atk
  document.getElementById('cs-atk-me').textContent  = pCard.pow;
  document.getElementById('cs-atk-opp').textContent = oCard.pow;

  stage.classList.add('show');

  // Phase timeline
  // 0–550: cards fly in
  // 600: pulses pop sequentially (≤90 * pulses ms)
  // 1200: bonus flash + ATK tick
  // 1900: clash class (rays + VS flash)
  // 1950: lunge + burst + shake
  // 2200: winner/loser reveal
  // 2500: verdict banner
  // 3800: stage fade, resume

  const totalPulsesMe  = result.p.pulses + (result.p.colapso ? 3 : 0);
  const totalPulsesOpp = result.o.pulses + (result.o.colapso ? 3 : 0);

  setTimeout(()=> animatePulsePips('cs-pulse-me',  totalPulsesMe),  600);
  setTimeout(()=> animatePulsePips('cs-pulse-opp', totalPulsesOpp), 640);

  setTimeout(()=>{
    if(result.p.bonus) bmEl.classList.add('show');
    if(result.o.bonus) boEl.classList.add('show');
    animateCombatCardStats(meHolder, pCard, result.p);
    animateCombatCardStats(oppHolder, oCard, result.o);
    tickNumber('cs-atk-me',  pCard.pow, result.p.atk, 600);
    tickNumber('cs-atk-opp', oCard.pow, result.o.atk, 600);
  }, 1200);

  setTimeout(()=>{
    stage.classList.add('clash');
    stage.classList.add('lunge');
    shakeScreen(10, 360);
    spawnBurst(window.innerWidth/2, window.innerHeight/2, '#ffffff', 40, 7);
    spawnBurst(window.innerWidth/2, window.innerHeight/2,
      result.winner === 'p' ? '#00FFC6' : (result.winner === 'o' ? '#FF3B3B' : '#f59e0b'),
      70, 8);
  }, 1950);

  setTimeout(()=>{
    if(result.winner === 'p'){
      sideMe.classList.add('winner');
      sideOpp.classList.add('loser');
      // Slight delay (150–300ms) before projectiles launch from winning card.
      setTimeout(()=>{
        launchDamageProjectiles('me', result.dmg, pCard.clan);
        // Shatter loser card after projectiles land.
        const travel = 600 + Math.max(0, (result.dmg-1)) * 130;
        setTimeout(()=> shatterCard(oppHolder), travel);
      }, 220);
    } else if(result.winner === 'o'){
      sideOpp.classList.add('winner');
      sideMe.classList.add('loser');
      setTimeout(()=>{
        launchDamageProjectiles('opp', result.dmg, oCard.clan);
        const travel = 600 + Math.max(0, (result.dmg-1)) * 130;
        setTimeout(()=> shatterCard(meHolder), travel);
      }, 220);
    } else {
      sideMe.classList.add('winner');
      sideOpp.classList.add('winner');
    }
  }, 2250);

  setTimeout(()=>{
    const map = {
      p:{t:gt('roundWon'), c:'win'},
      o:{t:gt('roundLost'), c:'loss'},
      draw:{t:gt('draw'), c:'draw'},
    };
    const v = map[result.winner] || map.draw;
    verdict.textContent = v.t + (result.dmg ? ` · −${result.dmg}` : '');
    verdict.classList.add(v.c, 'show');
  }, 2500);

  // Extend stage hold so all damage projectiles land before fade.
  const holdMs = 3800 + Math.max(0, (result.dmg||0) - 1) * 130;
  setTimeout(()=>{
    stage.classList.remove('show','clash','lunge');
    done && done();
  }, holdMs);
}

function buildPulseVizBar(elId, pulses, colapso){
  const bar = document.getElementById(elId);
  bar.innerHTML = '';
  const total = pulses + (colapso ? 3 : 0);
  const slots = Math.max(12, total);
  for(let i = 0; i < slots; i++){
    const pip = document.createElement('div');
    pip.className = 'pip';
    if(i < pulses) pip.dataset.kind = 'lit';
    else if(colapso && i < pulses + 3) pip.dataset.kind = 'fury';
    bar.appendChild(pip);
  }
}

function animateCombatCardStats(holder, baseCard, sideResult){
  if(!holder || !baseCard || !sideResult) return;
  const powEl = holder.querySelector('.stat-pill.pow b');
  const dmgEl = holder.querySelector('.stat-pill.dmg b');
  const apply = (el, baseVal, nextVal, cls) => {
    if(!el || nextVal == null || Number(nextVal) === Number(baseVal)) return;
    el.textContent = nextVal;
    const pill = el.closest('.stat-pill');
    pill?.classList.add(cls, 'stat-changed');
    setTimeout(()=> pill?.classList.remove('stat-changed'), 900);
  };
  apply(powEl, baseCard.pow, sideResult.pow, Number(sideResult.pow) > Number(baseCard.pow) ? 'buffed' : 'debuffed');
  apply(dmgEl, baseCard.dmg, sideResult.dmg, Number(sideResult.dmg) > Number(baseCard.dmg) ? 'buffed' : 'debuffed');
}

function animatePulsePips(elId, total){
  const bar = document.getElementById(elId);
  if(!bar) return;
  const pips = bar.querySelectorAll('.pip');
  let i = 0;
  const tick = ()=>{
    if(i >= total || i >= pips.length) return;
    const kind = pips[i].dataset.kind;
    if(kind) pips[i].classList.add(kind);
    i++;
    setTimeout(tick, 70);
  };
  tick();
}

function tickNumber(elId, from, to, ms){
  const el = document.getElementById(elId);
  if(!el) return;
  const start = performance.now();
  const step = (now)=>{
    const k = Math.min(1, (now - start) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    const v = Math.round(from + (to - from) * e);
    el.textContent = v;
    if(k < 1) requestAnimationFrame(step);
    else { el.classList.remove('boost'); void el.offsetWidth; el.classList.add('boost'); }
  };
  requestAnimationFrame(step);
}

function onRoundResolved(result){
  appendLog(
    `R${result.round+1} · ${getCard(result.p.cardId).name} (${result.p.atk}) vs ${getCard(result.o.cardId).name} (${result.o.atk}) · DMG ${result.dmg}`,
    result.winner === 'p' ? 'win' : result.winner === 'o' ? 'loss' : ''
  );

  // Persist visual outcome on the played cards.
  APP.cardOutcomes = APP.cardOutcomes || { me:{}, opp:{} };
  const meOutcome  = result.winner==='p'?'win':result.winner==='o'?'loss':'draw';
  const oppOutcome = result.winner==='o'?'win':result.winner==='p'?'loss':'draw';
  APP.cardOutcomes.me[result.p.cardId]  = meOutcome;
  APP.cardOutcomes.opp[result.o.cardId] = oppOutcome;

  // Reset timeout streak after a real play.
  APP.timeoutStreak = 0;

  renderHud();
  if(APP.battle.finished){
    stopRoundTimer();
    layoutHand('me',  APP.handSnapshot?.me  || APP.battle.pHand, false);
    layoutHand('opp', APP.handSnapshot?.opp || APP.battle.oHand, true);
    setTimeout(()=> showEnd(), 600);
    return;
  }
  // Re-layout from snapshot (keeps played cards greyed + tagged).
  layoutHand('me',  APP.handSnapshot?.me  || APP.battle.pHand, false);
  layoutHand('opp', APP.handSnapshot?.opp || APP.battle.oHand, true);
  APP.inputLocked = false;
  showTurnBanner(()=> startRoundTimer());
}

// ─── CLAN ATTACK ANIMATIONS + SHATTER ────────────────────────
const CLAN_FX = {
  nexus:    { color:'#6B5CE7', emoji:'🤖', kind:'laser'   },
  tidecall: { color:'#3B82F6', emoji:'🌊', kind:'wave'    },
  ashborn:  { color:'#FF6B35', emoji:'🔥', kind:'fire'    },
  errvoid:  { color:'#a855f7', emoji:'👾', kind:'glitch'  },
  vault:    { color:'#FBBF24', emoji:'👑', kind:'goldsmash' },
  mycelium: { color:'#10B981', emoji:'🍄', kind:'spores'  },
  ironpact: { color:'#94A3B8', emoji:'💀', kind:'iron'    },
  synthos:  { color:'#06B6D4', emoji:'🔬', kind:'beam'    },
  loopkin:  { color:'#F472B6', emoji:'⏳', kind:'loop'    },
  phantom:  { color:'#E5E7EB', emoji:'👁', kind:'phase'   },
  frequenz: { color:'#EF4444', emoji:'🎸', kind:'sonic'   },
  protocol: { color:'#22D3EE', emoji:'🛡', kind:'shield'  },
  echo:     { color:'#F5F0E8', emoji:'✨', kind:'titan'   },
};
// Real projectile system: winning card → loser HP bar.
// N projectiles (= damage), arc trajectory, trails, randomness, HP impact feedback.
function launchDamageProjectiles(winnerSide, dmg, clan){
  const N  = dmg|0;
  if (N <= 0) return;
  const fx = CLAN_FX[clan] || { color:'#fff', emoji:'⚡', kind:'laser' };
  const sourceEl = winnerSide === 'me'
    ? document.getElementById('cs-card-me')
    : document.getElementById('cs-card-opp');
  const targetBar = winnerSide === 'me'
    ? document.querySelector('.battle-hud.top .bar.hp')
    : document.querySelector('.battle-hud.bot .bar.hp');
  if (!sourceEl || !targetBar) return;
  const sRect = sourceEl.getBoundingClientRect();
  const tRect = targetBar.getBoundingClientRect();
  const sx = sRect.left + sRect.width/2;
  const sy = sRect.top  + sRect.height/2;
  const tx = tRect.left + tRect.width/2;
  const ty = tRect.top  + tRect.height/2;
  const layer = document.getElementById('projectile-layer');
  if (!layer) return;
  for (let i = 0; i < N; i++){
    setTimeout(()=> spawnProjectile(layer, sx, sy, tx, ty, fx, ()=>{
      onHpImpact(targetBar, fx.color);
    }), i * 130);
  }
  // Floating total damage near HP bar (after first hit).
  setTimeout(()=> spawnFloatingDamage(targetBar, dmg, fx.color), 700);
}

function spawnProjectile(layer, sx, sy, tx, ty, fx, onHit){
  const el = document.createElement('div');
  el.className = 'dmg-projectile fx-' + fx.kind;
  el.style.color = fx.color;
  el.innerHTML = `<span class="dmg-emoji">${fx.emoji}</span><span class="dmg-trail"></span>`;
  layer.appendChild(el);
  // Quadratic bezier arc with slight randomness.
  const dx = tx - sx, dy = ty - sy;
  const arcUp = 80 + Math.random()*80;
  const jitterX = (Math.random()-0.5) * 60;
  const jitterY = (Math.random()-0.5) * 30;
  const mx = sx + dx*0.5 + jitterX;
  const my = sy + dy*0.5 - arcUp + jitterY;
  // Land near HP bar with small horizontal jitter (60px max).
  const fx_x = tx + (Math.random()-0.5) * 60;
  const fy_y = ty + (Math.random()-0.5) * 8;
  const dur = 580 + Math.random()*160;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const u = 1 - t;
    const x = u*u*sx + 2*u*t*mx + t*t*fx_x;
    const y = u*u*sy + 2*u*t*my + t*t*fy_y;
    const scale = 1 - t*0.45;
    const rot = (t * 540) * (Math.random() < 0.5 ? 1 : -1) * 0.0 + t * 360;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rot}deg)`;
    if (t < 1) requestAnimationFrame(tick);
    else { onHit && onHit(); el.remove(); }
  };
  requestAnimationFrame(tick);
}
function onHpImpact(barEl, color){
  if (!barEl) return;
  // Bar pulse + flash overlay.
  barEl.classList.remove('hp-hit');
  void barEl.offsetWidth;
  barEl.classList.add('hp-hit');
  setTimeout(()=> barEl.classList.remove('hp-hit'), 360);
  const flash = document.createElement('div');
  flash.className = 'hp-impact-flash';
  flash.style.background = color;
  barEl.appendChild(flash);
  setTimeout(()=> flash.remove(), 420);
  // Brief screen shake per hit.
  shakeScreen(7, 220);
}

function spawnFloatingDamage(barEl, dmg, color){
  if (!barEl) return;
  const r = barEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'dmg-float';
  el.textContent = '−' + dmg;
  el.style.color = color || '#FF3B3B';
  el.style.left = (r.left + r.width/2) + 'px';
  el.style.top  = (r.top - 6) + 'px';
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 1100);
}
function shatterCard(holder){
  if (!holder) return;
  const card = holder.querySelector('.card');
  if (!card) return;
  card.classList.add('shatter');
  for (let i = 0; i < 14; i++) {
    const shard = document.createElement('div');
    shard.className = 'card-shard';
    shard.style.setProperty('--sx', (Math.random()*200-100).toFixed(0)+'px');
    shard.style.setProperty('--sy', (Math.random()*200-100).toFixed(0)+'px');
    shard.style.setProperty('--sr', (Math.random()*360).toFixed(0)+'deg');
    shard.style.setProperty('--sd', (Math.random()*0.4)+'s');
    holder.appendChild(shard);
    setTimeout(()=> shard.remove(), 1400);
  }
}

// ─── LOG / TOOLS ─────────────────────────────────────────────
function appendLog(text, kind){
  const el = document.getElementById('battle-log');
  const row = document.createElement('div');
  row.className = 'row ' + (kind || '');
  row.textContent = text;
  el.prepend(row);
  while(el.children.length > 6) el.removeChild(el.lastChild);
}
function toggleLog(){
  APP.logOpen = !APP.logOpen;
  document.getElementById('battle-log').classList.toggle('show', APP.logOpen);
}
function surrender(){
  if(!APP.battle || APP.screen !== 'battle') return;
  openSurrenderModal();
}
function openSurrenderModal(){
  closeSurrenderModal();
  APP.surrenderRemaining = 10;
  const modal = document.getElementById('surrender-modal');
  const count = document.getElementById('surrender-count');
  if(!modal || !count) return;
  applyGameLang();
  count.textContent = APP.surrenderRemaining;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('surrender-open');
  APP.surrenderTimerId = setInterval(() => {
    APP.surrenderRemaining -= 1;
    count.textContent = Math.max(0, APP.surrenderRemaining);
    if(APP.surrenderRemaining <= 0) closeSurrenderModal();
  }, 1000);
}
function closeSurrenderModal(){
  if(APP.surrenderTimerId) clearInterval(APP.surrenderTimerId);
  APP.surrenderTimerId = null;
  const modal = document.getElementById('surrender-modal');
  if(modal) {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('surrender-open');
}
function confirmSurrender(){
  closeSurrenderModal();
  recordAbandon();
  // Mark the battle as a player loss so showEnd() renders the proper screen
  // (defeat banner + ELO/penalty info), then route through the normal
  // end-of-battle flow instead of dumping the user back to the menu.
  try {
    if (APP && APP.battle) { APP.battle.winner = 'o'; APP.battle.abandoned = true; }
  } catch(_){}
  showEnd();
}
function surrenderForced(){
  recordAbandon();
  try {
    if (APP && APP.battle) { APP.battle.winner = 'o'; APP.battle.abandoned = true; }
  } catch(_){}
  setTimeout(()=> showEnd(), 600);
}
// Abandon penalty: 3 in a row → 5-min lockout + 2× ELO loss multiplier on next match.
function recordAbandon(){
  try {
    const KEY = 'shs_player';
    const cur = JSON.parse(localStorage.getItem(KEY) || '{}');
    cur.abandonStreak = (cur.abandonStreak||0) + 1;
    cur.lastAbandonAt = Date.now();
    if (cur.abandonStreak >= 3) {
      cur.lockoutUntil = Date.now() + 5*60*1000;
      cur.eloPenaltyMult = 2;
    }
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch(_){}
  if (APP?.battle?.pvp) {
    finalizePvpBattle('abandon');
    return;
  }
  // Server-authoritative abandon (RPC mirrors lockout + multiplier).
  try {
    if (window.SHS_SYNC && APP && APP.battle) {
      SHS_SYNC.finalizeBattle({
        mode: APP.battle.mode || 'casual',
        result: 'abandon',
        opponent_name: APP.battle.opponent && APP.battle.opponent.name,
      });
    }
  } catch(_){}
}
function clearAbandonStreak(){
  try {
    const KEY = 'shs_player';
    const cur = JSON.parse(localStorage.getItem(KEY) || '{}');
    cur.abandonStreak = 0;
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch(_){}
}

// ─── END ─────────────────────────────────────────────────────
function showEnd(){
  const B = APP.battle;
  // Successful battle clears the abandon streak.
  clearAbandonStreak();
  // Queue Battle Pass XP for the gamehub to consume.
  try {
    const xp = B.winner === 'p' ? 30 : (B.winner === 'o' ? 15 : 20);
    const cur = JSON.parse(localStorage.getItem('shs_bp_pending') || '{"xp":0,"battles":0,"wins":0}');
    cur.xp += xp; cur.battles += 1; if (B.winner==='p') cur.wins += 1;
    localStorage.setItem('shs_bp_pending', JSON.stringify(cur));
  } catch(_){}
  goScreen('end');

  const card = document.getElementById('end-card');
  const t = document.getElementById('end-title');
  const s = document.getElementById('end-sub');
  const tag = document.getElementById('end-tag');

  if(B.winner === 'p'){
    t.textContent = gt('win'); t.className = 'end-title win';
    s.textContent = gt('linkStable');
    tag.textContent = gt('win');
    card.className = 'end-card win';
    spawnConfetti();
  } else if(B.winner === 'o'){
    t.textContent = gt('defeat'); t.className = 'end-title loss';
    s.textContent = gt('linkSevered');
    tag.textContent = gt('defeat');
    card.className = 'end-card loss';
    spawnBurst(window.innerWidth/2, window.innerHeight/2, '#FF3B3B', 70, 6);
  } else {
    t.textContent = gt('draw'); t.className = 'end-title draw';
    s.textContent = gt('impasse');
    tag.textContent = gt('draw');
    card.className = 'end-card draw';
    spawnBurst(window.innerWidth/2, window.innerHeight/2, '#f59e0b', 40, 4);
  }

  document.getElementById('end-player-name').textContent = PLAYER.name;
  document.getElementById('end-avatar').textContent = PLAYER.name.charAt(0);
  document.getElementById('end-player-meta').textContent =
    'VS ' + B.opponent.name + ' · ' + MODES[B.mode].label;

  const rw = B.rewards || { shards:0, xp:0, elo:0 };
  document.getElementById('rw-shards').textContent = (rw.shards>=0?'+':'') + rw.shards;
  document.getElementById('rw-xp').textContent     = (rw.xp>=0?'+':'')     + rw.xp;
  document.getElementById('rw-elo').textContent    = (rw.elo>=0?'+':'')    + rw.elo;
  document.getElementById('rw-shards-box').className = 'rw ' + (rw.shards>0?'pos':'');
  document.getElementById('rw-xp-box').className     = 'rw ' + (rw.xp>0?'pos':'');
  document.getElementById('rw-elo-box').className    = 'rw ' + (rw.elo>0?'pos':(rw.elo<0?'neg':''));
  applyGameLang();

  // ── Server-authoritative finalization (Phase 2A) ────────────
  // Calls finalize_battle RPC. Server recomputes rewards atomically
  // and the on-screen numbers are reconciled from its response.
  // Skip when the battle was abandoned — recordAbandon() already finalized it.
  if (B.pvp) {
    finalizePvpBattle('end');
  } else if (window.SHS_SYNC && !B.abandoned) {
    const result = B.winner === 'p' ? 'win' : (B.winner === 'o' ? 'loss' : 'draw');
    SHS_SYNC.finalizeBattle({
      mode: B.mode || 'casual',
      result,
      opponent_name: B.opponent && B.opponent.name,
      rounds: B.roundLog || B.history || [],
    }).then(rsp => {
      if (!rsp) return;
      try {
        const sd = rsp.shards_delta|0, xd = rsp.xp_delta|0, ed = rsp.elo_delta|0;
        const elS = document.getElementById('rw-shards');
        const elX = document.getElementById('rw-xp');
        const elE = document.getElementById('rw-elo');
        if (elS) elS.textContent = (sd>=0?'+':'') + sd;
        if (elX) elX.textContent = (xd>=0?'+':'') + xd;
        if (elE) elE.textContent = (ed>=0?'+':'') + ed;
        document.getElementById('rw-shards-box').className = 'rw ' + (sd>0?'pos':'');
        document.getElementById('rw-xp-box').className     = 'rw ' + (xd>0?'pos':'');
        document.getElementById('rw-elo-box').className    = 'rw ' + (ed>0?'pos':(ed<0?'neg':''));
      } catch(_){}
    });
  }
}

function finalizePvpBattle(reason){
  const B = APP.battle;
  if(!B?.pvp || !window.SHS_PVP || !APP.pvp || APP.pvp.finalized) return;
  APP.pvp.finalized = true;
  const winnerUid = B.winner === 'p'
    ? APP.pvp.uid
    : (B.winner === 'o' ? APP.pvp.opponentId : null);
  SHS_PVP.finalize(APP.pvp.matchId || B.matchId, winnerUid, B.roundLog || B.history || [])
    .then(rsp => {
      const reward = extractPvpReward(rsp, APP.pvp.uid);
      if(!reward) return;
      try {
        const sd = reward.shards|0, xd = reward.xp|0, ed = reward.elo|0;
        const elS = document.getElementById('rw-shards');
        const elX = document.getElementById('rw-xp');
        const elE = document.getElementById('rw-elo');
        if (elS) elS.textContent = (sd>=0?'+':'') + sd;
        if (elX) elX.textContent = (xd>=0?'+':'') + xd;
        if (elE) elE.textContent = (ed>=0?'+':'') + ed;
        document.getElementById('rw-shards-box').className = 'rw ' + (sd>0?'pos':'');
        document.getElementById('rw-xp-box').className     = 'rw ' + (xd>0?'pos':'');
        document.getElementById('rw-elo-box').className    = 'rw ' + (ed>0?'pos':(ed<0?'neg':''));
      } catch(_){}
    })
    .catch(err => {
      console.warn('finalize_pvp_match failed', reason, err);
      APP.pvp.finalized = false;
    });
}

function extractPvpReward(rsp, uid){
  if(!rsp) return null;
  if(Array.isArray(rsp)) rsp = rsp[0];
  if(typeof rsp === 'string'){
    try { rsp = JSON.parse(rsp); } catch(_){ return null; }
  }
  const mine = rsp?.rewards?.[uid] || rsp?.players?.[uid] || rsp?.[uid] || rsp?.local || rsp;
  const out = {
    shards: mine.shards_delta ?? mine.shardsDelta ?? mine.shards ?? mine.reward_shards,
    xp:     mine.xp_delta     ?? mine.xpDelta     ?? mine.xp     ?? mine.reward_xp,
    elo:    mine.elo_delta    ?? mine.eloDelta    ?? mine.elo    ?? mine.reward_elo,
  };
  const hasAny = Object.values(out).some(v => v != null);
  if(!hasAny) return null;
  const allZero = Object.values(out).every(v => (v|0) === 0);
  if(allZero && APP.battle?.rewards && Object.values(APP.battle.rewards).some(v => (v|0) !== 0)){
    return APP.battle.rewards;
  }
  return out;
}

function backToMenu(){
  APP.inputLocked = false;
  stopRoundTimer();
  closeSurrenderModal();
  stopMatchmakingHud(true);
  try { if(APP.pvp?.watcher?.unsubscribe) APP.pvp.watcher.unsubscribe(); } catch(_){}
  try { if(APP.pvp?.channel?.close) APP.pvp.channel.close(); } catch(_){}
  APP.pvp = null;
  goScreen('menu');
  renderMenu();
}
function rematch(){
  const m = APP.battle ? APP.battle.mode : 'casual';
  APP.inputLocked = false;
  startMode(m);
}
