// Background music for the tutorial video: an original piece written for it,
// in the spirit of the classic Heroes III soundtrack (pastoral and classical,
// strings, harp, woodwinds and piano), synthesized here from scratch: no
// samples, nothing taken from the game's music. Every note is in this file.
//
//   node docs/tutorial/music.mjs --out <capture output folder>
//
// renders music for the length of the recording in that folder and mixes it
// under HoMM3-Scenario-Creator-tutorial.mp4 and every clip in clips/.
// capture.mjs calls addMusic() itself unless it is given --no-music.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;

// ------------------------------------------------------------ the score

// Chords as pitch classes above the tonic (D).
const CH = {
  I: [0, 4, 7],
  ii: [2, 5, 9],
  iii: [4, 7, 11],
  IV: [5, 9, 0],
  V: [7, 11, 2],
  V7: [7, 11, 2, 5],
  vi: [9, 0, 4],
  bVII: [10, 2, 5],
  "V/vi": [6, 10, 1],
};

// Five 16-bar themes, written for this video: the meter, one chord per bar,
// and the melody as [MIDI note or null for a rest, beats].
const THEMES = {
  pastoral: {
    meter: 3,
    chords: ["I", "IV", "vi", "V", "I", "iii", "IV", "V", "vi", "ii", "V", "I", "IV", "bVII", "V", "I"],
    melody: [
      [[69, 2], [66, 1]], [[67, 1], [69, 1], [71, 1]], [[74, 2], [73, 1]], [[71, 1], [69, 2]],
      [[66, 1], [69, 1], [74, 1]], [[73, 2], [69, 1]], [[71, 1], [74, 1], [71, 1]], [[69, 3]],
      [[71, 2], [74, 1]], [[79, 1.5], [78, 0.5], [76, 1]], [[73, 1], [76, 1], [69, 1]], [[74, 3]],
      [[74, 1], [71, 1], [67, 1]], [[72, 2], [67, 1]], [[69, 1], [73, 1], [76, 1]], [[74, 3]],
    ],
  },
  lament: {
    meter: 3,
    chords: ["vi", "iii", "IV", "I", "ii", "V", "I", "V/vi", "vi", "IV", "I", "V", "vi", "ii", "V7", "I"],
    melody: [
      [[71, 2], [74, 1]], [[73, 2], [69, 1]], [[71, 1], [67, 1], [71, 1]], [[69, 3]],
      [[67, 1], [71, 1], [76, 1]], [[76, 1.5], [74, 0.5], [73, 1]], [[74, 2], [66, 1]], [[70, 2], [73, 1]],
      [[74, 2], [71, 1]], [[79, 2], [74, 1]], [[78, 1], [74, 1], [69, 1]], [[76, 3]],
      [[74, 1], [73, 1], [71, 1]], [[67, 1], [71, 1], [79, 1]], [[78, 1], [76, 1], [73, 1]], [[74, 3]],
    ],
  },
  heroic: {
    meter: 3,
    chords: ["I", "bVII", "IV", "I", "vi", "IV", "V", "V", "I", "bVII", "IV", "I", "ii", "V", "I", "I"],
    melody: [
      [[62, 1], [66, 1], [69, 1]], [[72, 2], [67, 1]], [[67, 1], [71, 1], [74, 1]], [[74, 2], [69, 1]],
      [[71, 1.5], [69, 0.5], [66, 1]], [[67, 2], [71, 1]], [[69, 1], [73, 1], [76, 1]], [[76, 2], [73, 1]],
      [[74, 2], [78, 1]], [[79, 1], [76, 1], [72, 1]], [[74, 1], [71, 1], [67, 1]], [[69, 3]],
      [[71, 1], [67, 1], [64, 1]], [[69, 1], [73, 1], [76, 1]], [[74, 3]], [[66, 1], [69, 1], [74, 1]],
    ],
  },
  march: {
    meter: 4,
    chords: ["I", "I", "IV", "V", "vi", "iii", "IV", "V", "I", "V/vi", "vi", "IV", "ii", "V", "I", "I"],
    melody: [
      [[62, 1.5], [66, 0.5], [69, 1], [74, 1]], [[74, 1.5], [73, 0.5], [71, 1], [69, 1]],
      [[71, 1.5], [74, 0.5], [79, 1], [78, 1]], [[76, 3], [69, 1]],
      [[71, 1.5], [69, 0.5], [66, 1], [71, 1]], [[73, 1.5], [71, 0.5], [69, 2]],
      [[67, 1], [71, 1], [74, 1], [76, 1]], [[76, 2], [73, 1], [69, 1]],
      [[74, 1.5], [78, 0.5], [81, 2]], [[82, 1], [78, 1], [73, 2]],
      [[74, 1.5], [71, 0.5], [66, 2]], [[67, 1], [71, 1], [74, 1], [79, 1]],
      [[76, 1.5], [74, 0.5], [71, 1], [67, 1]], [[69, 1], [73, 1], [76, 1], [73, 1]],
      [[74, 4]], [[62, 1], [66, 1], [69, 1], [null, 1]],
    ],
  },
  nocturne: {
    meter: 4,
    chords: ["I", "vi", "ii", "V", "I", "IV", "ii", "V", "iii", "vi", "IV", "I", "ii", "V7", "I", "I"],
    melody: [
      [[78, 2], [76, 1], [74, 1]], [[73, 3], [71, 1]], [[71, 1], [69, 1], [67, 1], [76, 1]], [[73, 4]],
      [[74, 2], [78, 1], [81, 1]], [[79, 3], [76, 1]], [[74, 1], [76, 1], [71, 2]], [[69, 4]],
      [[71, 2], [73, 1], [76, 1]], [[74, 2], [73, 1], [71, 1]], [[69, 1.5], [71, 0.5], [74, 2]], [[74, 2], [69, 2]],
      [[71, 2], [76, 2]], [[79, 1], [78, 1], [76, 1], [73, 1]], [[74, 4]], [[null, 4]],
    ],
  },
};

// The running order. Each section has its own theme, tempo, accompaniment
// texture, lead (or none), key (semitones from D) and loudness, so the
// pulse, meter and colour keep changing:
//   arp      harp broken chords, four rhythms, settling every fourth bar
//   rolled   rolled harp chords and long cello notes, no running pulse
//   waltz    piano left hand: bass, then two chord beats (3/4 only)
//   chorale  sustained strings only, swelling with the phrase
//   pizz     pizzicato bass and chords on the beat, with timpani: a march
//   nocturne piano left hand that wanders, never the same two bars running
const ORDER = [
  { theme: "pastoral", bpm: 78, tex: "rolled", lead: null, t: 0, dyn: 0.7 },
  { theme: "pastoral", bpm: 84, tex: "arp", lead: "flute", t: 0, dyn: 0.85 },
  { theme: "nocturne", bpm: 63, tex: "nocturne", lead: "piano", t: 0, dyn: 0.7 },
  { theme: "march", bpm: 100, tex: "pizz", lead: "horn", t: 0, dyn: 1, timpani: true },
  { theme: "lament", bpm: 66, tex: "chorale", lead: "strings", t: 0, dyn: 0.75 },
  { theme: "pastoral", bpm: 88, tex: "waltz", lead: "flute", t: 5, dyn: 0.85 },
  { theme: "heroic", bpm: 92, tex: "rolled", lead: "horn", t: 5, dyn: 1, timpani: true },
  { theme: "nocturne", bpm: 60, tex: "nocturne", lead: "flute", t: -2, dyn: 0.65 },
  { theme: "lament", bpm: 72, tex: "arp", lead: "piano", t: -2, dyn: 0.8 },
  { theme: "march", bpm: 104, tex: "pizz", lead: "strings", t: 5, dyn: 1, timpani: true },
  { theme: "heroic", bpm: 86, tex: "chorale", lead: "horn", t: 0, dyn: 0.9, timpani: true },
  { theme: "pastoral", bpm: 80, tex: "waltz", lead: "piano", t: -2, dyn: 0.75 },
  { theme: "lament", bpm: 66, tex: "rolled", lead: "flute", t: 5, dyn: 0.7 },
  { theme: "nocturne", bpm: 63, tex: "nocturne", lead: "piano", t: 5, dyn: 0.65 },
  { theme: "march", bpm: 100, tex: "pizz", lead: "horn", t: -2, dyn: 1, timpani: true },
  { theme: "pastoral", bpm: 84, tex: "arp", lead: "strings", t: 0, dyn: 0.85 },
  { theme: "heroic", bpm: 90, tex: "rolled", lead: "strings", t: 0, dyn: 1, timpani: true },
  { theme: "pastoral", bpm: 76, tex: "chorale", lead: "flute", t: 0, dyn: 0.7 },
];

// ------------------------------------------------------------ synthesis

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

class Mix {
  constructor(seconds) {
    this.n = Math.ceil(seconds * SR);
    this.L = new Float32Array(this.n);
    this.R = new Float32Array(this.n);
    this.wetL = new Float32Array(this.n);
    this.wetR = new Float32Array(this.n);
  }
  /** Adds a mono signal at time t (s) with pan (-1..1), gain and reverb send. */
  put(t, sig, pan, gain, send) {
    const at = Math.round(t * SR);
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    const end = Math.min(sig.length, this.n - at);
    for (let i = Math.max(0, -at); i < end; i++) {
      const v = sig[i];
      this.L[at + i] += v * gl;
      this.R[at + i] += v * gr;
      this.wetL[at + i] += v * gl * send;
      this.wetR[at + i] += v * gr * send;
    }
  }
}

/** Harp / lute: Karplus-Strong plucked string. */
function pluck(m, seconds, rand, bright = 0.5) {
  const f = hz(m);
  const N = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const x = rand() * 2 - 1;
    prev = prev + bright * (x - prev); // soften the attack
    buf[i] = prev;
  }
  const out = new Float32Array(Math.round(seconds * SR));
  // loss per period for a ring time (T60) that shortens as the pitch rises
  const t60 = Math.max(0.8, 2.4 - f / 700);
  const decay = 10 ** (-3 / (t60 * f));
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const a = buf[idx];
    const b = buf[(idx + 1) % N];
    buf[idx] = decay * 0.5 * (a + b);
    out[i] = a;
    idx = (idx + 1) % N;
  }
  return tail(out);
}

/** Fades the last 0.25 s so a note cut short does not click. */
function tail(sig) {
  const n = Math.min(sig.length, Math.round(0.25 * SR));
  for (let i = 0; i < n; i++) sig[sig.length - 1 - i] *= i / n;
  return sig;
}

/** Soft piano: slightly inharmonic partials with per-partial decay. */
function piano(m, seconds, vel = 1) {
  const f = hz(m);
  const out = new Float32Array(Math.round(seconds * SR));
  const B = 0.0003;
  for (let k = 1; k <= 8; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k);
    if (fk > SR / 2.2) break;
    const amp = vel / k ** 1.4;
    const d = 0.8 + 0.45 * k + f / 900;
    const w = (2 * Math.PI * fk) / SR;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.004) * Math.exp(-d * t);
      out[i] += amp * env * Math.sin(w * i);
    }
  }
  return tail(out);
}

const blep = (t, dt) => {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
};

/**
 * Bowed / blown voice: detuned band-limited saws through a resonant
 * low-pass, with attack, release and delayed vibrato. Strings, horn, cello.
 */
function bowed(m, seconds, { voices = 3, detune = 7, cutoff = 2000, attack = 0.3, release = 0.5, vib = 0.004, q = 0.6, rand }) {
  const f = hz(m);
  const len = Math.round((seconds + release) * SR);
  const out = new Float32Array(len);
  const phases = Array.from({ length: voices }, () => rand());
  const ratios = Array.from({ length: voices }, (_, v) => 2 ** (((v - (voices - 1) / 2) * detune) / 1200));
  let low = 0;
  let band = 0;
  const fc = 2 * Math.sin((Math.PI * Math.min(cutoff, SR / 6)) / SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const vibAmt = vib * Math.min(1, Math.max(0, (t - 0.25) / 0.6));
    const fm = f * (1 + vibAmt * Math.sin(2 * Math.PI * 5.1 * t));
    let s = 0;
    for (let v = 0; v < voices; v++) {
      const dt = (fm * ratios[v]) / SR;
      let p = phases[v] + dt;
      if (p >= 1) p -= 1;
      phases[v] = p;
      s += 2 * p - 1 - blep(p, dt);
    }
    s /= voices;
    // state-variable low-pass
    low += fc * band;
    const high = s - low - q * band;
    band += fc * high;
    const env = t < seconds ? Math.min(1, t / attack) : Math.max(0, 1 - (t - seconds) / release);
    out[i] = low * env;
  }
  return out;
}

/** Flute: near-sine with a little breath and vibrato. */
function flute(m, seconds, rand) {
  const f = hz(m);
  const rel = 0.15;
  const len = Math.round((seconds + rel) * SR);
  const out = new Float32Array(len);
  let ph = 0;
  let nz = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const vib = 0.005 * Math.min(1, Math.max(0, (t - 0.2) / 0.4)) * Math.sin(2 * Math.PI * 5.3 * t);
    ph += (2 * Math.PI * f * (1 + vib)) / SR;
    nz += 0.08 * (rand() * 2 - 1 - nz);
    const env = t < seconds ? Math.min(1, t / 0.07) : Math.max(0, 1 - (t - seconds) / rel);
    out[i] = env * (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph) + 0.35 * nz);
  }
  return out;
}

/** Timpani: pitched thump with a short noise skin. */
function timpani(m, seconds, rand) {
  const f = hz(m);
  const out = new Float32Array(Math.round(seconds * SR));
  let ph = 0;
  let nz = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f * (1 + 0.08 * Math.exp(-t * 30))) / SR;
    nz += 0.2 * (rand() * 2 - 1 - nz);
    out[i] = Math.exp(-t * 2.6) * (Math.sin(ph) + 0.4 * Math.sin(1.5 * ph)) + Math.exp(-t * 40) * nz;
  }
  return out;
}

/** Freeverb-style hall on the send buses. */
function reverb(mix, room = 0.86, damp = 0.35) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const alls = [556, 441, 341, 225];
  const fb = room * 0.28 + 0.7;
  const run = (input, spread) => {
    const out = new Float32Array(input.length);
    for (const c of combs) {
      const buf = new Float32Array(c + spread);
      let idx = 0;
      let store = 0;
      for (let i = 0; i < input.length; i++) {
        const y = buf[idx];
        store = y * (1 - damp) + store * damp;
        buf[idx] = input[i] * 0.015 + store * fb;
        idx = (idx + 1) % buf.length;
        out[i] += y;
      }
    }
    for (const a of alls) {
      const buf = new Float32Array(a + spread);
      let idx = 0;
      for (let i = 0; i < out.length; i++) {
        const b = buf[idx];
        const x = out[i];
        buf[idx] = x + b * 0.5;
        out[i] = b - x;
        idx = (idx + 1) % buf.length;
      }
    }
    return out;
  };
  return [run(mix.wetL, 0), run(mix.wetR, 23)];
}

// ------------------------------------------------------------ arrangement

/** Chord tones near a center note. */
function voicing(pcs, root, center, count) {
  const notes = [];
  for (let m = center - 9; notes.length < count && m < center + 15; m++) {
    if (pcs.includes(((m - root) % 12 + 12) % 12)) notes.push(m);
  }
  return notes;
}

/** Harp rhythms for "arp", as [chord tone, beats]. */
const ARP = {
  3: [
    [[0, 0.5], [2, 0.5], [3, 0.5], [4, 0.5], [3, 0.5], [2, 0.5]],
    [[0, 1], [3, 0.5], [4, 0.5], [2, 1]],
    [[0, 0.5], [2, 0.5], [4, 2]],
    [[1, 1.5], [3, 0.5], [4, 1]],
  ],
  4: [
    [[0, 1], [2, 0.5], [3, 0.5], [4, 1], [2, 1]],
    [[0, 0.5], [2, 0.5], [4, 1], [3, 2]],
  ],
};

/** "nocturne" left-hand figures, as [beat, chord tone]; 0 is the bass. */
const NOCTURNE = [
  [[0, 0], [1, 2], [2, 3], [3, 2]],
  [[0, 0], [1.5, 3], [2.5, 4]],
  [[0, 0], [1, 1], [2, 3], [2.5, 4], [3.5, 3]],
  [[0, 0], [2, 2], [2, 3]],
];

/** Renders `seconds` of music as interleaved 16-bit stereo PCM. */
export function renderMusic(seconds, seed = 3) {
  const rand = rng(seed);
  const mix = new Mix(seconds);
  const human = () => (rand() - 0.5) * 0.012;
  const strum = (t, notes, gain, step = 0.035) =>
    notes.forEach((m, i) => mix.put(t + i * step + human(), pluck(m, 3, rand, 0.4), -0.4 + (i / notes.length) * 0.8, gain, 0.4));

  let t = 1.0; // a breath of silence under the title card
  for (let s = 0; t < seconds; s++) {
    const sec = ORDER[s % ORDER.length];
    const theme = THEMES[sec.theme];
    const meter = theme.meter;
    const tonic = 62 + sec.t; // D, or G (+5), or C (-2)
    for (let bar = 0; bar < 16 && t < seconds; bar++) {
      // Tempo: a gentle slowing over the last two bars, then a breath.
      const slow = bar >= 14 ? 1 + 0.12 * (bar - 13) : 1;
      const beat = (60 / sec.bpm) * slow;
      const barLen = meter * beat;
      const cadence = bar % 4 === 3;
      // Loudness: the section's level, swelling over each four-bar phrase.
      const dyn = sec.dyn * (0.8 + 0.2 * Math.sin((Math.PI * ((bar % 4) + 0.5)) / 4));

      const pcs = CH[theme.chords[bar]];
      const root = tonic + pcs[0];
      const bass = 38 + ((((root - 38) % 12) + 12) % 12);
      const chord = voicing(pcs, tonic, 57, 5);
      const pad = (gain, attack = 0.45) => {
        for (const [i, note] of voicing(pcs, tonic, 64, 4).entries()) {
          mix.put(t, bowed(note, barLen, { voices: 3, detune: 8, cutoff: 1500, attack, release: 0.7, vib: 0.003, rand }), -0.5 + i * 0.33, gain * dyn, 0.5);
        }
      };
      const cello = (at, dur, gain = 0.09) =>
        mix.put(at, bowed(bass, dur, { voices: 2, detune: 5, cutoff: 700, attack: 0.15, release: 0.4, vib: 0.002, rand }), 0.1, gain * dyn, 0.3);

      switch (sec.tex) {
        case "arp": {
          if (cadence) strum(t, chord, 0.13 * dyn);
          else {
            let at = t;
            for (const [k, beats] of ARP[meter][(bar + s) % ARP[meter].length]) {
              mix.put(at + human(), pluck(chord[k] ?? chord[0], 2.4, rand, 0.45), -0.35 + k * 0.15, 0.16 * dyn, 0.35);
              at += beats * beat;
            }
          }
          pad(0.03);
          if (bar % 2 === 0) cello(t, barLen * 2 * 0.95);
          break;
        }
        case "rolled": {
          if (bar % 2 === 0) strum(t, chord, 0.15 * dyn, 0.05);
          else if (!cadence) mix.put(t + (meter - 1) * beat, pluck(chord[4] + 12, 2.5, rand, 0.4), 0.3, 0.1 * dyn, 0.45);
          pad(0.03, 0.8);
          if (bar % 2 === 0) cello(t, barLen * 2 * 0.95, 0.1);
          break;
        }
        case "waltz": {
          mix.put(t + human(), piano(bass, 2.5, 0.8), -0.1, 0.12 * dyn, 0.35);
          const upper = voicing(pcs, tonic, 57, 3);
          if (cadence) for (const m of upper) mix.put(t + beat + human(), piano(m, 2.8, 0.5), 0, 0.09 * dyn, 0.35);
          else
            for (let b = 1; b < meter; b++) for (const m of upper) mix.put(t + b * beat + human(), piano(m, 1.2, 0.45), 0, 0.08 * dyn, 0.35);
          pad(0.02);
          break;
        }
        case "chorale": {
          pad(0.05, 0.9);
          cello(t, barLen * 0.98, 0.11);
          break;
        }
        case "pizz": {
          const pz = (at, m, gain, pan) => mix.put(at + human(), pluck(m, 0.9, rand, 0.8), pan, gain * dyn, 0.25);
          const upper = voicing(pcs, tonic, 60, 2);
          for (let b = 0; b < meter; b++) {
            if (cadence && b > 0) break;
            if (b % 2 === 0) pz(t + b * beat, b === 0 ? bass : bass + 7, 0.22, 0.1);
            else for (const m of upper) pz(t + b * beat, m, 0.12, -0.2);
          }
          if (cadence) pad(0.03);
          break;
        }
        case "nocturne": {
          const lh = voicing(pcs, tonic, 52, 5);
          for (const [b, k] of NOCTURNE[(bar * 3 + s) % NOCTURNE.length]) {
            const m = k === 0 ? bass + 12 : lh[k] ?? lh[0];
            mix.put(t + b * beat + human(), piano(m, 3, k === 0 ? 0.75 : 0.5), -0.15, 0.1 * dyn, 0.45);
          }
          pad(0.015, 1.2);
          break;
        }
      }

      // Timpani: a stroke at the start of each phrase, and a roll into the last bar.
      if (sec.timpani) {
        const tp = bass + 12 > 52 ? bass : bass + 12;
        if (bar % 4 === 0) mix.put(t, timpani(tp, 2.2, rand), 0, 0.22 * dyn, 0.4);
        if (bar === 14) for (let r = 0; r < 8; r++) mix.put(t + (meter - 1) * beat + (r * beat) / 8, timpani(tp, 0.6, rand), 0, (0.05 + r * 0.012) * dyn, 0.4);
      }

      // Lead.
      if (sec.lead) {
        let at = t;
        for (const [m, beats] of theme.melody[bar]) {
          const dur = beats * beat;
          if (m !== null) {
            const note = m + sec.t;
            if (sec.lead === "flute") mix.put(at + human(), flute(note + 12, dur * 0.95, rand), 0.15, 0.07 * dyn, 0.45);
            else if (sec.lead === "piano") mix.put(at + human(), piano(note, Math.max(2.5, dur + 1.5), 0.9), 0.05, 0.11 * dyn, 0.4);
            else if (sec.lead === "horn") mix.put(at + human(), bowed(note - 12, dur * 0.92, { voices: 2, detune: 4, cutoff: 1100, attack: 0.09, release: 0.25, vib: 0.0025, q: 0.8, rand }), -0.1, 0.1 * dyn, 0.45);
            else mix.put(at + human(), bowed(note, dur * 0.97, { voices: 4, detune: 10, cutoff: 2600, attack: 0.15, release: 0.4, vib: 0.005, rand }), -0.2, 0.07 * dyn, 0.5);
          }
          at += dur;
        }
      }
      t += barLen;
    }
    t += 60 / sec.bpm; // a beat of breath between sections
  }

  // Reverb, level, fades, soft limit.
  const [rl, rr] = reverb(mix);
  let sum = 0;
  for (let i = 0; i < mix.n; i++) {
    mix.L[i] += rl[i] * 0.9;
    mix.R[i] += rr[i] * 0.9;
    sum += mix.L[i] ** 2 + mix.R[i] ** 2;
  }
  const rms = Math.sqrt(sum / (2 * mix.n)) || 1;
  const gain = 10 ** (-20 / 20) / rms; // about -20 dBFS RMS: background level
  const fadeIn = 2 * SR;
  const fadeOut = 5 * SR;
  const pcm = Buffer.alloc(mix.n * 4);
  for (let i = 0; i < mix.n; i++) {
    const f = Math.min(1, i / fadeIn, (mix.n - i) / fadeOut);
    const l = Math.tanh(mix.L[i] * gain * f * 1.1) / 1.1;
    const r = Math.tanh(mix.R[i] * gain * f * 1.1) / 1.1;
    pcm.writeInt16LE(Math.round(l * 32767), i * 4);
    pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  return pcm;
}

export function writeWav(file, pcm) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

// ------------------------------------------------------------ mixing into the video

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}`))));
  });
}

/**
 * Renders the music for the recording in `out` (using its timeline.json) and
 * mixes it under the full video and each clip, in place. Also keeps the
 * soundtrack on its own as tutorial-music.m4a.
 */
export async function addMusic(out, ffmpeg) {
  const timeline = JSON.parse(fs.readFileSync(path.join(out, "timeline.json"), "utf8"));
  const video = path.join(out, "HoMM3-Scenario-Creator-tutorial.mp4");
  const wav = path.join(out, "_music.wav");
  console.log(`music: rendering ${timeline.total.toFixed(1)} s`);
  writeWav(wav, renderMusic(timeline.total));

  const tmp = path.join(out, "_with-music.mp4");
  await run(ffmpeg, ["-y", "-loglevel", "error", "-i", video, "-i", wav, "-map", "0:v", "-map", "0:s?", "-map", "1:a",
    "-map_metadata", "0", "-map_chapters", "0", "-c:v", "copy", "-c:s", "copy", "-c:a", "aac", "-b:a", "192k",
    "-metadata:s:a:0", "language=eng", "-shortest", "-movflags", "+faststart", tmp]);
  fs.renameSync(tmp, video);

  await run(ffmpeg, ["-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "192k", path.join(out, "tutorial-music.m4a")]);

  // Clips: the matching slice of the music, with short fades.
  const clipsDir = path.join(out, "clips");
  if (fs.existsSync(clipsDir)) {
    const clips = fs.readdirSync(clipsDir).filter((f) => f.endsWith(".mp4")).sort();
    const chapters = [...timeline.chapters].sort((a, b) => a.num - b.num);
    for (const [i, c] of chapters.entries()) {
      if (!clips[i]) break;
      const file = path.join(clipsDir, clips[i]);
      const dur = (c.end ?? timeline.total) - c.start;
      await run(ffmpeg, ["-y", "-loglevel", "error", "-i", file, "-ss", c.start.toFixed(3), "-i", wav, "-map", "0:v", "-map", "1:a",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-af", `afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, dur - 1.5).toFixed(3)}:d=1.5`,
        "-shortest", tmp]);
      fs.renameSync(tmp, file);
    }
  }
  fs.rmSync(wav, { force: true });
}

// ------------------------------------------------------------ CLI

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const get = (name, fallback) => {
    const i = a.indexOf(`--${name}`);
    return i >= 0 ? a[i + 1] : fallback;
  };
  const home = process.env.USERPROFILE ?? process.env.HOME ?? ".";
  const out = path.resolve(get("out", path.join(home, "Videos", "HoMM3-Scenario-Creator-tutorial")));
  const tools = path.resolve(get("tools", path.join(home, "tools", "tutorial-capture")));
  const ffmpeg = get("ffmpeg", process.env.FFMPEG ?? path.join(tools, "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe"));
  const wavOnly = get("wav", "");
  if (wavOnly) {
    // Just the soundtrack, e.g. to listen to it: --wav out.wav [--seconds 120]
    writeWav(wavOnly, renderMusic(Number(get("seconds", "120"))));
  } else {
    addMusic(out, ffmpeg).catch((e) => {
      console.error(e);
      process.exit(1);
    });
  }
}
