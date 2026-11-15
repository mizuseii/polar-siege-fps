// Every sound is synthesised with WebAudio: no audio assets ship with
// the game. The context unlocks on the first user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let windGain = null;
  let stepAcc = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 1;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    // wind: looped noise through a low pass, slowly breathing
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    src.connect(lp);
    lp.connect(windGain);
    windGain.connect(master);
    src.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(windGain.gain);
    lfo.start();
    return true;
  }

  function burst(dur, filterType, freq, gain, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function tone(freq, dur, type = 'sine', gain = 0.2, when = 0, slideTo = null) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const SHOT = {
    kestrel: { dur: 0.11, freq: 1800, gain: 0.5, thump: 140 },
    jackal: { dur: 0.09, freq: 2200, gain: 0.42, thump: 160 },
    mammoth: { dur: 0.14, freq: 1400, gain: 0.55, thump: 110 },
    longbow: { dur: 0.3, freq: 900, gain: 0.7, thump: 70 },
  };

  return {
    unlock() {
      ensure();
    },
    shot(id, distant = false) {
      if (!ensure()) return;
      const s = SHOT[id] || SHOT.mammoth;
      const g = distant ? s.gain * 0.25 : s.gain;
      const f = distant ? s.freq * 0.5 : s.freq;
      burst(s.dur, 'bandpass', f, g);
      tone(s.thump, 0.12, 'sine', g * 0.7, 0, 55);
    },
    dryfire() {
      if (!ensure()) return;
      tone(1400, 0.04, 'square', 0.12);
    },
    reload() {
      if (!ensure()) return;
      tone(700, 0.05, 'square', 0.14);
      tone(950, 0.05, 'square', 0.14, 0.28);
    },
    hit() {
      if (!ensure()) return;
      tone(2100, 0.05, 'sine', 0.22);
    },
    kill() {
      if (!ensure()) return;
      tone(660, 0.09, 'sine', 0.22);
      tone(990, 0.14, 'sine', 0.22, 0.09);
    },
    hurt() {
      if (!ensure()) return;
      tone(180, 0.18, 'sawtooth', 0.2, 0, 90);
    },
    plantBeep() {
      if (!ensure()) return;
      tone(1200, 0.07, 'sine', 0.2);
    },
    bombBeep() {
      if (!ensure()) return;
      tone(1500, 0.06, 'sine', 0.18);
    },
    explosion() {
      if (!ensure()) return;
      burst(1.4, 'lowpass', 400, 0.9);
      tone(120, 1.1, 'sine', 0.6, 0, 28);
    },
    roundWin() {
      if (!ensure()) return;
      tone(523, 0.14, 'sine', 0.22);
      tone(659, 0.14, 'sine', 0.22, 0.13);
      tone(784, 0.24, 'sine', 0.24, 0.26);
    },
    roundLose() {
      if (!ensure()) return;
      tone(392, 0.16, 'sine', 0.22);
      tone(311, 0.16, 'sine', 0.22, 0.15);
      tone(233, 0.3, 'sine', 0.22, 0.3);
    },
    step(dt, moving, speed) {
      if (!ctx || !moving) return;
      stepAcc += speed * dt;
      if (stepAcc > 2.1) {
        stepAcc = 0;
        burst(0.06, 'lowpass', 500, 0.1);
      }
    },
  };
}
