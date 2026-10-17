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
| [`score.mjs`](score.mjs) | The background music's score: keys, chords, the call, and what each on-screen event plays |
| [`music.mjs`](music.mjs) | Scores the recording's events to sound (pad, pedal, bells, harp, swells, hall) and mixes it into the video and clips |

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

The background music is scored to the picture, the way the Ski Resort film's soundtrack is: no running
beat and no loops. The capture writes every on-screen event with its time to `timeline.json`: steps,
captions, clicks, highlights, scrolls, key presses, typing, drags, downloads and the cards.
[`music.mjs`](music.mjs) turns those events into sound, using the rules in [`score.mjs`](score.mjs):

- a light string pad (two slightly detuned voices per note) holds one chord and changes, with a slow
  crossfade, when a new step or caption appears;
- a quiet low pedal note gives each part of the tutorial its key, like five towns: D major, F Lydian,
  G major, A major, and D major again for the finale. A distant horn chord marks each new part;
- glass bells answer the captions and highlights, with a line that moves through the chord;
- harp plucks walk up the scale with the clicks, roll through the chord while typing, and run up with
  drags; key presses get a low pluck;
- soft swells of filtered noise and low strings breathe with scrolls and drags, and each step opens with
  the hero's call (D A F♯ G A on bells or harp);
- the title and closing cards play the call slowly, ending on a low bell; downloads get a two-bell chime.

Bells and plucks are snapped to a 96 bpm grid (eighths and sixteenths) so they sound placed, not random,
and close events share the space: the busier a moment, the softer each note. Everything plays in an
eight-line feedback-delay hall (about 3.6 s). The accents set the level: bells and harp are rendered
first and pinned at about -29 dB gated loudness, and the background (pad, pedal, swells, horns) sits
just under them. It is light and distant: two voices per pad note, nothing below A2, a low cut, more
hall. `MIX` in `score.mjs` sets each layer without moving the accents. Peaks stay under -3 dBFS. The colours are the Heroes III palette (harp, glass bells, warm strings, distant horns);
the call and every chord are original, and none of the game's music is used or quoted.

To redo only the music on an existing recording (it needs that recording's `timeline.json`):

```powershell
node docs/tutorial/music.mjs --out "$env:USERPROFILEVideosHoMM3-Scenario-Creator-tutorial"
```

`--cues --timeline <timeline.json>` prints the cue sheet (time, sound, reason); `--wav music.wav
--timeline <timeline.json>` writes the soundtrack on its own; `--check` checks the score.

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
