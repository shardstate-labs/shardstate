// ════════════════════════════════════════════════════════════
// SHARDSTATE WEB PLATFORM — app.js
// ════════════════════════════════════════════════════════════
const AUTH_DB_KEY      = "shardstate_auth_db_v2";
const AUTH_SESSION_KEY = "shardstate_auth_session_v1";

const navItems = Array.from(document.querySelectorAll(".nav-item"));
const panels   = {
  learn:     document.getElementById("panel-learn"),
  missions:  document.getElementById("panel-missions"),
  battlepass:document.getElementById("panel-battlepass"),
  coleccion: document.getElementById("panel-coleccion"),
  mercado:   document.getElementById("panel-mercado"),
  shop:      document.getElementById("panel-shop"),
  guilds:    document.getElementById("panel-guilds"),
  community: document.getElementById("panel-community"),
  perfil:    document.getElementById("panel-perfil"),
};

const view = {
  db:   { users:{}, emailToUid:{}, usernameToUid:{}, marketListings:[], guilds:[] },
  user: null,
  state:{ shards:0, flux:0, shs:0, collection:{}, deck:[], deckPresets:[] },
  lastPack: [],
};

// ════════════════════════════════════════════════════════════
// I18N — Bilingual UI (ES/EN)
// ════════════════════════════════════════════════════════════
const I18N = {
  es: {
    nav_play:'JUGAR AHORA', nav_learn:'APRENDER', nav_missions:'MISIONES', nav_battlepass:'PASE DE BATALLA',
    panel_battlepass_title:'Pase de Batalla', panel_battlepass_sub:'30 días · 30 niveles · Gana SHARDS, FLUX y una carta GRAND aleatoria',
    bp_buy_premium:'Comprar Pase Premium', bp_owned:'Pase Premium activo', bp_locked_premium:'Premium', bp_claim:'Reclamar', bp_claimed:'Reclamado', bp_buy_with:'Comprar con',
    bp_xp_label:'XP del pase', bp_level:'Nivel', bp_required:'XP requerido',
    bp_ends_in:'Termina en', bp_days:'d', bp_hours:'h', bp_min:'min',
    bp_reward_shards:'SHARDS', bp_reward_flux:'FLUX', bp_reward_grand:'1 carta GRAND',
    nav_community:'COMUNIDAD', coll_search_ph:'Buscar cartas…',
    nav_jugar:'JUGAR', nav_perfil:'PERFIL', nav_coleccion:'COLECCIÓN',
    nav_mercado:'MERCADO', nav_guilds:'GUILDS', nav_shop:'PACK SHOP',
    tab_jugar:'JUGAR', tab_perfil:'PERFIL', tab_coleccion:'COLECCIÓN',
    tab_mercado:'MERCADO', tab_guilds:'GUILDS', tab_shop:'PACK SHOP',
    topbar_wallet:'Conectar Wallet', topbar_logout:'Cerrar sesión',
    panel_learn_title:'Aprender', panel_learn_sub:'Reglas, modos, rangos, clanes y mecánicas de cartas',
    panel_missions_title:'Misiones', panel_missions_sub:'Completa objetivos para ganar SHARDS y desbloquear cartas TITAN/ECO',
    panel_community_title:'Comunidad', panel_community_sub:'Foro, Discord y presets compartidos',
    panel_jugar_title:'Jugar', panel_perfil_title:'Perfil',
    panel_coleccion_title:'Colección', panel_mercado_title:'Mercado',
    panel_guilds_title:'Guilds', panel_shop_title:'Pack Shop',
    panel_perfil_sub:'Estadísticas de cuenta, padrino y referidos',
    panel_coleccion_sub:'Deck activo, presets y cartas',
    panel_mercado_sub:'Listar cartas y revisar historial de transacciones',
    panel_guilds_sub:'Crea, personaliza y gestiona solicitudes',
    panel_shop_sub:'Compra packs con FLUX o $SHS',
    deck_active:'Deck Activo', preset_save:'Guardar', preset_load:'Cargar',
    preset_name_ph:'Nombre del preset…',
    preset_share:'Compartir a Comunidad',
    coll_owned:'Obtenidas', coll_missing:'No Obtenidas',
    coll_filter_all:'Todas', coll_filter_owned:'Obtenidas', coll_filter_missing:'Faltantes',
    market_list_title:'Listar carta', market_my_sales:'Mis ventas activas',
    market_live:'Market Listings', market_buy_history:'Historial de compras',
    market_sell_history:'Historial de ventas',
    market_list_btn:'Listar', market_buy_btn:'Comprar',
    market_tab_offchain:'Off-Chain (SHARDS)', market_tab_onchain:'On-Chain ($SHS)', market_tab_history:'Historial',
    market_onchain_title:'MERCADO ON-CHAIN', market_onchain_desc:'Intercambia cartas NFT con tokens $SHS en Abstract Chain. Conecta tu wallet para acceder.',
    market_onchain_btn:'Conectar Wallet',
    market_price_ph:'Precio en SHARDS',
    shop_last_opened:'Último Pack Abierto', shop_empty:'Abre un pack para ver el resultado.',
    guild_create:'Crear Gremio', guild_create_cost:'100 FLUX',
    guild_my:'Mi Gremio', guild_pending:'Solicitudes Pendientes',
    guild_requests:'Solicitudes recibidas', guild_directory:'Directorio de Gremios',
    guild_create_btn:'Crear Gremio', guild_search_ph:'Buscar gremios…',
    guild_name_ph:'Nombre del gremio', guild_bio_ph:'Descripción del gremio…', guild_emoji_ph:'Emoji',
    profile_sponsor:'Sponsor', profile_no_sponsor:'Sin sponsor.',
    profile_friends:'Amigos', profile_ref_title:'Link de Referido',
    profile_ref_ph:'Genera tu link…', profile_copy:'Copiar', profile_referrals:'Referidos',
    sidebar_tagline:'FRACTURE NETWORK', logout:'Cerrar sesión',
    community_forum:'Foro', community_join:'Únete a la Comunidad',
    community_discord:'Servidor Discord', community_presets:'Presets Públicos',
    learn_tab_rules:'Reglas', learn_tab_modes:'Modos', learn_tab_rankings:'Rankings',
    learn_tab_clans:'Clanes', learn_tab_cards:'Mecánicas',
    guild_join_btn:'Solicitar unirse', guild_approve_btn:'Aprobar', guild_deny_btn:'Rechazar',
    guild_cost:'100 FLUX',
    guild_join_btn:'Solicitar ingreso', guild_approve_btn:'Aceptar', guild_deny_btn:'Rechazar',
    guild_cost:'100 FLUX',
    pack_flux_name:'Pack FLUX', pack_flux_desc:'4 cartas aleatorias · Común → Rara',
    pack_shs_name:'Pack $SHS', pack_shs_desc:'4 cartas aleatorias · Inusual garantizada',
    pack_open_btn:'Abrir Pack', pack_last:'Última apertura',
    mode_classic:'CLÁSICO', mode_classic_sub:'PvP · Gana SHARDS',
    mode_ranked:'RANGO FRACTAL', mode_ranked_sub:'ELO · Gana $SHS',
    mode_training:'ENTRENAMIENTO', mode_training_sub:'Sin riesgo · XP reducida',
    gate_sub:'FRACTURE NETWORK · TCG ON-CHAIN',
    gate_msg:'Inicia sesión desde la app para acceder al portal.',
    gate_btn:'⚡ ENTRAR AL JUEGO',
    gate_hint:'La sesión se crea automáticamente al hacer login en la app.',
    ref_title:'Link de referidos', ref_copy:'Copiar', ref_sub:'Referidos',
    sponsor_title:'Padrino',
    no_cards:'Sin cartas aún. Abre un pack.',
    no_market:'Sin ofertas activas.',
    no_sales:'No tienes ventas activas.',
    no_buy_hist:'Sin compras.', no_sell_hist:'Sin ventas.',
    no_guild:'No perteneces a ningún gremio.',
    no_guilds:'No hay gremios. ¡Crea el primero!',
    no_requests:'Sin solicitudes pendientes.',
    no_preset:'Sin presets', no_pack_open:'Abre un pack para ver el resultado.',
    leader_only:'Solo el líder gestiona solicitudes.',
    member_badge:'Miembro', requested_badge:'Solicitud enviada',
    members_label:'miembro(s)', version:'v0.9 · Abstract Chain',
    tagline:'FRACTURE NETWORK',
    currency_shards:'SHARDS', currency_flux:'FLUX', currency_shs:'$SHS',
    add_deck:'+ Deck', remove_deck:'− Deck', sell_card:'Vender',
    in_deck_label:'EN DECK',
    deck_full:'Deck completo (8/8).', removed_deck:'Removido del deck.',
    added_deck:'agregado al deck.',
    toast_ref:'🔗 Link de referido copiado.',
    toast_ref_err:'No se pudo copiar automáticamente.',
    preset_name_req:'Ingresa un nombre para el preset.',
    preset_deck_req:'El deck necesita 8 cartas.',
    preset_loaded:'sincronizado con la app.',
    preset_saved:'guardado.',
  },
  en: {
    nav_play:'PLAY NOW', nav_learn:'LEARN', nav_missions:'MISSIONS', nav_battlepass:'BATTLE PASS',
    panel_battlepass_title:'Battle Pass', panel_battlepass_sub:'30 days · 30 levels · Earn SHARDS, FLUX and a random GRAND card',
    bp_buy_premium:'Buy Premium Pass', bp_owned:'Premium Pass active', bp_locked_premium:'Premium', bp_claim:'Claim', bp_claimed:'Claimed', bp_buy_with:'Buy with',
    bp_xp_label:'Pass XP', bp_level:'Level', bp_required:'XP required',
    bp_ends_in:'Ends in', bp_days:'d', bp_hours:'h', bp_min:'min',
    bp_reward_shards:'SHARDS', bp_reward_flux:'FLUX', bp_reward_grand:'1 GRAND card',
    nav_community:'COMMUNITY', coll_search_ph:'Search cards…',
    nav_jugar:'PLAY', nav_perfil:'PROFILE', nav_coleccion:'COLLECTION',
    nav_mercado:'MARKET', nav_guilds:'GUILDS', nav_shop:'PACK SHOP',
    tab_jugar:'PLAY', tab_perfil:'PROFILE', tab_coleccion:'COLLECTION',
    tab_mercado:'MARKET', tab_guilds:'GUILDS', tab_shop:'PACK SHOP',
    topbar_wallet:'Connect Wallet', topbar_logout:'Log out',
    panel_learn_title:'Learn', panel_learn_sub:'Game rules, modes, rankings, clans, and card mechanics',
    panel_missions_title:'Missions', panel_missions_sub:'Complete objectives to earn SHARDS and unlock TITAN/ECO cards',
    panel_community_title:'Community', panel_community_sub:'Forum, Discord, and shared deck presets',
    panel_jugar_title:'Play', panel_perfil_title:'Profile',
    panel_coleccion_title:'Collection', panel_mercado_title:'Market',
    panel_guilds_title:'Guilds', panel_shop_title:'Pack Shop',
    panel_perfil_sub:'Account stats, sponsor and referrals',
    panel_coleccion_sub:'Active deck, presets and cards',
    panel_mercado_sub:'List cards and review transaction history',
    panel_guilds_sub:'Create, customize and manage guild requests',
    panel_shop_sub:'Buy packs with FLUX or $SHS',
    deck_active:'Active Deck', preset_save:'Save', preset_load:'Load',
    preset_name_ph:'Preset name…',
    preset_share:'Share to Community',
    coll_owned:'Owned', coll_missing:'Not Owned',
    coll_filter_all:'All', coll_filter_owned:'Owned', coll_filter_missing:'Missing',
    market_list_title:'List a Card', market_my_sales:'My Active Listings',
    market_live:'Market Listings', market_buy_history:'Purchase History',
    market_sell_history:'Sales History',
    market_list_btn:'List', market_buy_btn:'Buy',
    market_tab_offchain:'Off-Chain (SHARDS)', market_tab_onchain:'On-Chain ($SHS)', market_tab_history:'History',
    market_onchain_title:'ON-CHAIN MARKET', market_onchain_desc:'Trade NFT cards with $SHS tokens on Abstract Chain. Connect your wallet to access.',
    market_onchain_btn:'Connect Wallet to Trade',
    market_price_ph:'Price in SHARDS',
    shop_last_opened:'Last Opened', shop_empty:'Open a pack to see results.',
    guild_create:'Create Guild', guild_create_cost:'100 FLUX',
    guild_my:'My Guild', guild_pending:'Pending Requests',
    guild_requests:'Incoming requests', guild_directory:'Guild Directory',
    guild_create_btn:'Create Guild', guild_search_ph:'Search guilds…',
    guild_name_ph:'Guild name', guild_bio_ph:'Guild description…', guild_emoji_ph:'Emoji',
    profile_sponsor:'Sponsor', profile_no_sponsor:'No sponsor.',
    profile_friends:'Friends', profile_ref_title:'Referral Link',
    profile_ref_ph:'Generate your link…', profile_copy:'Copy', profile_referrals:'Referrals',
    sidebar_tagline:'FRACTURE NETWORK', logout:'Log out',
    community_forum:'Forum', community_join:'Join the Community',
    community_discord:'Discord Server', community_presets:'Public Presets',
    learn_tab_rules:'Rules', learn_tab_modes:'Modes', learn_tab_rankings:'Rankings',
    learn_tab_clans:'Clans', learn_tab_cards:'Mechanics',
    guild_join_btn:'Request to join', guild_approve_btn:'Approve', guild_deny_btn:'Decline',
    guild_cost:'100 FLUX',
    pack_flux_name:'FLUX Pack', pack_flux_desc:'4 random cards · Common → Rare',
    pack_shs_name:'$SHS Pack', pack_shs_desc:'4 random cards · Uncommon guaranteed',
    pack_open_btn:'Open Pack', pack_last:'Last opened',
    mode_classic:'CLASSIC', mode_classic_sub:'PvP · Earn SHARDS',
    mode_ranked:'FRACTAL RANKED', mode_ranked_sub:'ELO · Earn $SHS',
    mode_training:'TRAINING', mode_training_sub:'No risk · Reduced XP',
    gate_sub:'FRACTURE NETWORK · ON-CHAIN TCG',
    gate_msg:'Log in from the app to access the portal.',
    gate_btn:'⚡ ENTER THE GAME',
    gate_hint:'Your session is created automatically when you log in from the app.',
    ref_title:'Referral link', ref_copy:'Copy', ref_sub:'Referrals',
    sponsor_title:'Sponsor',
    no_cards:'No cards yet. Open a pack.',
    no_market:'No active listings.',
    no_sales:'No active listings from you.',
    no_buy_hist:'No purchases.', no_sell_hist:'No sales.',
    no_guild:'You don\'t belong to any guild.',
    no_guilds:'No guilds yet. Create the first one!',
    no_requests:'No pending requests.',
    no_preset:'No presets', no_pack_open:'Open a pack to see the result.',
    leader_only:'Only the guild leader manages requests.',
    member_badge:'Member', requested_badge:'Request sent',
    members_label:'member(s)', version:'v0.9 · Abstract Chain',
    tagline:'FRACTURE NETWORK',
    currency_shards:'SHARDS', currency_flux:'FLUX', currency_shs:'$SHS',
    add_deck:'+ Deck', remove_deck:'− Deck', sell_card:'Sell',
    in_deck_label:'IN DECK',
    deck_full:'Deck full (8/8).', removed_deck:'Removed from deck.',
    added_deck:'added to deck.',
    toast_ref:'🔗 Referral link copied.',
    toast_ref_err:'Could not copy automatically.',
    preset_name_req:'Enter a preset name.',
    preset_deck_req:'Deck needs 8 cards.',
    preset_loaded:'synced with app.',
    preset_saved:'saved.',
  }
};

let currentLang = localStorage.getItem('shs_lang') || 'es';
function t(key) { return (I18N[currentLang] || I18N.es)[key] || key; }
function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('shs_lang', lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const val = t(el.dataset.i18nPh);
    if (val) el.placeholder = val;
  });
  // Update lang toggle button
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = lang === 'es' ? 'EN' : 'ES';
  renderLearnContent();
  // Re-render open tab
  const activeNav = navItems.find(n => n.classList.contains('active'));
  if (activeNav) renderTab(activeNav.dataset.tab);
}

function renderLearnContent() {
  const L = currentLang === 'en';
  // ── RULES ──
  const rulesEl = document.getElementById('ltab-rules');
  if (rulesEl) rulesEl.innerHTML = `<div class="rules-grid">
    <div class="rule-card"><div class="rule-card-num">01 · ${L?'OBJECTIVE':'OBJETIVO'}</div><h3>${L?'Drain 12 HP':'Drenar 12 HP'}</h3><p>${L?'Each player starts with <strong>12 HP</strong>. Win rounds to deal damage equal to your card\'s Damage stat. First to zero loses.':'Cada jugador empieza con <strong>12 HP</strong>. Gana rondas para infligir daño igual al Daño de tu carta. El primero en llegar a cero pierde.'}</p></div>
    <div class="rule-card"><div class="rule-card-num">02 · ${L?'DECK':'MAZO'}</div><h3>${L?'Build Your 8-Card Deck':'Arma tu Mazo de 8 Cartas'}</h3><p>${L?'Choose 8 cards from up to <strong>2 clans</strong>. Each battle draws 4 random cards — build depth to handle variance.':'Elige 8 cartas de hasta <strong>2 clanes</strong>. Cada batalla roba 4 cartas al azar — construye profundidad para manejar la varianza.'}</p></div>
    <div class="rule-card"><div class="rule-card-num">03 · ${L?'PULSOS':'PULSOS'}</div><h3>${L?'Wager Pulsos Each Round':'Apuesta Pulsos Cada Ronda'}</h3><p>${L?'Start with <strong>10 Pulsos</strong>. Each allocated multiplies your card\'s attack: <strong>ATQ = Power × (1 + Pulsos)</strong>. Higher ATQ wins.':'Empiezas con <strong>10 Pulsos</strong>. Cada uno multiplicado es: <strong>ATQ = Poder × (1 + Pulsos)</strong>. Mayor ATQ gana.'}</p></div>
    <div class="rule-card"><div class="rule-card-num">04 · ${L?'ROUNDS':'RONDAS'}</div><h3>${L?'4 Rounds Per Battle':'4 Rondas por Batalla'}</h3><p>${L?'Both players secretly choose a card and allocate Pulsos simultaneously. Reveals happen at the same time — <strong>mind games are real</strong>.':'Ambos eligen carta y Pulsos en secreto simultáneamente. Todo se revela al mismo tiempo — <strong>los juegos mentales son reales</strong>.'}</p></div>
    <div class="rule-card"><div class="rule-card-num">05 · ${L?'CLAN BONUS':'BONUS DE CLAN'}</div><h3>${L?'Run 3+ Same-Clan Cards':'Juega 3+ Cartas del Mismo Clan'}</h3><p>${L?'Running 3+ cards of the same clan activates a <strong>passive clan bonus</strong> on all your cards.':'Usar 3+ cartas del mismo clan activa un <strong>bonus pasivo de clan</strong> en todas tus cartas.'}</p></div>
    <div class="rule-card"><div class="rule-card-num">06 · ${L?'ABILITIES':'HABILIDADES'}</div><h3>${L?'Card Abilities Trigger on Condition':'Las Habilidades se Activan por Condición'}</h3><p>${L?'Abilities like <strong>Poison, Weaken, Stop, Copy, Support</strong> can swing any round.':'Habilidades como <strong>Veneno, Debilitar, Stop, Copiar, Apoyo</strong> pueden cambiar cualquier ronda.'}</p></div>
  </div>`;

  // ── MODES ──
  const modesEl = document.getElementById('ltab-modes');
  if (modesEl) modesEl.innerHTML = `<div class="rules-grid">
    <div class="rule-card" style="--mc-color:#9BFF00"><div class="rule-card-num" style="color:#9BFF00">TRAINING</div><h3>${L?'Learn Without Risk':'Aprende Sin Riesgo'}</h3><p>${L?'Battle the AI. No Pulso/Shard stakes. <strong>Reduced XP</strong>. Perfect for testing decks and learning matchups.':'Batalla contra la IA. Sin apuestas de Pulsos/SHARDS. <strong>XP reducida</strong>. Perfecto para probar mazos y aprender matchups.'}</p></div>
    <div class="rule-card" style="--mc-color:var(--acc)"><div class="rule-card-num">CASUAL</div><h3>${L?'PvP · Earn SHARDS':'PvP · Gana SHARDS'}</h3><p>${L?'Play against real opponents. Win to earn <strong>SHARDS</strong> and XP. No ELO impact.':'Juega contra jugadores reales. Gana para obtener <strong>SHARDS</strong> y XP. Sin impacto en ELO.'}</p></div>
    <div class="rule-card" style="--mc-color:var(--am)"><div class="rule-card-num" style="color:var(--am)">FRACTAL RANKED</div><h3>${L?'Off-Chain ELO':'ELO Off-Chain'}</h3><p>${L?'Your ELO bracket determines rewards. Climb from <strong>Astilla → Singularidad</strong>.':'Tu bracket de ELO determina las recompensas. Sube desde <strong>Astilla → Singularidad</strong>.'}</p></div>
    <div class="rule-card" style="--mc-color:#f59e0b"><div class="rule-card-num" style="color:#f59e0b">ON-CHAIN RANKED</div><h3>${L?'$SHS Stakes':'Apuestas $SHS'}</h3><p>${L?'Wager <strong>$SHS tokens</strong> on match outcomes. Cards are NFTs with real on-chain ownership.':'Apuesta <strong>tokens $SHS</strong> en resultados de partidas. Las cartas son NFTs con propiedad real on-chain.'}</p></div>
  </div>`;

  // ── RANKINGS ──
  const ranksEl = document.getElementById('ltab-rankings');
  if (ranksEl) ranksEl.innerHTML = `<div class="ranks-list">
    <div class="rank-row" style="--rc:#6B7280"><div class="rank-dot"></div><div class="rank-name">Astilla</div><div class="rank-range">0 — 799 ELO</div></div>
    <div class="rank-row" style="--rc:#9B59B6"><div class="rank-dot"></div><div class="rank-name">Grieta</div><div class="rank-range">800 — 1199 ELO</div></div>
    <div class="rank-row" style="--rc:#F59E0B"><div class="rank-dot"></div><div class="rank-name">Fractura</div><div class="rank-range">1200 — 1599 ELO</div></div>
    <div class="rank-row" style="--rc:#FF3B3B"><div class="rank-dot"></div><div class="rank-name">Abismo</div><div class="rank-range">1600 — 1999 ELO</div></div>
    <div class="rank-row" style="--rc:#00FFC6"><div class="rank-dot"></div><div class="rank-name">Singularidad</div><div class="rank-range">2000+ ELO</div></div>
  </div>`;

  // ── CARDS (MECHANICS) ──
  const cardsEl = document.getElementById('ltab-cards');
  if (cardsEl) cardsEl.innerHTML = `<div class="rules-grid">
    <div class="rule-card"><div class="rule-card-num">POWER / PODER</div><h3>${L?'Base Combat Stat':'Estadística Base de Combate'}</h3><p>${L?'<strong>ATQ = Power × (1 + Pulsos)</strong>. Higher ATQ wins. Modified by Weaken, Stop, and other abilities.':'<strong>ATQ = Poder × (1 + Pulsos)</strong>. Mayor ATQ gana. Modificado por Debilitar, Stop y otras habilidades.'}</p></div>
    <div class="rule-card"><div class="rule-card-num">DAMAGE / DAÑO</div><h3>${L?'HP Dealt on Win':'HP Infligido al Ganar'}</h3><p>${L?'When you win a round, your card\'s <strong>Damage</strong> is deducted from the opponent\'s HP. Some abilities modify damage on trigger.':'Al ganar una ronda, el <strong>Daño</strong> de tu carta se resta al HP del oponente. Algunas habilidades lo modifican al activarse.'}</p></div>
    <div class="rule-card"><div class="rule-card-num">${L?'STARS':'ESTRELLAS'}</div><h3>${L?'Card Strength Rating':'Clasificación de Fuerza'}</h3><p>${L?'1–5 stars indicate overall power. Higher star cards are rarer. <strong>No deck restrictions</strong> by star count.':'1–5 estrellas indican potencia general. Cartas de más estrellas son más raras. <strong>Sin restricciones de mazo</strong> por estrellas.'}</p></div>
    <div class="rule-card"><div class="rule-card-num">${L?'RARITY':'RAREZA'}</div><h3>C / U / R / M</h3><p>${L?'<strong>Common, Uncommon, Rare, Mythic.</strong> Rarity affects pack drop rate and market value.':'<strong>Común, Infrecuente, Rara, Mítica.</strong> La rareza afecta la tasa de aparición en packs y el valor de mercado.'}</p></div>
  </div>`;

  // ── CLANS — reset cache so it re-renders with correct lang ──
  const cg = document.getElementById('clans-learn-grid');
  if (cg) { delete cg.dataset.rendered; renderLearnClans(); }
}

// ── HELPERS ──────────────────────────────────────────────────
function byId(id){ return document.getElementById(id); }

const CLANS_DATA = (typeof CLANS !== 'undefined') ? CLANS : {};

function clanColor(clanKey){
  const c = CLANS_DATA[clanKey];
  return c ? c.color : '#6B5CE7';
}
function clanEmoji(clanKey){
  const c = CLANS_DATA[clanKey];
  return c ? c.emoji : '⚡';
}

// ── TOAST ─────────────────────────────────────────────────────
let _toastTimer = null;
function toast(msg, dur = 2800) {
  const el = byId('toast');
  if (!el) { console.warn(msg); return; }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}

// ── ELO BRACKET ───────────────────────────────────────────────
function eloBracket(elo) {
  if (elo < 800)  return { label:'Astilla',      cls:'elo-astilla' };
  if (elo < 1200) return { label:'Grieta',        cls:'elo-grieta' };
  if (elo < 1600) return { label:'Fractura',      cls:'elo-fractura' };
  if (elo < 2000) return { label:'Abismo',        cls:'elo-abismo' };
  return              { label:'Singularidad',  cls:'elo-singularidad' };
}
function eloProgress(elo) {
  const brackets = [[0,800],[800,1200],[1200,1600],[1600,2000]];
  for (const [min,max] of brackets) {
    if (elo < max) return Math.round((elo - min) / (max - min) * 100);
  }
  return 100;
}

// ── DB / SESSION ───────────────────────────────────────────────
function loadDb() {
  try {
    const raw = localStorage.getItem(AUTH_DB_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      view.db = {
        users:          p.users          || {},
        emailToUid:     p.emailToUid     || {},
        usernameToUid:  p.usernameToUid  || {},
        marketListings: p.marketListings || [],
        guilds:         p.guilds         || [],
      };
    }
  } catch(_){}
}
function saveDb() {
  localStorage.setItem(AUTH_DB_KEY, JSON.stringify(view.db));
}
function ensureUserDefaults(u) {
  if (!u) return;
  const d = {
    username:'Player', referralCode:'REF00000', referrals:[], referredByUid:null,
    buyHistory:[], sellHistory:[], battleWins:0, battleLosses:0, battlesTotal:0,
    abandonStreak:0, lastAbandonAt:0,
    elo:0, onchainElo:0, shardsBalance:0, fluxBalance:0, shsBalance:0,
    guildId:null, avatar:'⚡', gameState:{ collection:{}, deck:[], deckPresets:[], welcomePackClaimed:false, claimedMissions:[] },
  };
  Object.keys(d).forEach(k => { if (u[k] == null) u[k] = d[k]; });
}
function resolveCurrentUser() {
  const uid = localStorage.getItem(AUTH_SESSION_KEY);
  if (uid && view.db.users[uid]) return view.db.users[uid];
  return Object.values(view.db.users)[0] || null;
}
function syncFromUser() {
  const u = view.user; if (!u) return;
  ensureUserDefaults(u);
  const gs = u.gameState || {};
  view.state.collection  = gs.collection  || {};
  view.state.deck        = (gs.deck || []).slice(0, 8);
  view.state.deckPresets = gs.deckPresets  || [];
  view.state.welcomePackClaimed = !!gs.welcomePackClaimed;
  view.state.shards = u.shardsBalance ?? 0;
  view.state.flux   = u.fluxBalance   ?? 0;
  view.state.shs    = u.shsBalance    ?? 0;
}
function persistToUser() {
  const u = view.user; if (!u) return;
  u.shardsBalance = view.state.shards;
  u.fluxBalance   = view.state.flux;
  u.shsBalance    = view.state.shs;
  u.gameState = u.gameState || {};
  u.gameState.collection       = view.state.collection;
  u.gameState.deck             = view.state.deck;
  u.gameState.deckPresets      = view.state.deckPresets;
  u.gameState.welcomePackClaimed = view.state.welcomePackClaimed;
  saveDb();

  // Mirror to Supabase (debounced, queued, retried offline).
  if (window.SHS_SYNC && u.uid) {
    SHS_SYNC.queueState(u.uid, {
      shards: view.state.shards|0,
      flux:   view.state.flux|0,
      shs:    Number(view.state.shs||0),
      elo:    u.elo|0,
      level:  u.accountLevel|0 || 1,
      xp:     u.accountXp|0,
      welcome_pack_claimed: !!view.state.welcomePackClaimed,
    });
    // Normalize collection to {cardId: qty} for the server (legacy entries
    // may still be {lv,xp} objects from old localStorage profiles).
    const colMap = {};
    Object.keys(view.state.collection || {}).forEach(id => {
      const v = view.state.collection[id];
      if (typeof v === 'number') colMap[id] = v;
      else if (v && typeof v === 'object') colMap[id] = (v.qty | 0) || 1;
    });
    SHS_SYNC.queueCollection(u.uid, colMap);
    if (Array.isArray(view.state.deck) && view.state.deck.length === 8) {
      SHS_SYNC.queueDeck(u.uid, 'Active', view.state.deck, true);
    } else if (SHS_SYNC.deleteDeck) {
      // Incomplete active deck → drop the server row so refresh doesn't resurrect old cards.
      SHS_SYNC.deleteDeck(u.uid, 'Active').catch(()=>{});
    }
    const validPresetNames = new Set();
    (view.state.deckPresets || []).forEach((preset, i) => {
      const ids = Array.isArray(preset?.cards) ? preset.cards : (Array.isArray(preset) ? preset : null);
      const name = preset?.name || ('Preset '+(i+1));
      if (ids && ids.length === 8) {
        SHS_SYNC.queueDeck(u.uid, name, ids, false);
        validPresetNames.add(name);
      }
    });
    // Hard-delete any preset rows the user removed locally (if we know them).
    const knownPresets = view._knownServerPresets || [];
    knownPresets.forEach(name => {
      if (name !== 'Active' && !validPresetNames.has(name) && SHS_SYNC.deleteDeck) {
        SHS_SYNC.deleteDeck(u.uid, name).catch(()=>{});
      }
    });
    view._knownServerPresets = Array.from(validPresetNames);
  }
}

function reloadPwaFrame() {
  const f = byId("pwa-frame");
  if (f && f.contentWindow) {
    try { f.contentWindow.location.reload(); } catch(_){}
  }
}

// ── TOPBAR / SIDEBAR SYNC ──────────────────────────────────────
function syncTopbar() {
  const u = view.user; if (!u) return;
  byId('sb-shards').textContent = (view.state.shards || 0).toLocaleString();
  byId('sb-flux').textContent   = (view.state.flux   || 0).toLocaleString();
  byId('sb-shs').textContent    = (view.state.shs    || 0).toLocaleString();
  const avatar = u.avatar || '⚡';
  const username = u.username || 'Player';
  byId('topbar-avatar') && (byId('topbar-avatar').textContent = avatar);
  byId('topbar-avatar2') && (byId('topbar-avatar2').textContent = avatar);
  byId('profile-avatar-big') && (byId('profile-avatar-big').textContent = avatar);
  byId('topbar-username') && (byId('topbar-username').textContent = username);
  byId('topbar-username2') && (byId('topbar-username2').textContent = username);
  const eb = eloBracket(u.elo || 0);
  const eloText = `${eb.label} · ${u.elo || 0}`;
  const eloEl = byId('topbar-elo');
  if (eloEl) { eloEl.textContent = eloText; eloEl.className = `user-elo ${eb.cls}`; }
  const eloEl2 = byId('topbar-elo2');
  if (eloEl2) { eloEl2.textContent = eloText; eloEl2.className = `topbar-elo ${eb.cls}`; }
  // Show admin nav link only for the admin email.
  const adminLink = byId('nav-admin-link');
  if (adminLink) {
    const isAdmin = (u.email || '').toLowerCase() === 'faxie.contact@gmail.com';
    adminLink.style.display = isAdmin ? '' : 'none';
  }
}

// ── TAB NAVIGATION ─────────────────────────────────────────────
const SECTION_LABELS = {
  learn:'LEARN', missions:'MISSIONS', battlepass:'BATTLE PASS', coleccion:'COLLECTION',
  mercado:'MARKET', shop:'SHOP', guilds:'GUILDS',
  community:'COMMUNITY', perfil:'PROFILE'
};
function setTab(tabId) {
  navItems.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  Object.entries(panels).forEach(([key, panel]) => {
    if (!panel) return;
    panel.classList.toggle('active', key === tabId);
  });
  const sectionEl = byId('topbar-section');
  if (sectionEl) sectionEl.textContent = SECTION_LABELS[tabId] || tabId.toUpperCase();
  renderTab(tabId);
}
function renderTab(tabId) {
  if (!view.user) return;
  if (tabId === 'perfil')    renderPerfil();
  if (tabId === 'coleccion') renderColeccion();
  if (tabId === 'mercado')   renderMercado();
  if (tabId === 'guilds')    renderGuilds();
  if (tabId === 'shop')      { renderShop(); renderPacks(); }
  if (tabId === 'learn')     renderLearnClans();
  if (tabId === 'missions')  { drainBpPending(); renderMissions(); }
  if (tabId === 'battlepass'){ drainBpPending(); renderBattlePass(); }
  if (tabId === 'community') renderCommunity();
}

// ════════════════════════════════════════════════════════════
// CARD RENDERING — TCG Visual Cards
// ════════════════════════════════════════════════════════════
function cardName(id) {
  const c = (typeof getCard === 'function') ? getCard(id) : null;
  return c ? c.name : id;
}

function starsHtml(filled, total) {
  // filled = current level (painted stars), total = card.stars (shown stars)
  if (total === undefined) { total = filled; filled = total; } // legacy 1-arg call
  let s = '';
  for (let i = 0; i < total; i++) {
    s += `<span class="star ${i < filled ? 'filled' : 'empty'}">★</span>`;
  }
  return s;
}

function rarLabel(rar) {
  const map = { C:'Common', U:'Uncommon', R:'Rare', M:'Mythic' };
  return map[rar] || rar;
}

function typeLabel(t) {
  // Only true card *types* are 'grand' (LD-equiv) and 'eco' (CR-equiv).
  // 'titans' is a CLAN now, not a type. Legacy values map to nothing.
  const map = { grand:'GRAND', eco:'ECO' };
  return map[t] || (t || '').toUpperCase();
}

/**
 * renderCard — Full TCG visual card (collection grid, market, pack reveal)
 * opts: { size:'sm'|'md'|'lg', actions:bool, missing:bool, forDeck:bool }
 */
function renderCard(id, opts = {}) {
  const card = (typeof getCard === 'function') ? getCard(id) : null;
  if (!card) return `<div class="shs-card shs-card-error" data-id="${id}"><span>${id}</span></div>`;

  const cc      = clanColor(card.clan);
  const ce      = clanEmoji(card.clan);
  const inDeck  = view.state?.deck?.includes(id);
  const stars   = card.stars || 2;
  const cardEntry = view.state?.collection?.[id] || {lv:1};
  const cardLv  = opts.missing ? 1 : (cardEntry.lv || 1);
  const stats   = (typeof getCardStatsAtLevel === 'function')
    ? getCardStatsAtLevel(card, cardLv)
    : {pow: card.pow ? card.pow[card.pow.length-1] : '?', dmg: card.dmg ? card.dmg[card.dmg.length-1] : '?'};
  const pow     = stats.pow;
  const dmg     = stats.dmg;
  const size    = opts.size || 'md';
  const abilityActive = (typeof cardHasAbility === 'function') ? cardHasAbility(card, cardLv) : true;
  const unlockAt = (typeof abilityUnlockLevel === 'function') ? abilityUnlockLevel(stars) : 2;
  const abilText = typeof card.ability === 'object' ? card.ability.text : (card.ability || '');
  const bonusText = typeof card.bonus === 'object' ? card.bonus.text : (card.bonus || '');
  const condText = card.abilityData?.condition || '';
  const cardType = card.type || 'normal';

  const imgSrc = (typeof getCardArt === 'function')
    ? (getCardArt(card, cardLv) || '')
    : (card.visual?.image || '');
  const logoSrc = card.visual?.logo || '';

  const starsStr = Array.from({length: stars}, (_, i) =>
    `<span class="${i < cardLv ? 'star-filled' : 'star-empty'}">★</span>`
  ).join('');

  const cls = [
    'shs-card',
    `shs-${size}`,
    `type-${cardType}`,
    inDeck ? 'in-deck' : '',
    opts.missing ? 'is-missing' : '',
  ].filter(Boolean).join(' ');

  return `
<div class="${cls}" style="--cc:${cc}" data-id="${id}" onclick="openCardDetail('${id}')">
  ${inDeck ? `<div class="shs-indeck-badge">${t('in_deck_label')}</div>` : ''}
  <div class="card-art${imgSrc ? ' has-img' : ''}">
    ${imgSrc ? `<img src="${imgSrc}" alt="${card.name}" loading="lazy" onerror="this.parentNode.classList.remove('has-img')"/>` : ''}
    <div class="card-art-placeholder">${ce}</div>
    ${opts.missing ? '<div class="card-missing-lock">🔒</div>' : ''}
  </div>
  <div class="card-vignette"></div>
  ${(cardType==='grand'||cardType==='eco') ? `<div class="card-type-badge type-${cardType}">${typeLabel(cardType)}</div>` : ''}
  <div class="card-top">
    ${logoSrc ? `<img class="card-logo show" src="${logoSrc}" alt="" onerror="this.classList.remove('show')"/>` : ''}
    <span class="card-name">${card.name}</span>
    <span class="card-rar rar-${card.rar}">${card.rar}</span>
  </div>
  <div class="card-stats">
    <div class="stat-pill"><span class="stat-pill-num pow">${pow}</span><span class="stat-pill-label">POW</span></div>
    <div class="stat-pill"><span class="stat-pill-num dmg">${dmg}</span><span class="stat-pill-label">DMG</span></div>
  </div>
  <div class="card-bottom">
    <div class="card-ability" style="${!abilityActive ? 'opacity:.4' : ''}">
      ${!abilityActive ? `🔒 LV${unlockAt}` : (condText ? `<span class="ability-condition">${condText}:</span> ` : '') + abilText}
    </div>
    ${bonusText ? `<div class="card-bonus"><span class="bonus-label">Bonus</span><span class="bonus-text">${bonusText}</span></div>` : ''}
  </div>
  <div class="card-stars">${starsStr}</div>
</div>`;
}

/**
 * renderDeckChip — Compact slot in the active deck row (not a full card)
 */
function renderDeckChip(id, index) {
  const card = (typeof getCard === 'function') ? getCard(id) : null;
  if (!card) {
    return `<div class="deck-chip empty" data-remove="${id}"><span class="deck-chip-num">${index+1}</span>—</div>`;
  }
  const cc = clanColor(card.clan);
  const ce = clanEmoji(card.clan);
  const pow = card.pow ? card.pow[1] : '?';
  const dmg = card.dmg ? card.dmg[1] : '?';
  return `
    <div class="deck-chip" style="--cc:${cc}" data-remove="${id}" title="${card.name} · click to remove">
      <span class="deck-chip-icon">${ce}</span>
      <span class="deck-chip-name">${card.name}</span>
      <span class="deck-chip-stats">${pow}/${dmg}</span>
      <span class="deck-chip-num">${index+1}</span>
    </div>`;
}

function renderEmptyDeckSlot(index) {
  return `<div class="deck-chip empty"><span class="deck-chip-num">${index+1}</span><span class="deck-chip-empty-icon">+</span></div>`;
}

// ════════════════════════════════════════════════════════════
// CARD DETAIL MODAL
// ════════════════════════════════════════════════════════════
let _cdModalLv = 1;
let _cdModalId = null;

function openCardDetail(id) {
  const card = (typeof getCard === 'function') ? getCard(id) : null;
  if (!card) return;
  _cdModalId = id;
  const owned = !!view.state?.collection?.[id];
  _cdModalLv = 1;
  _renderCardDetailModal(card, owned);
  byId('card-detail-modal').classList.add('show');
}

function closeCardDetail() {
  byId('card-detail-modal').classList.remove('show');
}

function _cdSetLv(lv) {
  _cdModalLv = lv;
  const card = (typeof getCard === 'function') ? getCard(_cdModalId) : null;
  if (!card) return;
  const owned = !!view.state?.collection?.[_cdModalId];
  _renderCardDetailModal(card, owned);
}

function _renderCardDetailModal(card, owned) {
  const id       = card.id;
  const stars    = card.stars || 2;
  const lv       = Math.max(1, Math.min(_cdModalLv, stars));
  const cc       = clanColor(card.clan);
  const ce       = clanEmoji(card.clan);
  const clanName = (CLANS_DATA[card.clan]?.name || card.clan).toUpperCase();
  const clanBonus= CLANS_DATA[card.clan]?.bonus || '';
  const stats    = (typeof getCardStatsAtLevel === 'function')
    ? getCardStatsAtLevel(card, lv)
    : {pow: card.pow[lv-1] ?? card.pow[0], dmg: card.dmg[lv-1] ?? card.dmg[0]};
  const imgSrc   = (typeof getCardArt === 'function') ? getCardArt(card, lv) : (card.visual?.image || '');
  const abilActive = (typeof cardHasAbility === 'function') ? cardHasAbility(card, lv) : true;
  const unlockAt = (typeof abilityUnlockLevel === 'function') ? abilityUnlockLevel(stars) : 2;
  const abilText = typeof card.ability === 'object' ? card.ability?.text : (card.ability || '');
  const condText = card.abilityData?.condition || '';
  const bonusText = typeof card.bonus === 'object' ? card.bonus?.text : (card.bonus || clanBonus || '');
  const rar      = card.rar || 'C';
  const rarNames = {C:'Common',U:'Uncommon',R:'Rare',M:'Mythic'};
  const cardType = card.type || 'normal';
  const inDeck   = view.state?.deck?.includes(id);

  // XP info
  const XP_PER_LV = 100;
  const entry = view.state?.collection?.[id] || {lv:1, xp:0};
  const curXp = entry.xp || 0;
  const maxReached = lv >= stars;
  const xpPct = maxReached ? 100 : Math.min(100, Math.round(curXp / XP_PER_LV * 100));

  // Level toggle buttons
  const lvBtns = Array.from({length: stars}, (_, i) => {
    const n = i + 1;
    const label = n === stars ? 'MAX' : `LV${n}`;
    return `<button class="cdm-lv-btn${n===lv?' active':''}" onclick="_cdSetLv(${n})">${label}</button>`;
  }).join('');

  // Stars display
  const starsHtml = Array.from({length:stars},(_,i)=>
    `<span class="${i<lv?'star-filled':'star-empty'}">★</span>`
  ).join('');

  // Card art side
  const artSide = `
    <div class="cdm-art-wrap" style="--cc:${cc}">
      <div class="cdm-art${imgSrc?' has-img':''}">
        ${imgSrc?`<img src="${imgSrc}" alt="${card.name}" onerror="this.parentNode.classList.remove('has-img')"/>`:''}
        <div class="cdm-art-ph">${ce}</div>
        ${!owned?'<div class="cdm-locked">🔒</div>':''}
      </div>
      <div class="cdm-art-vignette"></div>
      <div class="cdm-lv-toggle">${lvBtns}</div>
    </div>`;

  // Info side
  const infoSide = `
    <div class="cdm-info">
      <div class="cdm-header">
        <div class="cdm-name">${card.name}</div>
        <div class="cdm-rar rar-${rar}">${rarNames[rar]}</div>
      </div>
      <div class="cdm-clan-row">
        <span class="cdm-clan-dot" style="background:${cc}"></span>
        <span class="cdm-clan-name" style="color:${cc}">${ce} ${clanName}</span>
        ${(cardType==='grand'||cardType==='eco')?`<span class="cdm-type-badge type-${cardType}">${typeLabel(cardType)}</span>`:''}
      </div>
      <div class="cdm-stars-row">${starsHtml}</div>

      <div class="cdm-stats-row">
        <div class="cdm-stat-box">
          <div class="cdm-stat-num" style="color:#c8d8ff">${stats.pow}</div>
          <div class="cdm-stat-lbl">PODER</div>
        </div>
        <div class="cdm-stat-divider"></div>
        <div class="cdm-stat-box">
          <div class="cdm-stat-num" style="color:#ff6b6b">${stats.dmg}</div>
          <div class="cdm-stat-lbl">DAÑO</div>
        </div>
      </div>

      ${owned ? `<div class="cdm-xp-section">
        <div class="cdm-xp-label">
          <span>${maxReached ? (currentLang==='es'?'Nivel máximo':'Max level') : `XP ${curXp} / ${XP_PER_LV}`}</span>
          <span>${maxReached?'':'LV'+lv+' → LV'+(lv+1)}</span>
        </div>
        <div class="cdm-xp-bar"><div class="cdm-xp-fill" style="width:${xpPct}%;background:${cc}"></div></div>
      </div>` : `<div class="cdm-not-owned">${currentLang==='es'?'No obtenida · Consigue esta carta en packs':'Not owned · Get this card in packs'}</div>`}

      <div class="cdm-section-lbl">${currentLang==='es'?'HABILIDAD':'ABILITY'}</div>
      <div class="cdm-ability-box${abilActive?'':' locked'}">
        ${!abilActive
          ? `<span class="cdm-lock-icon">🔒</span> ${currentLang==='es'?'Se desbloquea en':'Unlocks at'} LV${unlockAt}`
          : (condText?`<span class="cdm-cond">${condText}:</span> `:'') + (abilText || '—')}
      </div>

      <div class="cdm-section-lbl">${currentLang==='es'?'BONUS DE CLAN':'CLAN BONUS'}</div>
      <div class="cdm-bonus-box">${bonusText || '—'}</div>

      ${owned ? `<div class="cdm-actions">
        <button class="cdm-btn${inDeck?' cdm-btn-remove':''}" onclick="cdmToggleDeck('${id}')">
          ${inDeck ? (currentLang==='es'?'− Quitar del deck':'− Remove from deck') : (currentLang==='es'?'+ Agregar al deck':'+ Add to deck')}
        </button>
        <button class="cdm-btn cdm-btn-sell" onclick="cdmSell('${id}')">
          ${currentLang==='es'?'💰 Vender':'💰 Sell'}
        </button>
      </div>` : ''}
    </div>`;

  const modal = byId('card-detail-modal');
  modal.querySelector('.cdm-body').innerHTML = artSide + infoSide;
}

function cdmToggleDeck(id) {
  const deck = view.state.deck;
  if (deck.includes(id)) {
    view.state.deck = deck.filter(x => x !== id);
    toast(currentLang==='es'?'Carta removida del deck.':'Card removed from deck.');
  } else {
    if (deck.length >= 8) return toast(currentLang==='es'?'Deck lleno (8/8).':'Deck is full (8/8).');
    view.state.deck.push(id);
    toast(currentLang==='es'?`Carta agregada (${deck.length}/8).`:`Card added (${deck.length}/8).`);
  }
  persistToUser();
  renderColeccion();
  // Re-render modal to update button state
  const card = getCard(id);
  if (card) _renderCardDetailModal(card, true);
}

function cdmSell(id) {
  closeCardDetail();
  setTab('mercado');
  const sel = byId('sell-card-id');
  if (sel) {
    sel.value = id;
    toast(currentLang==='es'?'Seleccionaste la carta para vender.':'Card selected for sale.');
  }
}

// ── RENDER: PERFIL ─────────────────────────────────────────────
function renderPerfil() {
  const u = view.user;
  const eb = eloBracket(u.elo || 0);
  const ep = eloProgress(u.elo || 0);
  byId('profile-name') && (byId('profile-name').textContent = u.username || 'Player');
  byId('profile-avatar-big') && (byId('profile-avatar-big').textContent = u.avatar || '⚡');
  const badge = byId('profile-elo-badge');
  if (badge) { badge.textContent = `${eb.label} · ${u.elo||0}`; badge.className = `profile-elo-badge ${eb.cls}`; }
  const xpBar = byId('xp-bar');
  if (xpBar) xpBar.style.width = ep + '%';
  byId('xp-label') && (byId('xp-label').textContent = `ELO ${u.elo||0} · ${eb.label}`);
  const statsGrid = byId('profile-stats-grid');
  if (statsGrid) statsGrid.innerHTML = `
    <div class="pstat"><div class="pstat-num">${u.battlesTotal||0}</div><div class="pstat-label">Battles</div></div>
    <div class="pstat"><div class="pstat-num">${u.battleWins||0}</div><div class="pstat-label">Wins</div></div>
    <div class="pstat"><div class="pstat-num">${u.battleLosses||0}</div><div class="pstat-label">Losses</div></div>
    <div class="pstat"><div class="pstat-num">${Object.keys(view.state.collection||{}).length}</div><div class="pstat-label">Cards</div></div>
  `;

  const sponsor = u.referredByUid ? view.db.users[u.referredByUid] : null;
  byId('profile-sponsor').innerHTML = sponsor
    ? `<div class="feed-row"><span class="feed-label">${sponsor.avatar||'⚡'} ${sponsor.username}</span></div>`
    : `<div class="feed-muted">Sin padrino.</div>`;

  const refCode = u.referralCode || 'REF00000';
  byId('ref-link').value = `https://shardstate.gg/join?ref=${refCode}`;
  const refs = (u.referrals || []).map(uid => view.db.users[uid]).filter(Boolean);
  const refEl = byId('referrals-list');
  refEl.innerHTML = refs.length ? '' : `<div class="feed-muted">Sin referidos aún.</div>`;
  refs.forEach(r => refEl.insertAdjacentHTML('beforeend',
    `<div class="feed-row"><span class="feed-label">${r.avatar||'⚡'} ${r.username}</span></div>`));

  // Pre-fill account-edit inputs
  const un = byId('acct-username');
  const em = byId('acct-email');
  if (un && document.activeElement !== un) un.value = u.username || '';
  if (em && document.activeElement !== em) em.value = u.email || '';

  renderFriends();
}

// ── ACCOUNT EDIT ──────────────────────────────────────────────
async function saveUsername(){
  const newName = String(byId('acct-username')?.value || '').trim().slice(0,24);
  if (!newName) return toast('Ingresa un username válido.');
  if (!window.SB || !SB.updateUsername) return toast('Sin conexión al servidor.');
  if (!view.user || !view.user.uid) return toast('Iniciá sesión.');
  const r = await SB.updateUsername(view.user.uid, newName);
  if (r.error) {
    const msg = ({
      invalid_username: 'Username inválido.',
      username_taken:   'Ese username ya existe.',
    })[r.error] || ('Error: ' + (r.error.message || r.error));
    return toast(msg);
  }
  view.user.username = newName;
  saveDb(); syncTopbar(); renderPerfil();
  toast('✓ Username actualizado.');
}
window.saveUsername = saveUsername;

async function saveEmail(){
  const newEmail = String(byId('acct-email')?.value || '').trim();
  if (!newEmail || !/.+@.+\..+/.test(newEmail)) return toast('Email inválido.');
  if (!window.SB || !SB.updateEmail) return toast('Sin conexión al servidor.');
  const r = await SB.updateEmail(newEmail);
  if (r.error) return toast('Error: ' + (r.error.message || r.error));
  toast('✉ Revisá tu nuevo email para confirmar el cambio.');
}
window.saveEmail = saveEmail;

async function savePassword(){
  const pw = String(byId('acct-password')?.value || '');
  if (pw.length < 6) return toast('Mínimo 6 caracteres.');
  if (!window.SB || !SB.updatePassword) return toast('Sin conexión al servidor.');
  const r = await SB.updatePassword(pw);
  if (r.error) return toast('Error: ' + (r.error.message || r.error));
  byId('acct-password').value = '';
  toast('🔐 Contraseña actualizada.');
}
window.savePassword = savePassword;

// ── FRIENDS SYSTEM ────────────────────────────────────────────
function getFriendSection() { return byId('friends-section'); }
function renderFriends() {
  const el = byId('friends-section');
  if (!el) return;
  const u = view.user;
  const friends = (u.friends||[]).map(uid => view.db.users[uid]).filter(Boolean);
  const received = (u.friendRequests?.received||[]).map(uid => view.db.users[uid]).filter(Boolean);
  const sent     = (u.friendRequests?.sent||[]);
  el.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <input id="friend-search-input" class="input-dark" style="flex:1;font-size:0.78rem" placeholder="${currentLang==='es'?'Buscar por username…':'Search by username…'}"/>
      <button class="btn btn-primary btn-sm" onclick="searchAndAddFriend()">+</button>
    </div>
    ${received.length ? `<div class="block-sub" style="margin-bottom:4px">${currentLang==='es'?'Solicitudes recibidas':'Incoming requests'}</div>
      ${received.map(r => `<div class="feed-row">
        <span class="feed-label">${r.avatar||'👤'} ${r.username}</span>
        <button class="btn-mini" onclick="acceptFriend('${r.uid}')">✓</button>
        <button class="btn-danger" onclick="declineFriend('${r.uid}')">✕</button>
      </div>`).join('')}` : ''}
    <div class="block-sub" style="margin:6px 0 4px">${currentLang==='es'?'Amigos':'Friends'} (${friends.length})</div>
    ${friends.length ? friends.map(f => `<div class="feed-row">
        <span class="feed-label">${f.avatar||'👤'} ${f.username}</span>
        <button class="btn-danger" onclick="removeFriend('${f.uid}')">✕</button>
      </div>`).join('') : `<div class="feed-muted">${currentLang==='es'?'Sin amigos aún.':'No friends yet.'}</div>`}
    ${sent.length ? `<div class="block-sub" style="margin-top:8px">${currentLang==='es'?'Enviadas':'Sent'}</div>
      ${sent.map(uid => { const r=view.db.users[uid]; return r?`<div class="feed-row"><span class="feed-label">${r.avatar||'👤'} ${r.username}</span><span style="font-size:0.65rem;color:var(--text2)">pending</span></div>`:''; }).join('')}` : ''}`;
}
function searchAndAddFriend() {
  const q = (byId('friend-search-input')?.value || '').trim().toLowerCase();
  if (!q) return toast('Ingresa un username.');
  const uid = view.db.usernameToUid?.[q];
  const target = uid ? view.db.users[uid] : null;
  if (!target || target.uid === view.user.uid) return toast(currentLang==='es'?'Usuario no encontrado.':'User not found.');
  if ((view.user.friends||[]).includes(target.uid)) return toast(currentLang==='es'?'Ya son amigos.':'Already friends.');
  if ((view.user.friendRequests?.sent||[]).includes(target.uid)) return toast('Solicitud ya enviada.');
  if (!view.user.friendRequests) view.user.friendRequests = {sent:[],received:[]};
  view.user.friendRequests.sent.push(target.uid);
  if (!target.friendRequests) target.friendRequests = {sent:[],received:[]};
  target.friendRequests.received.push(view.user.uid);
  saveDb();
  renderFriends();
  toast(`✉ Solicitud enviada a ${target.username}.`);
}
function acceptFriend(uid) {
  const u = view.user;
  const other = view.db.users[uid];
  if (!other) return;
  if (!u.friends) u.friends = [];
  if (!other.friends) other.friends = [];
  u.friends.push(uid);
  other.friends.push(u.uid);
  u.friendRequests.received = (u.friendRequests?.received||[]).filter(x=>x!==uid);
  other.friendRequests.sent = (other.friendRequests?.sent||[]).filter(x=>x!==u.uid);
  saveDb();
  renderFriends();
  toast(`👥 ${other.username} ${currentLang==='es'?'agregado como amigo':'added as friend'}.`);
}
function declineFriend(uid) {
  const u = view.user;
  if (!u.friendRequests) return;
  u.friendRequests.received = (u.friendRequests.received||[]).filter(x=>x!==uid);
  const other = view.db.users[uid];
  if (other?.friendRequests) other.friendRequests.sent = (other.friendRequests.sent||[]).filter(x=>x!==u.uid);
  saveDb();
  renderFriends();
}
function removeFriend(uid) {
  const u = view.user;
  const other = view.db.users[uid];
  u.friends = (u.friends||[]).filter(x=>x!==uid);
  if (other) other.friends = (other.friends||[]).filter(x=>x!==u.uid);
  saveDb();
  renderFriends();
}

// ── RENDER: COLECCIÓN ──────────────────────────────────────────
function renderColeccion() {
  // Deck slots
  const slotsEl = byId('deck-slots');
  let deckHtml = '';
  for (let i = 0; i < 8; i++) {
    const id = view.state.deck[i];
    deckHtml += id ? renderDeckChip(id, i) : renderEmptyDeckSlot(i);
  }
  slotsEl.innerHTML = deckHtml;
  byId('deck-count-num') && (byId('deck-count-num').textContent = view.state.deck.length);

  // Presets
  const sel = byId('preset-select');
  sel.innerHTML = '';
  const presets = view.state.deckPresets || [];
  if (!presets.length) {
    sel.innerHTML = `<option value="">${t('no_preset')}</option>`;
  } else {
    presets.forEach((p, i) => {
      sel.insertAdjacentHTML('beforeend', `<option value="${i}">${p.name}</option>`);
    });
  }

  // Owned / missing cards as visual TCG cards
  const owned   = Object.keys(view.state.collection || {});
  const allIds  = ((typeof ALL_CARDS!=='undefined'?ALL_CARDS:[])).map(c => c.id);
  const missing = allIds.filter(id => !view.state.collection[id]);

  const ownedEl   = byId('owned-cards');
  const missingEl = byId('missing-cards');
  ownedEl.innerHTML   = '';
  missingEl.innerHTML = '';

  byId('owned-count').textContent   = owned.length;
  byId('missing-count').textContent = missing.length;

  if (!owned.length) {
    ownedEl.innerHTML = `<div class="feed-muted full-span">${t('no_cards')}</div>`;
  } else {
    owned.forEach(id => {
      const entry = view.state.collection[id];
      const qty   = (typeof entry === 'number') ? entry : (entry?.qty | 0) || 1;
      let html    = renderCard(id, { size: 'sm' });
      // Inject data-qty so filterCollection can hide non-duplicates,
      // and a x[N] badge in the corner when the player owns more than one.
      html = html.replace('class="tcg-card', `data-qty="${qty}" class="tcg-card`);
      if (qty > 1) {
        html = html.replace('</div>', `<div class="shs-dup-badge">×${qty}</div></div>`);
      }
      ownedEl.insertAdjacentHTML('beforeend', html);
    });
  }
  missing.forEach(id => missingEl.insertAdjacentHTML('beforeend', renderCard(id, { missing: true, size: 'sm' })));
  // Re-apply active search/filter if any
  const q = byId('coll-search')?.value || '';
  if (q) filterCollection();
}

// ── RENDER: MERCADO — server-authoritative ─────────────────────
async function renderMercado() {
  const u = view.user;
  const sellSel = byId('sell-card-id');
  // Sell selector is filtered: cannot sell cards locked in the active deck (server enforces too).
  sellSel.innerHTML = '';
  const owned = view.state.collection || {};
  const activeDeck = new Set((view.state.deck || []));
  const sellable = Object.keys(owned).filter(id => {
    const qty = (typeof owned[id] === 'number') ? owned[id] : 1;
    // Allow if you have >1 copy OR the card isn't in your active deck.
    return qty > 1 || !activeDeck.has(id);
  });
  if (!sellable.length){
    sellSel.innerHTML = `<option value="">Sin cartas vendibles</option>`;
  } else {
    sellable.forEach(id => {
      const qty = (typeof owned[id] === 'number') ? owned[id] : 1;
      const lbl = qty > 1 ? `${cardName(id)} (×${qty})` : cardName(id);
      sellSel.insertAdjacentHTML('beforeend', `<option value="${id}">${lbl}</option>`);
    });
  }

  const mList  = byId('market-list');
  const msEl   = byId('my-sales');
  if (mList) mList.innerHTML = `<div class="feed-muted">${currentLang==='es'?'Cargando…':'Loading…'}</div>`;
  if (msEl)  msEl.innerHTML  = `<div class="feed-muted">${currentLang==='es'?'Cargando…':'Loading…'}</div>`;

  if (!window.SB || !view.user || !view.user.uid) {
    if (mList) mList.innerHTML = `<div class="feed-muted">${t('no_market')}</div>`;
    if (msEl)  msEl.innerHTML  = `<div class="feed-muted">${t('no_sales')}</div>`;
    return;
  }

  // Live listings from other players
  const active = await SB.loadMarketActive(view.user.uid);
  if (mList) {
    mList.innerHTML = active.length ? '' : `<div class="feed-muted">${t('no_market')}</div>`;
    active.forEach(l => {
      const card = (typeof getCard === 'function') ? getCard(l.card_id) : null;
      const cc = card ? clanColor(card.clan) : '#6B5CE7';
      const ce = card ? clanEmoji(card.clan) : '⚡';
      const pow = card && card.pow ? card.pow[1] : '?';
      const dmg = card && card.dmg ? card.dmg[1] : '?';
      const name = card ? card.name : l.card_id;
      const imgSrc = card?.visual?.image || `/assets/cards/${l.card_id}.png`;
      mList.insertAdjacentHTML('beforeend', `
        <div class="market-card-item" style="--cc:${cc}">
          <div class="mcard-art-wrap">
            <div class="mcard-clan-bar" style="background:${cc}">${ce} ${card?.clan?.toUpperCase() || ''}</div>
            <img src="${imgSrc}" alt="${name}" class="mcard-img" onerror="this.parentNode.classList.add('no-img')"/>
            <div class="mcard-art-fallback">${ce}</div>
          </div>
          <div class="mcard-info">
            <div class="mcard-name">${name}</div>
            <div class="mcard-stats">${pow} / ${dmg}</div>
            <div class="mcard-price">${l.price} SHARDS</div>
            <button class="btn-primary full" data-buy="${l.id}">${t('market_buy_btn')}</button>
          </div>
        </div>`);
    });
  }

  // My listings (active + recently closed) — with delist button on active ones
  const mine = await SB.loadMyListings(view.user.uid);
  const myActive = mine.filter(l => l.status === 'active');
  if (msEl){
    msEl.innerHTML = myActive.length ? '' : `<div class="feed-muted">${t('no_sales')}</div>`;
    myActive.forEach(l => msEl.insertAdjacentHTML('beforeend', `
      <div class="feed-row">
        <span class="feed-label">${cardName(l.card_id)}</span>
        <span class="feed-price">${l.price} SHARDS</span>
        <button class="btn-danger btn-sm" onclick="delistMarketCard('${l.id}')">✕ ${currentLang==='es'?'Retirar':'Delist'}</button>
      </div>`));
  }

  // History from closed listings (bought + sold).
  const bhEl = byId('buy-history');
  const shEl = byId('sell-history');
  const sold = mine.filter(l => l.status === 'sold');
  if (shEl){
    shEl.innerHTML = sold.length ? '' : `<div class="feed-muted">${t('no_sell_hist')}</div>`;
    sold.forEach(l => shEl.insertAdjacentHTML('beforeend',
      `<div class="feed-row"><span class="feed-label">${cardName(l.card_id)}</span><span class="feed-price">+${l.price} SHARDS</span></div>`));
  }
  // Buy history requires a query for listings where buyer_uid = me. RLS blocks generic select on closed
  // rows, so we skip for now — comment for followup.
  if (bhEl) bhEl.innerHTML = `<div class="feed-muted">${t('no_buy_hist')}</div>`;
}

// ── RENDER: GUILDS ─────────────────────────────────────────────
function renderGuilds() {
  const u = view.user;
  const myGuild = (view.db.guilds || []).find(g => g.id === u.guildId);
  const mgEl    = byId('my-guild');
  const reqEl   = byId('guild-requests');
  mgEl.innerHTML  = '';
  reqEl.innerHTML = '';

  if (!myGuild) {
    mgEl.innerHTML = `<div class="feed-muted">${t('no_guild')}</div>`;
  } else {
    mgEl.insertAdjacentHTML('beforeend', `
      <div class="guild-card">
        <div class="guild-card-header">
          <div class="guild-avatar">${myGuild.avatar}</div>
          <div>
            <div class="guild-name">${myGuild.name}</div>
            <div class="guild-members">${myGuild.members.length} ${t('members_label')}</div>
          </div>
        </div>
        ${myGuild.bio ? `<div class="guild-bio">${myGuild.bio}</div>` : ''}
      </div>`);
    if (myGuild.leaderUid === u.uid) {
      const reqs = (myGuild.requests || []).map(uid => view.db.users[uid]).filter(Boolean);
      if (!reqs.length) {
        reqEl.innerHTML = `<div class="feed-muted">${t('no_requests')}</div>`;
      } else {
        reqs.forEach(ru => reqEl.insertAdjacentHTML('beforeend', `
          <div class="feed-row">
            <span class="feed-label">👤 ${ru.username}</span>
            <button class="btn-mini" data-approve="${ru.uid}">${t('guild_approve_btn')}</button>
            <button class="btn-danger" data-deny="${ru.uid}">${t('guild_deny_btn')}</button>
          </div>`));
      }
    } else {
      reqEl.innerHTML = `<div class="feed-muted">${t('leader_only')}</div>`;
    }
  }

  const q    = String(byId('guild-search').value || '').toLowerCase();
  const list = byId('guild-directory');
  list.innerHTML = '';
  const guilds = (view.db.guilds || []).filter(g => !q || g.name.toLowerCase().includes(q));
  if (!guilds.length) {
    list.innerHTML = `<div class="feed-muted">${t('no_guilds')}</div>`;
  } else {
    guilds.forEach(g => {
      const isMember  = g.members.includes(u.uid);
      const requested = (g.requests || []).includes(u.uid);
      const canReq    = !isMember && !requested;
      list.insertAdjacentHTML('beforeend', `
        <div class="guild-card">
          <div class="guild-card-header">
            <div class="guild-avatar">${g.avatar}</div>
            <div>
              <div class="guild-name">${g.name}</div>
              <div class="guild-members">${g.members.length} ${t('members_label')}</div>
            </div>
          </div>
          ${g.bio ? `<div class="guild-bio">${g.bio}</div>` : ''}
          <div class="guild-actions">
            ${canReq    ? `<button class="btn-mini" data-join="${g.id}">${t('guild_join_btn')}</button>` : ''}
            ${isMember  ? `<span class="chip-rar R">${t('member_badge')}</span>` : ''}
            ${requested ? `<span class="chip-rar U">${t('requested_badge')}</span>` : ''}
          </div>
        </div>`);
    });
  }
}

// ── RENDER: LEARN CLANS ────────────────────────────────────────
function renderLearnClans() {
  const el = byId('clans-learn-grid');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';
  const clans = Object.entries(CLANS_DATA);
  if (!clans.length) { el.innerHTML = '<div class="feed-muted">Clan data not loaded.</div>'; return; }
  el.innerHTML = clans.map(([key, c]) => `
    <div class="clan-learn-card" style="--clc:${c.color||'#6B5CE7'}">
      <div class="clan-learn-top">
        <div class="clan-learn-dot"></div>
        <div class="clan-learn-name">${key.toUpperCase()}</div>
        <span style="margin-left:auto;font-size:1.1rem">${c.emoji||'⚡'}</span>
      </div>
      <div class="clan-learn-bonus">${c.bonus||'—'}</div>
    </div>`).join('');
}

// ── RENDER: MISSIONS ───────────────────────────────────────────
function playerLevel(u){ const b = (u && u.battlesTotal) || 0; return Math.floor(b/10) + 1; }
function _allCards(){ return (typeof ALL_CARDS!=='undefined'?ALL_CARDS:[]); }
function ownedTitanCount(){
  const col = view.state.collection || {};
  return Object.keys(col).filter(id => {
    const c = _allCards().find(x => x.id === id);
    return c && c.clan === 'titans';
  }).length;
}
const TITAN_TIERS = [10,20,30,40,50];
const MISSIONS_BASE = [
  { id:'m1',  icon:'⚔', title:{es:'Primera Sangre',en:'First Blood'},       desc:{es:'Gana tu primera batalla.',en:'Win your first battle.'},                 reward:50,  type:'shards' },
  { id:'m2',  icon:'📦', title:{es:'Coleccionista',en:'Collector'},          desc:{es:'Obtén 10 cartas diferentes.',en:'Own 10 different cards.'},              reward:100, type:'shards' },
  { id:'m3',  icon:'🃏', title:{es:'Constructor de Deck',en:'Deck Builder'}, desc:{es:'Arma un deck completo de 8 cartas.',en:'Build a full 8-card deck.'},     reward:150, type:'shards' },
  { id:'m4',  icon:'🏪', title:{es:'Mercader',en:'Market Maker'},            desc:{es:'Lista una carta en el mercado.',en:'List a card on the market.'},         reward:80,  type:'shards' },
  { id:'m5',  icon:'⚡', title:{es:'Veterano',en:'Veteran'},                 desc:{es:'Gana 5 batallas en total.',en:'Win 5 total battles.'},                   reward:200, type:'shards' },
  { id:'m6',  icon:'🌟', title:{es:'Maestro del Clan',en:'Clan Master'},     desc:{es:'Sube una carta al nivel máximo.',en:'Level a card to max level.'},        reward:300, type:'shards', locked:true },
  { id:'m7',  icon:'🏆', title:{es:'Campeón de Clan',en:'Clan Champion'},    desc:{es:'Gana 5 batallas con el mismo clan.',en:'Win 5 battles with 1 clan.'},     reward:250, type:'shards', locked:true },
  { id:'m8',  icon:'👥', title:{es:'Fundador de Gremio',en:'Guild Founder'}, desc:{es:'Crea o únete a un gremio.',en:'Create or join a guild.'},                 reward:200, type:'shards' },
  { id:'m9',  icon:'🔮', title:{es:'Rango Fractal',en:'Fractal Rank'},       desc:{es:'Alcanza el rango Fractura (1200+ ELO).',en:'Reach Fractura rank (1200+ ELO).'}, reward:500, type:'shards', locked:true },
  { id:'m10', icon:'✨', title:{es:'Iniciado TITAN',en:'TITAN Initiate'},    desc:{es:'Desbloquea tu primera carta TITAN.',en:'Unlock your first TITAN card.'},  reward:400, type:'shards' },
  { id:'m11', icon:'🎯', title:{es:'Sin Piedad',en:'No Mercy'},              desc:{es:'Haz KO a un rival 3 veces.',en:'KO a rival 3 times.'},                    reward:180, type:'shards', locked:true },
  { id:'m12', icon:'💎', title:{es:'Gran Coleccionista',en:'Grand Collector'}, desc:{es:'Obtén 50 cartas diferentes.',en:'Own 50 different cards.'},             reward:600, type:'shards', locked:true },
];
function buildMissions(){
  const u = view.user || {};
  const cardsOwned = Object.keys(view.state.collection||{}).length;
  const deckFull   = (view.state.deck||[]).length >= 8;
  const wins       = u.battleWins || 0;
  const titans     = ownedTitanCount();
  const lvl        = playerLevel(u);
  const list = MISSIONS_BASE.map(m => ({...m}));
  list[0].done = wins >= 1;
  list[1].done = cardsOwned >= 10;
  list[2].done = deckFull;
  list[4].done = wins >= 5;
  list[7].done = !!u.guildId;
  list[8].done = (u.elo||0) >= 1200;
  list[9].done = titans >= 1;
  list[11].done= cardsOwned >= 50;
  TITAN_TIERS.forEach((tier,i) => {
    list.push({
      id:`mt_${tier}`, icon:'🗿',
      title:{es:`Titán Nv ${tier}`, en:`Titan Lv ${tier}`},
      desc:{es:`Alcanza nivel ${tier} de jugador para reclamar una carta TITAN aleatoria.`,
            en:`Reach player level ${tier} to claim a random TITAN card.`},
      reward:1, type:'titan_card', tier, done: lvl >= tier
    });
  });
  return list;
}
function _claimedSet(){
  const u = view.user; if (!u) return new Set();
  u.gameState = u.gameState || {};
  u.gameState.claimedMissions = u.gameState.claimedMissions || [];
  return new Set(u.gameState.claimedMissions);
}
function _markClaimed(id){
  const u = view.user; if (!u) return;
  u.gameState = u.gameState || {};
  u.gameState.claimedMissions = Array.from(new Set([...(u.gameState.claimedMissions||[]), id]));
}
function claimMission(id){
  const u = view.user; if (!u) return;
  const m = buildMissions().find(x => x.id === id);
  if (!m || !m.done) return;
  if (_claimedSet().has(id)) return;
  if (m.type === 'shards') {
    view.state.shards = (view.state.shards||0) + (m.reward||0);
    toast(`+${m.reward} SHARDS`);
  } else if (m.type === 'titan_card') {
    const pool = _allCards().filter(c => c.clan === 'titans' && !view.state.collection?.[c.id]);
    const pick = pool[Math.floor(Math.random()*pool.length)] || _allCards().find(c=>c.clan==='titans');
    if (pick) {
      view.state.collection = view.state.collection || {};
      addCardToCollection(pick.id);
      toast(`🗿 ${pick.name} desbloqueada`);
    }
  }
  _markClaimed(id);
  persistToUser();
  syncTopbar();
  renderMissions();
}
window.claimMission = claimMission;
function renderMissions() {
  const el = byId('missions-grid');
  if (!el) return;
  const L = currentLang;
  const claimed = _claimedSet();
  const list = buildMissions();
  el.innerHTML = list.map(m => {
    const isClaimed = claimed.has(m.id);
    const canClaim  = m.done && !isClaimed && !m.locked;
    const rewardLabel = m.type === 'titan_card'
      ? (L==='es'?'+1 carta TITAN':'+1 TITAN card')
      : `+${m.reward} SHARDS`;
    return `
    <div class="mission-card ${isClaimed?'claimed':''} ${m.done?'done':''} ${m.locked&&!m.done?'locked':''}">
      <div class="mission-icon">${isClaimed?'✓':m.locked?'🔒':m.icon}</div>
      <div class="mission-body">
        <div class="mission-name">${m.title[L]||m.title.es}</div>
        <div class="mission-desc">${m.desc[L]||m.desc.es}</div>
        ${!m.locked?`<div class="mission-progress"><div class="mission-bar" style="width:${m.done?100:0}%"></div></div>`:''}
      </div>
      <div class="mission-side">
        <div class="mission-reward ${m.type==='titan_card'?'rw-titan':'rw-shards'}">${rewardLabel}</div>
        ${canClaim ? `<button class="btn btn-primary btn-sm mission-claim" onclick="claimMission('${m.id}')">${L==='es'?'Reclamar':'Claim'}</button>`
                   : isClaimed ? `<span class="mission-claimed-tag">${L==='es'?'Reclamado':'Claimed'}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── BATTLE PASS ────────────────────────────────────────────────
// 30 levels · 30 days · 6000 XP total (200 XP per level).
// XP from battles: win=+30, loss=+15. ~15 wins/day ≈ 450 XP/day → lvl in 30d.
const BP_LEVELS = 30;
const BP_XP_PER_LEVEL = 200;
const BP_TOTAL_XP = BP_LEVELS * BP_XP_PER_LEVEL;
const BP_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const BP_PRICE_USD = 20;
function bpRewardFor(level){
  if (level === 30) return { kind:'grand_card', label:'1 GRAND' };
  if (level === 25) return { kind:'flux', amount:1, label:'1 FLUX' };
  const milestones = {5:200, 10:400, 15:600, 20:800};
  return { kind:'shards', amount: milestones[level] || 100, label:`${milestones[level]||100} SHARDS` };
}
function bpPricing(){
  const rates = (window.ORACLE_RATES) || { flux_usd: 2.0, shs_usd: 0.15 };
  return {
    usd: BP_PRICE_USD,
    flux: Math.ceil(BP_PRICE_USD / rates.flux_usd),
    shs:  Math.ceil(BP_PRICE_USD / rates.shs_usd),
  };
}
function ensureBpState(){
  const u = view.user; if (!u) return null;
  u.gameState = u.gameState || {};
  if (!u.gameState.battlePass) {
    u.gameState.battlePass = {
      startedAt: Date.now(),
      xp: 0,
      claimedLevels: [],
      premium: false,
      grandClaimedIds: [],
    };
  }
  return u.gameState.battlePass;
}
function bpLevel(bp){ return Math.min(BP_LEVELS, Math.floor(bp.xp / BP_XP_PER_LEVEL)); }
function bpRemaining(bp){ return Math.max(0, bp.startedAt + BP_DURATION_MS - Date.now()); }
function formatBpTime(ms){
  if (ms <= 0) return '0d 0h';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h` : (h > 0 ? `${h}h ${m}min` : `${m}min`);
}
function buyBattlePass(currency){
  const bp = ensureBpState(); if (!bp) return;
  const p = bpPricing();
  if (currency === 'flux') {
    if ((view.state.flux||0) < p.flux) return toast(`Necesitas ${p.flux} FLUX.`);
    view.state.flux -= p.flux;
  } else if (currency === 'shs') {
    if ((view.state.shs||0) < p.shs) return toast(`Necesitas ${p.shs} $SHS.`);
    view.state.shs -= p.shs;
  } else { return; }
  bp.premium = true;
  persistToUser(); syncTopbar(); renderBattlePass();
  toast('⭐ Battle Pass Premium activado');
}
window.buyBattlePass = buyBattlePass;
async function claimBpLevel(level, track){
  // Default the track if the caller didn't pass one (older buttons).
  if (!track) track = (level === 1 || level % 5 === 0) ? 'free' : 'premium';
  if (!window.SB || !SB.claimBattlePass) return toast('Sin conexión al servidor.');
  if (!view.user || !view.user.uid) return toast('Iniciá sesión.');
  const r = await SB.claimBattlePass(level|0, String(track));
  if (r && r.error){
    const msg = ({
      not_authenticated:    'Iniciá sesión.',
      invalid_track:        'Pista inválida.',
      level_locked:         'Aún no alcanzaste ese nivel.',
      already_claimed:      'Ya lo reclamaste.',
      premium_required:     'Requiere Pase Premium.',
    })[r.error] || ('Error: ' + r.error);
    return toast(msg);
  }
  if (r && r.reward){
    const k = r.reward.kind;
    if (k === 'shards') toast(`+${r.reward.amount} SHARDS`);
    else if (k === 'flux') toast(`+${r.reward.amount} FLUX`);
    else if (k === 'grand_card') toast(`👑 ${r.reward.card_id || 'Grand'}`);
    else toast('Reclamado.');
  } else {
    toast('Reclamado.');
  }
  await refreshFromSupabase();
  renderBattlePass();
  syncTopbar();
}
window.claimBpLevel = claimBpLevel;
function renderBattlePass(){
  const root = byId('bp-root'); if (!root) return;
  const bp = ensureBpState(); if (!bp) { root.innerHTML = ''; return; }
  const L = currentLang;
  const lvl = bpLevel(bp);
  const overallPct = (Math.min(bp.xp, BP_TOTAL_XP) / BP_TOTAL_XP) * 100;
  const p = bpPricing();
  const cd = byId('bp-countdown');
  if (cd) cd.textContent = `${L==='es'?'Termina en':'Ends in'} ${formatBpTime(bpRemaining(bp))}`;
  const buyBox = bp.premium
    ? `<div class="bp-premium-tag">⭐ ${L==='es'?'Pase Premium activo':'Premium Pass active'}</div>`
    : `<div class="bp-buy-box">
         <div class="bp-buy-title">${L==='es'?'Desbloquear Premium':'Unlock Premium'} · $${p.usd}</div>
         <div class="bp-buy-row">
           <button class="btn btn-primary btn-sm" onclick="buyBattlePass('flux')">${p.flux} ⚡ FLUX</button>
           <button class="btn btn-secondary btn-sm" onclick="buyBattlePass('shs')">${p.shs} ◎ $SHS</button>
         </div>
         <div class="bp-buy-hint">${L==='es'?'El pase free solo da el nivel 1.':'Free pass only grants level 1.'}</div>
       </div>`;
  const header = `
    <div class="bp-header">
      <div class="bp-head-left">
        <div class="bp-lvl-row">
          <span class="bp-lvl-pill">${L==='es'?'NIVEL':'LEVEL'} <strong>${lvl}</strong><span class="bp-lvl-max">/ ${BP_LEVELS}</span></span>
          <span class="bp-xp-tag">${Math.min(bp.xp, BP_TOTAL_XP).toLocaleString()} / ${BP_TOTAL_XP.toLocaleString()} XP</span>
        </div>
        <div class="bp-xp-track-wrap">
          <div class="bp-xp-track"><div class="bp-xp-fill" style="width:${overallPct.toFixed(1)}%"></div></div>
        </div>
        <div class="bp-xp-hint">${L==='es'?'Gana XP del pase jugando partidas (Win +30 · Loss +15).':'Earn pass XP by playing battles (Win +30 · Loss +15).'}</div>
      </div>
      <div class="bp-head-right">${buyBox}</div>
    </div>`;

  // Horizontal slider: continuous bar that fills 100% per level segment, two reward rows (Free / Premium).
  const segWidth = 96;
  const trackPx = BP_LEVELS * segWidth;
  const fillSegments = lvl + ((bp.xp - lvl*BP_XP_PER_LEVEL) / BP_XP_PER_LEVEL);
  const fillPx = Math.min(trackPx, fillSegments * segWidth);

  const tier = (level, isPremium) => {
    const r = bpRewardFor(level);
    const reached = level <= lvl;
    const track = isPremium ? 'premium' : 'free';
    const claimedKey = `${level}:${track}`;
    const claimedSet = new Set((bp.claimedLevels || []).map(x => typeof x === 'string' ? x : `${x}:${level === 1 || level % 5 === 0 ? 'free' : 'premium'}`));
    const claimed = claimedSet.has(claimedKey);
    const isFreeLevel = (level === 1 || level % 5 === 0);
    const lockedByTier = isPremium ? !bp.premium : false;
    const visibleRow = isPremium ? !isFreeLevel : isFreeLevel;
    if (!visibleRow) return `<div class="bp-cell bp-cell-empty" style="width:${segWidth}px"></div>`;
    const canClaim = reached && !claimed && !lockedByTier;
    const icon = r.kind==='grand_card' ? '👑' : r.kind==='flux' ? '⚡' : '◈';
    const cls = r.kind==='grand_card' ? 'bp-rew-grand' : r.kind==='flux' ? 'bp-rew-flux' : 'bp-rew-shards';
    const stateCls = claimed ? 'claimed' : reached ? 'ready' : 'pending';
    return `
      <div class="bp-cell ${stateCls} ${lockedByTier?'locked':''}" style="width:${segWidth}px">
        <div class="bp-rew ${cls}">
          <div class="bp-rew-icon">${icon}</div>
          <div class="bp-rew-label">${r.label}</div>
          ${claimed
            ? `<div class="bp-rew-state">✓</div>`
            : canClaim
              ? `<button class="bp-claim-btn" onclick="claimBpLevel(${level}, '${track}')">${L==='es'?'Reclamar':'Claim'}</button>`
              : lockedByTier
                ? `<div class="bp-rew-state">🔒</div>`
                : `<div class="bp-rew-state">${level*BP_XP_PER_LEVEL}xp</div>`}
        </div>
      </div>`;
  };

  const lvlMarkers = Array.from({length: BP_LEVELS}, (_,i) => i+1).map(l =>
    `<div class="bp-lvl-marker ${l<=lvl?'reached':''}" style="width:${segWidth}px">
       <span class="bp-lvl-num">${l}</span>
       ${l===25?`<span class="bp-lvl-tag">★</span>`:''}
       ${l===BP_LEVELS?`<span class="bp-lvl-tag">👑</span>`:''}
     </div>`
  ).join('');

  const freeRow    = Array.from({length: BP_LEVELS}, (_,i) => tier(i+1, false)).join('');
  const premiumRow = Array.from({length: BP_LEVELS}, (_,i) => tier(i+1, true)).join('');

  root.innerHTML = `${header}
    <div class="bp-slider-controls">
      <button class="bp-nav" onclick="document.getElementById('bp-slider').scrollBy({left:-${segWidth*5},behavior:'smooth'})">‹</button>
      <div class="bp-row-labels">
        <span class="bp-row-label bp-row-free">${L==='es'?'GRATIS':'FREE'}</span>
        <span class="bp-row-label bp-row-premium ${bp.premium?'on':''}">${L==='es'?'PREMIUM':'PREMIUM'}</span>
      </div>
      <button class="bp-nav" onclick="document.getElementById('bp-slider').scrollBy({left:${segWidth*5},behavior:'smooth'})">›</button>
    </div>
    <div class="bp-slider" id="bp-slider">
      <div class="bp-slider-inner" style="width:${trackPx}px">
        <div class="bp-row bp-row-free-track">${freeRow}</div>
        <div class="bp-progress-track">
          <div class="bp-progress-rail"></div>
          <div class="bp-progress-fill" style="width:${fillPx}px"></div>
          <div class="bp-progress-markers">${lvlMarkers}</div>
        </div>
        <div class="bp-row bp-row-premium-track ${bp.premium?'unlocked':'locked'}">${premiumRow}</div>
      </div>
    </div>`;

  // Auto-scroll near current level on first render of this session
  requestAnimationFrame(() => {
    const slider = byId('bp-slider');
    if (slider && !slider.dataset.scrolled) {
      slider.dataset.scrolled = '1';
      slider.scrollLeft = Math.max(0, (lvl-2) * segWidth);
    }
  });
}

// Award battle-pass XP (called by game result handler).
function bpAwardXp(xp){
  const bp = ensureBpState(); if (!bp) return;
  if (bpRemaining(bp) <= 0) return;
  bp.xp = Math.min(BP_TOTAL_XP, (bp.xp||0) + xp);
  persistToUser();
}
window.bpAwardXp = bpAwardXp;
// Drain queued XP/battles from the embedded game iframe.
function drainBpPending(){
  try {
    const raw = localStorage.getItem('shs_bp_pending');
    if (!raw) return;
    const q = JSON.parse(raw);
    localStorage.removeItem('shs_bp_pending');
    if (q.xp) bpAwardXp(q.xp);
    if (q.battles && view.user) {
      view.user.battlesTotal = (view.user.battlesTotal||0) + q.battles;
      view.user.battleWins   = (view.user.battleWins||0)   + (q.wins||0);
      view.user.battleLosses = (view.user.battleLosses||0) + (q.battles - (q.wins||0));
      saveDb();
    }
  } catch(_){}
}
window.drainBpPending = drainBpPending;

// ── FORUM SYSTEM (localStorage-backed) ─────────────────────────
const FORUM_KEY = 'shs_forum_v1';
const FORUM_SEED = [
  { id:'f_seed1', title:'Best deck for beginners?',      author:'Kira',    tag:'Strategy',     ts: Date.now()-864e5*3, comments:[] },
  { id:'f_seed2', title:'NEXUS vs IRONPACT — who wins?', author:'Voss',    tag:'Discussion',   ts: Date.now()-864e5*2, comments:[] },
  { id:'f_seed3', title:'New patch: ECHO card rework',   author:'Admin',   tag:'Announcement', ts: Date.now()-864e5,   comments:[{author:'Voss',text:'¡Por fin!',ts:Date.now()-3600e3}] },
  { id:'f_seed4', title:'Looking for guild members',     author:'Zael',    tag:'Recruit',      ts: Date.now()-7200e3,  comments:[] },
  { id:'f_seed5', title:'Market tips for new players',   author:'Fenix',   tag:'Guide',        ts: Date.now()-600e3,   comments:[] },
];
function getForumThreads() {
  try { return JSON.parse(localStorage.getItem(FORUM_KEY) || 'null') || FORUM_SEED; } catch(_){ return FORUM_SEED; }
}
function saveForumThreads(threads) { localStorage.setItem(FORUM_KEY, JSON.stringify(threads)); }

function renderCommunity() {
  const forumEl = byId('forum-list');
  if (forumEl) renderForumList(forumEl);
  const presetsEl = byId('public-presets');
  if (presetsEl && !presetsEl.dataset.rendered) {
    presetsEl.dataset.rendered = '1';
    const shared = [];
    Object.values(view.db.users || {}).forEach(u => {
      (u?.gameState?.deckPresets || []).filter(p => p.public).forEach(p => {
        shared.push({ name: p.name, author: u.username });
      });
    });
    presetsEl.innerHTML = shared.length
      ? shared.map(p => `<div class="feed-row"><span class="feed-label">${p.name}</span><span class="feed-meta">${p.author}</span></div>`).join('')
      : '<div class="feed-muted">No hay presets públicos.</div>';
  }
}

let activeThreadId = null;
function renderForumList(container) {
  const threads = getForumThreads();
  container.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <input id="forum-new-title" class="input-dark" style="flex:1;font-size:0.8rem" placeholder="${currentLang==='es'?'Nuevo post…':'New post…'}"/>
      <select id="forum-new-tag" class="input-dark" style="width:110px;font-size:0.75rem">
        <option>Strategy</option><option>Discussion</option><option>Guide</option><option>Recruit</option><option>Off-topic</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick="submitForumThread()">Post</button>
    </div>
    ${threads.map(th => `
      <div class="forum-row" onclick="openThread('${th.id}')" style="cursor:pointer">
        <div class="forum-row-main">
          <span class="forum-tag">${th.tag}</span>
          <span class="forum-title">${th.title}</span>
        </div>
        <div class="forum-row-meta">
          <span class="forum-author">${th.author}</span>
          <span class="forum-replies">${th.comments.length} ${currentLang==='es'?'respuestas':'replies'}</span>
        </div>
      </div>`).join('')}
    <div id="forum-thread-view" class="forum-thread-view" style="display:none"></div>`;
  if (activeThreadId) openThread(activeThreadId);
}
function submitForumThread() {
  const title = (byId('forum-new-title')?.value || '').trim();
  if (!title) return toast('Escribe un título para el post.');
  const tag = byId('forum-new-tag')?.value || 'Discussion';
  const threads = getForumThreads();
  threads.unshift({ id:'f_'+Date.now(), title, author: view.user?.username || 'Anon', tag, ts:Date.now(), comments:[] });
  saveForumThreads(threads);
  activeThreadId = null;
  renderForumList(byId('forum-list'));
}
function openThread(id) {
  activeThreadId = id;
  const threads = getForumThreads();
  const th = threads.find(x => x.id === id);
  if (!th) return;
  const el = byId('forum-thread-view');
  if (!el) return;
  el.style.display = '';
  el.innerHTML = `
    <div class="forum-thread-header">
      <button class="btn-mini" onclick="activeThreadId=null;byId('forum-thread-view').style.display='none'">← Back</button>
      <span class="forum-tag">${th.tag}</span>
      <strong style="margin-left:6px">${th.title}</strong>
    </div>
    <div class="forum-comments">
      ${th.comments.length ? th.comments.map(c => `
        <div class="forum-comment">
          <span class="forum-comment-author">${c.author}</span>
          <span class="forum-comment-text">${c.text}</span>
        </div>`).join('') : '<div class="feed-muted" style="margin:8px 0">No comments yet.</div>'}
    </div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <input id="forum-comment-input" class="input-dark" style="flex:1;font-size:0.8rem" placeholder="${currentLang==='es'?'Escribe un comentario…':'Write a comment…'}"/>
      <button class="btn btn-primary btn-sm" onclick="submitComment('${id}')">Send</button>
    </div>`;
}
function submitComment(threadId) {
  const text = (byId('forum-comment-input')?.value || '').trim();
  if (!text) return;
  const threads = getForumThreads();
  const th = threads.find(x => x.id === threadId);
  if (!th) return;
  th.comments.push({ author: view.user?.username || 'Anon', text, ts: Date.now() });
  saveForumThreads(threads);
  openThread(threadId);
}

// ── RENDER: PACKS ──────────────────────────────────────────────
// Oracle: convert USD price to FLUX/$SHS at request time.
// Window.ORACLE_RATES can be hot-swapped by a real oracle later.
function oracleQuote(usd){
  const rates = (window.ORACLE_RATES) || { flux_usd: 2.0, shs_usd: 0.15 };
  return { usd, flux: Math.max(1, Math.ceil(usd / rates.flux_usd)), shs: Math.max(1, Math.ceil(usd / rates.shs_usd)) };
}
const PACKS_DATA = [
  { id:'welcome', name:{es:'Pack Bienvenida',en:'Welcome Pack'}, desc:{es:'8 cartas de regalo · Una sola vez · Gratuito',en:'8 free cards · One-time only · Free'}, costType:'welcome', usd:0,  color:'#00FFC6', icon:'🎁', cards:8, rarGuarantee:null },
  { id:'shard',   name:{es:'Pack Shard',en:'Shard Pack'},        desc:{es:'3 cartas · Inusual garantizada',en:'3 cards · Uncommon guaranteed'},                  costType:'oracle',  usd:5,  color:'#F59E0B', icon:'◎', cards:3, rarGuarantee:'U' },
  { id:'clan',    name:{es:'Pack Clan',en:'Clan Pack'},          desc:{es:'4 cartas · Todas del mismo clan',en:'4 cards · All from one clan'},                   costType:'oracle',  usd:7,  color:'#00FFC6', icon:'🧬', cards:4, rarGuarantee:null, randomClan:true },
  { id:'elite',   name:{es:'Pack Élite',en:'Elite Pack'},        desc:{es:'4 cartas · Rara garantizada · Sin duplicados',en:'4 cards · Rare guaranteed · No dupes'}, costType:'oracle', usd:10, color:'#a855f7', icon:'🔮', cards:4, rarGuarantee:'R' },
  // Pack TITANS removed: TITAN cards drop only as mission rewards.
  { id:'grand',   name:{es:'Pack GRAND',en:'GRAND Pack'},        desc:{es:'5 cartas · Posible GRAND · Mítica posible',en:'5 cards · Chance of a GRAND · Mythic possible'}, costType:'oracle', usd:18, color:'#fbbf24', icon:'👑', cards:5, grandChance:0.25, rarGuarantee:'R' },
  { id:'premium', name:{es:'Pack Premium',en:'Premium Pack'},    desc:{es:'6 cartas · Mítica garantizada',en:'6 cards · Mythic guaranteed'},                     costType:'oracle',  usd:22, color:'#d946ef', icon:'💎', cards:6, rarGuarantee:'M' },
];
function renderPacks() {
  const el = byId('packs-grid');
  if (!el) return;
  const L = currentLang;
  el.innerHTML = PACKS_DATA.map(p => {
    const isWelcome = p.costType === 'welcome';
    const accountClaimed = isWelcome && (view.user?.gameState?.welcomePackClaimed || view.state.welcomePackClaimed);
    let costLine, payButtons;
    if (isWelcome) {
      costLine = accountClaimed
        ? `<span class="pack-cost-claimed">${L==='es'?'✓ Reclamado (1 vez por cuenta)':'✓ Claimed (once per account)'}</span>`
        : `<span class="pack-cost-free">${L==='es'?'¡GRATIS!':'FREE!'}</span>`;
      payButtons = `<button class="pack-btn${accountClaimed?' pack-btn-disabled':''}" data-pack-id="${p.id}" data-pay="welcome" ${accountClaimed?'disabled':''}>${accountClaimed ? (L==='es'?'Reclamado':'Claimed') : (L==='es'?'¡Reclamar!':'Claim Now!')}</button>`;
    } else {
      const q = oracleQuote(p.usd);
      costLine = `<span class="pack-cost-amount">$${q.usd}</span><span class="pack-cost-or">${L==='es'?'oráculo':'oracle'}</span>`;
      payButtons = `
        <div class="pack-pay-row">
          <button class="pack-btn pack-btn-flux" data-pack-id="${p.id}" data-pay="flux" title="${L==='es'?'Pagar con FLUX':'Pay with FLUX'}">${q.flux} ⚡ FLUX</button>
          <button class="pack-btn pack-btn-shs" data-pack-id="${p.id}" data-pay="shs" title="${L==='es'?'Pagar con $SHS':'Pay with $SHS'}">${q.shs} ◎ $SHS</button>
        </div>`;
    }
    const wrapClass = `pack-card${isWelcome?' pack-card-welcome':''}${accountClaimed?' pack-card-claimed':''}`;
    return `<div class="${wrapClass}" style="--pc-color:${p.color};--pc-glow:${p.color}22">
      ${isWelcome?'<div class="pack-welcome-badge">'+(L==='es'?'NUEVO JUGADOR':'NEW PLAYER')+'</div>':''}
      <div class="pack-icon">${p.icon}</div>
      <div class="pack-name">${p.name[L]||p.name.es}</div>
      <div class="pack-desc">${p.desc[L]||p.desc.es}</div>
      <div class="pack-cost">${costLine}</div>
      ${payButtons}
    </div>`;
  }).join('');
  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-pack-id]');
      if (btn) openPackById(btn.getAttribute('data-pack-id'), btn.getAttribute('data-pay'));
    });
  }
}

// ── RENDER: SHOP ───────────────────────────────────────────────
function renderShop() {
  const el = byId('last-pack-open');
  el.innerHTML = '';
  if (!view.lastPack.length) {
    el.innerHTML = `<div class="feed-muted">${t('no_pack_open')}</div>`;
    return;
  }
  view.lastPack.forEach((c, i) => {
    el.insertAdjacentHTML('beforeend',
      renderCard(c.id, { size: 'md', _delay: i })
        .replace('class="tcg-card', `class="tcg-card pack-reveal-card" style="animation-delay:${i * 120}ms;`)
    );
  });
}

// ── PACK OPENING ───────────────────────────────────────────────
function randomCards(n, opts={}) {
  let pool = [...((typeof ALL_CARDS!=='undefined'?ALL_CARDS:[]))];
  // TITANS-clan cards are mission-only rewards — always exclude from packs.
  pool = pool.filter(c => c.clan !== 'titans');
  if (opts.clan) pool = pool.filter(c => c.clan === opts.clan);
  if (opts.minRar) {
    const ORDER = {C:0,U:1,R:2,M:3};
    pool = pool.filter(c => (ORDER[c.rar]||0) >= (ORDER[opts.minRar]||0));
  }
  pool.sort(() => Math.random() - 0.5);
  return pool.slice(0, Math.max(0, n));
}
function addCardToCollection(cardId) {
  const cur = view.state.collection[cardId];
  if (cur == null) {
    view.state.collection[cardId] = 1;
  } else if (typeof cur === 'number') {
    view.state.collection[cardId] = cur + 1;
  } else {
    // legacy {lv,xp} entry — promote to qty
    view.state.collection[cardId] = ((cur.qty | 0) || 1) + 1;
  }
}
function collectionQty(cardId){
  const c = view.state.collection?.[cardId];
  if (c == null) return 0;
  if (typeof c === 'number') return c;
  return (c.qty | 0) || 1;
}
function openPackById(packId, payWith) {
  const p = PACKS_DATA.find(x => x.id === packId);
  if (!p) return;
  let paidWith = 'free';
  let cost = 0;
  // Welcome pack — one-time free claim per account
  if (p.costType === 'welcome') {
    const u = view.user;
    if (u?.gameState?.welcomePackClaimed || view.state.welcomePackClaimed) {
      return toast(currentLang==='es'?'Ya reclamaste tu pack de bienvenida (1 vez por cuenta).':'Welcome pack already claimed (once per account).');
    }
    view.state.welcomePackClaimed = true;
    paidWith = 'welcome';
  } else if (p.costType === 'oracle') {
    const q = oracleQuote(p.usd);
    if (payWith === 'flux') {
      if ((view.state.flux||0) < q.flux) return toast(`⚡ Necesitas ${q.flux} FLUX.`);
      view.state.flux -= q.flux;
      paidWith = 'flux'; cost = q.flux;
    } else if (payWith === 'shs') {
      if ((view.state.shs||0) < q.shs) return toast(`◎ Necesitas ${q.shs} $SHS.`);
      view.state.shs -= q.shs;
      paidWith = 'shs'; cost = q.shs;
    } else {
      return toast(currentLang==='es'?'Elige FLUX o $SHS.':'Pick FLUX or $SHS.');
    }
  }
  // Draw cards
  const opts = {};
  if (p.clanFilter) opts.clan = p.clanFilter;
  if (p.randomClan) {
    const clans = ['nexus','tidecall','ashborn','errvoid','vault','mycelium','ironpact','synthos','loopkin','phantom','frequenz','protocol'];
    opts.clan = clans[Math.floor(Math.random()*clans.length)];
  }
  if (p.costType === 'welcome') opts.excludeEcho = true;
  let cards = randomCards(p.cards, opts);
  // (Pack TITANS removed — TITAN-clan cards are mission-only rewards.)
  if (p.grandChance && Math.random() < p.grandChance) {
    const grands = (typeof ALL_CARDS!=='undefined'?ALL_CARDS:[]).filter(c => c.type === 'grand');
    if (grands.length) cards[cards.length-1] = grands[Math.floor(Math.random()*grands.length)];
  }
  // Welcome pack: no Mythics — reroll any M card
  if (p.costType === 'welcome') {
    const ORDER = {C:0,U:1,R:2,M:3};
    const nonMythicPool = (typeof ALL_CARDS!=='undefined'?ALL_CARDS:[]).filter(c=>c.rar!=='M'&&c.clan!=='echo');
    cards = cards.map(c => c.rar==='M' ? nonMythicPool[Math.floor(Math.random()*nonMythicPool.length)]||c : c);
  }
  // Guarantee rarity
  if (p.rarGuarantee && cards.length) {
    const ORDER = {C:0,U:1,R:2,M:3};
    const req = ORDER[p.rarGuarantee]||0;
    if (!cards.some(c => (ORDER[c.rar]||0) >= req)) {
      const pool = (typeof ALL_CARDS!=='undefined'?ALL_CARDS:[]).filter(c => (ORDER[c.rar]||0) >= req);
      if (pool.length) cards[0] = pool[Math.floor(Math.random()*pool.length)];
    }
  }
  cards.forEach(c => addCardToCollection(c.id));
  view.lastPack = cards;
  persistToUser();
  syncTopbar();
  renderShop();
  renderColeccion();
  renderPacks();
  // Persist the opening server-side so it survives refresh.
  try {
    if (window.SB && SB.recordPackOpening && view.user?.uid) {
      SB.recordPackOpening(view.user.uid, p.id, paidWith, cost, cards.map(c=>c.id));
    }
  } catch(_){}
  // Show pack opening overlay
  showPackOverlay(p, cards);
}

function showPackOverlay(pack, cards) {
  const overlay = byId('pack-opening-overlay');
  if (!overlay) return;
  // Set pack icon & name
  const iconEl = byId('pack-anim-icon');
  const nameEl = byId('pack-anim-name');
  if (iconEl) iconEl.textContent = pack.icon || '📦';
  if (nameEl) nameEl.textContent = typeof pack.name === 'object' ? (pack.name[currentLang]||pack.name.es) : pack.name;
  // Welcome pack special subtitle
  const subEl = byId('pack-anim-sub');
  if (subEl) subEl.textContent = pack.costType === 'welcome'
    ? (currentLang==='es'?'Bienvenido a SHARDSTATE — tus primeras 8 cartas te esperan':'Welcome to SHARDSTATE — your first 8 cards await')
    : '';
  // Accent color
  overlay.style.setProperty('--pack-overlay-color', pack.color||'#00FFC6');
  overlay.classList.toggle('pack-overlay-welcome', pack.costType === 'welcome');
  // Reset state
  byId('pack-anim-wrap').style.display = 'flex';
  byId('pack-cards-reveal').style.display = 'none';
  // Store cards for reveal
  overlay._cards = cards;
  overlay.style.display = 'flex';
}

function revealPackCards() {
  const overlay = byId('pack-opening-overlay');
  if (!overlay) return;
  const cards = overlay._cards || [];
  byId('pack-anim-wrap').style.display = 'none';
  const revealEl = byId('pack-cards-reveal');
  revealEl.style.display = 'flex';
  const row = byId('pack-reveal-row');
  row.innerHTML = '';
  cards.forEach((c, i) => {
    const html = renderCard(c.id, { size: 'md' });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const card = wrapper.firstElementChild;
    if (card) {
      card.style.animationDelay = (i * 180) + 'ms';
      row.appendChild(card);
    }
  });
}

function closePackOverlay() {
  const overlay = byId('pack-opening-overlay');
  if (overlay) overlay.style.display = 'none';
  setTab('shop');
}
function openPack(costType) { // legacy shim
  const p = costType === 'flux' ? 'starter' : 'shard';
  openPackById(p);
}

// ── LAUNCH PWA ─────────────────────────────────────────────────
function launchPWA() {
  const deck = Array.isArray(view?.state?.deck) ? view.state.deck.slice(0, 8) : [];
  // Block launch if the active deck isn't a complete, valid 8-card build.
  const valid = deck.length === 8 && deck.every(id => typeof getCard === 'function' ? !!getCard(id) : !!id);
  if (!valid) { showDeckRequiredModal(deck.length); return; }
  try {
    localStorage.setItem('shardstate_deck', JSON.stringify(deck));
    localStorage.setItem('shardstate_player', JSON.stringify({
      uid:    view?.user?.uid       || null,
      name:   view?.user?.username  || 'PLAYER',
      club:   view?.user?.guildName || 'SIN CLUB',
      elo:    view?.user?.elo       ?? 0,
      shards: view?.state?.shards   ?? 0,
      level:  view?.user?.accountLevel ?? 1,
    }));
  } catch (e) { /* localStorage unavailable — continue anyway */ }
  window.open('../game/index.html', '_blank');
}

// ── DECK-REQUIRED MODAL (gates launchPWA) ──────────────────────
function showDeckRequiredModal(currentCount){
  const L = currentLang === 'es';
  let m = byId('deck-required-modal');
  if (!m){
    m = document.createElement('div');
    m.id = 'deck-required-modal';
    m.className = 'drm-overlay';
    m.innerHTML = `
      <div class="drm-card">
        <div class="drm-glow"></div>
        <div class="drm-icon">⚠</div>
        <div class="drm-title"></div>
        <div class="drm-sub"></div>
        <div class="drm-progress">
          <div class="drm-progress-bar"><div class="drm-progress-fill" id="drm-fill"></div></div>
          <div class="drm-progress-text" id="drm-text"></div>
        </div>
        <div class="drm-actions">
          <button class="btn btn-ghost" id="drm-cancel"></button>
          <button class="btn btn-primary" id="drm-go"></button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) closeDeckRequiredModal(); });
    byId('drm-cancel').onclick = closeDeckRequiredModal;
    byId('drm-go').onclick = () => { closeDeckRequiredModal(); setTab('coleccion'); };
  }
  m.querySelector('.drm-title').textContent = L ? 'DECK INCOMPLETO' : 'DECK INCOMPLETE';
  m.querySelector('.drm-sub').textContent   = L
    ? 'Necesitás un deck de 8 cartas para entrar a combate. Armá tu mazo en COLLECTION antes de jugar.'
    : 'You need a complete 8-card deck to enter combat. Build your deck in COLLECTION before playing.';
  byId('drm-cancel').textContent = L ? 'Cancelar'      : 'Cancel';
  byId('drm-go').textContent     = L ? 'ARMAR DECK →'  : 'BUILD DECK →';
  byId('drm-fill').style.width   = Math.round((currentCount/8)*100) + '%';
  byId('drm-text').textContent   = `${currentCount}/8 ${L ? 'cartas' : 'cards'}`;
  // Force reflow then add 'open' to trigger entry animation.
  void m.offsetWidth;
  m.classList.add('open');
}
function closeDeckRequiredModal(){
  const m = byId('deck-required-modal');
  if (m) m.classList.remove('open');
}

// ── LANG TOGGLE ────────────────────────────────────────────────
function toggleLang() {
  setLang(currentLang === 'es' ? 'en' : 'es');
}

// ── FILTER COLLECTION ──────────────────────────────────────────
function filterCollection(filter) {
  const query = (byId('coll-search')?.value || '').toLowerCase();
  const owned   = byId('collection-section-owned');
  const missing = byId('collection-section-missing');
  if (!filter) filter = 'all';
  if (filter === 'owned')   { owned && (owned.style.display=''); missing && (missing.style.display='none'); }
  else if (filter === 'missing') { owned && (owned.style.display='none'); missing && (missing.style.display=''); }
  else if (filter === 'duplicates') {
    owned && (owned.style.display=''); missing && (missing.style.display='none');
  }
  else { owned && (owned.style.display=''); missing && (missing.style.display=''); }
  // Filter by search query and duplicates flag
  const dupOnly = (filter === 'duplicates');
  document.querySelectorAll('#owned-cards .tcg-card').forEach(el => {
    const name = (el.getAttribute('title') || '').toLowerCase();
    const qty  = parseInt(el.getAttribute('data-qty') || '1', 10);
    const passQuery = !query || name.includes(query);
    const passDup   = !dupOnly || qty > 1;
    el.style.display = (passQuery && passDup) ? '' : 'none';
  });
  document.querySelectorAll('#missing-cards .tcg-card').forEach(el => {
    const name = (el.getAttribute('title') || '').toLowerCase();
    el.style.display = (!query || name.includes(query)) ? '' : 'none';
  });
}
window.filterCollection = filterCollection;

// ── OPEN DISCORD ───────────────────────────────────────────────
function openDiscord() {
  toast('Discord link coming soon.');
}

// ── WALLET ─────────────────────────────────────────────────────
function connectWallet() {
  toast('🔗 Wallet connect: próximamente en Abstract Chain.');
}

// ── LOGOUT ─────────────────────────────────────────────────────
async function logoutWeb() {
  try { if (window.SB) await SB.signOut(); } catch(_){}
  localStorage.removeItem(AUTH_SESSION_KEY);
  window.location.replace('../index.html');
}

// ── QUICK SELL — server-authoritative via list_card_for_sale RPC ──
async function quickSell(id, price) {
  if (!view.user || !view.user.uid) return toast('Iniciá sesión para listar.');
  if (!view.state.collection[id]) return toast('No posees esa carta.');
  if (!price) {
    const raw = prompt(`Precio en SHARDS para vender "${cardName(id)}":`);
    if (!raw) return;
    price = Math.max(1, parseInt(raw, 10) || 0);
    if (!price) return toast('Precio inválido.');
  }
  if (!window.SB || !window.SB.listCardForSale) return toast('Sin conexión al servidor.');
  const r = await SB.listCardForSale(id, price);
  if (r && r.error) return toast(marketError(r.error, id));
  toast(`📤 ${cardName(id)} listada por ${price} SHARDS.`);
  await refreshFromSupabase();
  renderMercado();
  renderColeccion();
  reloadPwaFrame();
}
function marketError(code, cardId){
  const msg = {
    not_authenticated:        'Iniciá sesión.',
    invalid_price:            'Precio inválido.',
    not_owned:                'No posees esa carta.',
    in_active_deck:           'No podés listar la única copia que está en tu deck activo.',
    minimum_collection_required:'Tenés que conservar al menos 8 cartas en tu colección.',
    listing_not_found:        'Esa oferta ya no existe.',
    not_owner:                'No es tu listing.',
    not_active:               'Esa oferta ya cerró.',
    cannot_buy_own:           'No podés comprar tu propio listing.',
    insufficient_shards:      'Te faltan SHARDS.',
    not_available:            'Ya no está disponible.',
  }[code] || ('Error: ' + code);
  return cardId ? msg : msg;
}
async function delistMarketCard(listingId){
  if (!window.SB || !window.SB.delistMarketCard) return toast('Sin conexión al servidor.');
  const r = await SB.delistMarketCard(listingId);
  if (r && r.error) return toast(marketError(r.error));
  toast('🗑 Listing retirado · carta devuelta.');
  await refreshFromSupabase();
  renderMercado();
  renderColeccion();
}
window.delistMarketCard = delistMarketCard;

// ── EVENT BINDINGS ─────────────────────────────────────────────
function bindEvents() {
  // Nav
  navItems.forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

  // Lang toggle (also handles onclick="toggleLang()" from HTML)
  const langBtn = byId('lang-toggle');
  if (langBtn) {
    langBtn.textContent = currentLang === 'es' ? 'EN' : 'ES';
  }

  // Learn sub-tabs
  document.querySelectorAll('.learn-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.learn-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.learn-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const id = 'ltab-' + btn.dataset.ltab;
      byId(id) && byId(id).classList.add('active');
      if (btn.dataset.ltab === 'clans') renderLearnClans();
    });
  });

  // Market sub-tabs
  document.querySelectorAll('.market-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.market-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ['mtab-offchain','mtab-onchain','mtab-history'].forEach(id => {
        const el = byId(id);
        if (el) el.style.display = (id === 'mtab-' + btn.dataset.mtab) ? '' : 'none';
      });
    });
  });

  // Copy ref link
  byId('copy-ref-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(byId('ref-link').value);
      toast(t('toast_ref'));
    } catch(_) { toast(t('toast_ref_err')); }
  });

  // Save preset
  byId('save-preset').addEventListener('click', () => {
    const name = String(byId('preset-name').value || '').trim();
    if (!name) return toast(t('preset_name_req'));
    if (view.state.deck.length < 8) return toast(t('preset_deck_req'));
    view.state.deckPresets.push({ name: name.slice(0,24), cards:[...view.state.deck] });
    byId('preset-name').value = '';
    persistToUser();
    renderColeccion();
    toast(`💾 Preset "${name}" ${t('preset_saved')}`);
  });

  // Load preset
  byId('load-preset').addEventListener('click', () => {
    const idx = Number(byId('preset-select').value);
    const p   = view.state.deckPresets[idx];
    if (!p) return toast('Selecciona un preset válido.');
    view.state.deck = [...p.cards].slice(0, 8);
    persistToUser();
    renderColeccion();
    reloadPwaFrame();
    toast(`📋 Deck "${p.name}" ${t('preset_loaded')}`);
  });

  // Deck slots — remove card
  byId('panel-coleccion').addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      const id = removeBtn.getAttribute('data-remove');
      view.state.deck = view.state.deck.filter(x => x !== id);
      persistToUser();
      renderColeccion();
      reloadPwaFrame();
      return;
    }
    const addBtn = e.target.closest('[data-adddeck]');
    if (addBtn) {
      const id = addBtn.getAttribute('data-adddeck');
      const idx = view.state.deck.indexOf(id);
      if (idx >= 0) {
        view.state.deck.splice(idx, 1);
        toast(t('removed_deck'));
      } else {
        if (view.state.deck.length >= 8) return toast(t('deck_full'));
        view.state.deck.push(id);
        toast(`✓ ${cardName(id)} ${t('added_deck')}`);
      }
      persistToUser();
      renderColeccion();
      reloadPwaFrame();
    }
    const sellBtn = e.target.closest('[data-sell]');
    if (sellBtn) {
      quickSell(sellBtn.getAttribute('data-sell'));
    }
  });

  // Sell card
  byId('sell-card-btn').addEventListener('click', () => {
    const id    = byId('sell-card-id').value;
    const price = Math.max(1, Number(byId('sell-card-price').value || 0));
    if (!id || !view.state.collection[id]) return toast('Selecciona una carta obtenida.');
    quickSell(id, price);
  });

  // Market buy / delist (server RPC)
  byId('panel-mercado').addEventListener('click', async e => {
    const buyBtn    = e.target.closest('[data-buy]');
    const delistBtn = e.target.closest('[data-delist]');
    if (delistBtn) {
      const lid = delistBtn.getAttribute('data-delist');
      if (!window.SB || !window.SB.delistMarketCard) return toast('Sin conexión al servidor.');
      delistBtn.disabled = true;
      const r = await SB.delistMarketCard(lid);
      if (r && r.error) { delistBtn.disabled = false; return toast(marketError(r.error)); }
      toast('🗑 Listing retirado.');
      await refreshFromSupabase();
      renderMercado();
      renderColeccion();
      reloadPwaFrame();
      return;
    }
    if (!buyBtn) return;
    const lid = buyBtn.getAttribute('data-buy');
    if (!view.user || !view.user.uid) return toast('Iniciá sesión para comprar.');
    if (!window.SB || !window.SB.buyMarketListing) return toast('Sin conexión al servidor.');
    buyBtn.disabled = true;
    const r = await SB.buyMarketListing(lid);
    if (r && r.error) { buyBtn.disabled = false; return toast(marketError(r.error)); }
    toast(`✅ Compra completada (${(r && r.price) || ''} SHARDS).`);
    await refreshFromSupabase();
    renderMercado();
    renderColeccion();
    renderPerfil();
    syncTopbar();
    reloadPwaFrame();
  });

  // Create guild
  byId('create-guild-btn').addEventListener('click', () => {
    const name   = String(byId('guild-name').value || '').trim();
    const avatar = String(byId('guild-avatar').value || '🛡').trim() || '🛡';
    const bio    = String(byId('guild-bio').value || '').trim();
    if (!name)               return toast('Nombre de gremio requerido.');
    if (view.user.guildId)   return toast('Ya perteneces a un gremio.');
    if (view.state.flux < 100) return toast('Necesitas 100 FLUX para crear un gremio.');
    view.state.flux -= 100;
    const guild = {
      id:        `g_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name:      name.slice(0,24),
      avatar:    avatar.slice(0,4),
      bio:       bio.slice(0,200),
      leaderUid: view.user.uid,
      members:   [view.user.uid],
      requests:  [],
      createdAt: Date.now(),
    };
    view.db.guilds.push(guild);
    view.user.guildId = guild.id;
    persistToUser();
    syncTopbar();
    renderGuilds();
    renderPerfil();
    toast(`🛡 Gremio "${name}" creado.`);
  });

  byId('guild-search').addEventListener('input', () => renderGuilds());

  byId('panel-guilds').addEventListener('click', e => {
    const join = e.target.closest('[data-join]');
    if (join) {
      const gid = join.getAttribute('data-join');
      if (view.user.guildId) return toast('Ya perteneces a un gremio.');
      const g = (view.db.guilds || []).find(x => x.id === gid);
      if (!g) return;
      g.requests = g.requests || [];
      if (!g.requests.includes(view.user.uid)) g.requests.push(view.user.uid);
      saveDb(); renderGuilds();
      toast('Solicitud enviada.');
      return;
    }
    const approve = e.target.closest('[data-approve]');
    if (approve) {
      const uid = approve.getAttribute('data-approve');
      const g   = (view.db.guilds || []).find(x => x.id === view.user.guildId);
      if (!g || g.leaderUid !== view.user.uid) return;
      g.requests = (g.requests || []).filter(x => x !== uid);
      if (!g.members.includes(uid)) g.members.push(uid);
      const ru = view.db.users[uid];
      if (ru) ru.guildId = g.id;
      saveDb(); renderGuilds();
      toast('Miembro aceptado.');
      return;
    }
    const deny = e.target.closest('[data-deny]');
    if (deny) {
      const uid = deny.getAttribute('data-deny');
      const g   = (view.db.guilds || []).find(x => x.id === view.user.guildId);
      if (!g || g.leaderUid !== view.user.uid) return;
      g.requests = (g.requests || []).filter(x => x !== uid);
      saveDb(); renderGuilds();
      toast('Solicitud rechazada.');
    }
  });

  // Share preset
  const sharePre = byId('share-preset');
  if (sharePre) {
    sharePre.addEventListener('click', () => {
      const idx = Number(byId('preset-select').value);
      const p   = view.state.deckPresets[idx];
      if (!p) return toast('Select a preset to share.');
      p.public = true;
      persistToUser();
      toast(`🌐 Preset "${p.name}" shared to community.`);
    });
  }
}

// ── INIT ───────────────────────────────────────────────────────
function loadCustomCards() {
  try {
    const raw = localStorage.getItem('shs_custom_cards');
    if (!raw) return;
    const cards = JSON.parse(raw);
    if (!Array.isArray(cards) || !cards.length) return;
    const existingMap = new Map(((typeof ALL_CARDS!=='undefined'?ALL_CARDS:[])).map((c, i) => [c.id, i]));
    cards.forEach(c => {
      const _ac = (typeof ALL_CARDS!=='undefined'?ALL_CARDS:null);
      if (!_ac) return;
      if (existingMap.has(c.id)) {
        _ac[existingMap.get(c.id)] = c;
      } else {
        _ac.push(c);
      }
    });
    if (typeof assignAbilities === 'function' && typeof ALL_CARDS !== 'undefined') assignAbilities(ALL_CARDS);
  } catch(_){}
}

/** Pull admin-published custom cards from Supabase and merge into ALL_CARDS. */
async function loadCustomCardsRemote(){
  try {
    if (!window.SB || !SB.loadCustomCards) return 0;
    const remote = await SB.loadCustomCards();
    if (!Array.isArray(remote) || !remote.length) return 0;
    if (typeof window.applyRemoteCustomCards === 'function') return window.applyRemoteCustomCards(remote);
    // Fallback if data.js helper isn't loaded (shouldn't happen).
    const _ac = (typeof ALL_CARDS!=='undefined'?ALL_CARDS:null);
    if (!_ac) return 0;
    const idx = new Map(_ac.map((c,i)=>[c.id,i]));
    let added = 0;
    remote.forEach(c => { if (idx.has(c.id)) _ac[idx.get(c.id)] = c; else { _ac.push(c); added++; } });
    if (typeof assignAbilities === 'function') assignAbilities(_ac);
    return added;
  } catch(e){ console.warn('loadCustomCardsRemote failed:', e); return 0; }
}

function applyCustomCardsToCollection() {
  // NOTE: previously this function gifted every custom-edited card to the
  // current user (and started them at level 2). Custom cards are catalog-only:
  // they extend ALL_CARDS via loadCustomCards() but must be obtained through
  // packs / market like everything else. This is now intentionally a no-op.
}

/** Hydrate view.db.users[uid] from Supabase profile + game_state. */
async function hydrateFromSupabase(authUser){
  const uid = authUser.id;
  let profile = null, gs = null, decks = [], collection = null, battlePass = null;
  try {
    const r = await SB.loadProfile(uid);
    profile = r.profile; gs = r.gameState; battlePass = r.battlePass;
  } catch(_){}
  try { decks      = await SB.loadDecks(uid); }      catch(_){}
  try { collection = await SB.loadCollection(uid); } catch(_){}
  const existing = view.db.users[uid] || {};
  const u = Object.assign({
    uid,
    email: authUser.email || existing.email || '',
    username: profile?.username || existing.username || 'Player',
    avatar: existing.avatar || '⚡',
    createdAt: existing.createdAt || Date.now(),
    updatedAt: Date.now(),
    gameState: existing.gameState || { collection:{}, deck:[], deckPresets:[], welcomePackClaimed:false, claimedMissions:[] },
  }, existing);
  if (profile) {
    u.username = profile.username || u.username;
  }
  if (gs) {
    u.shardsBalance  = gs.shards ?? u.shardsBalance ?? 0;
    u.fluxBalance    = gs.flux   ?? u.fluxBalance   ?? 0;
    u.shsBalance     = Number(gs.shs ?? u.shsBalance ?? 0);
    u.elo            = gs.elo    ?? u.elo ?? 0;
    u.accountXp      = gs.xp    ?? u.accountXp ?? 0;
    u.accountLevel   = gs.level ?? u.accountLevel ?? 1;
    u.gameState.welcomePackClaimed = !!gs.welcome_pack_claimed;
  }
  // Server is source of truth for collection — only override if we got data back.
  if (collection && Object.keys(collection).length){
    u.gameState.collection = collection;
  }
  // Battle pass: server is authoritative.
  if (battlePass) {
    const claimedFree    = Array.isArray(battlePass.claimed_free)    ? battlePass.claimed_free    : [];
    const claimedPremium = Array.isArray(battlePass.claimed_premium) ? battlePass.claimed_premium : [];
    u.gameState.battlePass = {
      season:         battlePass.season|0,
      startedAt:      battlePass.started_at ? new Date(battlePass.started_at).getTime() : Date.now(),
      xp:             battlePass.xp|0,
      premium:        !!battlePass.is_premium,
      claimedLevels:  [
        ...claimedFree.map(l => `${l}:free`),
        ...claimedPremium.map(l => `${l}:premium`),
      ],
      grandClaimedIds: u.gameState.battlePass?.grandClaimedIds || [],
    };
  }
  // Decks: pick the active row for the deck slot, presets from the rest.
  if (Array.isArray(decks) && decks.length){
    const active = decks.find(d => d.is_active) || decks[0];
    if (active && Array.isArray(active.card_ids) && active.card_ids.length === 8){
      u.gameState.deck = active.card_ids.slice(0, 8);
    } else {
      u.gameState.deck = [];
    }
    u.gameState.deckPresets = decks
      .filter(d => d !== active && Array.isArray(d.card_ids) && d.card_ids.length === 8)
      .map(d => ({ name: d.name, cards: d.card_ids.slice(0, 8) }));
    // Track server-known preset names so persistToUser can hard-delete removed ones.
    view._knownServerPresets = decks.map(d => d.name).filter(Boolean);
  } else {
    u.gameState.deck = [];
    u.gameState.deckPresets = [];
    view._knownServerPresets = [];
  }
  view.db.users[uid] = u;
  saveDb();
  localStorage.setItem(AUTH_SESSION_KEY, uid);
  // Hydrate the most recent pack so the SHOP "last pack opened" panel survives refresh.
  try {
    const hist = await SB.loadPackHistory(uid, 1);
    if (Array.isArray(hist) && hist.length){
      const last = hist[0];
      const ids = Array.isArray(last.card_ids) ? last.card_ids : [];
      const cards = ids.map(id => getCard(id)).filter(Boolean);
      if (cards.length) view.lastPack = cards;
    }
  } catch(_){}
  return u;
}

/** Re-pull from Supabase (stats only) and refresh UI.
 *  Triggered when the gamehub tab regains focus — picks up changes
 *  made in the /game tab (rewards from finalize_battle). */
async function refreshFromSupabase(){
  if (!window.SB || !view.user) return;
  try {
    const sess = await SB.getSession();
    if (!sess || !sess.user) return;
    const fresh = await hydrateFromSupabase(sess.user);
    view.user = fresh;
    syncFromUser();
    syncTopbar();
    if (typeof renderPerfil === 'function') renderPerfil();
    if (typeof renderBattlePass === 'function') renderBattlePass();
  } catch(_){}
}

async function start() {
  loadCustomCards();
  loadDb();

  // Try Supabase session first; fall back to legacy local session.
  if (window.SB) {
    try {
      const sess = await SB.getSession();
      if (sess && sess.user) {
        view.user = await hydrateFromSupabase(sess.user);
      }
    } catch(_){}
    // Always attempt to pull admin-published custom cards (read is open).
    loadCustomCardsRemote().catch(()=>{});
  }
  if (!view.user) view.user = resolveCurrentUser();

  if (!view.user) {
    window.location.replace('../index.html');
    return;
  }

  ensureUserDefaults(view.user);
  syncFromUser();
  applyCustomCardsToCollection();
  syncTopbar();
  bindEvents();
  setLang(currentLang);
  renderPacks();
  setTab('coleccion');

  // Re-pull from Supabase whenever the gamehub tab regains focus,
  // so rewards earned in /game (other tab) appear right away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshFromSupabase();
  });
  window.addEventListener('focus', refreshFromSupabase);
}

start();
