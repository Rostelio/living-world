import { Ambience, loadAudioFiles, audioFile } from './ambience.js';
// Living World — procedural audio. Everything is synthesized with Web Audio:
// no sound files. A generative score follows the era and whether you are at war;
// short synthesized effects punctuate battles, construction, discoveries and events.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------- Instrument voices (pure functions of ctx/out/time) ----------------
function env(g, t, a, peak, d, sustain = 0) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
}
function osc(ctx, type, freq, t, stop) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.start(t); o.stop(stop);
  return o;
}
let noiseBuf = null;
function noise(ctx, t, dur) {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.start(t, Math.random() * 1.5, dur);
  return s;
}

export const VOICES = {
  // soft detuned pad
  pad(ctx, out, freq, t, dur, vol = 0.05) {
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.3;
    for (const det of [-6, 5]) { const o = osc(ctx, 'sawtooth', freq, t, t + dur + 1.5); o.detune.value = det; o.connect(f); }
    f.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, dur * 0.4));
    g.gain.setValueAtTime(vol, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.4);
  },
  // Phase 21: a plucked harp (elves) and a wooden marimba (lizardfolk)
  harp(ctx, out, freq, t, dur, vol = 0.07) {
    const g = ctx.createGain();
    const o = osc(ctx, 'triangle', freq, t, t + 2.2), o2 = osc(ctx, 'sine', freq * 2, t, t + 1.4);
    const g2 = ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(g);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8 + dur * 0.2);
  },
  marimba(ctx, out, freq, t, dur, vol = 0.09) {
    const g = ctx.createGain();
    const o = osc(ctx, 'sine', freq, t, t + 0.8), o2 = osc(ctx, 'sine', freq * 4, t, t + 0.2);
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    void dur;
  },
  bass(ctx, out, freq, t, dur, vol = 0.12) {
    const g = ctx.createGain();
    const o = osc(ctx, 'triangle', freq, t, t + dur + 0.3);
    o.connect(g); g.connect(out);
    env(g, t, 0.02, vol, dur, 0.0001);
  },
  // Ancient: breathy flute
  flute(ctx, out, freq, t, dur, vol = 0.07) {
    const g = ctx.createGain();
    const o = osc(ctx, 'sine', freq, t, t + dur + 0.3);
    const lfo = osc(ctx, 'sine', 5, t, t + dur + 0.3); const lg = ctx.createGain(); lg.gain.value = freq * 0.006; lfo.connect(lg); lg.connect(o.frequency);
    const n = noise(ctx, t, dur + 0.2); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = freq * 2; nf.Q.value = 4; const ng = ctx.createGain(); ng.gain.value = 0.25;
    n.connect(nf); nf.connect(ng); ng.connect(g);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol * 0.8, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  },
  // Medieval: plucked lute
  lute(ctx, out, freq, t, dur, vol = 0.1) {
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 8, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.6);
    const o = osc(ctx, 'triangle', freq, t, t + 1.6); const o2 = osc(ctx, 'sawtooth', freq * 2, t, t + 1.6);
    const g2 = ctx.createGain(); g2.gain.value = 0.15; o2.connect(g2); g2.connect(f);
    o.connect(f); f.connect(g); g.connect(out);
    env(g, t, 0.005, vol, 1.4);
  },
  // Renaissance: harpsichord
  harpsi(ctx, out, freq, t, dur, vol = 0.06) {
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq * 0.8;
    const o = osc(ctx, 'square', freq, t, t + 1.2); const o2 = osc(ctx, 'square', freq * 2.005, t, t + 1.2);
    const g2 = ctx.createGain(); g2.gain.value = 0.4; o2.connect(g2); g2.connect(f);
    o.connect(f); f.connect(g); g.connect(out);
    env(g, t, 0.003, vol, 0.9);
  },
  // Industrial: piano-like
  piano(ctx, out, freq, t, dur, vol = 0.09) {
    const g = ctx.createGain();
    for (const [mul, gv] of [[1, 1], [2, 0.35], [3, 0.12], [4.01, 0.06]]) {
      const o = osc(ctx, 'sine', freq * mul, t, t + 2.2); const og = ctx.createGain(); og.gain.value = gv; o.connect(og); og.connect(g);
    }
    g.connect(out);
    env(g, t, 0.004, vol, 1.9);
  },
  kick(ctx, out, t, vol = 0.35) {
    const g = ctx.createGain(); const o = osc(ctx, 'sine', 120, t, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    o.connect(g); g.connect(out); env(g, t, 0.003, vol, 0.35);
  },
  drum(ctx, out, t, vol = 0.18, freq = 220) {
    const g = ctx.createGain(); const n = noise(ctx, t, 0.3);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.5;
    n.connect(f); f.connect(g); g.connect(out); env(g, t, 0.002, vol, 0.22);
    const o = osc(ctx, 'sine', freq * 0.7, t, t + 0.3); const og = ctx.createGain(); o.connect(og); og.connect(out); env(og, t, 0.002, vol * 0.6, 0.2);
  },
  bell(ctx, out, freq, t, vol = 0.12, len = 1.6) {
    const g = ctx.createGain();
    for (const [mul, gv] of [[1, 1], [2.76, 0.4], [5.4, 0.2]]) { const o = osc(ctx, 'sine', freq * mul, t, t + len); const og = ctx.createGain(); og.gain.value = gv; o.connect(og); og.connect(g); }
    g.connect(out); env(g, t, 0.003, vol, len);
  },
  horn(ctx, out, freq, t, dur, vol = 0.12) {
    const g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1600, t + 0.15);
    const o = osc(ctx, 'sawtooth', freq, t, t + dur + 0.4);
    const lfo = osc(ctx, 'sine', 5.5, t, t + dur + 0.4); const lg = ctx.createGain(); lg.gain.value = freq * 0.01; lfo.connect(lg); lg.connect(o.frequency);
    o.connect(f); f.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.12); g.gain.setValueAtTime(vol, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
  },
  clash(ctx, out, t, vol = 0.2) {
    const g = ctx.createGain(); const n = noise(ctx, t, 0.4);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200 + Math.random() * 1500; f.Q.value = 6;
    n.connect(f); f.connect(g); g.connect(out); env(g, t, 0.001, vol, 0.3);
    VOICES.bell(ctx, out, 1800 + Math.random() * 600, t, vol * 0.3, 0.4);
  },
  knock(ctx, out, t, vol = 0.25) {
    const g = ctx.createGain(); const n = noise(ctx, t, 0.12);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 3;
    n.connect(f); f.connect(g); g.connect(out); env(g, t, 0.001, vol, 0.08);
    const o = osc(ctx, 'triangle', 180, t, t + 0.12); const og = ctx.createGain(); o.connect(og); og.connect(out); env(og, t, 0.001, vol * 0.6, 0.09);
  },
  whoosh(ctx, out, t, vol = 0.12, dur = 0.6) {
    const g = ctx.createGain(); const n = noise(ctx, t, dur + 0.1);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2500, t + dur);
    n.connect(f); f.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
};

// ---------------- Sound effects ----------------
// Low filtered noise: earthquakes, explosions, fire, wind
function rumble(ctx, out, t, dur, freq = 120, vol = 0.3, q = 0.7) {
  const n = noise(ctx, t, dur + 0.2);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  n.connect(f); f.connect(g); g.connect(out);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.3, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
export const SFX = {
  quake: (c, o, t) => { rumble(c, o, t, 2.6, 70, 0.55); rumble(c, o, t + 0.4, 1.6, 160, 0.2); VOICES.kick(c, o, t + 0.2, 0.3); },
  meteor: (c, o, t) => { VOICES.whoosh(c, o, t, 0.12, 0.7); VOICES.kick(c, o, t + 0.7, 0.6); rumble(c, o, t + 0.7, 2.4, 200, 0.6); },
  lightning: (c, o, t) => { rumble(c, o, t, 0.25, 6000, 0.25, 0.2); rumble(c, o, t + 0.05, 2.2, 110, 0.5); },
  fire: (c, o, t) => { rumble(c, o, t, 1.8, 1800, 0.12, 0.3); for (let i = 0; i < 6; i++) VOICES.knock(c, o, t + Math.random() * 1.4, 0.05); },
  eruption: (c, o, t) => { VOICES.kick(c, o, t, 0.7); rumble(c, o, t, 3.2, 90, 0.6); rumble(c, o, t + 0.3, 2.5, 600, 0.15); },
  plague: (c, o, t) => { [[50, 0], [49, 0.4], [46, 0.8]].forEach(([m, d]) => VOICES.pad(c, o, mtof(m), t + d, 0.9, 0.035)); },
  bless: (c, o, t) => { [72, 76, 79, 83, 88].forEach((m, i) => VOICES.bell(c, o, mtof(m), t + i * 0.08, 0.06, 2)); VOICES.pad(c, o, mtof(60), t, 1.6, 0.03); },
  curse: (c, o, t) => { VOICES.horn(c, o, mtof(38), t, 1.2, 0.12); VOICES.horn(c, o, mtof(39), t + 0.05, 1.2, 0.08); },
  flood: (c, o, t) => { rumble(c, o, t, 2.4, 900, 0.18, 0.4); VOICES.whoosh(c, o, t + 0.2, 0.06, 1.2); },
  wind: (c, o, t) => { VOICES.whoosh(c, o, t, 0.07, 1.6); rumble(c, o, t, 1.8, 500, 0.08, 2); },
  click: (c, o, t) => VOICES.bell(c, o, 1400, t, 0.03, 0.12),
  build: (c, o, t) => { VOICES.knock(c, o, t); VOICES.knock(c, o, t + 0.16, 0.2); VOICES.knock(c, o, t + 0.32, 0.22); },
  research: (c, o, t) => [72, 76, 79, 84].forEach((m, i) => VOICES.bell(c, o, mtof(m), t + i * 0.11, 0.08, 1.4)),
  war: (c, o, t) => { for (let i = 0; i < 8; i++) VOICES.drum(c, o, t + i * 0.07, 0.12 + i * 0.015, 160); VOICES.horn(c, o, mtof(43), t + 0.6, 1.1, 0.14); VOICES.horn(c, o, mtof(50), t + 0.6, 1.1, 0.08); },
  battle: (c, o, t) => { for (let i = 0; i < 5; i++) VOICES.clash(c, o, t + i * 0.13 + Math.random() * 0.05, 0.16); VOICES.kick(c, o, t, 0.3); },
  victory: (c, o, t) => { [[60, 0], [64, 0.18], [67, 0.36], [72, 0.6]].forEach(([m, d]) => VOICES.horn(c, o, mtof(m), t + d, d > 0.5 ? 0.9 : 0.16, 0.1)); },
  defeat: (c, o, t) => { [[55, 0], [51, 0.35], [48, 0.7]].forEach(([m, d]) => VOICES.horn(c, o, mtof(m), t + d, 0.5, 0.09)); },
  event: (c, o, t) => { VOICES.whoosh(c, o, t, 0.06, 0.35); VOICES.bell(c, o, mtof(81), t + 0.25, 0.06, 1.2); VOICES.bell(c, o, mtof(76), t + 0.4, 0.05, 1.2); },
  toast: (c, o, t) => VOICES.bell(c, o, mtof(84), t, 0.04, 0.8),
  coin: (c, o, t) => { VOICES.bell(c, o, mtof(91), t, 0.05, 0.4); VOICES.bell(c, o, mtof(96), t + 0.07, 0.04, 0.5); },
  era: (c, o, t) => { [48, 55, 60, 64, 67].forEach((m) => VOICES.pad(c, o, mtof(m), t, 2.2, 0.035)); VOICES.bell(c, o, mtof(84), t + 0.3, 0.07, 2.5); },
  settle: (c, o, t) => { VOICES.lute(c, o, mtof(67), t, 0.4); VOICES.lute(c, o, mtof(72), t + 0.18, 0.5); },
  ship: (c, o, t) => { VOICES.whoosh(c, o, t, 0.09, 0.9); VOICES.bell(c, o, mtof(74), t + 0.2, 0.06, 1.5); },
  birth: (c, o, t) => { VOICES.bell(c, o, mtof(79), t, 0.04, 1); VOICES.bell(c, o, mtof(84), t + 0.15, 0.04, 1.2); },
};

// ---------------- Generative music ----------------
const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const MOOD_MODES = { peace: ['ionian', 'mixolydian', 'dorian', 'lydian'], war: ['aeolian', 'phrygian', 'harmonic'], menu: ['dorian', 'aeolian', 'mixolydian'], night: ['dorian', 'aeolian', 'lydian'] };
const LEAD = ['flute', 'lute', 'harpsi', 'piano'];
// Phase 21: each people has its own voice in the early eras
const RACE_LEAD = { elves: 'harp', lizardfolk: 'marimba', halflings: 'lute', dwarves: 'horn', orcs: 'lute' };

class Music {
  constructor(engine) {
    this.e = engine;
    this.mood = 'menu'; this.era = 0;
    this.step = 0; this.next = 0; this.section = null; this.timer = null;
    this.melody = 0;
  }
  setMood(mood, era, race) {
    this.race = race || this.race;
    if (mood === this.mood && era === this.era) return;
    const changed = mood !== this.mood;
    this.mood = mood; this.era = era;
    if (changed) this.section = null; // start a fresh section in the new mood
  }
  newSection() {
    const r = Math.random;
    const modes = MOOD_MODES[this.mood];
    const mode = MODES[modes[Math.floor(r() * modes.length)]];
    const root = [50, 52, 53, 55, 57][Math.floor(r() * 5)];
    const prog = this.mood === 'war' ? [0, 5, 3, 4] : [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3], [0, 2, 3, 4]][Math.floor(r() * 4)];
    const tempo = this.mood === 'war' ? 96 + r() * 12 : this.mood === 'menu' ? 62 : this.mood === 'night' ? 54 + r() * 8 : 66 + r() * 12;
    this.section = { mode, root, prog, tempo, bars: 16, bar: 0, rest: this.mood !== 'war' && r() < 0.35 };
    this.melody = 7 + Math.floor(r() * 4);
  }
  degree(d, octave = 0) {
    const s = this.section;
    const n = s.mode.length;
    const oct = Math.floor(d / n);
    return s.root + s.mode[((d % n) + n) % n] + 12 * (oct + octave);
  }
  // Schedule notes up to `until` (AudioContext time).
  schedule(until) {
    const e = this.e, ctx = e.ctx, out = e.musicBus;
    if (!this.section) { this.newSection(); this.next = Math.max(this.next, ctx.currentTime + 0.1); this.step = 0; }
    while (this.next < until) {
      const s = this.section;
      const eighth = 30 / s.tempo;
      const t = this.next;
      const barStep = this.step % 8;
      if (barStep === 0) {
        s.bar = Math.floor(this.step / 8);
        if (s.bar >= s.bars) { this.newSection(); this.step = 0; this.next += eighth * 4; continue; }
      }
      const chord = s.prog[Math.floor(s.bar / 2) % s.prog.length];
      const resting = s.rest && s.bar >= 12;
      // Pad + bass every two bars
      if (barStep === 0 && s.bar % 2 === 0 && !resting) {
        for (const d of [0, 2, 4]) VOICES.pad(ctx, out, mtof(this.degree(chord + d, 0)), t, eighth * 16, this.mood === 'war' ? 0.03 : 0.035);
      }
      if ((barStep === 0 || (barStep === 4 && this.mood === 'war')) && !resting) VOICES.bass(ctx, out, mtof(this.degree(chord, -1)), t, eighth * 3.5, 0.1);
      // Lead melody: a gentle random walk over the mode, anchored to chord tones
      const density = this.mood === 'war' ? 0.6 : this.mood === 'menu' ? 0.3 : this.mood === 'night' ? 0.22 : 0.42;
      if (!resting && Math.random() < density && (barStep % 2 === 0 || Math.random() < 0.3)) {
        const r = Math.random();
        this.melody += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : 0;
        this.melody = Math.max(4, Math.min(13, this.melody));
        if (barStep === 0) this.melody = chord + 7 + [0, 2, 4][Math.floor(Math.random() * 3)];
        const len = eighth * (Math.random() < 0.3 ? 4 : 2);
        const lead = this.era <= 1 && RACE_LEAD[this.race] && (RACE_LEAD[this.race] !== 'horn' || Math.random() < 0.5) ? RACE_LEAD[this.race] : LEAD[Math.min(3, this.era)];
        VOICES[lead](ctx, out, mtof(this.degree(this.melody, 0)), t, len, lead === 'horn' ? 0.06 : undefined);
        // a soft harp arpeggio answers at night
        if (this.mood === 'night' && barStep === 0 && Math.random() < 0.5) for (let k = 0; k < 3; k++) VOICES.harp(ctx, out, mtof(this.degree(chord + k * 2, 1)), t + k * eighth, eighth, 0.035);
      }
      // Percussion
      if (this.mood === 'war') {
        if (barStep === 0 || barStep === 4) VOICES.kick(ctx, out, t, 0.22);
        if (barStep === 2 || barStep === 6 || (barStep === 7 && Math.random() < 0.5)) VOICES.drum(ctx, out, t, 0.08, 240);
      } else if (this.race === 'orcs' && this.mood === 'peace' && (barStep === 0 || barStep === 3) && !resting) {
        VOICES.drum(ctx, out, t, 0.07, 140); // orc camps keep a war-drum beat even in peace
      } else if (this.era <= 1 && barStep === 0 && s.bar % 2 === 1 && !resting && this.mood !== 'night') {
        VOICES.drum(ctx, out, t, 0.05, 180);
      }
      this.step++;
      this.next += eighth;
    }
  }
}

// ---------------- Engine ----------------
class AudioEngine {
  constructor() {
    this.ctx = null; this.ready = false;
    this.vol = { master: 0.8, music: 0.5, sfx: 0.7, ambience: 0.8, muted: false };
    this.music = new Music(this);
    this.amb = new Ambience(this);
    this.track = null; // a looping music file playing instead of the generated music
    this.lastSfx = {};
  }
  unlock() {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    // gentle hall reverb from a generated impulse
    const len = ctx.sampleRate * 2.4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.28;
    this.musicBus.connect(this.comp); this.musicBus.connect(this.reverb);
    this.sfxBus.connect(this.comp); this.sfxBus.connect(this.reverb);
    this.reverb.connect(wet); wet.connect(this.comp);
    this.comp.connect(this.master); this.master.connect(ctx.destination);
    this.ready = true;
    this.applyVolume();
    this.timer = setInterval(() => this.tick(), 120);
    loadAudioFiles(ctx).then((n) => { if (n) console.info(`Audio slots: ${n} recordings loaded`); this.amb.layers = null; }); // Phase 21
  }
  applyVolume() {
    if (!this.ready) return;
    const v = this.vol, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(v.muted ? 0 : v.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(v.music, t, 0.3);
    this.sfxBus.gain.setTargetAtTime(v.sfx, t, 0.05);
  }
  setVolume(o) { Object.assign(this.vol, o); this.applyVolume(); }
  tick() {
    if (!this.ready || this.ctx.state !== 'running' || this.vol.muted || this.vol.music <= 0.001 || this.vol.master <= 0.001) {
      if (this.ready) this.music.next = this.ctx.currentTime;
      return;
    }
    // a recorded track for this mood (audio slots) plays instead of the generated music
    const file = audioFile('music', this.music.mood);
    if (file) { this.playTrack(this.music.mood, file); this.music.next = this.ctx.currentTime; return; }
    if (this.track) this.stopTrack();
    this.music.schedule(this.ctx.currentTime + 0.6);
  }
  playTrack(key, buf) {
    if (this.track?.key === key) return;
    this.stopTrack();
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.musicBus);
    g.gain.setTargetAtTime(1, this.ctx.currentTime, 1.5); src.start();
    this.track = { key, src, g };
  }
  stopTrack() {
    if (!this.track) return;
    const { src, g } = this.track, t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0, t, 1); src.stop(t + 5);
    this.track = null;
  }
  setMood(mood, era = 0, race) { this.music.setMood(mood, era, race); }
  ambience(s) { try { this.amb.update(s); } catch (e) { console.warn('ambience', e); } }
  play(name) {
    if (!this.ready || this.vol.muted || !SFX[name]) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastSfx[name] || 0) < (name === 'click' ? 0.05 : 0.35)) return; // avoid pile-ups at high speed
    this.lastSfx[name] = now;
    const file = audioFile('sfx', name); // a recorded effect, if one is in the audio slots
    if (file) { const src = this.ctx.createBufferSource(); src.buffer = file; src.connect(this.sfxBus); src.start(now + 0.01); return; }
    SFX[name](this.ctx, this.sfxBus, now + 0.01);
  }
}

export const audio = new AudioEngine();

// Render a voice offline (used by tests): returns RMS loudness.
export async function renderOffline(name, seconds = 2) {
  const ctx = new OfflineAudioContext(1, 44100 * seconds, 44100);
  SFX[name](ctx, ctx.destination, 0.01);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
  return Math.sqrt(s / d.length);
}
