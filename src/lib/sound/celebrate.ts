/**
 * The "you're all set" sound: a bottle popping open, a fizz, and a little
 * sparkle on top. Synthesized with Web Audio, so there's no file to load.
 * Needs a prior user gesture on the page (the click that led here).
 */
export function playCelebration() {
  const Ctx = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!Ctx) return;
  const ctx = new Ctx();
  void ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);

  const noise = (seconds: number) => {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  };

  // 1. The cork: a bright, very short burst whose pitch falls fast…
  const pop = noise(0.12);
  const popFilter = ctx.createBiquadFilter();
  popFilter.type = "bandpass";
  popFilter.Q.value = 1.4;
  popFilter.frequency.setValueAtTime(2600, t0);
  popFilter.frequency.exponentialRampToValueAtTime(380, t0 + 0.08);
  const popGain = ctx.createGain();
  popGain.gain.setValueAtTime(0, t0);
  popGain.gain.linearRampToValueAtTime(1, t0 + 0.004);
  popGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
  pop.connect(popFilter).connect(popGain).connect(out);
  pop.start(t0);

  // …with a hollow "thunk" underneath, like air leaving the neck.
  const thunk = ctx.createOscillator();
  thunk.type = "sine";
  thunk.frequency.setValueAtTime(420, t0);
  thunk.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);
  const thunkGain = ctx.createGain();
  thunkGain.gain.setValueAtTime(0.0001, t0);
  thunkGain.gain.exponentialRampToValueAtTime(0.7, t0 + 0.006);
  thunkGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
  thunk.connect(thunkGain).connect(out);
  thunk.start(t0);
  thunk.stop(t0 + 0.2);

  // 2. The fizz: airy hiss that swells, then crackles away.
  const fizz = noise(1.8);
  const hiss = ctx.createBiquadFilter();
  hiss.type = "highpass";
  hiss.frequency.value = 3200;
  const shimmer = ctx.createBiquadFilter();
  shimmer.type = "bandpass";
  shimmer.Q.value = 0.7;
  shimmer.frequency.setValueAtTime(5200, t0 + 0.08);
  shimmer.frequency.linearRampToValueAtTime(8200, t0 + 1.6);
  const fizzGain = ctx.createGain();
  fizzGain.gain.setValueAtTime(0.0001, t0 + 0.06);
  fizzGain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.2);
  fizzGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.75);
  // Bubbles: a fast, irregular flutter on the fizz's volume.
  const crackle = ctx.createGain();
  crackle.gain.value = 0.6;
  const flutter = ctx.createOscillator();
  flutter.type = "square";
  flutter.frequency.setValueAtTime(23, t0);
  flutter.frequency.linearRampToValueAtTime(41, t0 + 1.6);
  const flutterDepth = ctx.createGain();
  flutterDepth.gain.value = 0.4;
  flutter.connect(flutterDepth).connect(crackle.gain);
  fizz.connect(hiss).connect(shimmer).connect(fizzGain).connect(crackle).connect(out);
  fizz.start(t0 + 0.06);
  flutter.start(t0 + 0.06);
  flutter.stop(t0 + 1.8);

  // 3. A soft sparkle as the confetti lands: three rising chime notes.
  [1046.5, 1318.5, 1568].forEach((freq, i) => {
    const at = t0 + 0.22 + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.13, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.55);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + 0.6);
  });

  setTimeout(() => void ctx.close().catch(() => {}), 2600);
}
