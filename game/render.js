// SHARDSTATE — RENDER: HTML cards + Canvas2D FX (cyber-tech)
// ============================================================

const FX = {
  canvas:null, ctx:null,
  particles:[],
  shake:{ x:0, y:0, t:0, mag:0 },
  raf:null,
};

// RAR_COLOR is declared in data.js

function initFX(){
  FX.canvas = document.getElementById('combat-canvas');
  if(!FX.canvas) return;
  FX.ctx = FX.canvas.getContext('2d');
  resizeFX();
  window.addEventListener('resize', resizeFX);
  loop();
}
function resizeFX(){
  if(!FX.canvas) return;
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  FX.canvas.width  = window.innerWidth  * dpr;
  FX.canvas.height = window.innerHeight * dpr;
  FX.canvas.style.width  = window.innerWidth+'px';
  FX.canvas.style.height = window.innerHeight+'px';
  FX.ctx.setTransform(dpr,0,0,dpr,0,0);
}

function loop(){
  if(!FX.ctx){ FX.raf = requestAnimationFrame(loop); return; }
  const ctx = FX.ctx;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // shake
  if(FX.shake.t > 0){
    FX.shake.t -= 16;
    const m = FX.shake.mag * (FX.shake.t / 320);
    FX.shake.x = (Math.random()-.5) * m;
    FX.shake.y = (Math.random()-.5) * m;
    const stage = document.getElementById('screen-battle');
    if(stage) stage.style.transform = `translate(${FX.shake.x}px,${FX.shake.y}px)`;
  } else if(FX.shake.x !== 0 || FX.shake.y !== 0){
    FX.shake.x = FX.shake.y = 0;
    const stage = document.getElementById('screen-battle');
    if(stage) stage.style.transform = '';
  }

  // particles
  for(let i = FX.particles.length - 1; i >= 0; i--){
    const p = FX.particles[i];
    p.life -= 16;
    if(p.life <= 0){ FX.particles.splice(i,1); continue; }
    p.vy += p.g || 0.18;
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.985; p.vy *= 0.99;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 12; ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.r||3) * a, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  FX.raf = requestAnimationFrame(loop);
}

function shakeScreen(mag, ms){ FX.shake.mag = mag; FX.shake.t = ms; }

function spawnBurst(x, y, color, count, spread){
  count  = count || 40;
  spread = spread || 6;
  for(let i = 0; i < count; i++){
    const a = Math.random() * Math.PI * 2;
    const v = Math.random() * spread + 1;
    FX.particles.push({
      x, y,
      vx: Math.cos(a)*v, vy: Math.sin(a)*v - 2,
      r: 2 + Math.random()*3,
      color,
      life: 700 + Math.random()*500,
      max: 1200,
      g: 0.14,
    });
  }
}
function spawnConfetti(){
  const colors = ['#00FFC6','#9BFF00','#f59e0b','#a464ff','#ffffff'];
  for(let i = 0; i < 80; i++){
    FX.particles.push({
      x: Math.random()*window.innerWidth,
      y: -20,
      vx: (Math.random()-0.5)*4,
      vy: 2 + Math.random()*4,
      r: 2 + Math.random()*3,
      color: colors[Math.floor(Math.random()*colors.length)],
      life: 2400, max: 2400, g: 0.10,
    });
  }
}

// ─── HTML CARD ──────────────────────────────────────────────
function buildCardEl(card, opts){
  opts = opts || {};
  const clan = getClan(card.clan);
  const rarColor = RAR_COLOR[card.rarity] || '#9CA3AF';
  const el = document.createElement('div');
  el.className = 'card type-' + (card.type || 'normal') + (opts.compact ? ' compact' : '');
  el.dataset.cardId = card.id;
  el.style.setProperty('--clan-c',  clan.color);
  el.style.setProperty('--clan-c2', clan.hex2);
  el.style.setProperty('--rar-c',   rarColor);
  el.style.setProperty('--cc',      clan.color);

  const v = card.visual || {};
  const artUrl = v.image || v.imageLv1 || '';
  const logoUrl = v.logo || '';
  const stars = '<span class="f">★</span>'.repeat(card.stars) +
                '<span class="e">★</span>'.repeat(Math.max(0, 5-card.stars));

  el.innerHTML = `
    <div class="card-art${artUrl?' has-img':''}">
      ${artUrl ? `<img src="${artUrl}" alt="" onerror="this.parentElement.classList.remove('has-img');this.remove()"/>` : ''}
      <div class="art-glyph">${clan.glyph}</div>
    </div>
    <div class="card-vignette"></div>
    <div class="card-top">
      ${logoUrl
        ? `<img class="clan-logo-img" src="${logoUrl}" onerror="this.remove()"/>`
        : `<div class="clan-logo">${clan.glyph}</div>`}
      <div class="card-name">${card.name}</div>
      <div class="card-rar">${card.rar || card.rarity || 'C'}</div>
    </div>
    <div class="card-stats">
      <div class="stat-pill pow"><span>POW</span><b>${card.pow}</b></div>
      <div class="stat-pill dmg"><span>DMG</span><b>${card.dmg}</b></div>
    </div>
    ${opts.compact ? '' : `
    <div class="card-bottom">
      <div class="ability-row"><span class="lbl">ABILITY</span>${card.ability || '—'}</div>
      ${card.bonus ? `<div class="bonus-row"><span class="lbl">BONUS</span>${typeof card.bonus === 'string' ? card.bonus : (card.bonus.text || clan.bonus || '')}</div>` : ''}
      <div class="card-stars-row">${stars}</div>
    </div>`}
  `;
  return el;
}

function ensureBattleCardModal(){
  let modal = document.getElementById('battle-card-modal');
  if(modal) return modal;
  modal = document.createElement('div');
  modal.id = 'battle-card-modal';
  modal.className = 'bcd-overlay';
  modal.innerHTML = `
    <div class="bcd-panel">
      <button class="bcd-close" type="button" onclick="closeBattleCardDetail()">×</button>
      <div class="bcd-body"></div>
    </div>`;
  modal.addEventListener('click', e => {
    if(e.target === modal) closeBattleCardDetail();
  });
  document.body.appendChild(modal);
  if(!window.__bcdEscBound){
    window.__bcdEscBound = true;
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') closeBattleCardDetail();
    });
  }
  return modal;
}

function battleCardStars(stars){
  stars = stars || 1;
  return '<span class="star-filled">★</span>'.repeat(stars) +
    '<span class="star-empty">★</span>'.repeat(Math.max(0, 5 - stars));
}

function openBattleCardDetail(cardId){
  const card = getCard(cardId);
  if(!card) return;
  const clan = getClan(card.clan) || {};
  const v = card.visual || {};
  const cc = clan.color || '#00ffc6';
  const imgSrc = v.image || v.imageLv1 || '';
  const logo = v.logo || '';
  const rar = card.rar || card.rarity || 'C';
  const rarNames = {C:'Common',U:'Uncommon',R:'Rare',M:'Mythic'};
  const type = card.type || 'normal';
  const ability = typeof card.ability === 'object' ? card.ability.text : (card.ability || '—');
  const bonus = typeof card.bonus === 'object'
    ? card.bonus.text
    : (card.bonus || clan.bonus || '—');
  const cond = card.abilityData?.condition || '';
  const typeBadge = (type === 'grand' || type === 'eco')
    ? `<span class="bcd-type type-${type}">${type.toUpperCase()}</span>`
    : '';
  const modal = ensureBattleCardModal();
  modal.querySelector('.bcd-body').innerHTML = `
    <div class="bcd-art-wrap" style="--cc:${cc}">
      <div class="bcd-art${imgSrc ? ' has-img' : ''}">
        ${imgSrc ? `<img src="${imgSrc}" alt="${card.name}" onerror="this.parentNode.classList.remove('has-img');this.remove()"/>` : ''}
        <div class="bcd-art-ph">${logo ? `<img src="${logo}" alt=""/>` : (clan.glyph || '◆')}</div>
      </div>
      <div class="bcd-art-vignette"></div>
    </div>
    <div class="bcd-info">
      <div class="bcd-header">
        <div class="bcd-name">${card.name}</div>
        <div class="bcd-rar">${rarNames[rar] || rar}</div>
      </div>
      <div class="bcd-clan-row">
        <span class="bcd-clan-dot" style="background:${cc}"></span>
        <span class="bcd-clan-name" style="color:${cc}">${clan.glyph || ''} ${(clan.name || card.clan || '').toUpperCase()}</span>
        ${typeBadge}
      </div>
      <div class="bcd-stars-row">${battleCardStars(card.stars)}</div>
      <div class="bcd-stats-row">
        <div class="bcd-stat-box">
          <div class="bcd-stat-num pow">${card.pow}</div>
          <div class="bcd-stat-lbl">PODER</div>
        </div>
        <div class="bcd-stat-divider"></div>
        <div class="bcd-stat-box">
          <div class="bcd-stat-num dmg">${card.dmg}</div>
          <div class="bcd-stat-lbl">DAÑO</div>
        </div>
      </div>
      <div class="bcd-section-lbl">HABILIDAD</div>
      <div class="bcd-ability-box">${cond ? `<span class="bcd-cond">${cond}:</span> ` : ''}${ability}</div>
      <div class="bcd-section-lbl">BONUS DE CLAN</div>
      <div class="bcd-bonus-box">${bonus}</div>
    </div>`;
  modal.classList.add('show');
}

function closeBattleCardDetail(){
  const modal = document.getElementById('battle-card-modal');
  if(modal) modal.classList.remove('show');
}
window.openBattleCardDetail = openBattleCardDetail;
window.closeBattleCardDetail = closeBattleCardDetail;

function showRoundBanner(text, kind){
  const b = document.getElementById('round-banner');
  if(!b) return;
  b.textContent = text;
  b.className = 'round-banner ' + (kind || '');
  void b.offsetWidth;
  b.classList.add('show');
  setTimeout(()=> b.classList.remove('show'), 1400);
}

function getCardCenter(el){
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width/2, y: r.top + r.height/2 };
}
