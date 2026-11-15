// Frag grenades: a thrown sphere with an arc, a bounce off walls and the
// floor, a 1.4 s fuse, and a blast that hurts bots and the player alike.
// One module, one job: flight and explosion. Damage goes out through hooks
// so this file never touches match state.
import * as THREE from 'three';
import { collideCircle } from './world.js';

const GRAVITY = -14;
const FUSE = 1.4;
const BLAST_RADIUS = 5.5;
const MAX_DAMAGE = 120;

export function createGrenades(scene, world, hooks) {
  const live = [];
  let count = 1;

  const geo = new THREE.SphereGeometry(0.09, 12, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2e4a2a, roughness: 0.5, metalness: 0.4 });

  function throwGrenade(origin, dir, owner) {
    if (count <= 0) return false;
    count -= 1;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    scene.add(mesh);
    const vel = dir.clone().multiplyScalar(16);
    vel.y += 4.5;
    live.push({ mesh, vel, fuse: FUSE, owner });
    return true;
  }

  function explode(g) {
    const pos = g.mesh.position.clone();
    scene.remove(g.mesh);
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.9 }),
    );
    flash.position.set(pos.x, Math.max(0.5, pos.y), pos.z);
    scene.add(flash);
    const light = new THREE.PointLight(0xffc46b, 150, 26, 1.6);
    light.position.set(pos.x, 2, pos.z);
    scene.add(light);
    hooks.onExplodeFx(pos);
    hooks.onExplodeSound();
    // damage bots in the blast, falloff with distance
    for (const b of hooks.allBots()) {
      if (!b.alive) continue;
      const d = Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z);
      if (d > BLAST_RADIUS) continue;
      const dmg = Math.round(MAX_DAMAGE * (1 - d / BLAST_RADIUS) + 20);
      hooks.onBotDamage(b, dmg, g.owner);
    }
    // the player is not blast-proof, whoever threw it
    const p = hooks.playerPos();
    if (p) {
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < BLAST_RADIUS * 0.8) {
        const dmg = Math.round(60 * (1 - d / (BLAST_RADIUS * 0.8)));
        if (dmg > 0) hooks.onPlayerDamage(dmg, pos);
      }
    }
    // the flash fades in the caller's step via the fx list it owns
    hooks.onFlash(flash, light);
  }

  function step(dt) {
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const g = live[i];
      g.fuse -= dt;
      g.vel.y += GRAVITY * dt;
      const p = g.mesh.position;
      p.x += g.vel.x * dt;
      p.y += g.vel.y * dt;
      p.z += g.vel.z * dt;
      if (p.y <= 0.12) {
        p.y = 0.12;
        if (Math.abs(g.vel.y) > 1.2) g.vel.y = -g.vel.y * 0.4;
        else g.vel.y = 0;
        g.vel.x *= 0.6;
        g.vel.z *= 0.6;
      }
      const hitWall = collideCircle(p, 0.12, world.colliders);
      if (hitWall) {
        g.vel.x *= -0.35;
        g.vel.z *= -0.35;
      }
      if (g.fuse <= 0) {
        explode(g);
        live.splice(i, 1);
      }
    }
  }

  return {
    throwGrenade,
    step,
    get count() { return count; },
    add(n) { count = Math.min(3, count + n); },
    reset() { count = 1; for (const g of live) scene.remove(g.mesh); live.length = 0; },
  };
}
