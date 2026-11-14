// Procedural audio (no files needed): ocean, birds (day) and UI sounds.
let ctx: AudioContext | null = null;
let master: GainNode;
let dayGain: GainNode;
let birdTimer: ReturnType<typeof setInterval> | undefined;
let night = false;
let muted = false;

// A hot-reload re-evaluates this module and would orphan a still-playing context; close it.
const stale = globalThis as unknown as { __portfolioAudio?: AudioContext };
if (typeof window !== "undefined") void stale.__portfolioAudio?.close().catch(() => {});

function noise(c: AudioContext) {
  const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  const s = c.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start();
  return s;
}

function chirp() {
  if (!ctx || night || muted) return;
  const n = 1 + Math.floor(Math.random() * 3);
  const base = 2600 + Math.random() * 1400;
  for (let i = 0; i < n; i++) {
    const t = ctx.currentTime + i * 0.14;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base + 900, t + 0.09);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g).connect(dayGain);
    o.start(t);
    o.stop(t + 0.12);
  }
}

function applyMode() {
  if (!ctx) return;
  dayGain.gain.setTargetAtTime(night ? 0 : 1, ctx.currentTime, 0.8);
}

export function initAudio() {
  if (ctx) {
    if (!muted && ctx.state === "suspended") void ctx.resume();
    birdTimer ??= setInterval(() => Math.random() > 0.45 && chirp(), 3200);
    return;
  }
  const c = new AudioContext();
  ctx = c;
  stale.__portfolioAudio = c;
  master = c.createGain();
  master.gain.value = muted ? 0 : 0.7;
  master.connect(c.destination);

  // Waves: slow swells of low rumble plus a hiss that peaks as each wave breaks.
  const rumble = c.createBiquadFilter();
  rumble.type = "lowpass";
  rumble.frequency.value = 650;
  const rumbleGain = c.createGain();
  rumbleGain.gain.value = 0.3;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.2;
  lfo.connect(lfoDepth).connect(rumbleGain.gain);
  lfo.start();
  noise(c).connect(rumble).connect(rumbleGain).connect(master);

  const hiss = c.createBiquadFilter();
  hiss.type = "bandpass";
  hiss.frequency.value = 2400;
  const hissGain = c.createGain();
  hissGain.gain.value = 0.03;
  const lfo2 = c.createOscillator();
  lfo2.frequency.value = 0.11;
  const lfo2Depth = c.createGain();
  lfo2Depth.gain.value = 0.03;
  lfo2.connect(lfo2Depth).connect(hissGain.gain);
  lfo2.start();
  noise(c).connect(hiss).connect(hissGain).connect(master);

  // Birds (day)
  dayGain = c.createGain();
  dayGain.gain.value = 1;
  dayGain.connect(master);
  birdTimer = setInterval(() => Math.random() > 0.45 && chirp(), 3200);

  applyMode();
  if (muted) void c.suspend();
}

export function setNightMode(n: boolean) {
  night = n;
  applyMode();
}

export function setMuted(m: boolean) {
  muted = m;
  if (!ctx) return;
  const c = ctx;
  master.gain.setTargetAtTime(m ? 0 : 0.7, c.currentTime, 0.05);
  if (m) {
    // Fade out, then halt the whole audio engine so nothing can leak through.
    setTimeout(() => {
      if (muted) void c.suspend();
    }, 300);
  } else void c.resume();
}

export function stopAudio() {
  clearInterval(birdTimer);
  birdTimer = undefined;
}

function blip(freq: number, dur = 0.12, type: OscillatorType = "triangle", vol = 0.12, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function whoosh(up: boolean) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(up ? 400 : 1800, t);
  f.frequency.exponentialRampToValueAtTime(up ? 1800 : 400, t + 0.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  src.connect(f).connect(g).connect(master);
  src.stop(t + 0.4);
}

export const sfx = {
  menuOpen: () => {
    whoosh(false);
    blip(520, 0.1);
  },
  menuClose: () => {
    whoosh(true);
    blip(390, 0.1);
  },
  select: () => {
    blip(660, 0.1);
    blip(880, 0.16, "triangle", 0.1, 0.08);
  },
  hallClose: () => blip(440, 0.14),
  toDay: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.35, "sine", 0.1, i * 0.09)),
  toNight: () => [784, 659, 523, 392].forEach((f, i) => blip(f, 0.4, "sine", 0.1, i * 0.1)),
  unmute: () => blip(700, 0.1),
};
