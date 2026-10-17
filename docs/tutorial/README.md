# Tutorial video

A step-by-step video of the Scenario Creator, recorded from the real app by a script, so it can be
re-recorded whenever the UI changes. The video itself is **not** in the repository (size, and the game
art in it has its own licenses, see [NOTICE.md](../../NOTICE.md)).

| File | What it is |
| --- | --- |
| [`storyboard.md`](storyboard.md) | One row per step: start time, what is on screen, the callouts, the lower-third text |
| [`captions/tutorial.en.vtt`](captions/tutorial.en.vtt), [`.srt`](captions/tutorial.en.srt) | English captions (the lower-third text, timed) |
| [`capture.mjs`](capture.mjs) | Starts the dev server, drives the app, records, encodes, writes captions and storyboard |
| [`scenes.mjs`](scenes.mjs) | The 16 steps: what is clicked and typed, and every annotation |
| [`overlay.js`](overlay.js) | The annotation layer injected into the page: step chip, lower third, highlight boxes, callouts, arrows, cursor, title and closing cards |
| [`demo.mjs`](demo.mjs) | The made-up demo scenario typed in the video |
| [`score.mjs`](score.mjs) | The background music's score: five original pieces, written as themes and variations |
| [`music.mjs`](music.mjs) | Turns the score into sound (harmony, counterpoint, instruments, hall) and mixes it into the video and clips |

## What the video covers

1. Welcome screen and starting a project
2. Basics: name, type, heading line, rating, author, title icon, live page
3. Story: flavor text, the long Story
4. Player Setup: Rounds, player counts, resources and income, Units, Town Buildings, tile pool, Bonus
5. Map editor, placing tiles: face-down and printed tiles, click and drag-and-drop, search, moving, rotating,
   the "falls apart" warning, zoom
6. Map editor, tile details: faction borders, Fields, cubes, Heroes, location tokens (Monoliths),
   Creature Banks, blocked Fields
7. Map editor, layouts and files: layout name, player counts and caption, Export `.map`, Export PNG,
   a second layout filled by Import `.map`, Duplicate
8. Map Setup: counted tile list, own and per-player counts, notes, Heroes Placement
9. AI Opponent
10. Victory & Defeat
11. Timed Events: Rounds, repeats
12. Rules: Additional Rules, own sections
13. Text markup and the Icon button
14. Undo, autosave, Save file, reopening from the start screen
15. Review & Export: checklist with the Mission Book capitalisation lint, page preview, LaTeX, How to submit
16. Review & Export, the files: ZIP bundle, PDF, single files; closing card with where each file goes

## Re-record

The tools live **outside** the repository; nothing is added to `package.json`.

| Tool | Version | Why |
| --- | --- | --- |
| `playwright-core` (npm) | 1.64.0 | drives Chromium; uses the Chromium build 1248 Playwright keeps in `%LOCALAPPDATA%\ms-playwright` |
| `@ffmpeg-installer/win32-x64` (npm) | 4.1.0 | a static ffmpeg with libx264, for the H.264 MP4 (Playwright's own ffmpeg only writes VP8/VP9) |

Install them once, in their own folder (PowerShell):

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\tools\tutorial-capture"
```

```powershell
npm install --prefix "$env:USERPROFILE\tools\tutorial-capture" --save-exact --ignore-scripts playwright-core@1.64.0 @ffmpeg-installer/win32-x64@4.1.0
```

If Chromium 1248 is not on the machine yet:

```powershell
npx --prefix "$env:USERPROFILE\tools\tutorial-capture" playwright-core install chromium
```

Then, from the repository root (after `npm ci`):

```powershell
node docs/tutorial/capture.mjs --update-docs
```

It takes about 12 minutes (the video plays in real time). Output, by default in
`%USERPROFILE%\Videos\HoMM3-Scenario-Creator-tutorial`:

- `HoMM3-Scenario-Creator-tutorial.mp4`: 1440x810, 30 fps, H.264, background music (AAC), English soft
  subtitles and chapters
- `clips\NN-<step>.mp4`: one clip per step, cut from the full recording, with its slice of the music
- `tutorial-music.m4a`: the soundtrack on its own
- `tutorial.en.vtt`, `tutorial.en.srt`, `chapters.txt`, `storyboard.md`, `timeline.json`
- `exports\`: the files the app exported during the recording (ZIP, PDF, `.tex`, `.map`, PNG, project file)

`--update-docs` also rewrites `storyboard.md` and `captions/` in this folder; commit those.

Options: `--out <dir>`, `--port <n>` (default 5191), `--url <http://...>` to use a server that is already
running, `--tools <dir>`, `--ffmpeg <path>`, `--headed` to watch the browser, `--no-music`, `--no-encode`
for a dry run that only checks the script.

## Music

The background music is original: five short pieces composed for this video, written down in
[`score.mjs`](score.mjs) and synthesized by [`music.mjs`](music.mjs) (no samples or audio files). None
of the game's music is used or quoted. They borrow the principles that make the Heroes III soundtrack
work, not its notes:

- **Bright and moving.** Every piece is in a major key at 109 to 144 bpm, with strong I-IV-V harmony,
  folk-dance tonic-dominant swings, and heroic flat-VII and vi-IV-I-V turns.
- **One motif, developed.** Each piece is a set of variations: its motifs sequenced, inverted,
  ornamented, slowed, and moved to new keys (the dominant, the subdominant, a step up for the climax).
- **Rhythm.** Melodies start on upbeats and use dotted figures, eighth and triplet runs and staccato
  articulation. Underneath: pizzicato, driving string eighths, a gallop, brass fanfares, snare, bass
  drum, tambourine, triangle and timpani, plus a harp run into each new phrase.
- **Call and response.** The melody passes between instruments every two bars (flute and oboe, clarinet
  and bassoon); big moments double it an octave up. A countermelody answers it, moving while the melody
  holds and never crossing it.
- **A journey in about two minutes.** Each piece starts light, builds through changing textures to a
  climax (fanfares, choir, cymbal, a timpani roll) and closes.

| Piece | Steps it plays under | Character |
| --- | --- | --- |
| Morning in Brindlemere | 1 to 3 | D major 3/4 at 126: flute and oboe trading a pickup tune over pizzicato and harp |
| The mapmaker's workshop | 4 and 5 | F major 4/4 at 116: clockwork staccato woodwinds and celesta, a broad string tune, a choir climax |
| Riders at the ford | 6 and 7 | G major at 124: horn calls over galloping strings, fanfares, a lift to A major |
| Market day | 8 to 13 | A major 3/4 at 144: a bassoon-and-flute folk dance with tambourine, a lyrical oboe trio in D |
| Banners over the ford | 14 to 16 | D major march at 108: horns and strings, a turn to F, the first piece's motif returns |

Each piece starts when its first step starts. To fill the time until the next one, the planner chooses
optional variations and repeats (with their `alt` changes) and only nudges the tempo (0.96 to 1.12).
Everything plays in a light hall, mixed at about -20 dBFS RMS with fades. `node docs/tutorial/music.mjs
--check` checks that every chord parses and every melody fills its bars.

To redo only the music on an existing recording (needs its `timeline.json`):

```powershell
node docs/tutorial/music.mjs --out "$env:USERPROFILE\Videos\HoMM3-Scenario-Creator-tutorial"
```

To listen to it on its own: `node docs/tutorial/music.mjs --wav music.wav --seconds 688 --timeline <recording>/timeline.json`.

## How it works

- The page is 1440x810 CSS pixels, and so is the video: the DevTools screencast delivers frames at CSS-pixel size.
- Frames come from the DevTools screencast (JPEG, quality 92). Each frame is repeated until the next one
  arrives, by its timestamp, and piped into ffmpeg at a constant 30 fps.
- `overlay.js` is added with `addInitScript` and sits on top of the app with `pointer-events: none`, so
  the script clicks through it. The cursor in the video is drawn by the overlay; Playwright moves the
  real mouse to the same point.
- Map positions are computed in the page from the app's own `src/lib/hex.ts` (served by Vite), so tiles
  land on valid hexes whatever the board size.
- Each `say()` is one caption cue and one lower third; each scene is one chapter, one clip and one
  storyboard row. Changing the text in `scenes.mjs` and re-recording updates all of them.
