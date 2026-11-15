// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the
// display's rate. ?shot=start|play|end with &seed=N sets up a deterministic
// frame for a capture, renders it twice, then freezes it and sets
// window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITES, SPAWNS } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeaponSet, WEAPONS } from './weapons.js';
import { createBots } from './bots.js';
import { createMatch } from './game.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createGrenades } from './grenades.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color('#0d1a2e'), 22, 95);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 220);
scene.add(camera);

const world = createWorld(scene);
const hud = createHud();
const audio = createAudio();
const player = createPlayer(world.colliders, SPAWNS.aurora[0]);
const weapons = createWeaponSet(camera);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;

// invisible cylinder the bots shoot at when they target the player
const playerHitbox = new THREE.Mesh(
  new THREE.CylinderGeometry(0.42, 0.42, 1.7, 8),
  new THREE.MeshBasicMaterial({ visible: false }),
);
playerHitbox.position.set(0, 0.85, 18);
scene.add(playerHitbox);

const playerAttacker = { name: 'You', team: 'aurora', kills: 0 };
const ctx = {
  player,
  playerHitbox,
  lastShotAt: -99,
  lastShotPos: null,
  bombPlanted: false,
  bombPos: null,
};
const tracers = [];
const sparks = [];
let explosionFx = null;
let lastBombBeep = 0;
let started = false;
let frozen = false;
let downShown = false;
let buyOpen = false;
let elapsed = 0;
let lastTime = performance.now();
let accumulator = 0;
let minimapAt = 0;
let fovTarget = 74;

const match = createMatch({
  onPhase(phase) {
    if (phase === 'buy') {
      openBuyMenu();
      hud.banner('BUY PHASE', 'Spend your money — round starts soon.');
    } else if (phase === 'combat') {
      closeBuyMenu();
      hud.banner(`ROUND ${match.state.round}`, 'Eliminate BLIZZARD or plant the charge.');
      hud.setTimer(100, 'combat');
    }
  },
  onRoundStart() {
    bots.spawnRound();
    player.reset(SPAWNS.aurora[0], player.state.money);
    weapons.refillAll();
    downShown = false;
    syncHud();
  },
  onRoundEnd(winner, reason) {
    const won = winner === 'aurora';
    player.state.money += won ? 1000 : 500;
    hud.setMoney(player.state.money);
    hud.banner(won ? 'ROUND WON' : 'ROUND LOST', reason, 3400);
    if (won) audio.roundWin();
    else audio.roundLose();
    hud.killfeed(`${won ? 'AURORA' : 'BLIZZARD'} takes round ${match.state.round} — ${reason}`, won);
  },
  onMatchEnd(winner) {
    const won = winner === 'aurora';
    hud.showOverlay('match', { won, scoreA: match.state.score.aurora, scoreB: match.state.score.blizzard });
    if (document.pointerLockElement) document.exitPointerLock();
  },
  onPlant(site) {
    player.state.money += 300;
    hud.setMoney(player.state.money);
    hud.banner('CHARGE PLANTED', `Site ${site} — defend it for 30 seconds.`);
    hud.killfeed('You planted the charge.', true);
    audio.plantBeep();
    ctx.bombPlanted = true;
    ctx.bombPos = match.state.bomb.pos;
  },
  onDefuse() {
    hud.banner('CHARGE DEFUSED', 'BLIZZARD shut the charge down.');
    ctx.bombPlanted = false;
    ctx.bombPos = null;
  },
  onExplode(pos) {
    spawnExplosion(pos);
    audio.explosion();
    ctx.bombPlanted = false;
    ctx.bombPos = null;
  },
});

const bots = createBots(scene, world, {
  onShot(bot, from, to, color) {
    spawnTracer(from, to, color);
    audio.shot(bot.weapon, true);
    ctx.lastShotAt = performance.now() / 1000;
    ctx.lastShotPos = { x: from.x, z: from.z };
    bot.lastFiredAt = performance.now();
  },
  onKill(killer, victim, isHead) {
    const killerName = killer ? killer.name : '???';
    const good = killer && killer.team === 'aurora';
    hud.killfeed(`${killerName} ▸ ${victim.name}${isHead ? '  [HEADSHOT]' : ''}`, good);
    if (killer === playerAttacker) {
      player.state.money += 300;
      hud.setMoney(player.state.money);
      audio.kill();
    }
  },
  onPlayerDamage(amount, fromPos) {
    if (!player.state.alive) return;
    const dealt = player.damage(amount);
    if (dealt <= 0) return;
    audio.hurt();
    const dx = fromPos.x - player.state.position.x;
    const dz = fromPos.z - player.state.position.z;
    const worldAngle = Math.atan2(dx, dz);
    const rel = worldAngle - player.viewYaw() + Math.PI;
    hud.damageFlash(rel);
    if (!player.state.alive && !downShown) {
      downShown = true;
      hud.banner('YOU ARE DOWN', 'Your squad fights on without you.');
    }
    syncHud();
  },
});

const flashes = []; // grenade blast flashes fading out
const grenades = createGrenades(scene, world, {
  allBots: () => bots.allBots(),
  playerPos: () => (player.state.alive ? player.state.position : null),
  onBotDamage: (bot, dmg, owner) => bots.damageBot(bot, dmg, false, owner),
  onPlayerDamage: (amount, fromPos) => {
    if (!player.state.alive) return;
    const dealt = player.damage(amount);
    if (dealt > 0) {
      audio.hurt();
      syncHud();
    }
  },
  onExplodeFx: () => {},
  onExplodeSound: () => audio.explosion(),
  onFlash: (flash, light) => flashes.push({ mesh: flash, light, life: 0.5 }),
});

function syncHud() {
  const w = weapons.state();
  hud.setHealth(player.state.health, player.state.armor);
  hud.setAmmo(w.mag, w.reserve, w.def.name);
  hud.setMoney(player.state.money);
  hud.setGrenades(grenades.count);
  hud.setScore(match.state.score.aurora, match.state.score.blizzard, Math.max(1, match.state.round));
}

function spawnTracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
  scene.add(line);
  tracers.push({ line, life: 0.09 });
}

function spawnSparks(point, n = 10) {
  const pos = new Float32Array(n * 3);
  const vel = [];
  for (let i = 0; i < n; i += 1) {
    pos[i * 3] = point.x;
    pos[i * 3 + 1] = point.y;
    pos[i * 3 + 2] = point.z;
    vel.push(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffd27f', size: 0.09, transparent: true, opacity: 1 }));
  scene.add(points);
  sparks.push({ points, vel, life: 0.35 });
}

function spawnExplosion(pos) {
  const geo = new THREE.SphereGeometry(1, 20, 14);
  const mat = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, 1.2, pos.z);
  scene.add(mesh);
  const light = new THREE.PointLight('#ff9a3c', 120, 30, 1.6);
  light.position.set(pos.x, 2.5, pos.z);
  scene.add(light);
  explosionFx = { mesh, light, life: 1.1 };
}

function openBuyMenu() {
  if (buyOpen || match.state.phase !== 'buy') return;
  const items = [
    { id: 'jackal', key: '2', name: WEAPONS.jackal.name, desc: 'Rapid SMG, close quarters', price: WEAPONS.jackal.price, owned: weapons.state().id === 'jackal' || false },
    { id: 'mammoth', key: '3', name: WEAPONS.mammoth.name, desc: 'Hard-hitting rifle', price: WEAPONS.mammoth.price, owned: false },
    { id: 'longbow', key: '4', name: WEAPONS.longbow.name, desc: 'One-shot sniper, scoped', price: WEAPONS.longbow.price, owned: false },
    { id: 'armor', key: '5', name: 'Kevlar Vest', desc: 'Absorbs half of incoming damage', price: 650, owned: player.state.armor > 0 },
    { id: 'grenade', key: '6', name: 'Frag Grenade', desc: 'Explosive — throw with G', price: 300, owned: grenades.count >= 3 },
  ];
  // mark owned from the weapon set
  const ownedIds = new Set();
  for (const id of weapons.ids) {
    // owned state is internal; re-derive by trying a free switch is not
    // possible, so track it here from purchases this match
    if (purchased.has(id)) ownedIds.add(id);
  }
  for (const it of items) if (ownedIds.has(it.id)) it.owned = true;
  hud.openBuy(items, player.state.money);
  buyOpen = true;
}
const purchased = new Set(['kestrel']);

function closeBuyMenu() {
  if (!buyOpen) return;
  hud.closeBuy();
  buyOpen = false;
}

hud.onBuy((id) => {
  if (id === 'grenade') {
    if (player.state.money < 300 || grenades.count >= 3) return;
    player.state.money -= 300;
    grenades.add(1);
    hud.setMoney(player.state.money);
    hud.setGrenades(grenades.count);
    openBuyMenuRefresh();
    return;
  }
  if (id === 'armor') {
    if (player.state.money < 650 || player.state.armor > 0) return;
    player.state.money -= 650;
    player.state.armor = 50;
    hud.setMoney(player.state.money);
    syncHud();
    openBuyMenuRefresh();
    return;
  }
  const def = WEAPONS[id];
  if (!def || player.state.money < def.price || purchased.has(id)) return;
  player.state.money -= def.price;
  weapons.buy(id);
  purchased.add(id);
  weapons.switchTo(id, performance.now());
  hud.setMoney(player.state.money);
  syncHud();
  openBuyMenuRefresh();
});

function openBuyMenuRefresh() {
  buyOpen = false;
  openBuyMenu();
}

hud.onPlay(() => {
  audio.unlock();
  if (match.state.phase === 'lobby') {
    match.startMatch();
  } else if (match.state.phase === 'matchEnd') {
    player.state.money = 800;
    purchased.clear();
    purchased.add('kestrel');
    weapons.resetShop();
    match.startMatch();
  }
  input.requestLock();
});

const input = createInput(renderer.domElement, (locked) => {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
    closeBuyMenu();
  } else if (match.state.phase === 'combat' && player.state.alive) {
    hud.showOverlay('paused');
  }
});

function botHitMeshes() {
  const out = [];
  for (const b of bots.allBots()) if (b.alive) out.push(...b.hitMeshes);
  return out;
}

function shootPlayer(now) {
  const res = weapons.fire(now);
  if (!res) return;
  if (res.empty) {
    audio.dryfire();
    syncHud();
    return;
  }
  const spread = res.spread + player.groundSpeed() * 0.0016 + (input.state.scoped ? -0.004 : 0);
  camera.getWorldDirection(_dir);
  _dir.x += (random() * 2 - 1) * spread;
  _dir.y += (random() * 2 - 1) * spread;
  _dir.z += (random() * 2 - 1) * spread;
  _dir.normalize();
  raycaster.set(camera.position, _dir);
  const targets = [...botHitMeshes(), ...world.shootables];
  const hit = raycaster.intersectObjects(targets, false)[0];
  const muzzle = weapons.muzzleWorld(new THREE.Vector3());
  const end = hit ? hit.point.clone() : camera.position.clone().add(_dir.clone().multiplyScalar(60));
  spawnTracer(muzzle, end, res.tracer);
  audio.shot(weapons.state().id);
  ctx.lastShotAt = now / 1000;
  ctx.lastShotPos = { x: player.state.position.x, z: player.state.position.z };
  player.addRecoil(weapons.kickOf(), (random() * 2 - 1) * 0.004);
  if (hit && hit.object.userData && hit.object.userData.bot) {
    const victim = hit.object.userData.bot;
    const isHead = hit.object.userData.part === 'head';
    const dmg = res.damage * (isHead ? res.headMult : 1);
    bots.damageBot(victim, dmg, isHead, playerAttacker);
    hud.hitMarker(!victim.alive);
    audio.hit();
    spawnSparks(hit.point, 8);
  } else if (hit) {
    spawnSparks(hit.point, 6);
  }
  syncHud();
}

const _dir = new THREE.Vector3();
const _eye = new THREE.Vector3();

function syncCamera() {
  camera.position.set(player.state.position.x, player.state.position.y + player.state.eye, player.state.position.z);
  camera.rotation.set(player.viewPitch(), player.viewYaw(), 0, 'YXZ');
}

function step(dt, now) {
  elapsed += dt;
  const phase = match.state.phase;
  if (phase === 'buy' || phase === 'combat') {
    const look = input.takeLook();
    player.look(look.x, look.y);
    player.step(dt, input.state.keys);
    if (input.state.firing && player.state.alive) shootPlayer(now);
    if (input.consumePressed('KeyR')) {
      if (weapons.reload(now)) audio.reload();
    }
    for (const [key, id] of [['Digit1', 'kestrel'], ['Digit2', 'jackal'], ['Digit3', 'mammoth'], ['Digit4', 'longbow']]) {
      if (input.consumePressed(key)) {
        if (weapons.switchTo(id, now)) syncHud();
      }
    }
    if (input.consumePressed('KeyG') && player.state.alive) {
      camera.getWorldDirection(_dir);
      const origin = camera.position.clone().add(_dir.clone().multiplyScalar(0.5));
      origin.y -= 0.1;
      if (grenades.throwGrenade(origin, _dir.clone(), playerAttacker)) hud.setGrenades(grenades.count);
    }
    if (input.consumePressed('KeyB') && phase === 'buy') {
      if (buyOpen) closeBuyMenu();
      else openBuyMenu();
    }
    if (input.consumePressed('KeyB') && phase === 'combat') closeBuyMenu();
    // plant / defuse
    const holdingE = input.state.keys.has('KeyE');
    match.plantTick(dt, player.state.position, holdingE && player.state.alive);
    const bomb = match.state.bomb;
    if (bomb.status === 'planted') {
      const defusing = bots.allBots().some((b) => b.alive && b.team === 'blizzard' && b.state === 'defuse'
        && Math.hypot(b.pos.x - bomb.pos.x, b.pos.z - bomb.pos.z) < 1.6);
      match.defuseTick(dt, defusing);
      if (now - lastBombBeep > Math.max(250, bomb.fuse * 22)) {
        lastBombBeep = now;
        audio.bombBeep();
      }
    }
    // scope
    const wantScope = input.state.scoped && weapons.state().id === 'longbow';
    fovTarget = wantScope ? 30 : 74;
    hud.setScoped(wantScope);
    // spread feedback
    hud.setCrosshairSpread(4 + player.groundSpeed() * 1.6 + (weapons.state().reloading ? 4 : 0));
    audio.step(dt, player.groundSpeed() > 0.5, player.groundSpeed());
  }
  weapons.step(now, dt);
  bots.step(dt, now / 1000, ctx);
  grenades.step(dt);
  match.step(dt);
  world.update(dt, elapsed);
  // round-end checks
  if (match.state.phase === 'combat') {
    const bliz = bots.aliveCount('blizzard');
    const aur = bots.aliveCount('aurora') + (player.state.alive ? 1 : 0);
    const bomb = match.state.bomb;
    if (bliz === 0 && bomb.status !== 'planted') match.endRound('aurora', 'BLIZZARD team eliminated.');
    else if (aur === 0 && bomb.status !== 'planted') match.endRound('blizzard', 'AURORA team eliminated.');
    else if (aur === 0 && bomb.status === 'planted') match.endRound('blizzard', 'AURORA team eliminated before the fuse ran out.');
  }
  // hint text
  if (match.state.phase === 'combat') {
    const site = match.siteAt(player.state.position);
    const bomb = match.state.bomb;
    if (bomb.status === 'carried' && site) hud.hint(`Hold E to plant the charge at Site ${site}`);
    else if (bomb.status === 'carried') hud.hint('Plant the charge at Site A (Reactor) or Site B (Comms)');
    else if (bomb.status === 'planted') hud.hint(`Charge planted at Site ${bomb.site} — ${Math.ceil(bomb.fuse)}s to detonation`);
    else hud.hint('');
    if (bomb.status === 'carried' && site) hud.bombStatus('PLANTING…', bomb.plantProgress / 3);
    else if (bomb.status === 'planted') hud.bombStatus(`FUSE ${Math.ceil(bomb.fuse)}s`, 1 - bomb.fuse / 30);
    else hud.bombStatus('', null);
  } else {
    hud.hint('');
    hud.bombStatus('', null);
  }
  hud.setTimer(match.state.timer, match.state.phase);
  if (elapsed - minimapAt > 0.25) {
    minimapAt = elapsed;
    hud.drawMinimap(player.state, bots.allBots(), world.colliders, match.state.bomb);
  }
  // fx
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    tracers[i].life -= dt;
    tracers[i].line.material.opacity = Math.max(0, tracers[i].life / 0.09);
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers[i].line.material.dispose();
      tracers.splice(i, 1);
    }
  }
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const s = sparks[i];
    s.life -= dt;
    const p = s.points.geometry.attributes.position;
    for (let j = 0; j < p.count; j += 1) {
      p.setXYZ(j, p.getX(j) + s.vel[j].x * dt, p.getY(j) + s.vel[j].y * dt - 4 * dt * dt, p.getZ(j) + s.vel[j].z * dt);
      s.vel[j].y -= 9 * dt;
    }
    p.needsUpdate = true;
    s.points.material.opacity = Math.max(0, s.life / 0.35);
    if (s.life <= 0) {
      scene.remove(s.points);
      s.points.geometry.dispose();
      s.points.material.dispose();
      sparks.splice(i, 1);
    }
  }
  if (explosionFx) {
    explosionFx.life -= dt;
    const k = 1 - explosionFx.life / 1.1;
    explosionFx.mesh.scale.setScalar(1 + k * 14);
    explosionFx.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    explosionFx.light.intensity = 120 * (1 - k);
    if (explosionFx.life <= 0) {
      scene.remove(explosionFx.mesh);
      scene.remove(explosionFx.light);
      explosionFx = null;
    }
  }
  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    const f = flashes[i];
    f.life -= dt;
    const k = 1 - f.life / 0.5;
    f.mesh.scale.setScalar(1 + k * 6);
    f.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    f.light.intensity = 150 * (1 - k);
    if (f.life <= 0) {
      scene.remove(f.mesh);
      scene.remove(f.light);
      f.mesh.geometry.dispose();
      f.mesh.material.dispose();
      flashes.splice(i, 1);
    }
  }
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();
  playerHitbox.position.set(player.state.position.x, player.state.position.y + 0.85, player.state.position.z);
  hud.hitMarkerTick(now);
  syncCamera();
}

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min((nowMs - lastTime) / 1000, 0.1);
  lastTime = nowMs;
  if (!frozen) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP, nowMs);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
  input.endFrame();
}

function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP, performance.now());
}

function aimCameraAt(point) {
  const eye = new THREE.Vector3(player.state.position.x, player.state.position.y + player.state.eye, player.state.position.z);
  const dx = point.x - eye.x;
  const dy = point.y - eye.y;
  const dz = point.z - eye.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  player.state.yaw = Math.atan2(-dx, -dz);
  player.state.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncCamera();
}

function runShot(name) {
  hud.hideOverlay();
  closeBuyMenu();
  match.startMatch();
  // stop the buy clock so the staged frame never flips phase, and keep the
  // buy menu out of the frame — the overlay / the fight is the shot
  match.state.phase = 'combat';
  match.state.timer = 83;
  closeBuyMenu();
  const bliz = bots.allBots().filter((b) => b.team === 'blizzard');
  const aur = bots.allBots().filter((b) => b.team === 'aurora');
  if (name === 'start') {
    player.reset(SPAWNS.aurora[0], 800);
    player.state.yaw = 0;
    syncCamera();
    hud.showOverlay('start');
    hud.setScore(0, 0, 1);
    hud.setTimer(100, 'buy');
  } else if (name === 'play') {
    player.reset([0, 10], 2400);
    player.state.health = 82;
    player.state.armor = 25;
    weapons.buy('mammoth');
    purchased.add('mammoth');
    weapons.switchTo('mammoth', performance.now());
    weapons.refillAll();
    // stage the fight: one BLIZZARD bot in the open near the hab module,
    // one AURORA friendly covering the west lane
    const foe = bliz[0];
    foe.pos.set(-7, 0, 1);
    foe.yaw = Math.PI / 2;
    foe.group.position.copy(foe.pos);
    foe.group.rotation.y = foe.yaw;
    const friend = aur[0];
    friend.pos.set(-5, 0, 7);
    friend.yaw = -0.6;
    friend.group.position.copy(friend.pos);
    friend.group.rotation.y = friend.yaw;
    match.state.score = { aurora: 1, blizzard: 0 };
    match.state.round = 2;
    settle(15);
    aimCameraAt(new THREE.Vector3(foe.pos.x, foe.pos.y + 1.3, foe.pos.z));
    shootPlayer(performance.now());
    settle(2);
    hud.setHealth(82, 25);
    hud.setTimer(83, 'combat');
    hud.setScore(1, 0, 2);
    hud.killfeed('Vega ▸ Rook', true);
  } else {
    // end: round won at Site A, charge just detonated
    player.reset([2, 8], 3100);
    match.state.score = { aurora: 3, blizzard: 2 };
    match.state.round = 6;
    const foe = bliz[0];
    foe.pos.set(-16, 0, -4);
    foe.group.position.copy(foe.pos);
    spawnExplosion({ x: -20, z: -2.5 });
    settle(10);
    aimCameraAt(new THREE.Vector3(-20, 1.5, -2.5));
    hud.setScore(3, 2, 6);
    hud.setTimer(0, 'combat');
    hud.banner('ROUND WON', 'Charge detonated at Site A.', 9000);
  }
  syncHud();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
syncHud();
if (shot) runShot(shot);
else {
  hud.showOverlay('start');
  requestAnimationFrame(frame);
}
