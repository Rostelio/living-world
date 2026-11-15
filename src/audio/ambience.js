// Phase 21 — the soundscape: looping layers that follow what the camera sees and the time of
// day (wind, surf, birdsong, crickets and owls, rain, the bustle of a town, crackling fire),
// plus audio slots: audio/manifest.json can name real recordings for any music mood, ambience
// layer or sound effect; anything not listed stays generated.

// ---------------- Audio slots ----------------
export const AUDIO_SLOTS = {
  music: ['menu', 'peace', 'war', 'night'],
  ambience: ['wind', 'surf', 'birds', 'night', 'rain', 'town', 'fire'],
};
export const AUDIO_FILES = { buffers: new Map(), loaded: false };
export async function loadAudioFiles(ctx) {
  if (AUDIO_FILES.loaded) return AUDIO_FILES.buffers.size;
  AUDIO_FILES.loaded = true;
  try {
    const res = await fetch('audio/manifest.json', { cache: 'no-store' });
    if (!res.ok) return 0;
    const man = await res.json();
    const all = { ...(man.music || {}), ...(man.ambience || {}), ...(man.sfx || {}) };
    const kinds = {}; for (const k in man.music || {}) kinds[k] = 'music:'; for (const k in man.ambience || {}) kinds[k] = 'ambience:'; for (const k in man.sfx || {}) kinds[k] = 'sfx:';
    await Promise.all(Object.entries(all).map(async ([key, file]) => {
      try { const buf = await (await fetch('audio/' + file)).arrayBuffer(); AUDIO_FILES.buffers.set(kinds[key] + key, await ctx.decodeAudioData(buf)); }
      catch { console.warn('audio slot: could not load', file); }
    }));
  } catch { /* no audio folder: everything is generated */ }
  return AUDIO_FILES.buffers.size;
}
export const audioFile = (kind, key) => AUDIO_FILES.buffers.get(kind + ':' + key) || null;

// ---------------- Generated layers ----------------
function noiseBuffer(ctx, seconds, color = 'white') {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    else if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    else d[i] = w;
  }
  // fade the loop seam
  for (let i = 0; i < 2000; i++) { const f = i / 2000; d[i] *= f; d[len - 1 - i] *= f; }
  return buf;
}

export class Ambience {
  constructor(engine) {
    this.e = engine;
    this.layers = null;
    this.state = {};
    this.nextChirp = 0; this.nextCricket = 0; this.nextOwl = 0; this.nextTown = 0; this.nextCrackle = 0;
  }
  build() {
    const ctx = this.e.ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 1;
    this.bus.connect(this.e.sfxBus);
    const loop = (buf, filters) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      let node = src;
      for (const f of filters) { node.connect(f); node = f; }
      const g = ctx.createGain(); g.gain.value = 0; node.connect(g); g.connect(this.bus);
      src.start();
      return { src, g, filters };
    };
    const filt = (type, freq, q = 0.7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
    const pink = noiseBuffer(ctx, 6, 'pink'), brown = noiseBuffer(ctx, 6, 'brown'), white = noiseBuffer(ctx, 4, 'white');
    this.layers = {
      wind: this.fileOr('wind', () => loop(pink, [filt('bandpass', 420, 0.6)])),
      surf: this.fileOr('surf', () => loop(brown, [filt('lowpass', 700, 0.5)])),
      rain: this.fileOr('rain', () => loop(white, [filt('highpass', 1800, 0.4), filt('lowpass', 7000, 0.4)])),
      town: this.fileOr('town', () => loop(pink, [filt('bandpass', 260, 1.4)])),
      fire: this.fileOr('fire', () => loop(white, [filt('bandpass', 2500, 0.8)])),
      birds: this.fileOr('birds', null),
      night: this.fileOr('night', null),
    };
  }
  fileOr(key, make) {
    const buf = audioFile('ambience', key);
    const ctx = this.e.ctx;
    if (buf) {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.bus); src.start();
      return { src, g, file: true };
    }
    return make ? make() : null;
  }
  // s: { water, coast, forest, open, high, town, rain, night, dawn, warm, fire, zoom }
  update(s) {
    const e = this.e;
    if (!e.ready || e.ctx.state !== 'running') return;
    if (!this.layers) this.build();
    const ctx = e.ctx, t = ctx.currentTime;
    const amb = e.vol.ambience ?? 0.8;
    const set = (L, v, tc = 1.2) => { if (L) L.g.gain.setTargetAtTime(Math.max(0, v) * amb, t, tc); };
    const close = Math.min(1, Math.max(0, (s.zoom - 0.6) / 2));
    // wind: stronger far out, on heights and in storms; gusts swell slowly
    const gust = 0.6 + 0.4 * Math.sin(t * 0.23) * Math.sin(t * 0.071);
    set(this.layers.wind, (0.05 + s.high * 0.12 + (1 - close) * 0.06 + s.rain * 0.08) * gust);
    if (this.layers.wind?.filters) this.layers.wind.filters[0].frequency.setTargetAtTime(320 + gust * 260, t, 1);
    // surf: slow swells along the coast
    const swell = 0.55 + 0.45 * Math.sin(t * 0.55);
    set(this.layers.surf, (s.coast * 0.32 + s.water * 0.06) * (0.4 + 0.6 * close) * swell, 0.6);
    set(this.layers.rain, s.rain * 0.22);
    set(this.layers.town, s.town * close * (s.night ? 0.05 : 0.11));
    set(this.layers.fire, s.fire * 0.14, 0.5);
    if (this.layers.birds?.file) set(this.layers.birds, (s.forest + s.open * 0.5) * (1 - s.night) * close * 0.5);
    if (this.layers.night?.file) set(this.layers.night, s.night * s.warm * (s.forest + s.open) * close * 0.5);
    // generated one-shots: birdsong by day, crickets and owls at night, hammers and bells in town
    const sfx = this.bus;
    if (!this.layers.birds?.file && !s.night && (s.forest + s.open * 0.5) * close > 0.12 && t > this.nextChirp && !s.rain) {
      this.chirp(ctx, sfx, t, (s.dawn ? 0.05 : 0.03) * amb);
      this.nextChirp = t + (s.dawn ? 0.4 : 1.2) + Math.random() * (s.dawn ? 1 : 3);
    }
    if (!this.layers.night?.file && s.night > 0.5 && s.warm && (s.forest + s.open) * close > 0.15 && t > this.nextCricket) {
      this.cricket(ctx, sfx, t, 0.012 * amb);
      this.nextCricket = t + 0.6 + Math.random() * 1.2;
    }
    if (s.night > 0.5 && s.forest * close > 0.3 && t > this.nextOwl) { this.owl(ctx, sfx, t, 0.04 * amb); this.nextOwl = t + 12 + Math.random() * 20; }
    if (s.town * close > 0.3 && !s.night && t > this.nextTown) {
      if (Math.random() < 0.7) this.hammer(ctx, sfx, t, 0.05 * amb); else this.bellToll(ctx, sfx, t, 0.03 * amb);
      this.nextTown = t + 1.5 + Math.random() * 4;
    }
    if (s.fire > 0.2 && t > this.nextCrackle) { this.crackle(ctx, sfx, t, 0.06 * amb * s.fire); this.nextCrackle = t + 0.08 + Math.random() * 0.3; }
  }
  // ---- little generated sounds ----
  tone(ctx, out, type, f0, f1, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  chirp(ctx, out, t, vol) {
    const base = 2400 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) { const s = t + i * (0.07 + Math.random() * 0.05); this.tone(ctx, out, 'sine', base * (1 + Math.random() * 0.2), base * (0.8 + Math.random() * 0.5), s, 0.05 + Math.random() * 0.05, vol); }
  }
  cricket(ctx, out, t, vol) { for (let i = 0; i < 3; i++) this.tone(ctx, out, 'square', 4300, 4250, t + i * 0.045, 0.03, vol); }
  owl(ctx, out, t, vol) { this.tone(ctx, out, 'sine', 420, 380, t, 0.35, vol); this.tone(ctx, out, 'sine', 400, 350, t + 0.55, 0.6, vol); }
  hammer(ctx, out, t, vol) { for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) this.tone(ctx, out, 'triangle', 900 + Math.random() * 300, 300, t + i * 0.32, 0.08, vol); }
  bellToll(ctx, out, t, vol) { this.tone(ctx, out, 'sine', 660, 655, t, 2.2, vol); this.tone(ctx, out, 'sine', 1320, 1310, t, 1.2, vol * 0.4); }
  crackle(ctx, out, t, vol) { this.tone(ctx, out, 'square', 1200 + Math.random() * 2000, 200, t, 0.02 + Math.random() * 0.03, vol); }
}
