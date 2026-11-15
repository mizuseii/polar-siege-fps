// Aurora-9 station: a 56 by 44 metre arctic compound at blue hour.
// AURORA attacks from the south, BLIZZARD defends from the north. Site A
// is the reactor in the west, site B the comms array in the east, joined by
// a frozen courtyard and two side lanes. Every box is a collider for
// players and bots and a surface a bullet stops on.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import {
  auroraTexture, containerTexture, crateTexture, hazardTexture,
  panelTexture, signTexture, skyTexture, snowTexture,
} from './textures.js';

export const SITES = {
  A: { center: new THREE.Vector3(-20, 0, -2.5), radius: 4 },
  B: { center: new THREE.Vector3(20, 0, -2.5), radius: 4 },
};

export const SPAWNS = {
  aurora: [[0, 18], [-3, 18.5], [3, 18.5], [-6, 17], [6, 17]],
  blizzard: [[0, -18], [-3, -18.5], [3, -18.5], [-6, -17], [6, -17]],
};

// Waypoint graph the bots walk: nodes are [x, z], edges join neighbours
// with a clear lane.
export const WAYPOINTS = [
  [0, 18], [-8, 18], [8, 18],
  [-14, 12], [0, 12], [14, 12],
  [-14, 2], [0, 2], [14, 2],
  [-14, -8], [0, -8], [14, -8],
  [-20, -2.5], [20, -2.5],
  [-8, -17], [8, -17], [0, -18],
];
export const EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 5], [0, 4],
  [3, 6], [4, 7], [5, 8], [3, 4], [4, 5],
  [6, 9], [7, 10], [8, 11], [6, 7], [7, 8],
  [9, 10], [10, 11], [9, 12], [11, 13],
  [12, 9], [13, 11], [9, 14], [11, 15],
  [14, 16], [15, 16], [14, 10], [15, 10],
];

export function createWorld(scene) {
  const colliders = [];
  const shootables = [];
  const animated = { auroras: [], snow: null, snowVel: null };

  const snowTex = snowTexture();
  const wallTex = panelTexture('#6d7d8f', '#46545f');
  const darkTex = panelTexture('#4a5866', '#333f4c');
  const rustTex = containerTexture('#7a4a34');
  const blueTex = containerTexture('#3d5a74');
  const crateTex = crateTexture();
  const hazardTex = hazardTexture();

  function box(cx, cz, w, d, h, mat, y0 = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(cx, y0 + h / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    shootables.push(m);
    return m;
  }

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 44),
    new THREE.MeshStandardMaterial({ map: snowTex, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  shootables.push(ground);

  // perimeter walls
  box(0, -22.3, 57.2, 0.6, 3.4, wallTex);
  box(0, 22.3, 57.2, 0.6, 3.4, wallTex);
  box(-28.3, 0, 0.6, 45.2, 3.4, wallTex);
  box(28.3, 0, 0.6, 45.2, 3.4, wallTex);

  // reactor block (Site A) and comms block (Site B)
  const reactor = box(-20, -8, 10, 8, 5, darkTex);
  reactor.material = reactor.material;
  box(20, -8, 10, 7, 4.5, darkTex);
  // habitation module, centre
  box(0, -2, 14, 8, 4, wallTex);
  // containers, mid courtyard
  box(-1, 9.25, 6, 2.5, 2.6, rustTex);
  box(-1, 9.25, 6, 2.5, 2.6, blueTex, 2.6);
  box(11, 7.25, 6, 2.5, 2.6, blueTex);
  // crates as cover
  const crateSpots = [[-10, 2, 1.6], [-6, 10, 1.2], [4, 12, 1.6], [12, -2, 1.4], [-16, -14, 1.6], [16, 12, 1.2], [0, 14, 1.8], [-2, -12, 1.4], [-24, 6, 1.5], [24, 6, 1.5]];
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 });
  for (const [x, z, s] of crateSpots) box(x, z, s, s, s, crateMat);
  // fuel drums by the reactor
  const drumMat = new THREE.MeshStandardMaterial({ color: '#8a2f28', roughness: 0.6, metalness: 0.4 });
  for (const [x, z] of [[-14.2, -5.5], [-13.2, -6.4], [-14.2, -7.3]]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), drumMat);
    drum.position.set(x, 0.55, z);
    drum.castShadow = true;
    scene.add(drum);
    colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45 });
    shootables.push(drum);
  }
  // watchtower legs, north-west of mid
  const legMat = new THREE.MeshStandardMaterial({ color: '#3c4a5c', roughness: 0.7, metalness: 0.3 });
  for (const [x, z] of [[-13, 5], [-11, 5], [-13, 7], [-11, 7]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.4, 0.25), legMat);
    leg.position.set(x, 2.2, z);
    leg.castShadow = true;
    scene.add(leg);
    colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    shootables.push(leg);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 3), legMat);
  deck.position.set(-12, 4.5, 6);
  deck.castShadow = true;
  scene.add(deck);
  shootables.push(deck);

  // site rings + signs
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffb45c', transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  for (const key of ['A', 'B']) {
    const c = SITES[key].center;
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.5, 4, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(c.x, 0.03, c.z);
    scene.add(ring);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.1),
      new THREE.MeshBasicMaterial({ map: signTexture(`SITE ${key}`, key === 'A' ? 'REACTOR' : 'COMMS ARRAY') }),
    );
    sign.position.set(c.x, 3.4, key === 'A' ? -3.9 : -4.4);
    scene.add(sign);
  }
  // hazard strip at the south gate
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.8), new THREE.MeshBasicMaterial({ map: hazardTex }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.03, 21.6);
  scene.add(strip);

  // warm window glow on the hab module and reactor
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffb45c' });
  for (const [x, y, z, ry] of [[-4, 2.4, 2.05, 0], [4, 2.4, 2.05, 0], [-24.5, 2.6, -3.9, 0], [24.5, 2.4, -4.4, 0]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), winMat);
    win.position.set(x, y, z);
    win.rotation.y = ry;
    scene.add(win);
  }
  for (const [x, z] of [[-20, -3.6], [20, -4.1], [0, 2.2], [-12, 6]]) {
    const lamp = new THREE.PointLight('#ffb45c', 14, 13, 2);
    lamp.position.set(x, 3.1, z);
    scene.add(lamp);
  }

  // sky dome, stars, moon, aurora
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(130, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 600; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.12 + Math.random() * 1.3;
    const r = 120;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#cfe0ff', size: 0.9, sizeAttenuation: false, fog: false })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: '#e6efff', fog: false }));
  moon.position.set(-70, 62, -90);
  moon.lookAt(0, 0, 0);
  scene.add(moon);

  const aurTex = auroraTexture();
  for (let i = 0; i < 3; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      map: aurTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const band = new THREE.Mesh(new THREE.PlaneGeometry(90, 10 + i * 4), mat);
    band.position.set(-20 + i * 22, 34 + i * 5, -70 - i * 8);
    band.rotation.set(0.25, 0.3 - i * 0.25, 0.12 * i);
    scene.add(band);
    animated.auroras.push({ mesh: band, phase: i * 2.1, base: 0.35 + i * 0.08 });
  }

  // snowfall
  const snowCount = 2400;
  const pos = new Float32Array(snowCount * 3);
  const vel = new Float32Array(snowCount);
  for (let i = 0; i < snowCount; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 1] = Math.random() * 24;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 56;
    vel[i] = 1.2 + Math.random() * 2.2;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.14, transparent: true, opacity: 0.9 }));
  scene.add(snow);
  animated.snow = snow;
  animated.snowVel = vel;

  // lights
  scene.add(new THREE.HemisphereLight('#9db8dd', '#e8eef5', 0.55));
  const moonLight = new THREE.DirectionalLight('#bcd0ff', 1.0);
  moonLight.position.set(30, 42, -18);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -35;
  moonLight.shadow.camera.right = 35;
  moonLight.shadow.camera.top = 35;
  moonLight.shadow.camera.bottom = -35;
  moonLight.shadow.camera.far = 120;
  scene.add(moonLight);

  function update(dt, t) {
    for (const a of animated.auroras) {
      a.mesh.material.opacity = a.base + Math.sin(t * 0.35 + a.phase) * 0.18;
      a.mesh.rotation.z = 0.05 * Math.sin(t * 0.12 + a.phase);
    }
    const p = animated.snow.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      let y = p.getY(i) - animated.snowVel[i] * dt;
      let x = p.getX(i) + dt * 1.6;
      if (y < 0) { y = 24; x = (Math.random() - 0.5) * 70; }
      if (x > 35) x = -35;
      p.setY(i, y);
      p.setX(i, x);
    }
    p.needsUpdate = true;
  }

  return { colliders, shootables, update };
}

// Push a circle (x, z, radius) out of every AABB it overlaps. Returns true
// when a push happened.
export function collideCircle(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration
        const pl = pos.x - c.minX;
        const pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ;
        const pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return hit;
}
