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
