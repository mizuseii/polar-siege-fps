// The match: buy phase, combat, round end, first to five rounds. It owns
// the clock, the score, the charge and the money the player earns; the
// renderer and the bots read it every frame.
import { SITES } from './world.js';

export const BUY_SECONDS = 15;
export const ROUND_SECONDS = 100;
export const FUSE_SECONDS = 30;
export const PLANT_SECONDS = 3;
export const DEFUSE_SECONDS = 4;
export const WIN_ROUNDS = 5;
export const MAX_ROUNDS = 9;

export function createMatch(hooks) {
  const state = {
    phase: 'lobby',
    round: 0,
    score: { aurora: 0, blizzard: 0 },
    timer: 0,
    bomb: { status: 'carried', site: null, pos: null, plantProgress: 0, defuseProgress: 0, fuse: 0 },
    lastReason: '',
  };

  function setPhase(phase, timer) {
    state.phase = phase;
    state.timer = timer;
    hooks.onPhase(phase, state);
  }

  function startMatch() {
    state.score = { aurora: 0, blizzard: 0 };
    state.round = 0;
    state.bomb = { status: 'carried', site: null, pos: null, plantProgress: 0, defuseProgress: 0, fuse: 0 };
    startRound();
  }

  function startRound() {
    state.round += 1;
    state.bomb = { status: 'carried', site: null, pos: null, plantProgress: 0, defuseProgress: 0, fuse: 0 };
    hooks.onRoundStart(state.round);
    setPhase('buy', BUY_SECONDS);
  }

  function endRound(winner, reason) {
    if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return;
    state.score[winner] += 1;
    state.lastReason = reason;
    hooks.onRoundEnd(winner, reason, state);
    if (state.score[winner] >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
      const matchWinner = state.score.aurora > state.score.blizzard ? 'aurora' : 'blizzard';
      setPhase('matchEnd', 0);
      hooks.onMatchEnd(matchWinner, state);
    } else {
      setPhase('roundEnd', 4);
    }
  }

  function step(dt) {
    if (state.phase === 'buy' || state.phase === 'combat') {
      state.timer -= dt;
      if (state.timer <= 0) {
        if (state.phase === 'buy') {
          setPhase('combat', ROUND_SECONDS);
        } else if (state.bomb.status === 'planted') {
          // fuse decides it below; combat clock no longer matters
        } else {
          endRound('blizzard', 'Time expired — the charge was never planted.');
        }
      }
    }
    if (state.bomb.status === 'planted') {
      state.bomb.fuse -= dt;
      if (state.bomb.fuse <= 0) {
        state.bomb.status = 'exploded';
        hooks.onExplode(state.bomb.pos);
        endRound('aurora', 'Charge detonated at the site.');
      }
    }
    if (state.phase === 'roundEnd') {
      state.timer -= dt;
      if (state.timer <= 0) startRound();
    }
  }

  function siteAt(pos) {
    for (const key of ['A', 'B']) {
      const c = SITES[key].center;
      if (Math.hypot(pos.x - c.x, pos.z - c.z) <= SITES[key].radius) return key;
    }
    return null;
  }

  // Called every frame while the player holds E: advances planting when the
  // player stands in a site with the charge.
  function plantTick(dt, playerPos, holding) {
    if (state.phase !== 'combat' || state.bomb.status !== 'carried') return;
    const site = siteAt(playerPos);
    if (site && holding) {
      state.bomb.plantProgress += dt;
      if (state.bomb.plantProgress >= PLANT_SECONDS) {
        state.bomb.status = 'planted';
        state.bomb.site = site;
        state.bomb.pos = { x: playerPos.x, z: playerPos.z };
        state.bomb.fuse = FUSE_SECONDS;
        state.bomb.plantProgress = 0;
        hooks.onPlant(site);
      }
    } else {
      state.bomb.plantProgress = Math.max(0, state.bomb.plantProgress - dt * 2);
    }
  }

  // Called every frame while a BLIZZARD bot channels the defuse.
  function defuseTick(dt, channeling) {
    if (state.bomb.status !== 'planted') return;
    if (channeling) {
      state.bomb.defuseProgress += dt;
      if (state.bomb.defuseProgress >= DEFUSE_SECONDS) {
        state.bomb.status = 'defused';
        hooks.onDefuse();
        endRound('blizzard', 'Charge defused.');
      }
    } else {
      state.bomb.defuseProgress = Math.max(0, state.bomb.defuseProgress - dt * 2);
    }
  }

  return {
    state,
    startMatch,
    startRound,
    endRound,
    step,
    siteAt,
    plantTick,
    defuseTick,
  };
}
