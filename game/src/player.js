// The player: a capsule that walks, sprints, crouches and jumps across the
// station, slides along walls, and takes damage through armour first.
import * as THREE from 'three';
import { collideCircle } from './world.js';

const RADIUS = 0.42;
const EYE_STAND = 1.62;
const EYE_CROUCH = 1.12;
const WALK = 4.6;
const SPRINT = 6.4;
const CROUCH = 2.4;
const GRAVITY = -15;
const JUMP_VEL = 5.4;

export function createPlayer(colliders, spawn) {
  const state = {
    position: new THREE.Vector3(spawn[0], 0, spawn[1]),
    yaw: 0,
    pitch: 0,
    eye: EYE_STAND,
    velY: 0,
    onGround: true,
    crouched: false,
    health: 100,
    armor: 0,
    money: 800,
    alive: true,
    moveSpeed: 0,
  };

  let recoilPitch = 0;
  let recoilYaw = 0;

  function step(dt, keys) {
    if (!state.alive) return;
    const sprinting = keys.has('ShiftLeft') && !state.crouched;
    state.crouched = keys.has('ControlLeft') || keys.has('KeyC');
    const targetEye = state.crouched ? EYE_CROUCH : EYE_STAND;
    state.eye += (targetEye - state.eye) * Math.min(1, dt * 12);

    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);
    let fx = 0;
    let fz = 0;
    if (keys.has('KeyW')) { fx -= sin; fz -= cos; }
    if (keys.has('KeyS')) { fx += sin; fz += cos; }
    if (keys.has('KeyA')) { fx -= cos; fz += sin; }
    if (keys.has('KeyD')) { fx += cos; fz -= sin; }
    const len = Math.hypot(fx, fz) || 1;
    const speed = state.crouched ? CROUCH : sprinting && keys.has('KeyW') ? SPRINT : WALK;
    const mx = (fx / len) * speed * dt;
    const mz = (fz / len) * speed * dt;
    state.moveSpeed = (fx !== 0 || fz !== 0) ? speed : 0;

    state.position.x += mx;
    collideCircle(state.position, RADIUS, colliders);
    state.position.z += mz;
    collideCircle(state.position, RADIUS, colliders);

    if (keys.has('Space') && state.onGround) {
      state.velY = JUMP_VEL;
      state.onGround = false;
    }
    state.velY += GRAVITY * dt;
    state.position.y += state.velY * dt;
    if (state.position.y <= 0) {
      state.position.y = 0;
      state.velY = 0;
      state.onGround = true;
    }
    // recoil recovery
    recoilPitch *= Math.max(0, 1 - dt * 7);
    recoilYaw *= Math.max(0, 1 - dt * 7);
  }

  function look(dx, dy) {
    if (!state.alive) return;
    state.yaw -= dx * 0.0021;
    state.pitch -= dy * 0.0021;
    const lim = Math.PI / 2 - 0.02;
    state.pitch = Math.max(-lim, Math.min(lim, state.pitch));
  }

  function damage(amount) {
    if (!state.alive) return 0;
    let rest = amount;
    if (state.armor > 0) {
      const absorbed = Math.min(state.armor, rest * 0.5);
      state.armor -= absorbed;
      rest -= absorbed;
    }
    state.health -= rest;
    if (state.health <= 0) {
      state.health = 0;
      state.alive = false;
    }
    return rest;
  }

  function addRecoil(pitch, yaw) {
    recoilPitch += pitch;
    recoilYaw += yaw;
  }

  function reset(spawnPoint, money) {
    state.position.set(spawnPoint[0], 0, spawnPoint[1]);
    state.yaw = 0;
    state.pitch = 0;
    state.velY = 0;
    state.health = 100;
    state.armor = 0;
    state.money = money;
    state.alive = true;
    recoilPitch = 0;
    recoilYaw = 0;
  }

  return {
    state,
    step,
    look,
    damage,
    reset,
    addRecoil,
    groundSpeed() {
      return state.moveSpeed;
    },
    viewPitch() {
      return state.pitch + recoilPitch;
    },
    viewYaw() {
      return state.yaw + recoilYaw;
    },
  };
}
