// The score of the tutorial's background music: five short pieces, written
// for this video, in the manner of a classic fantasy-strategy soundtrack.
// Each piece develops one central motif through variations: sequenced,
// inverted, ornamented, stretched, moved to new keys, with a countermelody,
// changing accompaniment and a climax. No melody here is taken from
// anywhere else.
//
// Notation
//   chords   "I:3 V_3:3 ii7:1.5 V7:1.5"   roman numeral : beats. Upper case is
//            major, lower case minor, ° diminished; b/# shift the root; 7 maj7
//            9 sus add9 extend; _3 _5 _7 put that chord tone in the bass;
//            "V7>vi" is a secondary chord (V7 of vi).
//   motifs   [[scale degree or null, beats], ...]; degree 0 is the tonic.
//   cells    the melody, one motif per cell: "A", "A+2" (a sequence two
//            degrees up), "A~" (inverted), "A*" (twice as slow), "A'"
//            (ornamented), "r2" (two bars rest), and the cue's "cad"/"half".
//   keys     [{ bar, tonic (MIDI), mode }] where the key changes.
//   lead / counter / tex   instruments and accompaniment textures.
//   dyn      [start, end] loudness; tempo: factor on the cue's bpm;
//            rubato: push-and-pull per phrase; rit: slow the last bars.
//   optional / repeat      may be dropped / repeated (with `alt`) to fit time.

const D = 62;
const F = 65;
const G = 67;
const E = 64;

export const CUES = [
  {
    name: "Brindlemere at dawn",
    meter: 3,
    bpm: 80,
    motifs: {
      A: [[4, 1.5], [5, 0.5], [4, 1], [2, 2], [1, 0.5], [0, 0.5]],
      B: [[2, 1], [4, 1], [7, 1], [6, 1.5], [5, 0.5], [4, 1]],
      cad: [[3, 1], [2, 0.5], [1, 0.5], [1, 1], [0, 3]],
      half: [[2, 1], [3, 1], [2, 1], [1, 3]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "I:3 I:3 IVmaj7:3 IVmaj7:3 I:3 vi7:3 IV:3 Vsus:1.5 V:1.5",
        cells: ["r2", "A", "r2", "half"],
        lead: "flute",
        tex: ["rolled", "pad"],
        dyn: [0.3, 0.5],
        tempo: 0.85,
        rubato: 0.08,
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "I:3 V_3:3 vi:3 iii:3 IV:3 I_3:3 ii7:3 V:3 I:3 V7>IV:3 IV:3 iv:3 I_5:3 vi7:3 ii7:1.5 V7:1.5 I:3",
        cells: ["A", "A-1", "B", "half", "A", "A+2", "B-1", "cad"],
        lead: "oboe",
        counter: "cello",
        tex: ["arp", "pad"],
        dyn: [0.5, 0.7],
        rubato: 0.05,
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }, { bar: 8, tonic: D + 7, mode: "major" }],
        chords: "vi:3 ii:3 V:3 I:3 IV:3 V>V:3 V:3 V:3 I:3 IV:3 ii:3 V:3 I:3 vi:3 IV:1.5 V:1.5 I:3",
        cells: ["A~", "A~-1", "B", "half", "A'", "A'+1", "B", "cad"],
        lead: "violins",
        counter: "flute",
        counterAbove: true,
        tex: ["alberti", "pad"],
        dyn: [0.6, 0.8],
        rubato: 0.05,
      },
      {
        keys: [{ bar: 0, tonic: D + 9 - 12, mode: "minor" }],
        motifs: { C: [[0, 0.5], [2, 0.5], [4, 0.5], [2, 0.5], [3, 1], [1, 0.5], [2, 0.5], [0, 0.5], [-1, 0.5], [0, 1]] },
        chords: "i:3 iv:3 V7:3 i:3 VI:3 iv:3 V:3 V:3",
        cells: ["C", "C-1", "C+2", "half"],
        lead: "bassoon",
        tex: ["pizz"],
        dyn: [0.5, 0.55],
        optional: true,
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "IV:3 V:3 iii:3 vi:3 ii7:3 V7sus:1.5 V7:1.5 I:3 I:3",
        cells: ["A*", "B", "cad"],
        lead: "violins",
        counter: "horn",
        tex: ["quavers", "pad", "timpani"],
        dyn: [0.8, 1.0],
        rubato: 0.04,
        rit: 2,
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "IV:3 iv:3 I:3 I:3 I:3 I:3",
        cells: ["r2", "A", "r2"],
        lead: "flute",
        tex: ["rolled", "pad"],
        dyn: [0.45, 0.2],
        tempo: 0.9,
        rit: 3,
        hold: true,
      },
    ],
  },

  {
    name: "The mapmaker's study",
    meter: 4,
    bpm: 72,
    motifs: {
      A: [[0, 0.5], [2, 0.5], [4, 1], [3, 1.5], [4, 0.5]],
      B: [[7, 1.5], [6, 0.5], [4, 1], [5, 1], [4, 2], [2, 2]],
      cad: [[3, 1], [2, 1], [1, 1], [2, 1], [0, 4]],
      half: [[4, 2], [3, 1], [2, 1], [1, 4]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: F, mode: "lydian" }],
        chords: "Imaj7:4 II:4 Imaj7:4 II:4 iii7:4 II:4 vi7:4 V:4",
        cells: ["A", "r1", "A+1", "r1", "B", "half"],
        lead: "piano",
        tex: ["planing", "celesta"],
        pedal: true,
        dyn: [0.3, 0.45],
        tempo: 0.85,
        rubato: 0.1,
      },
      {
        keys: [{ bar: 0, tonic: F, mode: "lydian" }, { bar: 8, tonic: F, mode: "major" }],
        chords: "Imaj7:4 II:4 vi7:4 iii7:4 Imaj7:4 II7:4 vi:4 V:4 IVmaj7:4 iii7:4 ii7:4 V7:4 vi7:4 IVmaj7:4 ii7:2 V7:2 I:4",
        cells: ["A", "A+2", "B", "A+4", "A+2", "half", "A~", "A~+1", "B", "A'", "A'-1", "cad"],
        lead: "flute",
        counter: "clarinet",
        tex: ["arp", "pad"],
        dyn: [0.45, 0.65],
        rubato: 0.06,
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "dorian" }],
        motifs: { C: [[0, 2], [2, 1], [3, 1], [4, 3], [3, 0.5], [2, 0.5]] },
        chords: "i7:4 IV:4 i7:4 IV:4 bVII:4 IV:4 v7:4 V7:4",
        cells: ["C", "C+1", "C-1", "half"],
        lead: "cello",
        counter: "flute",
        counterAbove: true,
        tex: ["tremolo", "gliss"],
        dyn: [0.45, 0.6],
        optional: true,
      },
      {
        keys: [{ bar: 0, tonic: F, mode: "major" }],
        chords: "IV:4 V:4 iii:4 vi:4 ii7:4 V7sus:2 V7:2 I:4 I:4",
        cells: ["A*", "B", "A+2", "A+4", "cad"],
        lead: "violins",
        counter: "horn",
        tex: ["arp", "choir", "pad", "timpani"],
        dyn: [0.75, 0.95],
        rubato: 0.04,
        rit: 2,
      },
      {
        keys: [{ bar: 0, tonic: F, mode: "lydian" }],
        chords: "Imaj7:4 II:4 Imaj7:4 Imaj7:4",
        cells: ["A", "r1", "A+2", "r1"],
        lead: "celesta",
        tex: ["planing"],
        pedal: true,
        dyn: [0.4, 0.2],
        rit: 2,
        hold: true,
      },
    ],
  },

  {
    name: "Riders at the ford",
    meter: 4,
    bpm: 86,
    motifs: {
      A: [[0, 1.5], [4, 0.5], [4, 1], [7, 1], [6, 1.5], [4, 0.5], [5, 2]],
      B: [[4, 1], [5, 0.5], [6, 0.5], [7, 2], [5, 1], [3, 1], [4, 2]],
      cad: [[2, 1], [3, 1], [1, 1.5], [2, 0.5], [0, 4]],
      half: [[3, 2], [2, 1], [1, 1], [4, 4]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: G, mode: "major" }],
        chords: "I:4 vi:4 IV:4 V:4 I:4 iii:4 IV:2 V:2 I:4",
        cells: ["A", "B", "A+2", "half"],
        lead: "clarinet",
        tex: ["rolled", "pizz"],
        dyn: [0.45, 0.55],
        rubato: 0.05,
      },
      {
        keys: [{ bar: 0, tonic: G, mode: "major" }],
        chords: "I:4 V_3:4 vi:4 iii:4 IV:4 I_3:4 ii7:4 V:4 I:4 V7>vi:4 vi:4 V7>V:4 V:4 bVII:4 IV:4 V7:4",
        cells: ["A", "B", "A-1", "half", "A", "A+2", "B+1", "half"],
        lead: "horn",
        counter: "bassoon",
        tex: ["quavers", "pad", "timpani"],
        dyn: [0.6, 0.9],
        rubato: 0.03,
        repeat: true,
        alt: { lead: "violins", counter: "horn", cells: ["A'", "B", "A'-1", "half", "A~", "A~+2", "B+1", "half"] },
      },
      {
        keys: [{ bar: 0, tonic: G + 2, mode: "major" }],
        chords: "I:4 IV:4 V:4 vi:4 IV:4 V7sus:2 V7:2 I:4 I:4",
        cells: ["A*", "B", "cad"],
        lead: "violins",
        counter: "horn",
        tex: ["quavers", "choir", "pad", "timpani"],
        dyn: [0.9, 1.0],
        rit: 2,
      },
      {
        keys: [{ bar: 0, tonic: G + 2, mode: "major" }],
        chords: "IV:4 iv:4 I:4 I:4",
        cells: ["A", "r2"],
        lead: "flute",
        tex: ["rolled", "pad"],
        dyn: [0.45, 0.2],
        rit: 2,
        hold: true,
      },
    ],
  },

  {
    name: "Marsh lanterns",
    meter: 3,
    bpm: 92,
    motifs: {
      P: [[0, 0.5], [2, 0.5], [4, 1], [3, 0.5], [2, 0.5], [1, 1], [2, 0.5], [0, 0.5], [-1, 1]],
      L: [[4, 2], [3, 0.5], [2, 0.5], [5, 1.5], [4, 0.5], [2, 1]],
      cad: [[3, 1], [2, 1], [1, 1], [0, 3]],
      half: [[2, 1], [1, 1], [2, 1], [4, 3]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: E, mode: "dorian" }],
        chords: "i:3 IV:3 i:3 IV:3 i:3 bVII:3 IV:3 V:3",
        cells: ["P", "r2", "P+1", "half"],
        lead: "bassoon",
        tex: ["tremolo", "pizz"],
        dyn: [0.4, 0.5],
      },
      {
        keys: [{ bar: 0, tonic: E, mode: "dorian" }],
        chords: "i:3 IV:3 bIII:3 bVII:3 i:3 IV:3 ii:3 V:3 i:3 bVI:3 bIII:3 bVII:3 iv:3 i:3 V7:3 i:3",
        cells: ["P", "P-1", "P+2", "half", "P", "P+1", "L", "cad"],
        lead: "bassoon",
        counter: "clarinet",
        counterAbove: true,
        tex: ["pizz", "tremolo"],
        dyn: [0.5, 0.65],
        repeat: true,
        alt: { lead: "clarinet", counter: "bassoon", counterAbove: false, tex: ["pizz", "celesta"], cells: ["P'", "P'-1", "P~+2", "half", "P", "P+3", "L", "cad"] },
      },
      {
        keys: [{ bar: 0, tonic: G, mode: "major" }],
        chords: "I:3 iii:3 IV:3 I:3 vi:3 ii:3 V:3 V:3 I:3 V7>IV:3 IV:3 iv:3 I_5:3 V:3 I:3 I:3",
        cells: ["L", "L+1", "L+2", "half", "L", "L-1", "L+2", "cad"],
        lead: "oboe",
        counter: "cello",
        tex: ["arp", "pad"],
        dyn: [0.55, 0.75],
        tempo: 0.8,
        rubato: 0.06,
      },
      {
        keys: [{ bar: 0, tonic: E, mode: "dorian" }],
        chords: "i:3 IV:3 i:3 IV:3 bVI:3 bVII:3 V:3 V:3",
        cells: ["P", "P+2", "P+4", "half"],
        lead: "violins",
        counter: "horn",
        tex: ["pizz", "pad", "timpani"],
        dyn: [0.7, 0.85],
        optional: true,
      },
      {
        keys: [{ bar: 0, tonic: E, mode: "dorian" }],
        chords: "i:3 iv:3 i:3 V:3 I:3 I:3",
        cells: ["P", "r2", "r2"],
        lead: "bassoon",
        tex: ["pizz", "pad"],
        dyn: [0.5, 0.25],
        rit: 3,
        hold: true,
      },
    ],
  },

  {
    name: "Banners over the ford",
    meter: 4,
    bpm: 80,
    motifs: {
      H: [[0, 1], [4, 1], [7, 1.5], [6, 0.5], [5, 1], [4, 1], [2, 1], [4, 1]],
      K: [[7, 2], [8, 1], [9, 1], [7, 1], [4, 1], [5, 2]],
      cad: [[5, 1], [4, 0.5], [3, 0.5], [1, 2], [0, 4]],
      half: [[2, 1], [3, 1], [4, 2], [4, 4]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "I:4 IV:4 I:4 V:4 I:4 IV:4 ii7:2 V7:2 I:4",
        cells: ["H", "K", "H+1", "half"],
        lead: "horn",
        tex: ["pizz", "pad", "timpani"],
        dyn: [0.55, 0.7],
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }, { bar: 8, tonic: F, mode: "major" }],
        chords: "I:4 V_3:4 vi:4 I_5:4 IV:4 I_3:4 ii7:4 V7:4 I:4 iii:4 IV:4 V:4 vi:4 IV:4 V7sus:2 V7:2 I:4",
        cells: ["H", "K", "H-1", "half", "H", "K+1", "H+2", "cad"],
        lead: "violins",
        counter: "horn",
        tex: ["quavers", "pad", "timpani"],
        dyn: [0.7, 0.9],
        rubato: 0.03,
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "IV:4 V:4 iii7:4 vi:4 ii7:4 V7>V:4 V7sus:2 V7:2 I:4",
        cells: ["K*", "H", "cad"],
        lead: "violins",
        counter: "horn",
        tex: ["quavers", "choir", "pad", "timpani"],
        dyn: [0.95, 1.0],
        rit: 2,
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        meter: 3,
        bpm: 72,
        motifs: { A: [[4, 1.5], [5, 0.5], [4, 1], [2, 2], [1, 0.5], [0, 0.5]] },
        chords: "I:3 IVmaj7:3 I:3 vi7:3 IV:3 iv:3 I:3 I:3",
        cells: ["A", "A-1", "r2", "r2"],
        lead: "flute",
        tex: ["rolled", "pad"],
        dyn: [0.5, 0.2],
        rit: 3,
        hold: true,
      },
    ],
  },
];

/** The chapter each piece starts on (the first one starts with the video). */
export const CUE_CHAPTERS = [1, 4, 6, 8, 14];
