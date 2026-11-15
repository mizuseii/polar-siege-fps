// Every pixel of interface the player sees: health and armour, ammo and
// money, the round clock and score, the killfeed, the buy menu, the
// minimap, banners and the start / pause / match overlays.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    overlay: $('overlay'),
    title: $('overlay-title'),
    copy: $('overlay-copy'),
    play: $('play'),
    hud: $('hud'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    armorFill: $('armor-fill'),
    armorNum: $('armor-num'),
    ammoMag: $('ammo-mag'),
    ammoReserve: $('ammo-reserve'),
    weaponName: $('weapon-name'),
    money: $('money-value'),
    timer: $('timer-value'),
    scoreA: $('score-aurora'),
    scoreB: $('score-blizzard'),
    roundLabel: $('round-label'),
    killfeed: $('killfeed'),
    hint: $('hint-text'),
    bombText: $('bomb-text'),
    bombFill: $('bomb-fill'),
    bombBar: $('bomb-bar'),
    buy: $('buy-menu'),
    buyItems: $('buy-items'),
    buyMoney: $('buy-money'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    crosshair: $('crosshair'),
    hitmarker: $('hitmarker'),
    vignette: $('damage-vignette'),
    dmgDir: $('damage-dir'),
    minimap: $('minimap'),
    scope: $('scope-overlay'),
    grenades: $('grenades'),
  };
  let playCb = null;
  let buyCb = null;
  let bannerTimer = 0;
  let hitTimer = 0;

  els.play.addEventListener('click', () => {
    if (playCb) playCb();
  });

  function setHealth(h, armor) {
    els.healthFill.style.width = `${Math.max(0, h)}%`;
    els.healthNum.textContent = Math.ceil(h);
    els.armorFill.style.width = `${Math.max(0, armor)}%`;
    els.armorNum.textContent = Math.ceil(armor);
    els.healthFill.style.background = h <= 30 ? '#ff5a4a' : '#7fd4ff';
  }
  function setAmmo(mag, reserve, name) {
    els.ammoMag.textContent = mag;
    els.ammoReserve.textContent = `/ ${reserve}`;
    els.weaponName.textContent = name;
    els.ammoMag.parentElement.classList.toggle('empty', mag === 0);
  }
  function setMoney(m) {
    els.money.textContent = `$${m}`;
    if (els.buyMoney) els.buyMoney.textContent = `$${m}`;
  }
  function setTimer(seconds, phase) {
    const s = Math.max(0, Math.ceil(seconds));
    els.timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    els.timer.classList.toggle('buy', phase === 'buy');
    els.timer.classList.toggle('urgent', phase === 'combat' && s <= 10);
  }
  function setScore(a, b, round) {
    els.scoreA.textContent = a;
    els.scoreB.textContent = b;
    els.roundLabel.textContent = `ROUND ${round}`;
  }
  function killfeed(text, good) {
    const row = document.createElement('div');
    row.className = good ? 'kf good' : 'kf';
    row.textContent = text;
    els.killfeed.prepend(row);
    while (els.killfeed.children.length > 5) els.killfeed.lastChild.remove();
    setTimeout(() => row.remove(), 6000);
  }
  function hitMarker(kill) {
    els.hitmarker.classList.add('on');
    if (kill) els.hitmarker.classList.add('kill');
    hitTimer = performance.now() + (kill ? 260 : 120);
  }
  function hitMarkerTick(now) {
    if (now > hitTimer) els.hitmarker.classList.remove('on', 'kill');
  }
  function hint(text) {
    els.hint.textContent = text || '';
  }
  function bombStatus(text, progress) {
    els.bombText.textContent = text || '';
    els.bombBar.style.display = progress == null ? 'none' : 'block';
    if (progress != null) els.bombFill.style.width = `${Math.round(progress * 100)}%`;
  }
  function banner(title, sub, ms = 2600) {
    els.bannerTitle.textContent = title;
    els.bannerSub.textContent = sub || '';
    els.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => els.banner.classList.remove('show'), ms);
  }
  function showOverlay(kind, data = {}) {
    els.overlay.hidden = false;
    if (kind === 'start') {
      els.title.textContent = 'POLAR SIEGE';
      els.copy.textContent = 'Aurora-9 station, blue hour. You are AURORA: plant the charge at Site A (Reactor) or Site B (Comms), or eliminate all five BLIZZARD defenders. First to five rounds takes the station.';
      els.play.textContent = 'Click to play';
    } else if (kind === 'paused') {
      els.title.textContent = 'Paused';
      els.copy.textContent = 'The storm waits for no one. Click to return to the fight.';
      els.play.textContent = 'Resume';
    } else if (kind === 'match') {
      els.title.textContent = data.won ? 'STATION TAKEN' : 'STATION LOST';
      els.copy.textContent = data.won
        ? `AURORA takes Aurora-9, ${data.scoreA}–${data.scoreB}. The charge did its work.`
        : `BLIZZARD holds Aurora-9, ${data.scoreB}–${data.scoreA}. Regroup and run it back.`;
      els.play.textContent = 'Play again';
    }
  }
  function hideOverlay() {
    els.overlay.hidden = true;
  }
  function openBuy(items, money) {
    els.buyItems.innerHTML = '';
    for (const it of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'buy-row';
      row.innerHTML = `<span class="buy-key">${it.key}</span><span class="buy-name">${it.name}</span><span class="buy-desc">${it.desc}</span><span class="buy-price">${it.owned ? 'OWNED' : '$' + it.price}</span>`;
      if (it.owned || money < it.price) row.disabled = it.owned ? false : true;
      row.addEventListener('click', () => {
        if (buyCb) buyCb(it.id);
      });
      els.buyItems.appendChild(row);
    }
    setMoney(money);
    els.buy.classList.remove('hidden');
  }
  function closeBuy() {
    els.buy.classList.add('hidden');
  }
  function damageFlash(angleRad) {
    els.vignette.classList.add('hit');
    setTimeout(() => els.vignette.classList.remove('hit'), 220);
    els.dmgDir.style.transform = `translate(-50%, -50%) rotate(${angleRad}rad)`;
    els.dmgDir.classList.add('show');
    setTimeout(() => els.dmgDir.classList.remove('show'), 700);
  }
  function setScoped(on) {
    els.scope.classList.toggle('on', on);
    els.crosshair.style.display = on ? 'none' : 'block';
  }
  function setCrosshairSpread(px) {
    els.crosshair.style.setProperty('--gap', `${px}px`);
  }
  function setGrenades(n) {
    els.grenades.textContent = n;
  }
  function drawMinimap(player, bots, colliders, bomb) {
    const c = els.minimap;
    const ctx = c.getContext('2d');
    const W = c.width;
    const H = c.height;
    const sx = (x) => ((x + 28) / 56) * W;
    const sz = (z) => ((z + 22) / 44) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10,18,32,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#26334a';
    for (const col of colliders) {
      ctx.fillRect(sx(col.minX), sz(col.minZ), Math.max(2, sx(col.maxX) - sx(col.minX)), Math.max(2, sz(col.maxZ) - sz(col.minZ)));
    }
    for (const key of ['A', 'B']) {
      const site = key === 'A' ? { x: -20, z: -2.5 } : { x: 20, z: -2.5 };
      ctx.strokeStyle = '#ffb45c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx(site.x), sz(site.z), 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffb45c';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(key, sx(site.x) - 3, sz(site.z) + 3);
    }
    if (bomb && bomb.status === 'planted' && bomb.pos) {
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(sx(bomb.pos.x), sz(bomb.pos.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const now = performance.now();
    for (const b of bots) {
      if (!b.alive) continue;
      if (b.team === 'aurora') {
        ctx.fillStyle = '#7fd4ff';
      } else {
        if (now - (b.lastSeenAt || -100) * 1000 > 3000 && now - (b.lastFiredAt || -100) * 1000 > 3000) continue;
        ctx.fillStyle = '#ff5a4a';
      }
      ctx.beginPath();
      ctx.arc(sx(b.pos.x), sz(b.pos.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // the player, as an arrow
    const px = sx(player.position.x);
    const pz = sz(player.position.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-player.yaw + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    setHealth, setAmmo, setMoney, setTimer, setScore, killfeed, hitMarker,
    hitMarkerTick, hint, bombStatus, banner, showOverlay, hideOverlay,
    openBuy, closeBuy, damageFlash, setScoped, setCrosshairSpread, setGrenades, drawMinimap,
    onPlay(cb) { playCb = cb; },
    onBuy(cb) { buyCb = cb; },
  };
}
