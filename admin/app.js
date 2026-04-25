// SHARDSTATE — Admin card editor (live preview, level switcher, image upload)
// Persists changes to localStorage 'shs_custom_cards'; the game and gamehub
// merge that store on boot so edits propagate everywhere.

const CLAN_DATA   = (typeof CLANS !== 'undefined') ? CLANS : {};
const RAR_TO_FULL = { C:'common', U:'uncommon', R:'rare', M:'mythic' };
const INV_RAR     = { common:'C', uncommon:'U', rare:'R', mythic:'M' };

let blobArt1 = null, blobArt2 = null, blobLogo = null;
let previewLv = 2;
let selectedCardId = null;
let adminFilter = '';
let selectedUser = null;
let userSearchTimer = null;

function $(id){ return document.getElementById(id); }

function abilityUnlockLv(stars){ return (stars >= 5) ? 4 : 2; }
function pool_size_for(isTitans){
  const pools = window.SHS_ABILITY_POOLS || {};
  return ((isTitans ? pools.TITANS_POOL : pools.NORMAL_POOL) || []).length;
}
function interpolateStat(v0, vMax, lv, maxLv){
  if(maxLv <= 1) return vMax;
  const t = (lv - 1) / (maxLv - 1);
  return Math.round(v0 + (vMax - v0) * t);
}

// ── CARD POOL ─────────────────────────────────────────────
function getAllCards(){
  const base = (typeof ALL_CARDS !== 'undefined' && Array.isArray(ALL_CARDS)) ? ALL_CARDS : [];
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('shs_custom_cards') || '[]'); } catch(_){}
  const map = new Map(base.map(c => [c.id, c]));
  custom.forEach(c => map.set(c.id, { ...c, isCustom:true }));
  return Array.from(map.values());
}

function filterAdminList(){ adminFilter = $('admin-search').value.toLowerCase(); renderAdminList(); }

function renderAdminList(){
  const all = getAllCards();
  const q = adminFilter;
  const list = q
    ? all.filter(c => (c.id||'').includes(q) || (c.name||'').toLowerCase().includes(q) || (c.clan||'').includes(q))
    : all;
  const host = $('admin-list');
  if(!list.length){ host.innerHTML = '<div class="admin-empty">No cards found</div>'; return; }
  host.innerHTML = list.map(c => {
    const cc = CLAN_DATA[c.clan]?.color || '#6B5CE7';
    const sel = c.id === selectedCardId ? ' selected' : '';
    return `<div class="admin-card-row${sel}" onclick="loadCard('${c.id}')">
      <div class="admin-card-dot" style="background:${cc}"></div>
      <span class="admin-card-name">${c.name || c.id}</span>
      <span class="admin-card-clan">${(c.clan||'').toUpperCase()}</span>
      ${c.isCustom?'<span class="admin-card-custom">CUSTOM</span>':''}
    </div>`;
  }).join('');
}

function loadCard(id){
  const c = getAllCards().find(x => x.id === id);
  if(!c) return;
  selectedCardId = id;
  $('f-id').value     = c.id || '';
  $('f-name').value   = c.name || '';
  $('f-clan').value   = c.clan || 'nexus';
  $('f-type').value   = c.type || 'normal';
  $('f-rarity').value = c.rar || INV_RAR[c.rarity] || 'C';
  $('f-stars').value  = c.stars || 3;
  $('f-pow1').value   = Array.isArray(c.pow) ? c.pow[0] : (c.stats?.level1?.power ?? c.pow ?? 1);
  $('f-pow2').value   = Array.isArray(c.pow) ? c.pow[1] : (c.stats?.max?.power    ?? c.pow ?? 1);
  $('f-dmg1').value   = Array.isArray(c.dmg) ? c.dmg[0] : (c.stats?.level1?.damage ?? c.dmg ?? 1);
  $('f-dmg2').value   = Array.isArray(c.dmg) ? c.dmg[1] : (c.stats?.max?.damage    ?? c.dmg ?? 1);

  populateAbilityDropdown(c.clan || 'nexus', c.abilityId || '');

  $('f-art2-url').value = c.visual?.image    || '';
  $('f-art1-url').value = c.visual?.imageLv1 || '';
  $('f-logo-url').value = c.visual?.logo     || '';
  blobArt1 = blobArt2 = blobLogo = null;

  previewLv = parseInt(c.stars) || 3;
  renderAdminList();
  syncCard();
  showMsg(`Loaded: ${c.name} (${id})`, 'ok');
}

// Populate ability dropdown filtered by clan (titans-only or normal pool).
function populateAbilityDropdown(clan, currentId){
  const sel = $('f-ability-id');
  if (!sel) return;
  const isTitans = (clan === 'titans');
  const pool = (window.SHS_ABILITY_POOLS) ? (isTitans ? window.SHS_ABILITY_POOLS.TITANS_POOL : window.SHS_ABILITY_POOLS.NORMAL_POOL) : [];
  const cat = window.ABILITY_CATALOG || {};
  sel.innerHTML = pool.map(id => {
    const ab = cat[id] || {};
    return `<option value="${id}">${ab.label || id}</option>`;
  }).join('');
  if (currentId && pool.includes(currentId)) sel.value = currentId;
  else if (pool.length) sel.value = pool[0];
}

function newCard(){
  selectedCardId = null;
  $('f-id').value = 'custom_' + Date.now();
  $('f-name').value = 'NEW CARD';
  $('f-clan').value = 'nexus';
  $('f-type').value = 'normal';
  $('f-rarity').value = 'C';
  $('f-stars').value = '3';
  $('f-pow1').value = '3'; $('f-pow2').value = '5';
  $('f-dmg1').value = '2'; $('f-dmg2').value = '3';
  populateAbilityDropdown('nexus', '');
  $('f-art1-url').value = ''; $('f-art2-url').value = ''; $('f-logo-url').value = '';
  blobArt1 = blobArt2 = blobLogo = null;
  previewLv = 1;
  renderAdminList();
  syncCard();
}

// ── ART / LOGO HANDLERS (read as DataURL so they survive refresh in localStorage) ──
function handleArt(input, level){
  if(input.files && input.files[0]){
    const reader = new FileReader();
    reader.onload = e => {
      if(level === 'lv1') blobArt1 = e.target.result;
      else                blobArt2 = e.target.result;
      syncCard();
    };
    reader.readAsDataURL(input.files[0]);
  }
}
function handleLogo(input){
  if(input.files && input.files[0]){
    const reader = new FileReader();
    reader.onload = e => { blobLogo = e.target.result; $('f-logo-url').value = ''; syncCard(); };
    reader.readAsDataURL(input.files[0]);
  }
}

// ── PREVIEW ────────────────────────────────────────────────
function setImg(wrap, phId, url, emoji){
  $(phId).textContent = emoji;
  let img = wrap.querySelector('img');
  if(url){
    if(!img){ img = document.createElement('img'); wrap.insertBefore(img, $(phId)); }
    img.src = url;
    img.onload  = () => wrap.classList.add('has-img');
    img.onerror = () => wrap.classList.remove('has-img');
  } else {
    if(img) img.remove();
    wrap.classList.remove('has-img');
  }
}

function starsHtml(filled, total){
  if(total === undefined) total = filled;
  return Array.from({length:total},(_,i)=>`<span class="${i<filled?'star-filled':'star-empty'}">★</span>`).join('');
}

function rebuildLevelToggle(stars){
  const c = document.querySelector('.level-toggle');
  c.innerHTML = '';
  for(let i = 1; i <= stars; i++){
    const b = document.createElement('button');
    b.className = 'level-btn' + (i === previewLv ? ' active' : '');
    b.textContent = i === stars ? 'MAX' : `LV ${i}`;
    b.onclick = () => setLevel(i);
    c.appendChild(b);
  }
}
function setLevel(lv){
  previewLv = lv;
  document.querySelectorAll('.level-btn').forEach((b,i)=>b.classList.toggle('active', i+1 === previewLv));
  syncCard();
}

function syncCard(){
  const name     = $('f-name').value || 'UNNAMED';
  const clan     = $('f-clan').value;
  const type     = $('f-type').value;
  const rar      = $('f-rarity').value;
  const stars    = parseInt($('f-stars').value) || 2;
  const pow1     = parseInt($('f-pow1').value) || 1;
  const pow2     = parseInt($('f-pow2').value) || 1;
  const dmg1     = parseInt($('f-dmg1').value) || 1;
  const dmg2     = parseInt($('f-dmg2').value) || 1;
  const logoUrl  = $('f-logo-url').value.trim() || blobLogo || '';

  // If clan changed, repopulate ability dropdown so titans-only filter applies.
  const sel = $('f-ability-id');
  const wantTitans = (clan === 'titans');
  const optsAreTitans = sel && sel.options.length && (window.SHS_ABILITY_POOLS?.TITANS_POOL || []).includes(sel.options[0].value);
  if (sel && optsAreTitans !== wantTitans) populateAbilityDropdown(clan, sel.value);

  const abilityId = sel ? sel.value : '';
  const cat = window.ABILITY_CATALOG || {};
  const abilText = cat[abilityId]?.label || '';
  const cond = '';
  // Auto-derive bonus from clan
  const bonusId = (window.CLAN_BONUS_MAP || {})[clan];
  const bonus = bonusId ? (cat[bonusId]?.label || '') : (clan === 'titans' ? 'Cancela TITANS rival' : '');
  $('f-bonus').value = bonus;
  const hint = $('f-ability-hint');
  if (hint) hint.textContent = wantTitans ? 'Titans-only ability pool (passive, hand-based).' : `Slot único: ${pool_size_for(wantTitans)} habilidades disponibles.`;

  const cd = CLAN_DATA[clan] || {color:'#6B5CE7', emoji:'⚡'};
  const cc = cd.color, emoji = cd.emoji || '⚡';

  if(document.querySelectorAll('.level-btn').length !== stars) rebuildLevelToggle(stars);
  previewLv = Math.max(1, Math.min(previewLv, stars));
  document.querySelectorAll('.level-btn').forEach((b,i)=>b.classList.toggle('active', i+1 === previewLv));

  const showPow = interpolateStat(pow1, pow2, previewLv, stars);
  const showDmg = interpolateStat(dmg1, dmg2, previewLv, stars);

  const artUrl = previewLv >= stars
    ? ($('f-art2-url').value.trim() || blobArt2 || $('f-art1-url').value.trim() || blobArt1 || '')
    : ($('f-art1-url').value.trim() || blobArt1 || $('f-art2-url').value.trim() || blobArt2 || '');

  const unlockAt   = abilityUnlockLv(stars);
  const abilLocked = previewLv < unlockAt;

  const front = $('preview-front');
  front.style.setProperty('--cc', cc);
  front.className = `card type-${type}`;

  setImg($('p-art-wrap'), 'p-art-ph', artUrl, emoji);

  const logoEl = $('p-logo');
  if(logoUrl){
    logoEl.src = logoUrl;
    logoEl.classList.add('show');
    logoEl.onerror = () => logoEl.classList.remove('show');
  } else {
    logoEl.classList.remove('show');
  }

  $('p-name').textContent = name;
  $('p-rar').textContent  = rar;
  $('p-rar').className    = `card-rar rar-${rar}`;

  const badge = $('p-type-badge');
  const TYPE_LABEL = { grand:'GRAND', eco:'ECO' };
  if(type === 'grand' || type === 'eco'){ badge.textContent = TYPE_LABEL[type]; badge.style.display = 'block'; }
  else badge.style.display = 'none';

  $('p-pow').textContent = showPow;
  $('p-dmg').textContent = showDmg;
  $('p-stars').innerHTML = starsHtml(previewLv, stars);

  const condEl = $('p-cond');
  const wrap   = $('p-ability-text').parentElement;
  if(abilLocked){
    wrap.style.opacity = '0.4';
    condEl.style.display = 'none';
    $('p-ability-text').textContent = `🔒 Unlocks at LV${unlockAt}`;
  } else {
    wrap.style.opacity = '1';
    condEl.style.display = 'none';
    $('p-ability-text').textContent = abilText;
  }
  $('p-bonus').textContent = bonus;
}

// ── BUILD CARD OBJECT ─────────────────────────────────────
function buildCard(){
  const id     = $('f-id').value.trim().toLowerCase().replace(/\s+/g,'_') || 'custom_card';
  const name   = $('f-name').value.trim() || 'UNNAMED';
  const clan   = $('f-clan').value;
  const type   = $('f-type').value;
  const rar    = $('f-rarity').value;
  const stars  = parseInt($('f-stars').value) || 3;
  const pow1   = parseInt($('f-pow1').value) || 1;
  const pow2   = parseInt($('f-pow2').value) || 1;
  const dmg1   = parseInt($('f-dmg1').value) || 1;
  const dmg2   = parseInt($('f-dmg2').value) || 1;
  const cat    = window.ABILITY_CATALOG || {};
  const abilityId = $('f-ability-id') ? $('f-ability-id').value : '';
  const bonusId   = (window.CLAN_BONUS_MAP || {})[clan] || null;
  const abilText  = cat[abilityId]?.label || '';
  const bonusText = bonusId ? (cat[bonusId]?.label || '') : (clan === 'titans' ? 'Cancela TITANS rival' : '');
  const art1   = $('f-art1-url').value.trim() || blobArt1 || '';
  const art2   = $('f-art2-url').value.trim() || blobArt2 || '';
  const logo   = $('f-logo-url').value.trim() || blobLogo || '';
  const cc     = (CLAN_DATA[clan]?.color) || '#6B5CE7';

  return {
    id, name, clan,
    stars, rar,
    pow:[pow1, pow2], dmg:[dmg1, dmg2],
    lv:1, lv_max:stars,
    type:type || 'normal',
    rarity: RAR_TO_FULL[rar] || 'common',
    abilityId,
    bonusId,
    ability: abilText,
    bonus:   bonusText,
    abilityData: { id: abilityId, text: abilText, condition: null },
    tags:[],
    visual: { image:art2, imageLv1:art1, logo:logo || null, frame:clan, color:cc },
    rules:{}, economy:{ tradable:true },
    isCustom:true,
  };
}

async function addToGame(){
  const card = buildCard();
  if(!card.id || card.id === 'custom_card'){ showMsg('Give the card a unique ID before saving.', 'warn'); return; }
  let customs = [];
  try { customs = JSON.parse(localStorage.getItem('shs_custom_cards') || '[]'); } catch(_){}
  customs = customs.filter(c => c.id !== card.id);
  customs.push(card);
  try {
    localStorage.setItem('shs_custom_cards', JSON.stringify(customs));
  } catch(e){
    showMsg('Could not save — image too large for localStorage. Use a smaller file.', 'err');
    return;
  }
  // Best-effort push to Supabase so other clients see it.
  try {
    if (window.SB && SB.upsertCustomCard){
      const r = await SB.upsertCustomCard(card.id, card);
      if (r && r.error) showMsg(`Saved locally. Cloud sync skipped: ${r.error.message || 'no admin'}.`, 'warn');
      else showMsg(`✓ "${card.name}" saved + synced. Reload to see updates.`, 'ok');
    } else {
      showMsg(`✓ "${card.name}" saved locally. Reload gamehub or game to see updates.`, 'ok');
    }
  } catch(e){
    showMsg(`Saved locally. Cloud sync error: ${e.message}`, 'warn');
  }
  selectedCardId = card.id;
  renderAdminList();
}

function exportJS(){
  const card = buildCard();
  const cfg = {
    id: card.id, name: card.name, clan: card.clan,
    type: card.type, rarity: card.rarity, stars: card.stars,
    stats: { level1:{ power:card.pow[0], damage:card.dmg[0] }, max:{ power:card.pow[1], damage:card.dmg[1] } },
    abilityId: card.abilityId,
    bonusId:   card.bonusId,
    ability:   { id: card.abilityId, text: card.ability },
    bonus:     { text: card.bonus },
    visual: { image:card.visual.image, imageLv1:card.visual.imageLv1, logo:card.visual.logo },
    rules:{}, economy:{ tradable:true },
  };
  const out = $('export-out');
  out.value = `createCard(${JSON.stringify(cfg, null, 2)}),\n`;
  out.classList.add('show');
  out.select();
  try { document.execCommand('copy'); showMsg('Snippet copied. Paste into engine/cards.js.', 'ok'); }
  catch(_){ showMsg('Copy snippet manually.', 'warn'); }
}

function clearCustomCards(){
  if(!confirm('Remove all custom card overrides from localStorage?\nBase game cards are not affected.')) return;
  localStorage.removeItem('shs_custom_cards');
  selectedCardId = null;
  renderAdminList();
  showMsg('All custom overrides cleared.', 'warn');
}

function showMsg(text, type){
  const el = $('export-msg');
  el.textContent = text;
  el.className = `msg ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'msg'; }, 6000);
}

// ── INIT ──────────────────────────────────────────────────
function setAdminMode(mode){
  const isUsers = mode === 'users';
  document.body.classList.toggle('admin-mode-users', isUsers);
  $('tab-cards')?.classList.toggle('active', !isUsers);
  $('tab-users')?.classList.toggle('active', isUsers);
}
function userMsg(text, type='ok'){
  const el = $('user-action-msg');
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'msg'; }, 7000);
}
function statusPill(status){
  const s = status || 'active';
  return `<span class="status-pill status-${s}">${s}</span>`;
}
function searchAdminUsersDebounced(){
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(searchAdminUsers, 250);
}
async function searchAdminUsers(){
  const q = String($('user-search')?.value || '').trim();
  const host = $('user-results');
  if (!host) return;
  if (q.length < 2) { host.innerHTML = '<div class="admin-empty">Type at least 2 characters.</div>'; return; }
  host.innerHTML = '<div class="admin-empty">Searching...</div>';
  const r = await SB.adminSearchUsers(q);
  if (r.error) { host.innerHTML = `<div class="admin-empty">${r.error.message || 'Search failed'}</div>`; return; }
  const rows = r.data || [];
  host.innerHTML = rows.length ? rows.map(u => `
    <div class="user-row" onclick="selectAdminUser('${u.user_id}')">
      <div class="user-row-main"><div class="user-row-email">${u.email || u.user_id}</div>
      <div class="user-row-meta">${u.username || 'no username'} · cards ${u.cards_count || 0} · deck rows ${u.deck_count || 0}</div></div>
      ${statusPill(u.status)}
    </div>`).join('') : '<div class="admin-empty">No users found.</div>';
}
async function selectAdminUser(userId){
  const r = await SB.adminGetUserDetail(userId);
  if (r.error) return userMsg(r.error.message || 'Could not load user.', 'err');
  selectedUser = { user_id:userId, detail:r.data || {} };
  renderSelectedUser();
}
function renderSelectedUser(){
  const box = $('user-detail'), panel = $('user-log-panel');
  if (!box || !panel || !selectedUser) return;
  const d = selectedUser.detail || {}, p = d.profile || {}, gs = d.game_state || {}, flag = d.flag || { status:'active' };
  const cards = Array.isArray(d.cards) ? d.cards : [];
  const decks = Array.isArray(d.decks) ? d.decks : [];
  box.classList.remove('empty');
  box.innerHTML = `<div class="user-detail-title">${p.username || 'No username'} ${statusPill(flag.status || 'active')}</div>
    <div class="user-detail-meta">${selectedUser.user_id}</div>
    <div class="user-kv"><div><span>SHARDS</span>${gs.shards || 0}</div><div><span>FLUX</span>${gs.flux || 0}</div>
    <div><span>ELO</span>${gs.elo || 0}</div><div><span>Cards</span>${cards.length}</div>
    <div><span>Deck rows</span>${decks.length}</div><div><span>Welcome</span>${gs.welcome_pack_claimed ? 'claimed' : 'available'}</div></div>`;
  const actions = Array.isArray(d.recent_actions) ? d.recent_actions : [];
  panel.innerHTML = `<div class="user-log-title">${p.username || 'Selected user'}</div>
    <div class="user-detail-meta">Cards: ${cards.map(c => `${c.card_id} x${c.qty}`).join(', ') || 'none'}</div>
    <div class="user-detail-meta">Decks: ${decks.map(x => `${x.name}: ${(x.card_ids || []).join(', ')}`).join(' · ') || 'none'}</div>
    ${actions.length ? actions.map(a => `<div class="user-log-entry"><strong>${a.action}</strong><div>${new Date(a.created_at).toLocaleString()}</div><code>${JSON.stringify(a.details || {}, null, 2)}</code></div>`).join('') : '<div class="admin-empty">No recent admin actions.</div>'}`;
}
async function refreshSelectedUser(){ if (selectedUser) await selectAdminUser(selectedUser.user_id); }
function requireSelectedUser(){ if (!selectedUser?.user_id) { userMsg('Select a user first.', 'warn'); return null; } return selectedUser.user_id; }
async function setSelectedStatus(status){
  const uid = requireSelectedUser(); if (!uid) return;
  const reason = status === 'active' ? '' : prompt(`Reason for ${status}:`, 'Admin action') || '';
  const r = await SB.adminSetAccountStatus(uid, status, reason);
  if (r.error) return userMsg(r.error.message || 'Status update failed.', 'err');
  userMsg(`Status set to ${status}.`, 'ok'); await refreshSelectedUser();
}
async function resetSelectedUser(){
  const uid = requireSelectedUser(); if (!uid) return;
  if (!confirm('Reset this account to zero?')) return;
  const r = await SB.adminResetUser(uid);
  if (r.error) return userMsg(r.error.message || 'Reset failed.', 'err');
  userMsg('Account reset to zero.', 'warn'); await refreshSelectedUser();
}
async function deleteSelectedUserGameData(){
  const uid = requireSelectedUser(); if (!uid) return;
  if (!confirm('Delete all game records and mark this account deleted/blocked from game access?')) return;
  const r = await SB.adminDeleteUserGameData(uid);
  if (r.error) return userMsg(r.error.message || 'Delete failed.', 'err');
  userMsg('Game records deleted and account marked deleted.', 'warn'); await refreshSelectedUser();
}
async function grantSelectedCurrency(currency){
  const uid = requireSelectedUser(); if (!uid) return;
  const id = currency === 'flux' ? 'grant-flux' : 'grant-shards';
  const amount = parseInt($(id)?.value || '0', 10);
  if (!amount || amount <= 0) return userMsg('Enter a positive amount.', 'warn');
  const r = await SB.adminGrantCurrency(uid, currency, amount, $('grant-note')?.value || '');
  if (r.error) return userMsg(r.error.message || 'Grant failed.', 'err');
  userMsg(`Granted +${amount} ${currency.toUpperCase()}.`, 'ok'); $(id).value = ''; await refreshSelectedUser();
}

renderAdminList();
newCard();
