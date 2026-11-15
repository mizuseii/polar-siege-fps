// Keyboard + mouse, with pointer lock. One-shot keys (reload, interact,
// buy, weapon slots) are consumed through consumePressed so a single press
// fires exactly one action.
import * as THREE from 'three';

export function createInput(dom, onLockChange) {
  const state = {
    keys: new Set(),
    pressed: new Set(),
    lookX: 0,
    lookY: 0,
    firing: false,
    scoped: false,
    locked: false,
  };

  function onKeyDown(e) {
    if (e.repeat) return;
    state.keys.add(e.code);
    state.pressed.add(e.code);
  }
  function onKeyUp(e) {
    state.keys.delete(e.code);
  }
  function onMouseMove(e) {
    if (!state.locked) return;
    state.lookX += e.movementX;
    state.lookY += e.movementY;
  }
  function onMouseDown(e) {
    if (!state.locked) return;
    if (e.button === 0) state.firing = true;
    if (e.button === 2) state.scoped = true;
  }
  function onMouseUp(e) {
    if (e.button === 0) state.firing = false;
    if (e.button === 2) state.scoped = false;
  }
  function onLock() {
    state.locked = document.pointerLockElement === dom;
    if (!state.locked) {
      state.firing = false;
      state.scoped = false;
    }
    onLockChange(state.locked);
  }
  function onContext(e) {
    e.preventDefault();
  }
  function onBlur() {
    state.keys.clear();
    state.firing = false;
    state.scoped = false;
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLock);
  document.addEventListener('contextmenu', onContext);
  window.addEventListener('blur', onBlur);

  return {
    state,
    requestLock() {
      dom.requestPointerLock();
    },
    takeLook() {
      const look = { x: state.lookX, y: state.lookY };
      state.lookX = 0;
      state.lookY = 0;
      return look;
    },
    consumePressed(code) {
      if (!state.pressed.has(code)) return false;
      state.pressed.delete(code);
      return true;
    },
    endFrame() {
      state.pressed.clear();
    },
    dispose() {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('contextmenu', onContext);
      window.removeEventListener('blur', onBlur);
    },
  };
}
