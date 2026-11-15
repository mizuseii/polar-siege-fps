# POLAR SIEGE — Aurora-9

A round-based tactical FPS in three.js 0.187.0, built for the make.fun
threejs-fps-02 bounty ("Make the best three.js tactical FPS").

**Repository owner:** [mizuseii](https://github.com/mizuseii)
**Intended public repo:** https://github.com/mizuseii/polar-siege-fps
**License:** MIT

## The game

An arctic research station, Aurora-9, at blue hour: snowstorm, aurora, a
56×44 m yard of hab modules, labs and crates between two bomb sites.

- **Teams:** AURORA (you + 3 bots, cyan, attacking from the south) vs
  BLIZZARD (5 bots, crimson, defending from the north).
- **Rounds:** first to 5 (max 9). 15 s buy phase, 100 s combat. Win by
  eliminating the other team, or by planting the charge at Site A
  (Reactor) or Site B (Comms Array) and holding it through the 30 s fuse.
  Defenders can defuse in 4 s.
- **Economy:** start $800, kill +$300, round win +$1,000, loss +$500,
  plant +$300. Buy between rounds: MP7 Jackal ($600), VK-47 Mammoth
  ($2,700), LB-50 Longbow sniper ($4,750), Kevlar ($650), frag grenades
  ($300).
- **Gunplay:** hitscan with headshot multiplier, recoil, spread that grows
  while moving and shrinks while crouched, tracers, muzzle flash, per-weapon
  fire rates, magazines and reserves, reloads.
- **Bots:** waypoint patrols, investigate gunfire, engage with reaction
  delay and bursts, strafe, hold sites, plant and defuse. They see, hear
  and shoot back.
- **HUD:** health/armor, ammo, money, round timer, score, killfeed, minimap,
  hitmarkers, damage direction, buy menu, banners.

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome. No build step, no network
requests: static files, ES modules, three.js vendored under
`game/vendor/three/`.

**Controls:** WASD move · mouse look · click fire · R reload · 1–4 weapons ·
Shift sprint · Space jump · C / Ctrl crouch · E plant/defuse · B buy menu ·
G throw grenade · right click scope (Longbow) · Esc pause.

## Screenshots

`shots.json` lists the three capture frames; each is a deterministic render
of the game's own code via `?shot=start|play|end&seed=1`, which renders twice,
freezes, and sets `window.__shotReady`.

## Layout

- `game/index.html` — the page, HUD DOM, single import map for three.js.
- `game/src/main.js` — boot, fixed 60 Hz loop, shooting, rounds, captures.
- `game/src/world.js` — the station: geometry, colliders, waypoints, snow, aurora.
- `game/src/bots.js` — bot AI: patrol, investigate, engage, plant, defuse.
- `game/src/weapons.js` — the four guns, viewmodels, recoil, tracers.
- `game/src/grenades.js` — frag grenades: arc, bounce, fuse, blast.
- `game/src/game.js` — match state machine: phases, timer, bomb, score.
- `game/src/player.js` — movement, acceleration, crouch, jump, collision.
- `game/src/input.js` — pointer lock, keys, mouse look.
- `game/src/hud.js` — every DOM element the player sees.
- `game/src/audio.js` — WebAudio-synthesised shots, reloads, footsteps.
- `game/src/palette.js`, `game/src/textures.js` — the blue-hour palette and
  procedural canvas textures.
- `main.ts` — the entry program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `serve.ts` — the local static server.
