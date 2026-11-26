// Focus "vibes" generated live with Web Audio — no audio files to download.
export type Vibe = 'rain' | 'cafe' | 'lofi' | 'quiet';

let ctx: AudioContext | null = null;
let nodes: AudioNode[] = [];
let sources: (AudioBufferSourceNode | OscillatorNode)[] = [];

function noiseBuffer(c: AudioContext, kind: 'white' | 'brown'): AudioBuffer {
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

export function stopVibe() {
  sources.forEach((s) => {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  });
  nodes.forEach((n) => n.disconnect());
  sources = [];
  nodes = [];
}

export function playVibe(v: Vibe) {
  stopVibe();
  if (v === 'quiet') return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = ctx || new AC();
  void ctx.resume();
  const c = ctx;
  const out = c.createGain();
  out.gain.value = 0;
  out.gain.linearRampToValueAtTime(1, c.currentTime + 1.5);
  out.connect(c.destination);
  nodes.push(out);

  const src = c.createBufferSource();
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  const g = c.createGain();

  if (v === 'rain') {
    src.buffer = noiseBuffer(c, 'white');
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    lp.frequency.value = 7000;
    g.gain.value = 0.12;
    src.connect(hp).connect(lp).connect(g).connect(out);
    nodes.push(hp);
  } else if (v === 'cafe') {
    src.buffer = noiseBuffer(c, 'brown');
    lp.frequency.value = 900;
    g.gain.value = 0.35;
    src.connect(lp).connect(g).connect(out);
  } else {
    // lo-fi: warm brown noise + a slow, soft chord
    src.buffer = noiseBuffer(c, 'brown');
    lp.frequency.value = 500;
    g.gain.value = 0.18;
    src.connect(lp).connect(g).connect(out);
    for (const f of [110, 138.6, 164.8]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = 0.018;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.08;
      const lg = c.createGain();
      lg.gain.value = 0.012;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(out);
      o.start();
      lfo.start();
      sources.push(o, lfo);
      nodes.push(og, lg);
    }
  }
  src.start();
  sources.push(src);
  nodes.push(lp, g);
}
