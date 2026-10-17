// Background music for the tutorial video, scored to the picture: a warm
// pad that changes chord with the steps and captions, a low pedal per part,
// and harp plucks, glass bells and soft swells on what happens on screen.
// The score (keys, chords, motif, which event plays what) is in score.mjs;
// this file turns the recording's timeline into sound. Synthesized from
// scratch: no samples, nothing taken from the game's music. Deterministic:
// the same timeline gives the same file.
//
//   node docs/tutorial/music.mjs --out <capture output folder>   mix into the video and clips
//   node docs/tutorial/music.mjs --cues --timeline <timeline.json>   print the cue sheet
//   node docs/tutorial/music.mjs --wav music.wav --timeline <timeline.json>
//   node docs/tutorial/music.mjs --check
//
// capture.mjs calls addMusic() itself unless it is given --no-music.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BPM, MIX, MOTIF, RULES, SECTIONS } from "./score.mjs";

const SR = 48000;
const TAU = 2 * Math.PI;
const BEAT = 60 / BPM;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (t) => t * t * (3 - 2 * t);

// ------------------------------------------------------------ pitch and harmony

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10] };

/** "F#4" -> MIDI note. */
function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note "${name}"`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

/** Scale degree (may be negative or above 6) in a section's key, around octave `oct`. */
function degree(section, d, oct) {
  const sc = SCALES[section.key.mode];
  const tonic = 12 * (oct + 1) + PC[section.key.tonic];
  return tonic + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
}

// ------------------------------------------------------------ randomness (seeded)

function hash32(...xs) {
  let h = 2166136261 >>> 0;
  for (const x of xs) {
    h ^= (x | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  return f;
}
const SEED = 3;
const R = (...k) => rng(hash32(SEED, ...k));

// ------------------------------------------------------------ the cue sheet

/**
 * Turns the timeline into what plays: chord changes, pedal changes,
 * struck notes (bells, plucks) and swells, each with the reason.
 */
export function cueSheet(timeline) {
  const total = timeline.total;
  let events = timeline.events;
  if (!events?.length) {
    // an older timeline: chapters and captions only
    events = [
      ...timeline.chapters.map((c) => ({ t: c.start, type: "chapter", chapter: c.num, num: c.num })),
      ...timeline.cues.map((c) => ({ t: c.start, type: "caption", chapter: timeline.chapters.findLast((ch) => ch.start <= c.start + 1e-6)?.num ?? 0 })),
    ];
  }
  events = [...events].sort((a, b) => a.t - b.t);
  const sectionOf = (chapter) => SECTIONS.findLast((s) => s.from <= chapter) ?? SECTIONS[0];
  const grid = (t, g) => Math.round(t / g) * g;

  const chords = []; // { t, notes, section }
  const pedals = []; // { t, note }
  const notes = []; // { t, kind: bell|pluck|horn, m, vel, pan, dur?, why }
  const swells = []; // { t, dur, w, why }
  let section = null;
  let chordIx = -1;
  let lastChordT = -99;
  let bellLine = 0;
  let pluckStep = 0;
  const changeChord = (t, why) => {
    chordIx = (chordIx + 1) % section.chords.length;
    chords.push({ t, notes: section.chords[chordIx].split(" ").map(midi), why });
    lastChordT = t;
  };
  const chord = () => chords.at(-1).notes;

  for (const e of events) {
    const sec = sectionOf(e.chapter ?? 0);
    if (sec !== section) {
      section = sec;
      chordIx = -1;
      pedals.push({ t: grid(e.t, BEAT), note: midi(sec.pedal), section: sec });
      changeChord(grid(e.t, BEAT), `${sec.name}`);
      if (e.t > 1) for (const r of RULES.section ?? []) notes.push({ t: grid(e.t, BEAT), kind: "horn", m: chord(), vel: r.vel, dur: r.dur, pan: 0, why: `horns: ${sec.name}` });
    } else if ((e.type === "chapter" || e.type === "caption") && e.t - lastChordT > 3.5) {
      changeChord(grid(e.t, BEAT), e.type === "chapter" ? `step ${e.num}` : "caption");
    }

    for (const rule of RULES[e.type] ?? []) {
      const g = rule.play === "pluck" ? BEAT / 4 : BEAT / 2;
      const t = Math.max(0, grid(e.t, g));
      const c = chord();
      switch (rule.play) {
        case "motif": {
          const step = rule.slow ? 2 * BEAT : BEAT;
          const kind = e.type === "chapter" && events.find((x) => x.type === "chapter" && sectionOf(x.chapter) === sec) !== e ? "pluck" : "bell";
          MOTIF.forEach((d, i) =>
            notes.push({ t: t + i * step, kind, m: degree(sec, d, 5), vel: rule.vel * (1 - 0.06 * i), pan: [-0.25, 0.15, -0.1, 0.25, 0][i % 5], why: `motif ${i + 1}` }),
          );
          if (rule.slow) notes.push({ t: t + MOTIF.length * step, kind: "bell", m: degree(sec, 0, 3), vel: rule.vel * 0.8, pan: 0, why: "low bell" });
          break;
        }
        case "bell": {
          // the bell line moves through the chord's upper tones: up two, down one
          const tones = c.map((m) => m + 12).filter((m) => m >= 62 && m <= 86);
          const pool = tones.length ? tones : c.map((m) => m + 24);
          bellLine = (bellLine + (bellLine % 3 === 2 ? -1 : 2)) % (pool.length * 2);
          let m = pool[bellLine % pool.length] + 12 * (rule.octave ?? 0);
          while (m > 88) m -= 12;
          notes.push({ t, kind: "bell", m, vel: rule.vel, pan: [-0.3, 0.3, 0, -0.15, 0.15][notes.length % 5], why: e.type });
          break;
        }
        case "pluck": {
          let m;
          if (rule.root) m = degree(sec, 0, 3 + (rule.octave ?? 0) + 1);
          else {
            m = degree(sec, pluckStep % 12, 4);
            pluckStep++;
          }
          notes.push({ t, kind: "pluck", m, vel: rule.vel, pan: e.x ? clamp((e.x / 1440) * 1.2 - 0.6, -0.6, 0.6) : 0, why: e.type });
          break;
        }
        case "roll": {
          const span = Math.min(1.2, Math.max(0.4, e.dur ?? 0.6));
          c.forEach((m, i) => notes.push({ t: t + (i * span) / c.length, kind: "pluck", m: m + 12, vel: rule.vel, pan: -0.4 + i * 0.25, why: `${e.type} roll` }));
          break;
        }
        case "run": {
          const n = 5;
          const span = Math.max(0.5, e.dur ?? 0.8);
          for (let i = 0; i < n; i++) notes.push({ t: t + (i * span) / n, kind: "pluck", m: degree(sec, 2 + i, 4), vel: rule.vel, pan: -0.4 + i * 0.2, why: `${e.type} run` });
          break;
        }
        case "swell":
          swells.push({ t: e.t, dur: rule.dur ?? e.dur ?? 1, w: rule.vel, why: e.type });
          break;
        case "chime":
          notes.push({ t, kind: "bell", m: degree(sec, 0, 5), vel: rule.vel, pan: -0.2, why: "export" });
          notes.push({ t: t + BEAT / 2, kind: "bell", m: degree(sec, 4, 5), vel: rule.vel * 0.85, pan: 0.2, why: "export" });
          break;
      }
    }
  }

  // Close events share the space: in each second, the busier it is, the softer each note.
  notes.sort((a, b) => a.t - b.t);
  for (const n of notes) {
    const near = notes.filter((o) => o.kind === n.kind && Math.abs(o.t - n.t) < 1).length;
    n.vel *= 1 / Math.sqrt(Math.max(1, near - 1));
  }
  // and the same pluck note never repeats within a quarter second
  const kept = notes.filter((n, i) => !notes.slice(Math.max(0, i - 6), i).some((o) => o.kind === n.kind && o.m === n.m && n.t - o.t < 0.25));
  return { total, chords, pedals, notes: kept.filter((n) => n.t < total - 0.5), swells };
}

// ------------------------------------------------------------ synthesis

class Bus {
  constructor(n) {
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
  }
}
const pan = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];

/** Stereo state-variable low-pass, cutoff fc(i) in Hz, in place. */
function lowpass(bus, fc, q = 0.6) {
  const k = 1 / q;
  let a1 = 0, a2 = 0, a3 = 0, l1 = 0, l2 = 0, r1 = 0, r2 = 0;
  for (let i = 0; i < bus.L.length; i++) {
    if ((i & 31) === 0) {
      const g = Math.tan((Math.PI * Math.min(fc(i), SR * 0.45)) / SR);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    }
    let v3 = bus.L[i] - l2;
    let v1 = a1 * l1 + a2 * v3;
    let v2 = l2 + a2 * l1 + a3 * v3;
    l1 = 2 * v1 - l1;
    l2 = 2 * v2 - l2;
    bus.L[i] = v2;
    v3 = bus.R[i] - r2;
    v1 = a1 * r1 + a2 * v3;
    v2 = r2 + a2 * r1 + a3 * v3;
    r1 = 2 * v1 - r1;
    r2 = 2 * v2 - r2;
    bus.R[i] = v2;
  }
}

/** Glass bell and harp: damped partials [ratio, level, ring time at 440 Hz]. */
const BELL = [[1, 1, 3.4], [1.0015, 0.3, 2.8], [2, 0.2, 1.7], [3.01, 0.07, 1], [4.2, 0.045, 0.5], [5.42, 0.025, 0.3]];
const HARP = Array.from({ length: 8 }, (_, i) => [
  (i + 1) * (1 + 0.0003 * (i + 1) ** 2),
  (Math.abs(Math.sin(Math.PI * (i + 1) * 0.19)) / (i + 1) ** 1.1) * Math.exp(-0.2 * i),
  1.8 / (1 + 0.5 * i),
]);

function strike(bus, send, at, m, parts, amp, p, attack, vel, r) {
  const f0 = hz(m);
  const [gl, gr] = pan(p);
  const s0 = Math.round(at * SR);
  const na = Math.max(1, Math.round(attack * SR));
  const tsc = (440 / f0) ** 0.35;
  for (const [pi, [ratio, a, t60]] of parts.entries()) {
    const T = t60 * tsc;
    const n = Math.min(bus.L.length - s0, Math.ceil(T * 1.3 * SR));
    const g0 = amp * a * (pi < 2 ? 1 : 0.45 + 0.55 * vel);
    for (let ch = 0; ch < 2; ch++) {
      const f = f0 * ratio * (1 + (ch ? 0.0003 : -0.0003) * (pi + 1));
      if (f >= SR * 0.45) continue;
      const w = (TAU * f) / SR;
      const rr = 10 ** (-3 / (T * SR));
      const c = 2 * rr * Math.cos(w);
      const r2 = rr * rr;
      const phi = r() * TAU;
      const g = g0 * (ch ? gr : gl);
      let y1 = Math.sin(phi - w) / rr;
      let y0 = Math.sin(phi);
      const out = ch ? bus.R : bus.L;
      const sendOut = ch ? send.R : send.L;
      for (let j = 0; j < n; j++) {
        const v = y0 * g * (j < na ? 0.5 - 0.5 * Math.cos((Math.PI * j) / na) : 1);
        out[s0 + j] += v;
        sendOut[s0 + j] += v * 0.5;
        const y = c * y0 - r2 * y1;
        y1 = y0;
        y0 = y;
      }
    }
  }
}

/** Band-limited wavetable: a soft string tone. */
const TL = 4096;
const WT = (() => {
  const wt = new Float64Array(TL + 1);
  let mx = 0;
  for (let i = 0; i <= TL; i++) {
    let v = 0;
    for (let h = 1; h <= 12; h++) v += Math.sin((TAU * h * i) / TL) / h ** 1.25;
    wt[i] = v;
    mx = Math.max(mx, Math.abs(v));
  }
  return wt.map((v) => v / mx);
})();

/** One sustained voice from the wavetable, with an envelope env(t) and slow drift. */
function voice(bus, m, i0, i1, env, level, p, r, cents = 0) {
  const [gl, gr] = pan(p);
  const inc = ((hz(m) * 2 ** ((cents + r.range(-2, 2)) / 1200)) / SR) * TL;
  const dph = r() * TAU;
  const drate = r.range(0.06, 0.14);
  let ph = r() * TL;
  for (let b = i0; b < i1; b += 256) {
    const be = Math.min(i1, b + 256);
    const g0 = env(b / SR) * level;
    const g1 = env(be / SR) * level;
    const k = inc * (1 + 0.0017 * Math.sin(dph + (TAU * drate * b) / SR));
    for (let i = b; i < be; i++) {
      const x = ph | 0;
      const v = (WT[x] + (WT[x + 1] - WT[x]) * (ph - x)) * (g0 + ((g1 - g0) * (i - b)) / 256);
      bus.L[i] += v * gl;
      bus.R[i] += v * gr;
      ph += k;
      if (ph >= TL) ph -= TL;
    }
  }
}

/** 8-line feedback delay network, about 3.6 s, with input diffusion and a wet EQ. */
function reverb(send, out, wet = 1.1) {
  const N = send.L.length;
  const LENS = [2111, 2339, 2557, 2803, 3023, 3253, 3491, 3727].map((l) => Math.round((l * SR) / 48000));
  const T60 = 3.6;
  const DAMP = 0.42;
  const AP = [[241, 0.62], [173, 0.62], [571, 0.55], [419, 0.55]];
  const PRE = Math.round(0.022 * SR);
  const buf = LENS.map((l) => new Float64Array(l));
  const ix = new Int32Array(8);
  const G = LENS.map((l) => 10 ** ((-3 * l) / (SR * T60)));
  const lp = new Float64Array(8);
  const y = new Float64Array(8);
  const apb = AP.map(([l]) => new Float64Array(l));
  const api = new Int32Array(AP.length);
  const pre = new Float64Array(PRE);
  const s8 = 1 / Math.sqrt(8);
  const hpA = Math.exp((-TAU * 140) / SR);
  const lpA = Math.exp((-TAU * 6500) / SR);
  let pi = 0, hl = 0, hr = 0, zl = 0, zr = 0;
  for (let i = 0; i < N; i++) {
    let x = pre[pi];
    pre[pi] = (send.L[i] + send.R[i]) * 0.5;
    if (++pi === PRE) pi = 0;
    for (let a = 0; a < AP.length; a++) {
      const B = apb[a];
      const dd = B[api[a]];
      const g = AP[a][1];
      const w = x + g * dd;
      x = dd - g * w;
      B[api[a]] = w;
      if (++api[a] === B.length) api[a] = 0;
    }
    for (let j = 0; j < 8; j++) {
      const v = buf[j][ix[j]];
      lp[j] = v + DAMP * (lp[j] - v);
      y[j] = lp[j] * G[j];
    }
    const oL = y[0] - y[2] + y[4] - y[6];
    const oR = y[1] - y[3] + y[5] - y[7];
    for (let h = 1; h < 8; h <<= 1)
      for (let j = 0; j < 8; j += h << 1)
        for (let k = j; k < j + h; k++) {
          const u = y[k];
          const v = y[k + h];
          y[k] = u + v;
          y[k + h] = u - v;
        }
    for (let j = 0; j < 8; j++) {
      buf[j][ix[j]] = x * (j & 1 ? -0.35 : 0.35) + y[j] * s8;
      if (++ix[j] === LENS[j]) ix[j] = 0;
    }
    hl = oL + hpA * (hl - oL);
    zl = oL - hl + lpA * (zl - (oL - hl));
    hr = oR + hpA * (hr - oR);
    zr = oR - hr + lpA * (zr - (oR - hr));
    out.L[i] += zl * wet;
    out.R[i] += zr * wet;
  }
}

/** Gated loudness of a stereo bus in dB (400 ms blocks, absolute and relative gates). */
function gatedLoudness(L, Rt) {
  const blk = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const e = [];
  for (let s = 0; s + blk <= L.length; s += hop) {
    let sum = 0;
    for (let i = s; i < s + blk; i++) sum += L[i] * L[i] + Rt[i] * Rt[i];
    e.push(sum / blk);
  }
  const abs = e.filter((v) => 10 * Math.log10(v + 1e-20) > -70);
  const mean = abs.reduce((a, b) => a + b, 0) / (abs.length || 1);
  const rel = abs.filter((v) => 10 * Math.log10(v + 1e-20) > 10 * Math.log10(mean + 1e-20) - 10);
  return 10 * Math.log10(rel.reduce((a, b) => a + b, 0) / (rel.length || 1) + 1e-20);
}

/**
 * Renders the score for a timeline: stereo 48 kHz, as 16-bit PCM. The
 * accents (bells, harp) are rendered first and set the master level, so
 * the background (pad, pedal, swells, horns) can be turned up or down in
 * score.mjs (MIX) without moving the accents. With accents: null the whole
 * mix is normalised to `target` instead and the accent level is printed.
 */
export function renderMusic(timeline, { target = -21, ceiling = -3, accents = MIX.accents, mix = MIX } = {}) {
  const sheet = cueSheet(timeline);
  const N = Math.ceil(sheet.total * SR);
  const END = N / SR;
  const dry = new Bus(N);
  const send = new Bus(N);

  // Accents first: bells and harp plucks, measured on their own.
  sheet.notes.forEach((n, i) => {
    const r = R(0xbe11, i);
    const vel = clamp(n.vel * r.range(0.95, 1.05));
    const p = clamp(n.pan + r.range(-0.05, 0.05), -1, 1);
    if (n.kind === "bell") strike(dry, send, n.t, n.m, BELL, 0.24 * vel ** 1.3, p, 0.004, vel, r);
    else if (n.kind === "pluck") strike(dry, send, n.t, n.m, HARP, 0.6 * vel ** 1.3, p, 0.003, vel, r);
  });
  const accentLoud = gatedLoudness(dry.L, dry.R);

  // Pads: one chord at a time, three slightly detuned voices per note,
  // crossfading on each change, through a low-pass that opens with the swells
  // and the section's brightness.
  const pads = new Bus(N);
  sheet.chords.forEach((c, ci) => {
    const last = ci === sheet.chords.length - 1;
    const s = c.t;
    const e = last ? END : sheet.chords[ci + 1].t;
    const on = ci === 0 ? 0 : s - 0.5;
    const rise = ci === 0 ? 3 : 2.2;
    const off = last ? END - 2 : e - 0.4;
    const fall = last ? 2 : 2.6;
    const env = (t) => smooth(clamp((t - on) / rise)) * (1 - smooth(clamp((t - off) / fall)));
    const i0 = Math.max(0, Math.floor(on * SR));
    const i1 = Math.min(N, Math.ceil((off + fall) * SR));
    const spread = mix.padVoices === 2 ? [[-6, -0.6], [6, 0.6]] : [[-7, -0.6], [0, 0], [6, 0.6]];
    const lvl = (mix.pad * 0.1) / Math.sqrt(c.notes.length * spread.length);
    c.notes.forEach((m0, ni) => {
      const m = m0 < mix.padFloor ? m0 + 12 : m0; // the pedal holds the bass
      spread.forEach(([cents, p], vi) => voice(pads, m, i0, i1, env, lvl, p * 0.8, R(0xa0d1, ci, ni, vi), cents));
    });
  });

  // Swell envelope: each swell a smooth bump, then gently smoothed.
  const SW = new Float64Array(Math.ceil(END * 100) + 2); // 100 per second
  for (const s of sheet.swells) {
    const a = Math.round(s.t * 100);
    const b = Math.round((s.t + s.dur) * 100);
    for (let k = a; k <= b && k < SW.length; k++) SW[k] += s.w * Math.sin((Math.PI * (k - a)) / Math.max(1, b - a)) ** 2;
  }
  for (let k = 1; k < SW.length; k++) SW[k] = Math.max(SW[k], SW[k - 1] * 0.985);
  const swellAt = (i) => {
    const f = (i / SR) * 100;
    const k = Math.floor(f);
    return Math.min(1, SW[k] + (SW[k + 1] - SW[k]) * (f - k));
  };
  const brightAt = (i) => {
    const t = i / SR;
    const p = sheet.pedals.findLast((x) => x.t <= t) ?? sheet.pedals[0];
    return p.section.bright;
  };
  lowpass(pads, (i) => mix.padCutoff + 700 * swellAt(i) + 700 * brightAt(i) + 200 * Math.sin((TAU * 0.045 * i) / SR));
  // a gentle low cut, so the pad sits above the pedal
  {
    const hp = Math.exp((-TAU * mix.padLowCut) / SR);
    let zl = 0, zr = 0;
    for (let i = 0; i < N; i++) {
      zl = pads.L[i] + hp * (zl - pads.L[i]);
      zr = pads.R[i] + hp * (zr - pads.R[i]);
      const l = mix.padLowCut ? pads.L[i] - zl : pads.L[i];
      const r = mix.padLowCut ? pads.R[i] - zr : pads.R[i];
      dry.L[i] += l * (1 - mix.padSend);
      dry.R[i] += r * (1 - mix.padSend);
      send.L[i] += l * mix.padSend;
      send.R[i] += r * mix.padSend;
    }
  }

  // Pedal: the section's low tonic with its octave, breathing, crossfading between sections.
  sheet.pedals.forEach((p, pi) => {
    const s = p.t;
    const e = pi + 1 < sheet.pedals.length ? sheet.pedals[pi + 1].t : END;
    const f = hz(p.note);
    const r = R(0xd2d2, pi);
    const ph = [r() * TAU, r() * TAU, r() * TAU];
    const i0 = Math.max(0, Math.floor((s - 1) * SR));
    const i1 = Math.min(N, Math.ceil((e + 2) * SR));
    for (let i = i0; i < i1; i++) {
      const t = i / SR;
      const g = mix.pedal * 0.02 * smooth(clamp((t - s + 1) / 4)) * (1 - smooth(clamp((t - e) / 2))) * (1 - smooth(clamp((t - END + 3) / 3))) * (1 + 0.12 * Math.sin(TAU * 0.09 * t + ph[2]));
      const v = g * (Math.sin(TAU * f * t + ph[0]) + 0.22 * Math.sin(TAU * 2 * f * t + ph[1]) + 0.05 * Math.sin(TAU * 3 * f * t));
      dry.L[i] += v;
      dry.R[i] += v;
    }
  });

  // The distant horns.
  sheet.notes.forEach((n, i) => {
    const vel = n.vel * mix.horn;
    if (n.kind === "horn") {
      // a horn chord far away: root, fifth and octave of the chord, low, slow in and out
      const notes = [n.m[0], n.m[1], n.m[0] + 12].map((m) => (m < 45 ? m + 12 : m));
      const i0 = Math.floor(n.t * SR);
      const i1 = Math.min(N, Math.ceil((n.t + n.dur + 2) * SR));
      const env = (t) => smooth(clamp((t - n.t) / 1.4)) * (1 - smooth(clamp((t - n.t - n.dur) / 2)));
      const horns = new Bus(i1 - i0);
      notes.forEach((m, k) => voice(horns, m, 0, i1 - i0, (t) => env(t + i0 / SR), 0.05 * vel, -0.3 + k * 0.3, R(0x40e1, i, k)));
      lowpass(horns, () => 700);
      for (let j = 0; j < i1 - i0; j++) {
        dry.L[i0 + j] += horns.L[j] * 0.6;
        dry.R[i0 + j] += horns.R[j] * 0.6;
        send.L[i0 + j] += horns.L[j];
        send.R[i0 + j] += horns.R[j];
      }
    }
  });

  // Swells: low noise through a low-pass that opens with the swell, and the pedal's octave and fifth.
  {
    const nl = R(0x5e11, 1);
    const nr = R(0x5e11, 2);
    const SWB = pads; // reuse the pad bus: the pads are already mixed in
    SWB.L.fill(0);
    SWB.R.fill(0);
    for (let i = 0; i < N; i++) {
      const a = nl() + nl() - 1;
      const b = nr() + nr() - 1;
      const g = mix.swell * 1.6 * swellAt(i) ** 1.4;
      SWB.L[i] = (a * 0.8 + b * 0.2) * g;
      SWB.R[i] = (b * 0.8 + a * 0.2) * g;
    }
    const fc = (i) => 70 + 600 * swellAt(i) ** 1.6;
    lowpass(SWB, fc);
    lowpass(SWB, fc);
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const p = sheet.pedals.findLast((x) => x.t <= t) ?? sheet.pedals[0];
      const d = hz(p.note);
      const g = mix.swell * 0.045 * swellAt(i) ** 1.6;
      const tone = g ? g * (0.7 * Math.sin(TAU * d * t) + 0.6 * Math.sin(TAU * 1.5 * d * t) + 0.5 * Math.sin(TAU * 2 * d * t)) : 0;
      dry.L[i] += SWB.L[i] + tone;
      dry.R[i] += SWB.R[i] + tone;
      send.L[i] += (SWB.L[i] + tone) * 0.25;
      send.R[i] += (SWB.R[i] + tone) * 0.25;
    }
  }

  reverb(send, dry);

  // Master: DC block, fade at the very end, loudness to the target under a peak ceiling.
  const a = Math.exp((-TAU * 18) / SR);
  const fade0 = N - Math.round(4 * SR);
  let zl = 0, zr = 0, peak = 0;
  for (let i = 0; i < N; i++) {
    zl = dry.L[i] + a * (zl - dry.L[i]);
    zr = dry.R[i] + a * (zr - dry.R[i]);
    const g = i < fade0 ? 1 : Math.cos(((i - fade0) / (N - fade0)) * (Math.PI / 2)) ** 2;
    dry.L[i] = (dry.L[i] - zl) * g;
    dry.R[i] = (dry.R[i] - zr) * g;
    peak = Math.max(peak, Math.abs(dry.L[i]), Math.abs(dry.R[i]));
  }
  const loud = gatedLoudness(dry.L, dry.R);
  const wanted = accents === null ? target - loud : accents - accentLoud;
  const gainDb = Math.min(wanted, ceiling - 20 * Math.log10(peak || 1));
  if (accents === null) console.log(`music: accents at ${(accentLoud + gainDb).toFixed(2)} dB when the whole mix is at ${target} dB`);
  const k = 10 ** (gainDb / 20);
  const pcm = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    pcm.writeInt16LE(Math.round(clamp(dry.L[i] * k, -1, 1) * 32767), i * 4);
    pcm.writeInt16LE(Math.round(clamp(dry.R[i] * k, -1, 1) * 32767), i * 4 + 2);
  }
  const notes = sheet.notes;
  console.log(
    `music: ${sheet.chords.length} chords, ${notes.filter((n) => n.kind === "bell").length} bells, ${notes.filter((n) => n.kind === "pluck").length} plucks, ` +
      `${notes.filter((n) => n.kind === "horn").length} horn chords, ${sheet.swells.length} swells; loudness ${(loud + gainDb).toFixed(1)} dB (accents ${(accentLoud + gainDb).toFixed(1)} dB), peak ${(20 * Math.log10(peak * k)).toFixed(1)} dBFS`,
  );
  return pcm;
}

/** Checks the score: notes parse, sections are in order, rules play known sounds. */
export function checkScore() {
  const problems = [];
  SECTIONS.forEach((s, i) => {
    if (i && s.from <= SECTIONS[i - 1].from) problems.push(`${s.name}: sections out of order`);
    if (!SCALES[s.key.mode]) problems.push(`${s.name}: unknown mode ${s.key.mode}`);
    for (const c of [s.pedal, ...s.chords.flatMap((c) => c.split(" "))]) {
      try {
        midi(c);
      } catch (e) {
        problems.push(`${s.name}: ${e.message}`);
      }
    }
  });
  const known = new Set(["motif", "bell", "pluck", "roll", "run", "swell", "chime"]);
  for (const [type, rules] of Object.entries(RULES)) for (const r of rules) if (type !== "section" && !known.has(r.play)) problems.push(`${type}: unknown sound ${r.play}`);
  return problems;
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
 * Renders the music for the recording in `out` (its timeline.json) and mixes
 * it under the full video and each clip, in place. Also keeps the soundtrack
 * on its own as tutorial-music.m4a.
 */
export async function addMusic(out, ffmpeg) {
  const timeline = JSON.parse(fs.readFileSync(path.join(out, "timeline.json"), "utf8"));
  const video = path.join(out, "HoMM3-Scenario-Creator-tutorial.mp4");
  const wav = path.join(out, "_music.wav");
  console.log(`music: scoring ${timeline.total.toFixed(1)} s, ${timeline.events?.length ?? 0} events`);
  writeWav(wav, renderMusic(timeline));

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
  // the repository root's HoMM3-Scenario-Creator-tutorial/ (in .gitignore)
  const out = path.resolve(get("out", path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "HoMM3-Scenario-Creator-tutorial")));
  const tools = path.resolve(get("tools", path.join(home, "tools", "tutorial-capture")));
  const ffmpeg = get("ffmpeg", process.env.FFMPEG ?? path.join(tools, "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe"));
  const timelineFile = get("timeline", path.join(out, "timeline.json"));
  if (a.includes("--check")) {
    const problems = checkScore();
    console.log(problems.length ? problems.join("\n") : "score OK");
    process.exitCode = problems.length ? 1 : 0;
  } else if (a.includes("--cues")) {
    const sheet = cueSheet(JSON.parse(fs.readFileSync(timelineFile, "utf8")));
    const rows = [
      ...sheet.pedals.map((p) => [p.t, `pedal  ${p.section.name}`]),
      ...sheet.chords.map((c) => [c.t, `pad    ${c.notes.join(" ")}  (${c.why})`]),
      ...sheet.notes.map((n) => [n.t, `${n.kind.padEnd(6)} ${Array.isArray(n.m) ? "chord" : n.m}  vel ${n.vel.toFixed(2)}  ${n.why}`]),
      ...sheet.swells.map((s) => [s.t, `swell  ${s.dur.toFixed(1)} s x${s.w}  ${s.why}`]),
    ].sort((x, y) => x[0] - y[0]);
    for (const [t, s] of rows) console.log(`${t.toFixed(2).padStart(8)} s  ${s}`);
  } else if (get("wav", "")) {
    writeWav(get("wav", ""), renderMusic(JSON.parse(fs.readFileSync(timelineFile, "utf8"))));
  } else {
    addMusic(out, ffmpeg).catch((e) => {
      console.error(e);
      process.exit(1);
    });
  }
}
