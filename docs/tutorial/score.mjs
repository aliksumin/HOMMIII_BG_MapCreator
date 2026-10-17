// The score of the tutorial's background music: five short pieces, written
// for this video, in the manner of a bright fantasy-strategy soundtrack.
// They are all in major keys and move briskly. Each develops its motifs
// through variations: sequenced, inverted, ornamented, stretched, moved to
// new keys, passed between instruments, over changing accompaniment and
// percussion, up to a climax. No melody here is taken from anywhere else.
//
// Notation
//   progressions  named chord runs, reused by the variations.
//   chords   "I:3 V_3:3 ii7:1.5 V7:1.5", or progression names. Roman numeral
//            : beats. Upper case is major, lower case minor, ° diminished;
//            b/# shift the root; 7 maj7 9 sus add9 extend; _3 _5 _7 put that
//            chord tone in the bass; "V7>vi" is a secondary chord (V7 of vi).
//   motifs   [[scale degree or null, beats], ...]; degree 0 is the tonic.
//            A leading rest makes a pickup into the next bar.
//   cells    the melody, one motif per cell: "A", "A+2" (a sequence two
//            degrees up), "A~" (inverted), "A*" (twice as slow), "A'"
//            (ornamented), "r2" (two bars rest).
//   keys     [{ bar, tonic (MIDI), mode }] where the key changes.
//   lead     an instrument, or a list that takes turns cell by cell (call
//            and response); double: another instrument on the melody in its
//            own octave; counter: the countermelody's instrument.
//   tex      accompaniment and percussion: arp rolled alberti pizz quavers
//            gallop fanfare runs pad tremolo choir planing celesta timpani
//            snare drum tambourine triangle cymbal.
//   dyn      [start, end] loudness; artic "staccato" for short, bouncing
//            notes; tempo: factor on the cue's bpm; rubato; rit: slow the
//            last bars; hold: the last chord may ring on.
//   optional / repeat   may be dropped / played again (with `alt`) to fit time.

const D = 62;
const F = 65;
const G = 67;
const A3 = 57;
const C = 60;

export const CUES = [
  {
    name: "Morning in Brindlemere",
    meter: 3,
    bpm: 126,
    progressions: {
      P0: "I:3 I:3 IV:3 V:3 I:3 vi:3 ii:3 V:3",
      P1: "I:3 I:3 IV:3 V:3 I:3 vi:3 ii:3 V:3 I:3 I_3:3 IV:3 V>V:3 V:3 IV:1.5 V:1.5 I:3 I:3",
      P2: "IV:3 V:3 iii:3 vi:3 ii:3 V:3 I:3 I:3 IV:3 V:3 I_3:3 vi:3 ii7:3 V7:3 I:3 V:3",
      P3: "I:3 V_3:3 vi:3 I_5:3 IV:3 I_3:3 ii7:3 V7:3 I:3 V7>IV:3 IV:3 V>V:3 I_5:3 V7:3 I:3 I:3",
      Pc: "I:3 IV:3 I:3 V:3 I:3 IV:3 V:3 I:3",
    },
    motifs: {
      A: [[null, 2], [4, 0.5], [5, 0.5], [7, 1.5], [6, 0.5], [5, 0.5], [4, 0.5]],
      A2: [[2, 1], [4, 1], [3, 0.5], [2, 0.5], [1, 1.5], [2, 0.5], [4, 1]],
      B: [[0, 0.75], [2, 0.25], [4, 1], [7, 1], [6, 0.75], [5, 0.25], [4, 1], [2, 1]],
      C: [[4, 0.5], [5, 0.5], [6, 0.5], [7, 0.5], [8, 0.5], [7, 0.5], [6, 1], [4, 1], [2, 1]],
      cad: [[5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [1, 1], [0, 3]],
      half: [[2, 1], [1, 0.5], [0, 0.5], [1, 1], [4, 3]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "P0",
        cells: ["A", "A2", "A+2", "half"],
        lead: ["oboe", "flute"],
        tex: ["pizz", "runs", "triangle"],
        artic: "staccato",
        dyn: [0.45, 0.6],
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "P1",
        cells: ["A", "A2", "B", "half", "A", "A2+1", "C", "cad"],
        lead: ["flute", "oboe"],
        counter: "bassoon",
        tex: ["arp", "pizz", "runs", "triangle"],
        artic: "staccato",
        dyn: [0.6, 0.75],
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "P2",
        cells: ["B", "B+1", "C", "half", "A", "A2", "B+2", "half"],
        lead: "violins",
        counter: "horn",
        tex: ["quavers", "snare", "runs"],
        dyn: [0.7, 0.85],
        repeat: true,
        alt: { lead: ["oboe", "clarinet"], counter: "bassoon", tex: ["arp", "pizz", "tambourine"], artic: "staccato", cells: ["A'", "A2", "B'", "half", "C", "C-2", "B", "half"] },
      },
      {
        keys: [{ bar: 0, tonic: G, mode: "major" }],
        chords: "P1",
        cells: ["A'", "A2", "B'", "half", "C", "C-2", "A", "cad"],
        lead: ["clarinet", "oboe"],
        counter: "bassoon",
        tex: ["pizz", "tambourine", "celesta"],
        artic: "staccato",
        dyn: [0.55, 0.65],
        optional: true,
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "P3",
        cells: ["A", "A2", "B", "C", "A+2", "A2", "B", "cad"],
        lead: "violins",
        double: "flute",
        counter: "horn",
        tex: ["quavers", "fanfare", "snare", "drum", "timpani", "cymbal"],
        dyn: [0.85, 1.0],
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "Pc",
        cells: ["A", "half", "B", "cad"],
        lead: ["flute", "oboe"],
        tex: ["arp", "pad", "triangle"],
        dyn: [0.6, 0.45],
        rit: 2,
        hold: true,
      },
    ],
  },

  {
    name: "The mapmaker's workshop",
    meter: 4,
    bpm: 116,
    progressions: {
      Q1: "I:4 V_3:4 vi:4 IV:4 I_5:4 V:4 I:2 IV:2 V:4",
      Q2: "I:4 IV:4 V7>vi:4 vi:4 ii:4 V:4 I:2 V:2 I:4",
      Q3: "IV:4 V:4 iii:4 vi:4 ii7:4 V7>V:4 V7sus:2 V7:2 I:4",
      Qc: "IV:4 V:4 I:4 I:4",
    },
    motifs: {
      A: [[null, 1], [0, 0.5], [2, 0.5], [4, 1], [4, 0.5], [5, 0.5], [4, 1], [2, 1], [3, 0.5], [2, 0.5], [1, 1]],
      B: [[4, 1.5], [3, 0.5], [2, 1], [4, 1], [7, 2], [6, 1], [5, 1]],
      C: [[0, 0.25], [1, 0.25], [2, 0.25], [3, 0.25], [4, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [7, 1], [4, 1], [5, 1], [6, 1], [7, 1]],
      cad: [[2, 1], [3, 0.5], [2, 0.5], [1, 1], [1, 1], [0, 4]],
      half: [[3, 1], [2, 1], [1, 1], [2, 1], [4, 4]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: F, mode: "major" }],
        chords: "Q1",
        cells: ["A", "B", "A+1", "half"],
        lead: ["clarinet", "flute"],
        tex: ["pizz", "celesta"],
        artic: "staccato",
        dyn: [0.45, 0.55],
      },
      {
        keys: [{ bar: 0, tonic: F, mode: "major" }],
        chords: "Q1 Q2",
        cells: ["A", "B", "C", "half", "A", "A+2", "B", "cad"],
        lead: ["flute", "clarinet"],
        counter: "bassoon",
        tex: ["pizz", "celesta", "runs", "triangle"],
        artic: "staccato",
        dyn: [0.55, 0.7],
        repeat: true,
        alt: { lead: ["oboe", "clarinet"], counter: "cello", tex: ["alberti", "pad", "runs"], artic: "legato", cells: ["A'", "B", "C", "half", "A~", "A", "B+1", "cad"] },
      },
      {
        keys: [{ bar: 0, tonic: C, mode: "major" }],
        chords: "Q2 Q3",
        cells: ["B", "B+1", "A", "half", "C", "C+1", "B", "cad"],
        lead: "violins",
        counter: "horn",
        tex: ["arp", "pad", "runs", "snare"],
        dyn: [0.65, 0.8],
      },
      {
        keys: [{ bar: 0, tonic: F, mode: "major" }],
        chords: "Q1 Q3",
        cells: ["A", "B", "C", "half", "A+2", "B", "C", "cad"],
        lead: "violins",
        double: "flute",
        counter: "horn",
        tex: ["quavers", "fanfare", "snare", "drum", "timpani", "cymbal", "choir"],
        dyn: [0.85, 1.0],
      },
      {
        keys: [{ bar: 0, tonic: F, mode: "major" }],
        chords: "Qc",
        cells: ["A", "cad"],
        lead: "celesta",
        tex: ["planing", "pizz"],
        dyn: [0.5, 0.4],
        rit: 1,
        hold: true,
      },
    ],
  },

  {
    name: "Riders at the ford",
    meter: 4,
    bpm: 124,
    progressions: {
      R1: "I:4 I:4 IV:4 I:4 vi:4 IV:4 V:4 V:4",
      R2: "I:4 V_3:4 vi:4 iii:4 IV:4 I_3:4 IV:2 V:2 I:4",
      R3: "bVII:4 IV:4 I:4 I:4 bVI:4 bVII:4 V:4 V:4",
      Rc: "IV:4 V:4 I:4 I:4",
    },
    motifs: {
      A: [[0, 0.75], [0, 0.25], [4, 1], [4, 0.75], [5, 0.25], [4, 1], [7, 1.5], [6, 0.5], [5, 1], [4, 1]],
      B: [[2, 0.5], [3, 0.5], [4, 1], [5, 1], [6, 1], [7, 2], [4, 2]],
      C: [[4, 1 / 3], [5, 1 / 3], [6, 1 / 3], [7, 1], [6, 1 / 3], [5, 1 / 3], [4, 1 / 3], [5, 1], [2, 1], [4, 1], [0, 2]],
      cad: [[5, 1], [6, 0.5], [7, 0.5], [4, 1], [2, 1], [0, 4]],
      half: [[2, 1], [4, 1], [3, 1], [1, 1], [4, 4]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: G, mode: "major" }],
        chords: "R1",
        cells: ["A", "B", "A+2", "half"],
        lead: "horn",
        tex: ["gallop", "timpani"],
        dyn: [0.5, 0.65],
      },
      {
        keys: [{ bar: 0, tonic: G, mode: "major" }],
        chords: "R2 R1",
        cells: ["A", "C", "B", "half", "A", "A+2", "C", "cad"],
        lead: ["flute", "oboe"],
        counter: "horn",
        tex: ["gallop", "runs", "snare"],
        dyn: [0.6, 0.75],
        repeat: true,
        alt: { lead: ["clarinet", "oboe"], counter: "bassoon", tex: ["pizz", "runs", "tambourine"], artic: "staccato", cells: ["A'", "C", "B'", "half", "A", "A-1", "C", "cad"] },
      },
      {
        keys: [{ bar: 0, tonic: G, mode: "major" }],
        chords: "R1",
        cells: ["A'", "B", "A~", "half"],
        lead: ["clarinet", "oboe"],
        counter: "bassoon",
        tex: ["pizz", "tambourine", "runs"],
        artic: "staccato",
        dyn: [0.55, 0.65],
        optional: true,
      },
      {
        keys: [{ bar: 0, tonic: G, mode: "major" }],
        chords: "R3 R2",
        cells: ["B", "B+2", "A", "half", "C", "C+1", "A", "cad"],
        lead: "violins",
        counter: "horn",
        tex: ["gallop", "fanfare", "snare", "timpani"],
        dyn: [0.75, 0.9],
      },
      {
        keys: [{ bar: 0, tonic: G + 2, mode: "major" }],
        chords: "R2",
        cells: ["A", "C", "B", "cad"],
        lead: "violins",
        double: "flute",
        counter: "horn",
        tex: ["gallop", "fanfare", "snare", "drum", "timpani", "cymbal", "choir"],
        dyn: [0.9, 1.0],
      },
      {
        keys: [{ bar: 0, tonic: G + 2, mode: "major" }],
        chords: "Rc",
        cells: ["A", "cad"],
        lead: "horn",
        tex: ["rolled", "pad", "timpani"],
        dyn: [0.7, 0.5],
        rit: 1,
        hold: true,
      },
    ],
  },

  {
    name: "Market day",
    meter: 3,
    bpm: 144,
    progressions: {
      S1: "I:3 I:3 V:3 V:3 V:3 V:3 I:3 I:3",
      S2: "IV:3 IV:3 I:3 I:3 ii:3 V:3 I:3 I:3",
      S3: "I:3 vi:3 IV:3 V:3 I:3 iii:3 IV:1.5 V:1.5 I:3",
      S4: "I:3 vi:3 ii:3 V:3 I:3 IV:3 V:3 I:3",
    },
    motifs: {
      P: [[0, 0.5], [2, 0.5], [4, 0.5], [2, 0.5], [4, 0.5], [7, 0.5], [6, 1], [4, 1], [5, 1]],
      Q: [[4, 1], [null, 0.5], [4, 0.5], [5, 0.5], [6, 0.5], [7, 1.5], [5, 0.5], [4, 1]],
      L: [[2, 2], [3, 0.5], [4, 0.5], [5, 2], [4, 1]],
      cad: [[3, 0.5], [4, 0.5], [2, 1], [1, 1], [0, 3]],
      half: [[2, 1], [3, 1], [2, 1], [4, 3]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: A3, mode: "major" }],
        chords: "S1",
        cells: ["P", "Q", "P+1", "half"],
        lead: "bassoon",
        tex: ["pizz", "triangle"],
        artic: "staccato",
        dyn: [0.45, 0.55],
      },
      {
        keys: [{ bar: 0, tonic: A3, mode: "major" }],
        chords: "S1 S2",
        cells: ["P", "Q", "P+2", "half", "Q", "P", "Q+1", "cad"],
        lead: ["bassoon", "flute"],
        tex: ["pizz", "tambourine", "runs"],
        artic: "staccato",
        dyn: [0.55, 0.7],
        repeat: true,
        alt: { lead: ["clarinet", "oboe"], counter: "bassoon", tex: ["pizz", "celesta", "tambourine"], cells: ["P'", "Q", "P+2", "half", "Q'", "P", "Q+1", "cad"] },
      },
      {
        keys: [{ bar: 0, tonic: A3, mode: "major" }],
        chords: "S2 S1",
        cells: ["Q", "Q+2", "P", "half", "P'", "Q", "P", "cad"],
        lead: ["clarinet", "oboe"],
        counter: "bassoon",
        tex: ["arp", "pizz", "runs", "triangle"],
        artic: "staccato",
        dyn: [0.6, 0.75],
        repeat: true,
        alt: { lead: ["flute", "oboe"], counter: "cello", tex: ["alberti", "pizz", "tambourine"], cells: ["P", "P+2", "Q", "half", "Q'", "P", "Q", "cad"] },
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "S3 S4",
        cells: ["L", "L+1", "L+2", "half", "L", "L-1", "L+2", "cad"],
        lead: "oboe",
        counter: "cello",
        tex: ["arp", "pad", "runs"],
        dyn: [0.55, 0.7],
        tempo: 0.8,
        rubato: 0.04,
      },
      {
        keys: [{ bar: 0, tonic: A3, mode: "major" }],
        chords: "S1 S2",
        cells: ["P", "Q", "P+2", "half", "Q", "P+2", "Q", "cad"],
        lead: "violins",
        double: "flute",
        counter: "horn",
        tex: ["quavers", "fanfare", "snare", "drum", "tambourine", "timpani", "cymbal"],
        artic: "staccato",
        dyn: [0.85, 1.0],
        repeat: true,
        alt: { double: "oboe", tex: ["quavers", "snare", "tambourine", "timpani"], cells: ["Q", "P", "Q+2", "half", "P", "P+2", "Q", "cad"] },
      },
      {
        keys: [{ bar: 0, tonic: A3, mode: "major" }],
        chords: "S2",
        cells: ["P", "Q", "P", "cad"],
        lead: ["bassoon", "flute"],
        tex: ["pizz", "triangle"],
        artic: "staccato",
        dyn: [0.55, 0.45],
        rit: 2,
        hold: true,
      },
    ],
  },

  {
    name: "Banners over the ford",
    meter: 4,
    bpm: 108,
    progressions: {
      M1: "I:4 IV:4 I:4 V:4 I:4 IV:4 ii7:2 V7:2 I:4",
      M2: "vi:4 IV:4 I:4 V:4 vi:4 IV:4 V7sus:2 V7:2 I:4",
      M3: "IV:4 V:4 iii7:4 vi:4 ii7:4 V7>V:4 V7sus:2 V7:2 I:4",
      Mc: "IV:4 V:4 I:4 I:4",
    },
    motifs: {
      H: [[0, 0.75], [0, 0.25], [4, 1.5], [4, 0.5], [5, 0.75], [6, 0.25], [7, 2], [4, 1], [5, 1]],
      K: [[7, 1], [6, 0.5], [5, 0.5], [4, 1], [2, 1], [3, 1.5], [4, 0.5], [5, 2]],
      // the opening motif of the first piece, brought back for the finale
      A1: [[null, 3], [4, 0.5], [5, 0.5], [7, 1.5], [6, 0.5], [5, 0.5], [4, 0.5], [2, 1]],
      cad: [[2, 1], [3, 1], [4, 1.5], [1, 0.5], [0, 4]],
      half: [[3, 1], [4, 1], [5, 1], [6, 1], [4, 4]],
    },
    variations: [
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "M1",
        cells: ["H", "K", "H+1", "half"],
        lead: "horn",
        tex: ["pizz", "snare", "timpani"],
        dyn: [0.55, 0.7],
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "M1 M2",
        cells: ["H", "K", "H-1", "half", "H", "K+1", "H+2", "cad"],
        lead: "violins",
        double: "flute",
        counter: "horn",
        tex: ["quavers", "snare", "runs", "timpani"],
        dyn: [0.7, 0.85],
      },
      {
        keys: [{ bar: 0, tonic: F, mode: "major" }],
        chords: "M2",
        cells: ["K", "H", "K+1", "half"],
        lead: ["oboe", "flute"],
        counter: "cello",
        tex: ["arp", "pad", "runs", "triangle"],
        dyn: [0.6, 0.7],
        repeat: true,
        alt: { lead: ["clarinet", "flute"], counter: "bassoon", tex: ["pizz", "celesta", "tambourine"], artic: "staccato", cells: ["K'", "H", "K+1", "half"] },
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "M2 M3",
        cells: ["H", "K", "A1", "half", "H+2", "K", "A1", "cad"],
        lead: "violins",
        double: "flute",
        counter: "horn",
        tex: ["quavers", "fanfare", "snare", "drum", "timpani", "cymbal", "choir"],
        dyn: [0.9, 1.0],
      },
      {
        keys: [{ bar: 0, tonic: D, mode: "major" }],
        chords: "Mc",
        cells: ["A1", "cad"],
        lead: "violins",
        double: "flute",
        tex: ["fanfare", "timpani", "choir", "pad", "cymbal"],
        dyn: [0.85, 0.7],
        rit: 2,
        hold: true,
      },
    ],
  },
];

/** The chapter each piece starts on (the first one starts with the video). */
export const CUE_CHAPTERS = [1, 4, 6, 8, 14];
