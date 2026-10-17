// Records the step-by-step tutorial video of the Scenario Creator.
//
// It starts the app's Vite dev server, drives the real UI in Chromium with
// Playwright, draws the annotations with overlay.js, captures the page with
// the DevTools screencast, and encodes an H.264 MP4 with ffmpeg. It also
// writes the captions (.vtt, .srt), the chapter list and the storyboard.
// See README.md in this folder for how to install the tools and re-record.

import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO } from "./demo.mjs";
import { addMusic } from "./music.mjs";
import { SCENES } from "./scenes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function args() {
  const a = process.argv.slice(2);
  const get = (name, fallback) => {
    const i = a.indexOf(`--${name}`);
    return i >= 0 ? a[i + 1] : fallback;
  };
  const home = process.env.USERPROFILE ?? process.env.HOME ?? ".";
  return {
    repo: path.resolve(get("repo", path.join(HERE, "..", ".."))),
    tools: path.resolve(get("tools", path.join(home, "tools", "tutorial-capture"))),
    // the repository root's HoMM3-Scenario-Creator-tutorial/ (in .gitignore)
    out: path.resolve(get("out", path.join(HERE, "..", "..", "HoMM3-Scenario-Creator-tutorial"))),
    port: Number(get("port", "5191")),
    ffmpeg: get("ffmpeg", process.env.FFMPEG ?? ""),
    only: get("only", ""),
    url: get("url", ""),
    headed: a.includes("--headed"),
    noEncode: a.includes("--no-encode") || a.includes("--fast"),
    fast: a.includes("--fast"),
    noMusic: a.includes("--no-music"),
    updateDocs: a.includes("--update-docs"),
  };
}

const opt = args();
const toolsRequire = createRequire(path.join(opt.tools, "package.json"));
const { chromium } = toolsRequire("playwright-core");
const ffmpegPath =
  opt.ffmpeg || path.join(opt.tools, "node_modules", "@ffmpeg-installer", "win32-x64", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

const VIEW = { width: 1440, height: 810 };
// The DevTools screencast delivers frames at CSS-pixel size whatever the
// device scale, so the video is the viewport size.
const FPS = 30;

const SPEED = opt.fast ? 0.15 : 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SPEED));
const now = () => Date.now() / 1000;

// ---------------------------------------------------------------- dev server

async function startServer() {
  const vite = path.join(opt.repo, "node_modules", "vite", "bin", "vite.js");
  if (!fs.existsSync(vite)) throw new Error(`No Vite in ${opt.repo}; run npm ci there first.`);
  const proc = spawn(process.execPath, [vite, "--port", String(opt.port), "--strictPort"], { cwd: opt.repo, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  const url = `http://localhost:${opt.port}/`;
  for (let i = 0; i < 120; i++) {
    if (proc.exitCode !== null) throw new Error(`Vite exited:\n${log}`);
    try {
      if ((await fetch(url)).ok) return { proc, url };
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  proc.kill();
  throw new Error(`Vite did not start on ${url}:\n${log}`);
}

// ---------------------------------------------------------------- recorder

/**
 * Pipes the DevTools screencast into ffmpeg at a constant frame rate: each
 * frame is repeated until the next one arrives, by its timestamp.
 */
function startRecorder(cdp, file) {
  const ff = spawn(
    ffmpegPath,
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "pipe:0",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(FPS), file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const rec = { t0: null, written: 0, last: null, frames: 0, ff };
  const push = (upTo) => {
    while (rec.last && rec.written < upTo) {
      ff.stdin.write(rec.last);
      rec.written++;
    }
  };
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    const ts = metadata.timestamp ?? now();
    if (rec.t0 === null) rec.t0 = ts;
    push(Math.floor((ts - rec.t0) * FPS));
    rec.last = Buffer.from(data, "base64");
    rec.frames++;
  });
  rec.start = () =>
    cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: VIEW.width, maxHeight: VIEW.height, everyNthFrame: 1 });
  rec.stop = async () => {
    await cdp.send("Page.stopScreencast").catch(() => {});
    push(Math.floor((now() - rec.t0) * FPS) + 1);
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
  };
  /** seconds since the first frame */
  rec.time = () => (rec.t0 === null ? 0 : now() - rec.t0);
  return rec;
}

// ---------------------------------------------------------------- the director

/** What the scenes call: overlay, mouse, keyboard, timeline. */
function director(page, rec, outDir, repoRequire) {
  const cues = [];
  const chapters = [];
  const downloads = [];
  // Everything visible that happens, with its time: the music follows it.
  const events = [];
  const ev = (type, extra = {}) => events.push({ t: +rec.time().toFixed(3), type, chapter: chapter?.num ?? 0, ...extra });
  let cue = null;
  let chapter = null;
  let cursor = { x: 720, y: 420 };

  const closeCue = () => {
    if (cue) cue.end = rec.time();
    cue = null;
  };
  const readTime = (text) => Math.max(3200, 1400 + text.split(/\s+/).length * 330);

  page.on("download", async (d) => {
    const file = path.join(outDir, "exports", d.suggestedFilename());
    const done = d.saveAs(file).then(() => file);
    downloads.push({ name: d.suggestedFilename(), done });
    ev("download");
  });

  const box = async (target) => {
    const loc = (typeof target === "string" ? page.locator(target) : target).first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error(`Not visible: ${loc}`);
    return b;
  };

  const d = {
    page,
    demo: DEMO,
    sleep,
    repoRequire,
    async lowerAt(mode) {
      await page.evaluate((m) => window.__tut.lowerAt(m), mode);
    },
    /** Runs `action` and resolves to the saved path of the download it starts. */
    async expectDownload(action, timeout = 60000) {
      const ev = page.waitForEvent("download", { timeout });
      await action();
      const dl = await ev;
      return d.waitDownload(dl.suggestedFilename(), timeout);
    },
    async chapter(num, title, sub, screen) {
      closeCue();
      if (chapter) chapter.end = rec.time();
      chapter = { num, title, sub, screen, start: rec.time(), end: null, beats: [], labels: [] };
      chapters.push(chapter);
      ev("chapter", { num });
      // A new step starts without the last step's lower third, as its caption cue ends here.
      await page.evaluate(([n, t, s]) => (window.__tut.lower("", ""), window.__tut.caption(n, t, s)), [String(num), title, sub]);
    },
    /** Lower-third description; also one caption cue. Holds long enough to read. */
    async say(title, text, hold) {
      closeCue();
      cue = { start: rec.time(), end: null, title, text };
      cues.push(cue);
      chapter?.beats.push({ title, text });
      ev("caption");
      await page.evaluate(([t, x]) => window.__tut.lower(t, x), [title, text]);
      await sleep(hold ?? readTime(`${title} ${text}`));
    },
    /**
     * For a say() with a short hold, so the actions it describes play under it: waits out the
     * rest of its reading time, and at least `min` ms for the highlight that ends them.
     */
    async finishCue(min = 1600) {
      const left = cue ? readTime(`${cue.title} ${cue.text}`) - (rec.time() - cue.start) * 1000 : 0;
      await sleep(Math.max(min, left));
    },
    async hideText() {
      closeCue();
      await page.evaluate(() => window.__tut.lower("", ""));
    },
    /** Highlights one or more elements, with an optional callout + arrow. */
    async hl(targets, label = "", hold = 0) {
      const list = Array.isArray(targets) ? targets : [targets];
      const rects = [];
      for (const t of list) rects.push(t && typeof t === "object" && "x" in t && "width" in t ? t : await box(t));
      if (label && !chapter?.labels.includes(label)) chapter?.labels.push(label);
      await page.evaluate(([r, l]) => window.__tut.highlight(r, l), [rects, label]);
      ev("highlight", { boxes: rects.length, label: !!label });
      if (hold) await sleep(hold);
    },
    async clear() {
      await page.evaluate(() => window.__tut.clear());
    },
    async smoothScroll(target, block = "center") {
      const loc = (typeof target === "string" ? page.locator(target) : target).first();
      // "start" leaves room for the sticky top bar.
      ev("scroll", { dur: 0.9 });
      await loc.evaluate((el, b) => {
        if (b === "start") window.scrollBy({ top: el.getBoundingClientRect().top - 72, behavior: "smooth" });
        else el.scrollIntoView({ behavior: "smooth", block: b });
      }, block);
      await sleep(900);
    },
    async scrollTop() {
      ev("scroll", { dur: 0.7 });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await sleep(700);
    },
    async moveTo(x, y, ms = 600) {
      await page.evaluate(([a, b, m]) => window.__tut.cursor(a, b, m), [x, y, ms]);
      await page.mouse.move(x, y, { steps: 8 });
      cursor = { x, y };
      await sleep(ms + 60);
    },
    /** Moves the visible cursor to an element, then clicks it. */
    async click(target, { hold = 350, position } = {}) {
      const loc = (typeof target === "string" ? page.locator(target) : target).first();
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const b = await loc.boundingBox();
      if (!b) throw new Error(`Not visible: ${loc}`);
      const x = b.x + (position ? position.x : b.width / 2);
      const y = b.y + (position ? position.y : b.height / 2);
      await d.moveTo(x, y);
      await page.evaluate(([a, c]) => window.__tut.ripple(a, c), [x, y]);
      ev("click", { x: Math.round(x), y: Math.round(y) });
      await page.mouse.click(x, y);
      await sleep(hold);
    },
    async clickAt(x, y, hold = 350) {
      await d.moveTo(x, y);
      await page.evaluate(([a, c]) => window.__tut.ripple(a, c), [x, y]);
      ev("click", { x: Math.round(x), y: Math.round(y) });
      await page.mouse.click(x, y);
      await sleep(hold);
    },
    /** Clicks a field and types into it, visibly. */
    async type(target, text, { delay = 26, clear = false } = {}) {
      const loc = (typeof target === "string" ? page.locator(target) : target).first();
      await d.click(loc, { hold: 150 });
      if (clear) {
        await page.keyboard.press("Control+A");
        await page.keyboard.press("Delete");
      }
      ev("type", { chars: text.length, dur: +((text.length * delay) / 1000).toFixed(2) });
      await loc.pressSequentially(text, { delay });
      await sleep(300);
    },
    async select(target, option) {
      const loc = (typeof target === "string" ? page.locator(target) : target).first();
      await d.click(loc, { hold: 200 });
      ev("select");
      await loc.selectOption(option);
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(500);
    },
    /** Presses a key and shows it on screen. */
    async key(keys, label = keys) {
      await page.evaluate(([l, x, y]) => window.__tut.key(l, x, y), [label, cursor.x, cursor.y]);
      ev("key", { key: label });
      await page.keyboard.press(keys);
      await sleep(700);
    },
    /** Mouse drag with the visible cursor (pointer events, e.g. moving a tile). */
    async drag(from, to, steps = 24) {
      await d.moveTo(from.x, from.y);
      ev("drag", { dur: +((steps * 0.03 + 0.2)).toFixed(2) });
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        await page.evaluate(([a, b]) => window.__tut.cursor(a, b, 40), [x, y]);
        await page.mouse.move(x, y);
        await sleep(30);
      }
      cursor = to;
      await sleep(200);
      await page.mouse.up();
      await sleep(400);
    },
    /** HTML5 drag and drop (palette tile onto the board). */
    async dragDrop(source, targetLoc, to) {
      const b = await box(source);
      await d.moveTo(b.x + b.width / 2, b.y + b.height / 2);
      const tb = await targetLoc.boundingBox();
      await page.evaluate(([a, c]) => window.__tut.cursor(a, c, 900), [to.x, to.y]);
      ev("drag", { dur: 0.9 });
      await source.dragTo(targetLoc, { targetPosition: { x: to.x - tb.x, y: to.y - tb.y } });
      cursor = to;
      await sleep(950);
    },
    async waitDownload(name, timeout = 60000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const hit = downloads.find((x) => x.name === name);
        if (hit) return hit.done;
        await sleep(200);
      }
      throw new Error(`No download named ${name}`);
    },
    async card(html, hold) {
      closeCue();
      ev(html ? "card" : "card-off");
      await page.evaluate(([h]) => window.__tut.card(h), [html]);
      if (hold) await sleep(hold);
    },
    /** Title card text also goes into the captions. */
    cue(title, text, start, end) {
      cues.push({ title, text, start, end });
    },
    time: () => rec.time(),
    finish() {
      closeCue();
      if (chapter) chapter.end = rec.time();
      return { cues, chapters, downloads, events };
    },
  };
  return d;
}

// ---------------------------------------------------------------- outputs

const stamp = (t, comma) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  const f = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s}${comma ? "," : "."}${f}`;
};
const plain = (s) => s.replace(/`/g, "");

function captions(cues) {
  const sorted = [...cues].filter((c) => c.end > c.start).sort((a, b) => a.start - b.start);
  const vtt = ["WEBVTT", "", "NOTE Generated by docs/tutorial/capture.mjs", ""];
  const srt = [];
  sorted.forEach((c, i) => {
    const body = [plain(c.title), plain(c.text)].filter(Boolean).join("\n");
    vtt.push(String(i + 1), `${stamp(c.start)} --> ${stamp(c.end)}`, body, "");
    srt.push(String(i + 1), `${stamp(c.start, true)} --> ${stamp(c.end, true)}`, body, "");
  });
  return { vtt: vtt.join("\n"), srt: srt.join("\n") };
}

function ffmetadata(chapters, total) {
  const lines = [";FFMETADATA1", "title=HoMM3 Board Game Scenario Creator - step-by-step tutorial", ""];
  for (const c of chapters) {
    lines.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${Math.round(c.start * 1000)}`, `END=${Math.round((c.end ?? total) * 1000)}`, `title=${c.num}. ${c.title}`, "");
  }
  return lines.join("\n");
}

function storyboard(chapters) {
  const esc = (s) => plain(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
  const rows = chapters.map((c) => {
    const notes = c.labels.map(esc).join("; ") || "-";
    const desc = c.beats.map((b) => `**${esc(b.title)}** ${esc(b.text)}`).join("<br>");
    return `| ${c.num} | ${stamp(c.start).slice(3, 8)} | ${esc(c.title)}${c.sub ? ` (${esc(c.sub)})` : ""} | ${esc(c.screen ?? "")} | ${notes} | ${desc} |`;
  });
  return [
    "# Tutorial storyboard",
    "",
    "Generated by `capture.mjs` from `scenes.mjs` on the last recording; the times are from that run.",
    "One row per step. *Annotations* are the callouts drawn next to highlighted controls;",
    "*Description* is the lower-third text (also the captions in `captions/`).",
    "",
    "| # | Start | Step | On screen | Annotations | Description |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}`))));
  });
}

// ---------------------------------------------------------------- main

async function main() {
  fs.mkdirSync(path.join(opt.out, "exports"), { recursive: true });
  for (const f of fs.readdirSync(path.join(opt.out, "exports"))) fs.rmSync(path.join(opt.out, "exports", f), { recursive: true, force: true });
  if (!opt.noEncode && !fs.existsSync(ffmpegPath)) throw new Error(`No ffmpeg at ${ffmpegPath} (pass --ffmpeg or --no-encode).`);

  const server = opt.url ? { url: opt.url, proc: null } : await startServer();
  let browser;
  try {
    // Inside the try, so a failed launch still stops the dev server.
    browser = await chromium.launch({ headless: !opt.headed });
    const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, acceptDownloads: true, locale: "en-GB" });
    await context.addInitScript({ path: path.join(HERE, "overlay.js") });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.error("page error:", e.message));
    // The first load can be slow while Vite pre-bundles the dependencies.
    await page.goto(server.url, { timeout: 180000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ timeout: 180000 });
    await page.waitForLoadState("networkidle", { timeout: 180000 });
    await page.evaluate(() => document.fonts.ready);

    const cdp = await context.newCDPSession(page);
    const raw = path.join(opt.out, "_raw.mp4");
    const rec = opt.noEncode ? { time: () => 0, start: async () => {}, stop: async () => {} } : startRecorder(cdp, raw);
    if (opt.noEncode) {
      const t0 = now();
      rec.time = () => now() - t0;
    }
    await rec.start();
    await sleep(300);

    const d = director(page, rec, opt.out, createRequire(path.join(opt.repo, "package.json")));
    const scenes = opt.only ? SCENES.filter((s) => opt.only.split(",").includes(String(s.num))) : SCENES;
    for (const scene of scenes) {
      console.log(`scene ${scene.num}: ${scene.title}  (${rec.time().toFixed(1)} s)`);
      try {
        await scene.run(d);
        if (opt.fast) await page.screenshot({ path: path.join(opt.out, `_scene-${String(scene.num).padStart(2, "0")}.png`) });
      } catch (e) {
        await page.screenshot({ path: path.join(opt.out, "_error.png") }).catch(() => {});
        await rec.stop().catch(() => {});
        throw e;
      }
    }
    const { cues, chapters, downloads, events } = d.finish();
    await Promise.all(downloads.map((x) => x.done));
    await rec.stop();
    const total = rec.time();
    console.log(`recorded ${total.toFixed(1)} s, ${rec.frames ?? 0} screencast frames`);

    const cap = captions(cues);
    fs.writeFileSync(path.join(opt.out, "tutorial.en.vtt"), cap.vtt);
    fs.writeFileSync(path.join(opt.out, "tutorial.en.srt"), cap.srt);
    fs.writeFileSync(path.join(opt.out, "chapters.txt"), ffmetadata(chapters, total));
    fs.writeFileSync(path.join(opt.out, "storyboard.md"), storyboard(chapters));
    fs.writeFileSync(path.join(opt.out, "timeline.json"), JSON.stringify({ total, chapters, cues, events }, null, 2));
    if (opt.updateDocs) {
      fs.mkdirSync(path.join(HERE, "captions"), { recursive: true });
      fs.writeFileSync(path.join(HERE, "captions", "tutorial.en.vtt"), cap.vtt);
      fs.writeFileSync(path.join(HERE, "captions", "tutorial.en.srt"), cap.srt);
      fs.writeFileSync(path.join(HERE, "storyboard.md"), storyboard(chapters));
    }

    if (!opt.noEncode) {
      // Final file: video + soft English subtitles + chapters.
      const final = path.join(opt.out, "HoMM3-Scenario-Creator-tutorial.mp4");
      await run(ffmpegPath, ["-y", "-loglevel", "error", "-i", raw, "-i", path.join(opt.out, "tutorial.en.srt"), "-i", path.join(opt.out, "chapters.txt"),
        "-map", "0:v", "-map", "1:s", "-map_metadata", "2", "-map_chapters", "2", "-c:v", "copy", "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng", "-movflags", "+faststart", final]);
      // One clip per step, cut from the full recording.
      const clips = path.join(opt.out, "clips");
      fs.rmSync(clips, { recursive: true, force: true });
      fs.mkdirSync(clips);
      for (const c of chapters) {
        const name = `${String(c.num).padStart(2, "0")}-${c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.mp4`;
        await run(ffmpegPath, ["-y", "-loglevel", "error", "-ss", c.start.toFixed(3), "-i", raw, "-t", ((c.end ?? total) - c.start).toFixed(3),
          "-map", "0:v", "-map_chapters", "-1",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", path.join(clips, name)]);
      }
      fs.rmSync(raw, { force: true });
      if (!opt.noMusic) await addMusic(opt.out, ffmpegPath);
      console.log(`video: ${final}`);
    }
  } finally {
    await browser?.close().catch(() => {});
    server.proc?.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
