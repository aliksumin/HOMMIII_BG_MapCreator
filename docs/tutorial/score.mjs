// The score of the tutorial's background music. It follows the picture
// instead of running on its own beat: a warm pad holds one chord at a time
// and changes when a new step or a new caption appears; a low pedal note
// gives each part of the tutorial its key; harp plucks, glass bells and soft
// swells answer what happens on screen (clicks, highlights, scrolls, keys,
// typing, downloads, the title and closing cards). The colours are the
// Heroes III palette (harp, bells, warm strings, distant horns), the motif
// and every chord are original.
//
// The capture writes timeline.json with every on-screen event and its time;
// music.mjs turns those events into notes with the rules below.

/** The hero's call: scale degrees, played on chapter starts and the cards. */
export const MOTIF = [0, 4, 2, 3, 4];

/** Events are placed on this grid: eighths for bells, sixteenths for plucks. */
export const BPM = 96;

/**
 * The five parts of the tutorial (by chapter), each a "town" with its own
 * key, pedal, chords (open voicings, low to high) and brightness. Chords
 * advance one by one as steps and captions arrive.
 */
export const SECTIONS = [
  {
    from: 0,
    name: "Morning in Brindlemere",
    key: { tonic: "D", mode: "major" },
    pedal: "D2",
    bright: 0.45,
    chords: ["D3 A3 E4 F#4", "G2 D3 A3 B3", "B2 F#3 A3 D4", "A2 E3 A3 C#4", "G2 D3 B3 F#4", "E3 B3 D4 G4", "A2 E3 G3 C#4", "D3 A3 F#4 A4"],
  },
  {
    from: 4,
    name: "The mapmaker's study",
    key: { tonic: "F", mode: "lydian" },
    pedal: "F2",
    bright: 0.6,
    chords: ["F2 C3 E3 A3", "F2 D3 G3 B3", "A2 E3 G3 C4", "C3 G3 D4 E4", "D3 A3 C4 F4", "G2 D3 F3 B3", "F2 C3 G3 A3"],
  },
  {
    from: 6,
    name: "Riders at the ford",
    key: { tonic: "G", mode: "major" },
    pedal: "G2",
    bright: 0.7,
    chords: ["G2 D3 A3 B3", "C3 G3 B3 E4", "F2 C3 A3 D4", "D3 A3 C4 F#4", "E3 B3 D4 G4", "C3 G3 D4 E4", "D3 A3 B3 F#4"],
  },
  {
    from: 8,
    name: "Market day",
    key: { tonic: "A", mode: "major" },
    pedal: "A2",
    bright: 0.55,
    chords: ["A2 E3 B3 C#4", "D3 A3 C#4 F#4", "E3 B3 D4 G#4", "F#2 C#3 E3 A3", "B2 F#3 A3 D4", "D3 F#3 A3 E4", "E3 B3 D4 A4"],
  },
  {
    from: 14,
    name: "Banners over the ford",
    key: { tonic: "D", mode: "major" },
    pedal: "D2",
    bright: 0.75,
    chords: ["D3 A3 E4 F#4", "A2 E3 A3 C#4", "B2 F#3 A3 D4", "G2 D3 B3 F#4", "E3 B3 D4 G4", "A2 E3 G3 C#4", "D3 A3 F#4 A4"],
  },
];

/**
 * What each kind of on-screen event plays. vel is loudness (0..1); every
 * sound is soft, and close events share the space (see music.mjs).
 *   motif   the hero's call, on bells (a new part) or harp (a new step)
 *   bell    one glass bell on a chord tone; the line moves between captions
 *   pluck   a harp note walking up the scale, one per click
 *   roll    a quiet harp roll through the chord
 *   run     rising plucks spread over the action
 *   swell   a breath of filtered noise and low strings
 *   horn    a distant horn chord
 *   chime   two bells a fifth apart
 */
export const RULES = {
  chapter: [{ play: "motif", vel: 0.5 }, { play: "roll", vel: 0.2 }, { play: "swell", vel: 0.5, dur: 2.5 }],
  section: [{ play: "horn", vel: 0.45, dur: 4 }],
  caption: [{ play: "bell", vel: 0.36 }],
  highlight: [{ play: "bell", vel: 0.2, octave: 1 }],
  click: [{ play: "pluck", vel: 0.26 }],
  select: [{ play: "pluck", vel: 0.22 }],
  key: [{ play: "pluck", vel: 0.3, octave: -1, root: true }],
  type: [{ play: "roll", vel: 0.16 }],
  drag: [{ play: "run", vel: 0.22 }, { play: "swell", vel: 0.35 }],
  scroll: [{ play: "swell", vel: 0.28 }],
  download: [{ play: "chime", vel: 0.42 }],
  card: [{ play: "motif", vel: 0.6, slow: true }, { play: "swell", vel: 0.7, dur: 4 }],
};

/**
 * Mix levels. The accents (bells, harp) set the master level: `accents` is
 * their gated loudness in dB. The background layers are relative to the
 * first version of this score (1 = as loud as then).
 *   pad, pedal, swell, horn   background levels
 *   padVoices                 2 or 3 detuned voices per pad note
 *   padFloor                  pad notes below this MIDI note move up an octave
 *   padCutoff, padLowCut      the pad's low-pass base and low cut (Hz)
 *   padSend                   how much of the pad goes to the hall (0..1)
 */
export const MIX = {
  accents: -28.9, // where the accents were in the first scored version
  pad: 0.6,
  pedal: 0.5,
  swell: 0.55,
  horn: 0.65,
  padVoices: 2,
  padFloor: 45,
  padCutoff: 750,
  padLowCut: 140,
  padSend: 0.38,
};
