// The armoury: four buyable weapons, each with its own viewmodel built
// from boxes, its own kick, and its own sound profile (see audio.js).
import * as THREE from 'three';

export const WEAPONS = {
  kestrel: {
    id: 'kestrel', name: 'P12 Kestrel', price: 0, damage: 34, headMult: 3,
    mag: 12, reserve: 48, rate: 0.22, spread: 0.011, reload: 1.4,
    auto: false, zoom: 0, kick: 0.011, barrel: 0.22, tracer: '#ffd27f',
  },
  jackal: {
    id: 'jackal', name: 'MP7 Jackal', price: 600, damage: 26, headMult: 2,
    mag: 30, reserve: 120, rate: 0.085, spread: 0.02, reload: 2.0,
    auto: true, zoom: 0, kick: 0.007, barrel: 0.34, tracer: '#ffe9a8',
  },
  mammoth: {
    id: 'mammoth', name: 'VK-47 Mammoth', price: 2700, damage: 40, headMult: 2.5,
    mag: 30, reserve: 90, rate: 0.11, spread: 0.008, reload: 2.4,
    auto: true, zoom: 0, kick: 0.013, barrel: 0.52, tracer: '#ffb45c',
  },
  longbow: {
    id: 'longbow', name: 'LB-50 Longbow', price: 4750, damage: 110, headMult: 4,
    mag: 5, reserve: 15, rate: 1.1, spread: 0.001, reload: 3.0,
    auto: false, zoom: 30, kick: 0.03, barrel: 0.78, tracer: '#9fe8ff',
  },
};

const ORDER = ['kestrel', 'jackal', 'mammoth', 'longbow'];

function buildViewmodel(def) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#232a33', roughness: 0.45, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: '#14181e', roughness: 0.6, metalness: 0.5 });
  const accent = new THREE.MeshStandardMaterial({ color: '#7fd4ff', roughness: 0.4, metalness: 0.4, emissive: '#1a4a66', emissiveIntensity: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.34 + def.barrel * 0.4), metal);
  body.position.set(0, 0, -0.1);
  group.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, def.barrel, 10), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.28 - def.barrel * 0.4);
  group.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.09), dark);
  grip.position.set(0, -0.12, 0.04);
  grip.rotation.x = 0.25;
  group.add(grip);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.06), accent);
  sight.position.set(0, 0.09, -0.12);
  group.add(sight);
  if (def.id === 'longbow') {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), dark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.11, -0.1);
    group.add(scope);
  }
  if (def.id === 'mammoth' || def.id === 'jackal') {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.07), dark);
    mag.position.set(0, -0.13, -0.08);
    mag.rotation.x = 0.12;
    group.add(mag);
  }
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.22),
    new THREE.MeshBasicMaterial({ color: '#ffd27f', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  flash.position.set(0, 0.02, -0.3 - def.barrel * 0.8);
  group.add(flash);
  const light = new THREE.PointLight('#ffb45c', 0, 9, 2);
  light.position.set(0, 0, -0.3 - def.barrel * 0.8);
  group.add(light);
  return { group, flash, light };
}

export function createWeaponSet(camera) {
  const rig = new THREE.Group();
  rig.position.set(0.26, -0.24, -0.42);
  camera.add(rig);
  const models = {};
  for (const id of ORDER) {
    const m = buildViewmodel(WEAPONS[id]);
    m.group.visible = false;
    rig.add(m.group);
    models[id] = m;
  }
  const ammo = {};
  for (const id of ORDER) {
    ammo[id] = { owned: id === 'kestrel', mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  }
  let current = 'kestrel';
  models.kestrel.group.visible = true;
  let nextShotAt = 0;
  let reloadingUntil = 0;
  let kick = 0;
  let reloadDip = 0;
  let flashUntil = 0;

  function def() {
    return WEAPONS[current];
  }
  function state() {
    return { id: current, def: def(), mag: ammo[current].mag, reserve: ammo[current].reserve, owned: ammo[current].owned, reloading: performance.now() < reloadingUntil };
  }
  function switchTo(id, now) {
    if (!ammo[id].owned || id === current) return false;
    models[current].group.visible = false;
    current = id;
    models[current].group.visible = true;
    reloadingUntil = 0;
    nextShotAt = now + 0.25;
    return true;
  }
  function buy(id) {
    if (ammo[id].owned) return 0;
    ammo[id].owned = true;
    ammo[id].mag = WEAPONS[id].mag;
    ammo[id].reserve = WEAPONS[id].reserve;
    return WEAPONS[id].price;
  }
  function fire(now) {
    if (now < nextShotAt || now < reloadingUntil) return null;
    const a = ammo[current];
    if (a.mag <= 0) {
      reload(now);
      return { empty: true };
    }
    a.mag -= 1;
    nextShotAt = now + def().rate * 1000;
    kick = 1;
    flashUntil = now + 55;
    return { damage: def().damage, headMult: def().headMult, spread: def().spread, tracer: def().tracer };
  }
  function reload(now) {
    const a = ammo[current];
    if (now < reloadingUntil || a.mag >= def().mag || a.reserve <= 0) return false;
    reloadingUntil = now + def().reload * 1000;
    reloadDip = 1;
    return true;
  }
  function step(now, dt) {
    if (now >= reloadingUntil && reloadingUntil > 0) {
      const a = ammo[current];
      const need = def().mag - a.mag;
      const take = Math.min(need, a.reserve);
      a.mag += take;
      a.reserve -= take;
      reloadingUntil = 0;
    }
    kick = Math.max(0, kick - dt * 6);
    reloadDip = Math.max(0, reloadDip - dt * 1.4);
    const m = models[current];
    m.group.position.z = kick * 0.09;
    m.group.rotation.x = kick * 0.14 + reloadDip * 0.55;
    const flashing = now < flashUntil;
    m.flash.material.opacity = flashing ? 0.9 : 0;
    m.flash.rotation.z = Math.random() * Math.PI;
    m.light.intensity = flashing ? 26 : 0;
  }
  function refillAll() {
    for (const id of ORDER) {
      if (!ammo[id].owned) continue;
      ammo[id].mag = WEAPONS[id].mag;
      ammo[id].reserve = WEAPONS[id].reserve;
    }
    reloadingUntil = 0;
  }
  function resetShop() {
    for (const id of ORDER) {
      ammo[id] = { owned: id === 'kestrel', mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
    }
    models[current].group.visible = false;
    current = 'kestrel';
    models.kestrel.group.visible = true;
    reloadingUntil = 0;
    nextShotAt = 0;
  }
  function muzzleWorld(out) {
    const m = models[current];
    return m.flash.getWorldPosition(out);
  }
  return {
    state, switchTo, buy, fire, reload, step, refillAll, resetShop, muzzleWorld,
    ids: ORDER,
    kickOf() {
      return def().kick;
    },
  };
}
