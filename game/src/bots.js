// The other nine soldiers: three AURORA friendlies who advance with the
// player, five BLIZZARD defenders who hold the sites. Each bot patrols a
// waypoint graph, hears gunfire, spots enemies by line of sight, aims with
// a reaction delay, fires in bursts while strafing, and converges on a
// planted charge to defuse it.
import * as THREE from 'three';
import { WAYPOINTS, EDGES, SITES, SPAWNS, collideCircle } from './world.js';

const EYE = 1.55;
const TEAM_COLOR = { aurora: '#2e86b8', blizzard: '#b83a2e' };
const TEAM_TRIM = { aurora: '#7fd4ff', blizzard: '#ff8a7a' };
const NAMES = {
  aurora: ['Vega', 'Iris', 'Noor'],
  blizzard: ['Yeti', 'Frost', 'Sable', 'Rook', 'Onyx'],
};

function nearestNode(x, z) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i += 1) {
    const dx = WAYPOINTS[i][0] - x;
    const dz = WAYPOINTS[i][1] - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function bfsPath(from, to) {
  if (from === to) return [from];
  const prev = new Array(WAYPOINTS.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const [a, b] of EDGES) {
      const nxt = a === cur ? b : b === cur ? a : -1;
      if (nxt === -1 || prev[nxt] !== -1) continue;
      prev[nxt] = cur;
      if (nxt === to) {
        const path = [to];
        let p = to;
        while (p !== from) { p = prev[p]; path.unshift(p); }
        return path;
      }
      queue.push(nxt);
    }
  }
  return [from, to];
}

function buildMesh(team) {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: TEAM_COLOR[team], roughness: 0.7, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a2027', roughness: 0.6, metalness: 0.4 });
  const trim = new THREE.MeshStandardMaterial({ color: TEAM_TRIM[team], roughness: 0.4, metalness: 0.2, emissive: TEAM_TRIM[team], emissiveIntensity: 0.5 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), suit);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.32), dark);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), trim);
  visor.position.set(0, 1.64, 0.17);
  group.add(visor);
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.24), dark);
    leg.position.set(sx, 0.36, 0);
    group.add(leg);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.72), dark);
  gun.position.set(0.2, 1.15, -0.3);
  group.add(gun);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), trim);
  lamp.position.set(0, 1.32, 0.17);
  group.add(lamp);
  return { group, torso, head };
}

export function createBots(scene, world, hooks) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 60;
  const bots = [];
  let botSeq = 0;

  function spawn(team, index, pos) {
    const { group, torso, head } = buildMesh(team);
    const bot = {
      id: botSeq,
      seq: botSeq,
      team,
      name: NAMES[team][index % NAMES[team].length],
      group,
      pos: new THREE.Vector3(pos[0], 0, pos[1]),
      yaw: team === 'aurora' ? 0 : Math.PI,
      health: 100,
      alive: true,
      weapon: team === 'aurora' ? (index === 0 ? 'mammoth' : 'jackal') : (index % 3 === 0 ? 'mammoth' : 'jackal'),
      speed: 3.4 + Math.random() * 0.4,
      state: 'hold',
      path: [],
      pathIdx: 0,
      holdPos: [pos[0], pos[1]],
      target: null,
      lastSeen: null,
      lastSeenAt: -10,
      aimTime: 0,
      reactionUntil: 0,
      burstLeft: 0,
      nextShotAt: 0,
      nextBurstAt: 0,
      strafeDir: 1,
      strafeUntil: 0,
      scanUntil: 0,
      investigatePos: null,
      thinkAt: Math.random() * 0.12,
      kills: 0,
    };
    botSeq += 1;
    torso.userData = { bot, part: 'body' };
    head.userData = { bot, part: 'head' };
    bot.hitMeshes = [torso, head];
    group.position.copy(bot.pos);
    scene.add(group);
    bots.push(bot);
    return bot;
  }

  function spawnRound() {
    for (const b of bots) scene.remove(b.group);
    bots.length = 0;
    botSeq = 0;
    SPAWNS.aurora.slice(0, 4).forEach((p, i) => {
      if (i === 0) return; // slot 0 is the player
      spawn('aurora', i - 1, p);
    });
    SPAWNS.blizzard.forEach((p, i) => spawn('blizzard', i, p));
    // defenders hold their sites: two at A, two at B, one roams mid
    const defs = bots.filter((b) => b.team === 'blizzard');
    defs[0].holdPos = [-20, -2.5];
    defs[1].holdPos = [-17, -6];
    defs[2].holdPos = [20, -2.5];
    defs[3].holdPos = [17, -6];
    defs[4].holdPos = [0, -8];
  }

  function losClear(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.01) return true;
    dir.normalize();
    raycaster.set(from, dir);
    raycaster.far = dist;
    const hits = raycaster.intersectObjects(world.shootables, false);
    return hits.length === 0;
  }

  function visibleEnemies(bot, ctx, now) {
    const out = [];
    const eye = new THREE.Vector3(bot.pos.x, bot.pos.y + EYE, bot.pos.z);
    const fwd = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
    const foes = [];
    if (bot.team === 'blizzard') {
      if (ctx.player.state.alive) foes.push({ kind: 'player', pos: ctx.player.state.position, chest: 1.35, head: 1.6 });
      for (const f of bots) if (f.team === 'aurora' && f.alive) foes.push({ kind: 'bot', bot: f, pos: f.pos, chest: 1.1, head: 1.62 });
    } else {
      for (const f of bots) if (f.team === 'blizzard' && f.alive) foes.push({ kind: 'bot', bot: f, pos: f.pos, chest: 1.1, head: 1.62 });
    }
    for (const foe of foes) {
      const dx = foe.pos.x - bot.pos.x;
      const dz = foe.pos.z - bot.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 42) continue;
      const dir = new THREE.Vector3(dx / (dist || 1), 0, dz / (dist || 1));
      const facing = fwd.dot(dir);
      const heard = now - (ctx.lastShotAt || -99) < 1.2 && ctx.lastShotPos && Math.hypot(ctx.lastShotPos.x - bot.pos.x, ctx.lastShotPos.z - bot.pos.z) < 26;
      if (facing < 0.35 && !heard) continue;
      const to = new THREE.Vector3(foe.pos.x, foe.pos.y + foe.chest, foe.pos.z);
      if (!losClear(eye, to)) continue;
      out.push({ foe, dist });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }

  function setPath(bot, gx, gz) {
    const from = nearestNode(bot.pos.x, bot.pos.z);
    const to = nearestNode(gx, gz);
    const nodes = bfsPath(from, to);
    bot.path = nodes.map((i) => WAYPOINTS[i]);
    bot.path.push([gx, gz]);
    bot.pathIdx = 0;
  }

  function stepBot(bot, dt, now, ctx) {
    if (!bot.alive) return;
    // --- perception, staggered
    if (now >= bot.thinkAt) {
      bot.thinkAt = now + 0.12 + Math.random() * 0.06;
      // a dead target is dropped at once, not shot at for another cycle
      if (bot.target) {
        const t = bot.target;
        const dead = t.kind === 'player' ? !ctx.player.state.alive : !t.bot.alive;
        if (dead) bot.target = null;
      }
      const seen = visibleEnemies(bot, ctx, now);
      if (seen.length > 0) {
        const first = seen[0];
        if (bot.target !== first.foe) {
          bot.target = first.foe;
          bot.aimTime = 0;
          bot.reactionUntil = now + 0.3 + Math.random() * 0.35 + first.dist * 0.008;
          bot.burstLeft = 0;
        }
        bot.lastSeen = new THREE.Vector3(first.foe.pos.x, first.foe.pos.y, first.foe.pos.z);
        bot.lastSeenAt = now;
      } else if (bot.target && now - bot.lastSeenAt > 1.6) {
        bot.investigatePos = bot.lastSeen ? [bot.lastSeen.x, bot.lastSeen.z] : null;
        bot.target = null;
      }
      // hearing: a shot nearby pulls an idle bot over
      if (!bot.target && ctx.lastShotPos && now - (ctx.lastShotAt || -99) < 0.5) {
        const d = Math.hypot(ctx.lastShotPos.x - bot.pos.x, ctx.lastShotPos.z - bot.pos.z);
        if (d < 24 && bot.state !== 'engage') {
          bot.investigatePos = [ctx.lastShotPos.x, ctx.lastShotPos.z];
        }
      }
    }

    const eye = new THREE.Vector3(bot.pos.x, bot.pos.y + EYE, bot.pos.z);
    let moveTarget = null;
    let wantSpeed = bot.speed;

    if (bot.target) {
      const tp = bot.target.pos;
      const dx = tp.x - bot.pos.x;
      const dz = tp.z - bot.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantYaw = Math.atan2(-dx, -dz);
      let dy = wantYaw - bot.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      bot.yaw += dy * Math.min(1, dt * 10);
      bot.aimTime += dt;
      // strafe while engaging
      if (now > bot.strafeUntil) {
        bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
        bot.strafeUntil = now + 0.7 + Math.random() * 0.8;
      }
      const strafe = new THREE.Vector3(Math.cos(bot.yaw) * bot.strafeDir, 0, -Math.sin(bot.yaw) * bot.strafeDir);
      moveTarget = new THREE.Vector3(bot.pos.x + strafe.x, 0, bot.pos.z + strafe.z);
      wantSpeed = bot.speed * 0.45;
      if (dist > 26) moveTarget = new THREE.Vector3(tp.x, 0, tp.z);
      // fire in bursts once reacted
      if (now >= bot.reactionUntil) {
        if (bot.burstLeft <= 0 && now >= bot.nextBurstAt) {
          bot.burstLeft = 3 + Math.floor(Math.random() * 3);
          bot.nextBurstAt = now + 0.7 + Math.random() * 0.5;
        }
        if (bot.burstLeft > 0 && now >= bot.nextShotAt) {
          bot.nextShotAt = now + 0.13;
          bot.burstLeft -= 1;
          fireAt(bot, tp, dist, ctx, now);
        }
      }
    } else if (ctx.bombPlanted && bot.team === 'blizzard') {
      // converge on the planted charge; closest one defuses
      const bp = ctx.bombPos;
      const d = Math.hypot(bp.x - bot.pos.x, bp.z - bot.pos.z);
      if (d < 1.4) {
        bot.state = 'defuse';
        moveTarget = null;
        bot.yaw += dt * 0.8;
      } else {
        if (!bot.path.length || bot.pathIdx >= bot.path.length) setPath(bot, bp.x, bp.z);
        moveTarget = nextPathPoint(bot);
      }
    } else if (bot.investigatePos) {
      const [ix, iz] = bot.investigatePos;
      const d = Math.hypot(ix - bot.pos.x, iz - bot.pos.z);
      if (d < 1.2) {
        bot.investigatePos = null;
        bot.scanUntil = now + 2;
        bot.state = 'hold';
      } else {
        if (!bot.path.length || bot.pathIdx >= bot.path.length) setPath(bot, ix, iz);
        moveTarget = nextPathPoint(bot);
      }
    } else if (now < bot.scanUntil) {
      bot.yaw += dt * 0.9;
    } else if (bot.team === 'blizzard') {
      // hold the assigned post, small patrol loop around it
      const hx = bot.holdPos[0];
      const hz = bot.holdPos[1];
      const d = Math.hypot(hx - bot.pos.x, hz - bot.pos.z);
      if (d > 2.5) {
        if (!bot.path.length || bot.pathIdx >= bot.path.length) setPath(bot, hx, hz);
        moveTarget = nextPathPoint(bot);
      } else {
        bot.yaw += Math.sin(now * 0.4 + bot.seq) * dt * 0.6;
      }
    } else {
      // AURORA friendlies: push toward the site nearest the player
      const px = ctx.player.state.position.x;
      const pz = ctx.player.state.position.z;
      const site = Math.abs(SITES.A.center.x - px) < Math.abs(SITES.B.center.x - px) ? SITES.A : SITES.B;
      const gx = site.center.x + (bot.seq % 3 - 1) * 3;
      const gz = site.center.z + 4 + (bot.seq % 2) * 2;
      const d = Math.hypot(gx - bot.pos.x, gz - bot.pos.z);
      if (d > 3) {
        if (!bot.path.length || bot.pathIdx >= bot.path.length) setPath(bot, gx, gz);
        moveTarget = nextPathPoint(bot);
      }
    }

    if (moveTarget) {
      const dx = moveTarget.x - bot.pos.x;
      const dz = moveTarget.z - bot.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const stepLen = Math.min(dist, wantSpeed * dt);
        bot.pos.x += (dx / dist) * stepLen;
        bot.pos.z += (dz / dist) * stepLen;
        collideCircle(bot.pos, 0.42, world.colliders);
        if (!bot.target) {
          const wantYaw = Math.atan2(-dx, -dz);
          let dy = wantYaw - bot.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          bot.yaw += dy * Math.min(1, dt * 6);
        }
      }
    }
    bot.group.position.copy(bot.pos);
    bot.group.rotation.y = bot.yaw;
    // walk bob
    const bob = moveTarget && bot.alive ? Math.sin(now * 9 + bot.seq) * 0.03 : 0;
    bot.group.position.y = bob;
  }

  function nextPathPoint(bot) {
    while (bot.pathIdx < bot.path.length) {
      const [x, z] = bot.path[bot.pathIdx];
      if (Math.hypot(x - bot.pos.x, z - bot.pos.z) < 0.7) bot.pathIdx += 1;
      else return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  function fireAt(bot, targetPos, dist, ctx, now) {
    const from = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.35, bot.pos.z);
    const aimErr = 0.028 + dist * 0.0011 + Math.max(0, 0.5 - bot.aimTime * 0.2) * 0.03;
    const dir = new THREE.Vector3(
      targetPos.x - from.x + (Math.random() * 2 - 1) * aimErr * dist,
      targetPos.y + 1.1 - from.y + (Math.random() * 2 - 1) * aimErr * dist,
      targetPos.z - from.z + (Math.random() * 2 - 1) * aimErr * dist,
    ).normalize();
    raycaster.set(from, dir);
    raycaster.far = 60;
    const targets = [];
    if (ctx.playerHitbox) targets.push(ctx.playerHitbox);
    for (const b of bots) if (b.alive) targets.push(...b.hitMeshes);
    const hits = raycaster.intersectObjects([...targets, ...world.shootables], false);
    const hit = hits[0];
    const to = hit ? hit.point.clone() : from.clone().add(dir.clone().multiplyScalar(50));
    hooks.onShot(bot, from, to, '#ffb45c', now);
    bot.lastFiredAt = now;
    if (hit && hit.object.userData && hit.object.userData.bot) {
      const victim = hit.object.userData.bot;
      const isHead = hit.object.userData.part === 'head';
      const dmg = (bot.weapon === 'mammoth' ? 40 : 26) * (isHead ? 2.5 : 1);
      damageBot(victim, dmg, isHead, bot);
    } else if (hit && hit.object === ctx.playerHitbox) {
      const dmg = bot.weapon === 'mammoth' ? 40 : 26;
      hooks.onPlayerDamage(dmg, bot.pos);
    }
  }

  function damageBot(bot, amount, isHead, attacker) {
    if (!bot.alive) return;
    bot.health -= amount;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.group.rotation.x = -Math.PI / 2;
      bot.group.position.y = 0.25;
      if (attacker) attacker.kills += 1;
      hooks.onKill(attacker, bot, isHead);
    }
  }

  function step(dt, now, ctx) {
    for (const bot of bots) stepBot(bot, dt, now, ctx);
  }

  function reset() {
    for (const b of bots) scene.remove(b.group);
    bots.length = 0;
  }

  function aliveCount(team) {
    return bots.filter((b) => b.team === team && b.alive).length;
  }

  function allBots() {
    return bots;
  }

  return { spawnRound, step, reset, aliveCount, allBots, damageBot };
}
