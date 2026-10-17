// Background music for the tutorial video: five short pieces composed for it
// (see score.mjs) in the manner of the classic Heroes III soundtrack, and
// synthesized here from scratch: no samples, nothing taken from the game's
// music.
//
//   node docs/tutorial/music.mjs --out <capture output folder>
//
// renders music for the recording in that folder (each piece starts where its
// group of tutorial steps starts) and mixes it under
// HoMM3-Scenario-Creator-tutorial.mp4 and every clip in clips/. capture.mjs
// calls addMusic() itself unless it is given --no-music.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CUE_CHAPTERS, CUES } from "./score.mjs";

const SR = 44100;

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
function bowed(m, seconds, { voices = 3, detune = 7, cutoff = 2000, attack = 0.3, release = 0.5, vib = 0.004, q = 0.6, vel = 1, trem = 0, rand }) {
  const f = hz(m);
  const len = Math.round((seconds + release) * SR);
  const out = new Float32Array(len);
  const phases = Array.from({ length: voices }, () => rand());
  const ratios = Array.from({ length: voices }, (_, v) => 2 ** (((v - (voices - 1) / 2) * detune) / 1200));
  let low = 0;
  let band = 0;
  const fc = 2 * Math.sin((Math.PI * Math.min(cutoff * (0.55 + 0.6 * vel), SR / 6)) / SR);
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
    out[i] = low * env * (trem ? 0.6 + 0.4 * Math.abs(Math.sin(Math.PI * trem * t)) : 1);
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

// ------------------------------------------------------------ theory

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 11], // harmonic minor, so V is major
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};
const ROMAN = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
const pc = (m) => ((m % 12) + 12) % 12;

/** A chord symbol in a key: its pitch classes, root and bass. */
function parseChord(sym, tonic) {
  const [base, target] = sym.split(">");
  const ref = target ? tonic + parseChord(target, tonic).offset : tonic;
  const m = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|\+)?((?:maj7|7|9|sus|add9)*)(?:_(3|5|7))?$/.exec(base);
  if (!m) throw new Error(`Unknown chord "${sym}"`);
  const [, acc, rn, mod, ext, inv] = m;
  const offset = ROMAN[rn.toUpperCase()] + (acc === "b" ? -1 : acc === "#" ? 1 : 0) + (ref - tonic);
  const upper = rn === rn.toUpperCase();
  let iv = mod === "°" ? [0, 3, 6] : mod === "+" ? [0, 4, 8] : upper ? [0, 4, 7] : [0, 3, 7];
  if (ext.includes("sus")) iv = [0, 5, 7];
  if (ext.includes("maj7")) iv.push(11);
  else if (ext.includes("7")) iv.push(mod === "°" ? 9 : 10);
  if (ext.includes("add9")) iv.push(14);
  else if (ext.includes("9")) iv.push(...(iv.length < 4 ? [10, 14] : [14]));
  const root = tonic + offset;
  const bassIv = inv === "3" ? iv[1] : inv === "5" ? iv[2] : inv === "7" ? iv[3] ?? 0 : 0;
  return { offset, pcs: iv.map((x) => pc(root + x)), root: pc(root), bass: pc(root + bassIv), seventh: iv.length > 3 };
}

/** Nearest MIDI note at or around `near` whose pitch class is in `pcs`. */
function nearestIn(pcs, near, lo = 0, hi = 127) {
  let best = null;
  for (let d = 0; d < 12; d++) {
    for (const m of [near - d, near + d]) {
      if (m >= lo && m <= hi && pcs.includes(pc(m))) {
        best = m;
        break;
      }
    }
    if (best !== null) break;
  }
  return best ?? near;
}

// ------------------------------------------------------------ realizing a variation

const LEAD_OCTAVE = { flute: 12, oboe: 0, clarinet: 0, bassoon: -12, violins: 0, horn: -12, cello: -12, piano: 0, celesta: 12 };

/** Applies a cell's transformations to a motif. */
function cellNotes(cell, motifs, meter) {
  const rest = /^r(\d+)$/.exec(cell);
  if (rest) return [[null, Number(rest[1]) * meter]];
  const name = /^[A-Za-z0-9]+/.exec(cell)[0];
  const mods = cell.slice(name.length);
  let notes = (motifs[name] ?? []).map(([d, b]) => [d, b]);
  if (!notes.length) throw new Error(`Unknown motif "${name}"`);
  const first = notes.find(([d]) => d !== null)?.[0] ?? 0;
  for (const tok of mods.match(/[+-]\d+|~|\*|'/g) ?? []) {
    if (tok === "~") notes = notes.map(([d, b]) => [d === null ? null : first - (d - first), b]);
    else if (tok === "*") notes = notes.map(([d, b]) => [d, b * 2]);
    else if (tok === "'")
      notes = notes.flatMap(([d, b], i) =>
        d !== null && b >= 1 && i < notes.length - 1 ? [[d, b - 0.5], [d + 1, 0.25], [d, 0.25]] : [[d, b]],
      );
    else notes = notes.map(([d, b]) => [d === null ? null : d + Number(tok), b]);
  }
  return notes;
}

/** A variation's chord tokens, with named progressions expanded. */
function chordTokens(cue, v) {
  return v.chords
    .trim()
    .split(/\s+/)
    .flatMap((tok) => (tok.includes(":") ? [tok] : (cue.progressions?.[tok] ?? `?${tok}:0`).trim().split(/\s+/)));
}
const beatsOf = (tokens) => tokens.reduce((s, tok) => s + Number(tok.split(":")[1]), 0);

/**
 * Turns a variation into timed parts (in beats): chords, melody, countermelody,
 * bass and the voice-led inner chord, ready for the instruments.
 */
function realize(cue, v) {
  const meter = v.meter ?? cue.meter;
  const motifs = { ...cue.motifs, ...v.motifs };
  const keyAt = (beat) => [...v.keys].reverse().find((k) => k.bar * meter <= beat) ?? v.keys[0];
  const leads = Array.isArray(v.lead) ? v.lead : [v.lead];

  // Chords.
  const chords = [];
  let beat = 0;
  for (const tok of chordTokens(cue, v)) {
    const [sym, len] = tok.split(":");
    if (sym.startsWith("?")) throw new Error(`Unknown progression "${sym.slice(1)}"`);
    const key = keyAt(beat);
    chords.push({ start: beat, dur: Number(len), sym, key, ...parseChord(sym, key.tonic) });
    beat += Number(len);
  }
  const total = beat;
  const chordAt = (b) => chords.findLast((c) => c.start <= b + 1e-6) ?? chords[0];

  // Melody: motifs in scale degrees, strong beats on chord tones; the cells
  // take turns between the lead instruments (call and response).
  const melody = [];
  let at = 0;
  for (const [ci, cell] of v.cells.entries()) {
    const inst = leads[ci % leads.length];
    for (const [d, b] of cellNotes(cell, motifs, meter)) {
      if (d !== null && at < total) {
        const key = keyAt(at);
        const sc = SCALES[key.mode];
        let m = key.tonic + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7) + (LEAD_OCTAVE[inst] ?? 0) + 12 * (v.leadOctave ?? 0);
        const strong = Math.abs(at % meter) < 1e-6 || (meter === 4 && Math.abs((at % 4) - 2) < 1e-6);
        if (strong) m = nearestIn(chordAt(at).pcs, m);
        melody.push({ start: at, dur: Math.min(b, total - at), m, inst, strong });
      }
      at += b;
    }
  }

  // Inner chord, voice-led: each voice moves to the nearest chord tone.
  let voices = null;
  for (const c of chords) {
    const need = c.seventh ? c.pcs.slice(0, 4) : c.pcs.slice(0, 3);
    if (!voices) voices = [55, 60, 64, 69].map((m) => nearestIn(c.pcs, m, 52, 76));
    else voices = voices.map((m) => nearestIn(c.pcs, m, 52, 76));
    for (const p of need) {
      if (voices.some((m) => pc(m) === p)) continue;
      const counts = voices.map((m) => voices.filter((x) => pc(x) === pc(m)).length);
      const i = counts.indexOf(Math.max(...counts));
      voices[i] = nearestIn([p], voices[i], 52, 76);
    }
    voices.sort((a, b) => a - b);
    // no two voices on the same note: spread a doubled one to the next chord tone up
    for (let i = 1; i < voices.length; i++) {
      if (voices[i] <= voices[i - 1]) voices[i] = nearestIn(c.pcs, voices[i - 1] + 1, voices[i - 1] + 1, 80);
    }
    c.voicing = [...voices];
  }

  // Bass: the chord's bass note near the previous one, a passing note
  // between roots a third apart, or a tonic pedal.
  let prev = 45;
  for (const [i, c] of chords.entries()) {
    const key = c.key;
    c.bassNote = v.pedal ? 38 + pc(key.tonic - 38) : nearestIn([c.bass], prev, 36, 52);
    prev = c.bassNote;
    const next = chords[i + 1];
    if (!v.pedal && next && c.dur >= meter) {
      const target = nearestIn([next.bass], c.bassNote, 36, 52);
      const gap = target - c.bassNote;
      if (Math.abs(gap) >= 3 && Math.abs(gap) <= 4) {
        const step = SCALES[key.mode].includes(pc(c.bassNote + Math.sign(gap) * 2 - key.tonic)) ? 2 : 1;
        c.passing = c.bassNote + Math.sign(gap) * step;
      }
    }
  }

  // Countermelody, the melody's partner: on each new chord it takes a chord
  // tone close by (never the same note again); while the melody holds or
  // rests it moves by scale steps, in eighths when there is room, against
  // the melody's direction; while the melody moves it holds still.
  const counter = [];
  if (v.counter && melody.length) {
    // below or above the melody's own register, never crossing it
    const mels = melody.map((n) => n.m);
    const floor = v.counter === "horn" ? 46 : 40; // horns get muddy below B♭2
    const lo = v.counterAbove ? Math.max(...mels) + 1 : Math.max(floor, Math.min(...mels) - 17);
    const hi = v.counterAbove ? Math.max(...mels) + 14 : Math.min(...mels) - 2;
    let cur = nearestIn(chords[0].pcs, Math.round((lo + hi) / 2), lo, hi);
    let lastMel = melody[0]?.m ?? cur;
    let dir = -1;
    const step = (m, d, key) => {
      let n = m + d;
      while (!SCALES[key.mode].includes(pc(n - key.tonic))) n += d;
      return n;
    };
    const add = (start, m) => {
      if (counter.length) counter.at(-1).dur = start - counter.at(-1).start;
      counter.push({ start, dur: 1, m });
      cur = m;
    };
    for (let b = 0; b < total; b++) {
      const c = chordAt(b);
      const mel = melody.findLast((n) => n.start <= b + 1e-6);
      const attack = melody.some((n) => Math.abs(n.start - b) < 1e-6);
      const change = Math.abs(c.start - b) < 1e-6;
      const sounding = mel && b < mel.start + mel.dur - 1e-6;
      if (mel && mel.m !== lastMel) {
        dir = mel.m > lastMel ? -1 : 1; // contrary motion
        lastMel = mel.m;
      }
      if (change) {
        const options = [];
        for (let m = lo; m <= hi; m++) if (c.pcs.includes(pc(m))) options.push(m);
        const score = (m) =>
          Math.abs(m - cur) + (m === cur ? 4 : 0) + (Math.sign(m - cur) === dir ? 0 : 1.5) + (mel && Math.abs(m - mel.m) < 3 ? 8 : 0);
        options.sort((a, b2) => score(a) - score(b2));
        add(b, options[0] ?? cur);
      } else if (!attack) {
        // the melody holds (or rests): move, by step
        let n = step(cur, dir, c.key);
        if (n < lo || n > hi) {
          dir = -dir;
          n = step(cur, dir, c.key);
        }
        if (sounding && Math.abs(n - mel.m) < 2) continue;
        add(b, n);
        const roomy = !melody.some((x) => x.start > b && x.start < b + 1 - 1e-6) && !chords.some((x) => x.start > b && x.start < b + 1 - 1e-6);
        if (roomy && (b + Math.floor(b / meter)) % 3 === 1) {
          const n2 = step(n, dir, c.key);
          if (n2 >= lo && n2 <= hi) add(b + 0.5, n2);
        }
      }
    }
    if (counter.length) counter.at(-1).dur = total - counter.at(-1).start;
  }

  return { meter, total, chords, melody, counter, keyAt };
}

/** Beat times for a variation, with rubato and ritardando. */
function tempoMap(cue, v, total, meter, k) {
  const bpm = (v.bpm ?? cue.bpm) * (v.tempo ?? 1) * k;
  const phrase = 4 * meter;
  const ritBeats = (v.rit ?? 0) * meter;
  const times = [0];
  for (let i = 0; i < total; i++) {
    const pos = (i % phrase) / phrase;
    let f = 1 + (v.rubato ?? 0) * Math.sin(Math.PI * pos) - (v.rubato ?? 0) * 0.5;
    if (ritBeats && i >= total - ritBeats) f *= 1 - 0.3 * ((i - (total - ritBeats) + 1) / ritBeats);
    times.push(times[i] + 60 / (bpm * f));
  }
  return (b) => {
    const i = Math.max(0, Math.min(total - 1, Math.floor(b)));
    return times[i] + (b - i) * (times[i + 1] - times[i]);
  };
}

function variationSeconds(cue, v, k) {
  const total = beatsOf(chordTokens(cue, v));
  return tempoMap(cue, v, total, v.meter ?? cue.meter, k)(total);
}

/**
 * Picks which variations play and the tempo so a cue fills `target`
 * seconds. Tempo may only move a little (0.96 to 1.12), so the music keeps
 * its drive: time is filled by optional variations and repeats (played with
 * their `alt` changes), not by slowing down.
 */
function planCue(cue, target) {
  const base = cue.variations;
  const optional = base.map((v, i) => (v.optional ? i : -1)).filter((i) => i >= 0);
  const repeatable = base.map((v, i) => (v.repeat ? i : -1)).filter((i) => i >= 0);
  let best = null;
  for (let om = 0; om < 1 << optional.length; om++) {
    for (let rm = 0; rm < 1 << repeatable.length; rm++) {
      const list = [];
      base.forEach((v, i) => {
        const oi = optional.indexOf(i);
        if (oi >= 0 && !(om & (1 << oi))) return;
        list.push(v);
        const ri = repeatable.indexOf(i);
        if (ri >= 0 && rm & (1 << ri)) list.push({ ...v, ...v.alt });
      });
      const len = list.reduce((s, v) => s + variationSeconds(cue, v, 1), 0);
      const k = len / target; // >1: play faster to fit
      const fits = k >= 0.96 && k <= 1.12;
      const cost = (fits ? 0 : 10) + Math.abs(Math.log(k));
      if (!best || cost < best.cost) best = { list, k: Math.max(0.96, Math.min(1.12, k)), cost, len };
    }
  }
  const length = best.list.reduce((s, v) => s + variationSeconds(cue, v, best.k), 0);
  return { list: best.list, k: best.k, slack: Math.max(0, target - length) };
}

/** Oboe, clarinet or bassoon: additive reed tone, brighter when louder. */
const REEDS = {
  oboe: { h: [1, 0.95, 0.9, 0.75, 0.55, 0.4, 0.3, 0.2, 0.12, 0.08], vib: 0.004, attack: 0.05 },
  clarinet: { h: [1, 0.06, 0.6, 0.05, 0.35, 0.05, 0.2, 0.04, 0.1], vib: 0, attack: 0.06 },
  bassoon: { h: [1, 0.85, 0.7, 0.55, 0.42, 0.3, 0.2, 0.12], vib: 0.002, attack: 0.03 },
};
function reed(kind, m, seconds, vel, rand) {
  const { h, vib, attack } = REEDS[kind];
  const f = hz(m);
  const rel = 0.09;
  const len = Math.round((seconds + rel) * SR);
  const out = new Float32Array(len);
  const amps = h.map((a, k) => (f * (k + 1) < 9000 ? a * (0.55 + 0.45 * vel) ** k : 0));
  let ph = rand() * 6.28;
  let nz = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const v = vib * Math.min(1, Math.max(0, (t - 0.25) / 0.4)) * Math.sin(2 * Math.PI * 5.4 * t);
    ph += (2 * Math.PI * f * (1 + v)) / SR;
    let s = 0;
    for (let k = 0; k < amps.length; k++) if (amps[k]) s += amps[k] * Math.sin((k + 1) * ph);
    nz += 0.1 * (rand() * 2 - 1 - nz);
    const env = t < seconds ? Math.min(1, t / attack) : Math.max(0, 1 - (t - seconds) / rel);
    out[i] = env * (s * 0.35 + nz * 0.05);
  }
  return out;
}

/** Band-pass biquad (0 dB peak), applied in place. */
function bandpass(sig, f0, q) {
  const w = (2 * Math.PI * f0) / SR;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  const out = new Float32Array(sig.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < sig.length; i++) {
    const x = sig[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Choir "ah": detuned saws through three vowel formants. */
function choir(m, seconds, rand) {
  const src = bowed(m, seconds, { voices: 4, detune: 12, cutoff: 5000, attack: 0.6, release: 0.9, vib: 0.004, q: 0.3, rand });
  const a = bandpass(src, 730, 730 / 90);
  const b = bandpass(src, 1090, 1090 / 110);
  const c = bandpass(src, 2440, 2440 / 170);
  for (let i = 0; i < src.length; i++) src[i] = a[i] + 0.55 * b[i] + 0.3 * c[i];
  return src;
}

/** Celesta / music box: a bell with a quick inharmonic shimmer. */
function celesta(m, seconds) {
  const f = hz(m);
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const w = 2 * Math.PI * f * t;
    out[i] = Math.min(1, t / 0.002) * (Math.exp(-t * 2.2) * Math.sin(w) + 0.25 * Math.exp(-t * 6) * Math.sin(4 * w) + 0.15 * Math.exp(-t * 9) * Math.sin(2.76 * w));
  }
  return tail(out);
}

/** Percussion: noise and tone, shaped. */
function noiseHit(seconds, rand, decay, f0, q) {
  const n = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < n.length; i++) n[i] = (rand() * 2 - 1) * Math.exp((-decay * i) / SR);
  return bandpass(n, f0, q);
}
function snare(rand) {
  const out = noiseHit(0.3, rand, 22, 2200, 0.7);
  for (let i = 0; i < out.length; i++) out[i] = out[i] * 2.2 + 0.5 * Math.exp((-38 * i) / SR) * Math.sin((2 * Math.PI * 190 * i) / SR);
  return out;
}
function bassDrum() {
  const out = new Float32Array(Math.round(0.5 * SR));
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (52 + 40 * Math.exp(-t * 25))) / SR;
    out[i] = Math.exp(-t * 7) * Math.sin(ph);
  }
  return out;
}
function triangleHit() {
  const out = new Float32Array(Math.round(1.4 * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t * 3) * (Math.sin(2 * Math.PI * 4200 * t) + 0.5 * Math.sin(2 * Math.PI * 6150 * t));
  }
  return out;
}
const tambourine = (rand) => noiseHit(0.22, rand, 16, 7500, 1.4).map((x) => x * 2.5);
const cymbal = (rand) => noiseHit(1.8, rand, 2.2, 6000, 0.5).map((x) => x * 1.6);

/** Checks the score: every chord and motif parses, and each variation's
 * melody fills exactly its chords. Returns the problems found. */
export function checkScore() {
  const problems = [];
  for (const cue of CUES) {
    for (const [i, v] of cue.variations.entries()) {
      for (const variant of [v, v.alt ? { ...v, ...v.alt } : null].filter(Boolean)) {
        const where = `${cue.name} #${i + 1}${variant === v ? "" : " (alt)"}`;
        try {
          const meter = variant.meter ?? cue.meter;
          const motifs = { ...cue.motifs, ...variant.motifs };
          const total = beatsOf(chordTokens(cue, variant));
          const melody = variant.cells.reduce((n, c) => n + cellNotes(c, motifs, meter).reduce((m, [, b]) => m + b, 0), 0);
          if (total % meter) problems.push(`${where}: chords end mid-bar (${total} beats)`);
          if (Math.abs(melody - total) > 1e-6) problems.push(`${where}: melody ${melody} beats, chords ${total}`);
          realize(cue, variant);
        } catch (e) {
          problems.push(`${where}: ${e.message}`);
        }
      }
    }
  }
  return problems;
}

// ------------------------------------------------------------ rendering

const LEAD_GAIN = { flute: 0.08, oboe: 0.085, clarinet: 0.09, bassoon: 0.1, violins: 0.075, horn: 0.1, cello: 0.1, piano: 0.12, celesta: 0.1 };

/** One note on an instrument; `vel` 0..1. */
function play(mix, inst, at, m, dur, vel, rand, pan = 0) {
  const g = LEAD_GAIN[inst] * (0.5 + 0.5 * vel);
  switch (inst) {
    case "flute":
      return mix.put(at, flute(m, dur, rand), pan + 0.15, g, 0.3);
    case "oboe":
    case "clarinet":
    case "bassoon":
      return mix.put(at, reed(inst, m, dur, vel, rand), pan + (inst === "bassoon" ? 0.2 : -0.15), g, 0.28);
    case "violins":
      return mix.put(at, bowed(m, dur, { voices: 4, detune: 9, cutoff: 2800, attack: Math.min(0.1, dur / 3), release: 0.3, vib: 0.005, vel, rand }), pan - 0.25, g, 0.35);
    case "horn":
      return mix.put(at, bowed(m, dur, { voices: 2, detune: 4, cutoff: 1300, attack: Math.min(0.07, dur / 3), release: 0.25, vib: 0.0025, q: 0.8, vel, rand }), pan - 0.1, g, 0.35);
    case "cello":
      return mix.put(at, bowed(m, dur, { voices: 1, detune: 0, cutoff: 1600, attack: Math.min(0.08, dur / 3), release: 0.3, vib: 0.006, vel, rand }), pan + 0.25, g, 0.3);
    case "piano":
      return mix.put(at, piano(m, Math.max(2, dur + 1.2), 0.6 + 0.4 * vel), pan, g, 0.3);
    case "celesta":
      return mix.put(at, celesta(m, Math.max(1.5, dur + 1)), pan + 0.3, g, 0.4);
  }
}

/** Renders one variation starting at `t0` seconds; returns its length. */
function renderVariation(mix, cue, v, t0, k, holdExtra, rand) {
  const { meter, total, chords, melody, counter, keyAt } = realize(cue, v);
  const beatTime = tempoMap(cue, v, total, meter, k);
  const T = (b) => t0 + beatTime(b) + (b >= total - 1e-6 ? holdExtra : 0);
  const human = () => (rand() - 0.5) * 0.01;
  const tex = new Set(v.tex ?? []);
  const lastChord = chords.at(-1);
  const dynAt = (b) => {
    const base = v.dyn[0] + (v.dyn[1] - v.dyn[0]) * (b / total);
    const pos = (b % (4 * meter)) / (4 * meter);
    // steeper than linear, so quiet passages are really quiet
    return (base * (0.85 + 0.15 * Math.sin(Math.PI * pos))) ** 1.5;
  };
  const span = (c) => T(c.start + c.dur) - T(c.start) + (c === lastChord ? holdExtra : 0);
  const articulate = (n, len) => {
    if (v.artic !== "staccato") return len * 0.96;
    return n.dur <= 0.5 ? len * 0.45 : n.dur <= 1 ? len * 0.7 : len * 0.9;
  };

  for (const c of chords) {
    const t = T(c.start);
    const len = span(c);
    const dyn = dynAt(c.start);
    const bars = Math.max(1, Math.round(c.dur / meter));
    const barIndex = Math.floor(c.start / meter);
    const cadence = barIndex % 4 === 3 || c === lastChord;
    const rhythmic = tex.has("pizz") || tex.has("quavers") || tex.has("gallop");

    // Bass: sustained under the lyrical textures (the rhythmic ones play their own).
    if (!rhythmic) {
      const passAt = c.passing ? T(c.start + c.dur - 1) : null;
      mix.put(t, bowed(c.bassNote, (passAt ? passAt - t : len) * 0.98, { voices: 2, detune: 5, cutoff: 650, attack: 0.1, release: 0.4, vib: 0.002, vel: dyn, rand }), 0.1, 0.08 * dyn, 0.2);
      if (passAt) mix.put(passAt, bowed(c.passing, T(c.start + c.dur) - passAt, { voices: 2, detune: 5, cutoff: 650, attack: 0.06, release: 0.25, vib: 0.002, vel: dyn, rand }), 0.1, 0.07 * dyn, 0.2);
    }
    if (tex.has("pad") || tex.has("tremolo")) {
      const trem = tex.has("tremolo") ? 7 : 0;
      c.voicing.forEach((m, i) =>
        mix.put(t, bowed(m, len, { voices: 3, detune: 8, cutoff: 1500, attack: trem ? 0.2 : 0.35, release: 0.6, vib: 0.003, vel: dyn, trem, rand }), -0.5 + i * 0.33, 0.022 * dyn, 0.35),
      );
    }
    if (tex.has("choir")) c.voicing.slice(1).forEach((m, i) => mix.put(t, choir(m + 12 > 76 ? m : m + 12, len, rand), -0.4 + i * 0.4, 0.05 * dyn, 0.45));
    if (tex.has("rolled") && (c.start % meter === 0 || c.dur >= meter)) {
      [c.bassNote + 12, ...c.voicing].forEach((m, i) => mix.put(t + i * 0.035 + human(), pluck(m, 2.5, rand, 0.45), -0.4 + i * 0.16, 0.12 * dyn, 0.3));
    }
    if (tex.has("planing")) c.voicing.forEach((m, i) => mix.put(t + i * 0.02, piano(m + 12, Math.max(2.5, len + 1), 0.45 + 0.3 * dyn), 0.1, 0.06 * dyn, 0.4));
    if (tex.has("cymbal") && barIndex % 8 === 0) mix.put(t, cymbal(rand), 0.2, 0.05 * dyn, 0.3);

    // Per-bar figures.
    for (let bar = 0; bar < bars; bar++) {
      const b0 = c.start + bar * meter;
      if (b0 >= c.start + c.dur - 1e-6) break;
      const beats = Math.min(meter, c.start + c.dur - b0);
      const bi = Math.floor(b0 / meter);
      const lastBarOfPhrase = bi % 4 === 3;
      const vv = c.voicing;
      const at = (b) => T(b0 + b) + human();

      if (tex.has("arp")) {
        const figures = meter === 3
          ? [[0, 2, 3, 1, 3, 2], [0, 1, 2, 3, 2, 1], [0, 3, 2, 3, 1, 3], [0, 2, 1, 2, 3, 2]]
          : [[0, 2, 3, 1, 3, 2, 1, 2], [0, 1, 3, 2, 3, 1, 2, 3]];
        figures[bi % figures.length].forEach((k2, i) => {
          if (i * 0.5 < beats) mix.put(at(i * 0.5), pluck(vv[k2] + (i > 3 ? 12 : 0), 2, rand, 0.5), -0.35 + k2 * 0.18, 0.11 * dyn, 0.3);
        });
      }
      if (tex.has("alberti")) {
        const fig = meter === 3 ? [0, 3, 1, 3, 2, 3] : [0, 3, 1, 3, 0, 3, 1, 3];
        fig.forEach((k2, i) => i * 0.5 < beats && mix.put(at(i * 0.5), piano(vv[k2], 1.2, 0.4 + 0.2 * dyn), -0.05, 0.06 * dyn, 0.25));
      }
      if (tex.has("pizz")) {
        for (let b = 0; b < beats; b++) {
          if (b === 0) mix.put(at(b), pluck(c.bassNote, 0.8, rand, 0.85), 0.1, 0.2 * dyn, 0.15);
          else if (meter === 4 && b === 2) mix.put(at(b), pluck(c.bassNote + 7, 0.8, rand, 0.85), 0.1, 0.15 * dyn, 0.15);
          else vv.slice(1, 3).forEach((m) => mix.put(at(b), pluck(m, 0.6, rand, 0.85), -0.2, 0.08 * dyn, 0.15));
        }
      }
      if (tex.has("quavers")) {
        for (let e = 0; e < beats * 2; e++) {
          const len8 = T(b0 + (e + 1) / 2) - T(b0 + e / 2);
          const acc = e % 2 === 0 ? 1 : 0.7;
          vv.slice(1, 3).forEach((m) => mix.put(at(e / 2), bowed(m, len8 * 0.8, { voices: 2, detune: 6, cutoff: 2400, attack: 0.012, release: 0.05, vib: 0, vel: dyn, rand }), -0.3, 0.03 * dyn * acc, 0.2));
          if (e % 2 === 0) mix.put(at(e / 2), bowed(c.bassNote, len8 * 1.6, { voices: 2, detune: 5, cutoff: 900, attack: 0.012, release: 0.08, vib: 0, vel: dyn, rand }), 0.1, 0.09 * dyn, 0.2);
        }
      }
      if (tex.has("gallop")) {
        // long-short triplet on every beat, the "riding" rhythm
        for (let b = 0; b < beats; b++) {
          for (const [o, d] of [[0, 2 / 3], [2 / 3, 1 / 3]]) {
            const len3 = T(b0 + b + o + d) - T(b0 + b + o);
            vv.slice(1, 3).forEach((m) => mix.put(at(b + o), bowed(m, len3 * 0.8, { voices: 2, detune: 6, cutoff: 2400, attack: 0.01, release: 0.04, vib: 0, vel: dyn, rand }), -0.3, 0.03 * dyn * (o ? 0.7 : 1), 0.2));
          }
          if (b % 2 === 0) mix.put(at(b), bowed(c.bassNote, (T(b0 + b + 1) - T(b0 + b)) * 0.9, { voices: 2, detune: 5, cutoff: 900, attack: 0.01, release: 0.06, vib: 0, vel: dyn, rand }), 0.1, 0.1 * dyn, 0.2);
        }
      }
      if (tex.has("fanfare")) {
        const fig = lastBarOfPhrase ? [[0, meter]] : meter === 3 ? [[0, 1], [1.5, 0.5], [2, 1]] : [[0, 0.75], [0.75, 0.25], [1, 1], [2.5, 0.5], [3, 1]];
        for (const [o, d] of fig) {
          if (o >= beats) continue;
          const dur = T(b0 + o + d) - T(b0 + o);
          vv.slice(1).forEach((m, i) => mix.put(at(o), bowed(m - 12 < 48 ? m : m - 12, dur * 0.85, { voices: 2, detune: 4, cutoff: 1400, attack: 0.03, release: 0.12, vib: 0, q: 0.8, vel: dyn, rand }), -0.3 + i * 0.3, 0.05 * dyn, 0.3));
        }
      }
      if (tex.has("runs") && lastBarOfPhrase && beats >= meter - 1e-6) {
        // a harp run up into the next phrase
        const key = c.key;
        const sc = SCALES[key.mode];
        const top = vv.at(-1) + 12;
        const notes = [];
        for (let d = 0, m = key.tonic + 12; notes.length < 6 && d < 30; d++) {
          m = key.tonic + 12 + sc[d % 7] + 12 * Math.floor(d / 7);
          if (m > top - 7) notes.push(m);
        }
        notes.slice(0, 6).forEach((m, i) => mix.put(T(b0 + meter - 1) + i * ((T(b0 + meter) - T(b0 + meter - 1)) / 6), pluck(m, 1.2, rand, 0.6), -0.3 + i * 0.12, 0.08 * dyn, 0.3));
      }
      if (tex.has("celesta")) {
        const pattern = meter === 3 ? [1, 2.5] : [1.5, 3];
        pattern.forEach((p, i) => p < beats && mix.put(at(p), celesta(vv[(i + bi) % vv.length] + 24, 1.4), 0.4, 0.05 * dyn, 0.4));
      }
      if (tex.has("timpani")) {
        const tp = c.bassNote + 12 > 52 ? c.bassNote : c.bassNote + 12;
        if (bi % 4 === 0) mix.put(at(0), timpani(tp, 2, rand), 0, 0.2 * dyn, 0.3);
        if (bi % 4 === 2 && meter === 4) mix.put(at(2), timpani(tp + 7 > 55 ? tp - 5 : tp + 7, 1.2, rand), 0, 0.12 * dyn, 0.3);
        if (b0 + meter >= total - meter - 1e-6 && b0 < total - meter) {
          for (let r = 0; r < 12; r++) mix.put(T(b0 + meter - 1) + (r * (T(b0 + meter) - T(b0 + meter - 1))) / 12, timpani(tp, 0.5, rand), 0, (0.04 + r * 0.008) * dyn, 0.3);
        }
      }
      if (tex.has("snare")) {
        for (let b = 0; b < beats; b++) {
          const accent = b === 0 ? 1 : meter === 4 && b === 2 ? 0.8 : 0.55;
          mix.put(at(b), snare(rand), -0.1, 0.06 * dyn * accent, 0.15);
          if (lastBarOfPhrase && b === beats - 1) [0.25, 0.5, 0.75].forEach((o) => mix.put(at(b + o), snare(rand), -0.1, 0.04 * dyn, 0.15));
          else if (meter === 4 && b === 3) mix.put(at(b + 0.5), snare(rand), -0.1, 0.035 * dyn, 0.15);
        }
      }
      if (tex.has("drum")) {
        mix.put(at(0), bassDrum(), 0, 0.22 * dyn, 0.1);
        if (meter === 4) mix.put(at(2), bassDrum(), 0, 0.15 * dyn, 0.1);
      }
      if (tex.has("tambourine")) {
        const hits = meter === 3 ? [1, 2, 2.5] : [1, 3, 3.5];
        hits.forEach((h) => h < beats && mix.put(at(h), tambourine(rand), 0.35, 0.05 * dyn, 0.15));
      }
      if (tex.has("triangle") && bi % 2 === 0) mix.put(at(0), triangleHit(), 0.4, 0.012 * dyn, 0.3);
    }
  }

  // Melody (with its octave double) and countermelody.
  for (const n of melody) {
    const isLast = n.start + n.dur >= total - 1e-6;
    const len = articulate(n, T(n.start + n.dur) - T(n.start)) + (isLast ? holdExtra : 0);
    const vel = Math.min(1, dynAt(n.start) ** (1 / 1.5) * (n.strong ? 1.05 : 0.88));
    const at = T(n.start) + human();
    play(mix, n.inst, at, n.m, len, vel, rand);
    if (v.double) play(mix, v.double, at, n.m + (LEAD_OCTAVE[v.double] - LEAD_OCTAVE[n.inst]), len, vel * 0.8, rand, 0.2);
  }
  for (const n of counter) play(mix, v.counter, T(n.start) + human(), n.m, (T(n.start + n.dur) - T(n.start)) * 0.95, dynAt(n.start) ** (1 / 1.5) * 0.75, rand, 0.1);

  return T(total) - t0;
}

/**
 * Renders `seconds` of music as interleaved 16-bit stereo PCM. With the
 * recording's chapters, each piece starts where its group of steps starts.
 */
export function renderMusic(seconds, chapters = [], seed = 3) {
  const rand = rng(seed);
  const mix = new Mix(seconds);
  const startOf = (i) => {
    if (i === 0) return 1.0;
    const ch = chapters.find((c) => c.num === CUE_CHAPTERS[i]);
    return ch ? ch.start : seconds * [0, 0.2, 0.39, 0.56, 0.8][i];
  };
  for (const [i, cue] of CUES.entries()) {
    const start = startOf(i);
    const end = i + 1 < CUES.length ? startOf(i + 1) - 0.5 : seconds - 1.5;
    if (start >= seconds || end <= start + 5) continue;
    const { list, k, slack } = planCue(cue, end - start);
    console.log(`music: ${cue.name} at ${start.toFixed(1)} s, ${list.length} variations, tempo x${k.toFixed(2)}`);
    let t = start;
    for (const [j, v] of list.entries()) {
      const hold = j === list.length - 1 ? Math.min(slack, 4) : 0;
      t += renderVariation(mix, cue, v, t, k, hold, rand);
    }
  }

  // Reverb (a drier hall than before, so the rhythm stays clear), level,
  // fades, soft limit.
  const [rl, rr] = reverb(mix, 0.8, 0.4);
  let sum = 0;
  for (let i = 0; i < mix.n; i++) {
    mix.L[i] += rl[i] * 0.55;
    mix.R[i] += rr[i] * 0.55;
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
  writeWav(wav, renderMusic(timeline.total, timeline.chapters));

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
  if (a.includes("--check")) {
    const problems = checkScore();
    console.log(problems.length ? problems.join("\n") : "score OK");
    process.exitCode = problems.length ? 1 : 0;
  } else if (wavOnly) {
    // Just the soundtrack: --wav out.wav [--seconds 688] [--timeline timeline.json]
    const tl = get("timeline", "");
    const chapters = tl ? JSON.parse(fs.readFileSync(tl, "utf8")).chapters : [];
    writeWav(wavOnly, renderMusic(Number(get("seconds", "120")), chapters));
  } else {
    addMusic(out, ffmpeg).catch((e) => {
      console.error(e);
      process.exit(1);
    });
  }
}
