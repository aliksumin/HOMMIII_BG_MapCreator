// A PDF of the scenario laid out like a mission book page: parchment
// background, the marble heading with the title icon, two columns of text
// with inline game icons, then the map. Drawn with jsPDF as real text, so it
// stays sharp and searchable.

import type { jsPDF as JsPDF } from "jspdf";
import { assetUrl, glyphUrl, titleImageUrl } from "../data/catalog.ts";
import type { Scenario } from "../model/types.ts";
import { PDF_CREDIT } from "./credits.ts";
import { type Block, buildDocument, type ScenarioDoc } from "./document.ts";
import { loadImage, rasterise } from "./images.ts";
import { renderMapPng } from "./mapdraw.ts";
import { type Inline, ordinalSuffix } from "./markup.ts";
import { fitTitle, PAGE_W_PT, TITLE_W_PT } from "./titlefit.ts";

const PAGE_W = PAGE_W_PT;
const PAGE_H = 841.89;
// Page geometry and type sizes measured from the official Mission Book: the
// heading frame and the two columns share the 35.3pt side margins, and the
// body is 11pt on 14pt leading. theme.css uses the same numbers.
const MARGIN_X = 35.3;
const MARGIN_TOP = 34;
const MARGIN_BOTTOM = 56;
const GAP = 23;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const COL_W = (CONTENT_W - GAP) / 2;
const BODY = 11;
const LEADING = 14 / 11;
const FRAME_TOP = 35.3;
const INK: [number, number, number] = [32, 24, 16];
const HEAD_INK: [number, number, number] = [222, 200, 120];
const KIND_INK: [number, number, number] = [203, 181, 116];
const HEAD_SHADOW: [number, number, number] = [20, 15, 10];
const FONT = "Liberation";

type Style = "normal" | "bold" | "italic" | "bolditalic";

type Piece =
  | { kind: "word"; text: string; style: Style; size: number; w: number; rise: number }
  | { kind: "glyph"; name: string; w: number; h: number }
  | { kind: "space"; w: number };

interface Assets {
  glyphs: Map<string, { data: string; ratio: number }>;
  background: string;
  heading: string;
  bullet: string;
  icon: { data: string; ratio: number } | null;
}

function styleOf(b?: boolean, i?: boolean): Style {
  return b && i ? "bolditalic" : b ? "bold" : i ? "italic" : "normal";
}

async function fontBase64(file: string): Promise<string> {
  const res = await fetch(assetUrl(`assets/fonts/${file}`));
  if (!res.ok) throw new Error(`Could not load the font ${file}.`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function glyphNames(doc: ScenarioDoc): Set<string> {
  const names = new Set<string>();
  const visit = (runs: Inline[]) => runs.forEach((r) => r.t === "glyph" && names.add(r.name));
  for (const block of [...doc.body, ...doc.story]) {
    if (block.k === "list") block.items.forEach(visit);
    else if (block.k !== "heading") visit(block.runs);
  }
  // The heading badge draws the rating glyph even when the text never uses it.
  if (doc.rating) names.add(doc.rating);
  return names;
}

async function loadAssets(doc: ScenarioDoc): Promise<Assets> {
  const glyphs = new Map<string, { data: string; ratio: number }>();
  await Promise.all(
    [...glyphNames(doc)].map(async (name) => {
      const img = await loadImage(glyphUrl(name));
      const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      glyphs.set(name, { data: await rasterise(glyphUrl(name), Math.round(72 * ratio), 72), ratio });
    }),
  );
  let icon: Assets["icon"] = null;
  const iconUrl = doc.image?.kind === "upload" ? doc.image.dataUrl : doc.image?.kind === "library" ? titleImageUrl(doc.image.name) : undefined;
  if (iconUrl) {
    const img = await loadImage(iconUrl);
    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    icon = { data: doc.image?.kind === "upload" ? iconUrl : await rasterise(iconUrl, 256), ratio };
  }
  return {
    glyphs,
    background: await rasterise(assetUrl("assets/pdf/tausta.jpg"), 1210, 859, "image/jpeg"),
    heading: await rasterise(assetUrl("assets/pdf/section_heading.png"), 1200),
    bullet: await rasterise(assetUrl("assets/pdf/listdot.png"), 60),
    icon,
  };
}

class Writer {
  pdf: JsPDF;
  assets: Assets;
  col = 0;
  y = MARGIN_TOP;
  top = MARGIN_TOP;
  page = 1;

  constructor(pdf: JsPDF, assets: Assets) {
    this.pdf = pdf;
    this.assets = assets;
    this.decorate();
  }

  decorate(): void {
    this.pdf.addImage(this.assets.background, "JPEG", 0, 0, PAGE_W, PAGE_H, "bg", "FAST");
    this.pdf.setFont(FONT, "normal");
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(110, 90, 70);
    this.pdf.text(String(this.page), PAGE_W / 2, PAGE_H - 26, { align: "center" });
  }

  /** The art credit, in small type between the last page's text and its page number. */
  credit(): void {
    this.pdf.setFont(FONT, "normal");
    this.pdf.setFontSize(6);
    this.pdf.setTextColor(110, 90, 70);
    const lines: string[] = this.pdf.splitTextToSize(PDF_CREDIT, CONTENT_W);
    lines.forEach((line, i) => {
      this.pdf.text(line, PAGE_W / 2, PAGE_H - 36 - (lines.length - 1 - i) * 7, { align: "center" });
    });
  }

  newPage(): void {
    this.pdf.addPage();
    this.page++;
    this.decorate();
    this.col = 0;
    this.top = MARGIN_TOP;
    this.y = this.top;
  }

  get x0(): number {
    return MARGIN_X + this.col * (COL_W + GAP);
  }

  /** Room for `h` points, moving to the next column or page when needed. */
  ensure(h: number): void {
    if (this.y + h <= PAGE_H - MARGIN_BOTTOM) return;
    if (this.col === 0) {
      this.col = 1;
      this.y = this.top;
    } else {
      this.newPage();
    }
  }

  measure(text: string, style: Style, size: number): number {
    this.pdf.setFont(FONT, style);
    this.pdf.setFontSize(size);
    return this.pdf.getTextWidth(text);
  }

  pieces(runs: Inline[], size: number, force?: { b?: boolean; i?: boolean }): Piece[] {
    const out: Piece[] = [];
    for (const run of runs) {
      if (run.t === "glyph") {
        const g = this.assets.glyphs.get(run.name);
        const h = size * 1.05;
        out.push({ kind: "glyph", name: run.name, w: g ? h * g.ratio : h, h });
      } else if (run.t === "ordinal") {
        const style = styleOf(force?.b, force?.i);
        const n = String(run.n);
        const suffix = ordinalSuffix(run.n);
        out.push({ kind: "word", text: n, style, size, w: this.measure(n, style, size), rise: 0 });
        out.push({ kind: "word", text: suffix, style, size: size * 0.62, w: this.measure(suffix, style, size * 0.62), rise: size * 0.36 });
      } else {
        const style = run.t === "math" ? styleOf(force?.b, true) : styleOf(run.b || force?.b, run.i || force?.i);
        const text = run.s;
        for (const part of text.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) out.push({ kind: "space", w: this.measure(" ", style, size) });
          else out.push({ kind: "word", text: part, style, size, w: this.measure(part, style, size), rise: 0 });
        }
      }
    }
    return out;
  }

  /** Breaks pieces into lines no wider than `width`; breaks only at spaces. */
  lines(pieces: Piece[], width: number): Piece[][][] {
    const clusters: { parts: Piece[]; w: number; space: number }[] = [];
    let current: Piece[] = [];
    let space = 0;
    const flush = () => {
      if (current.length) clusters.push({ parts: current, w: current.reduce((s, p) => s + p.w, 0), space });
      current = [];
    };
    for (const p of pieces) {
      if (p.kind === "space") {
        flush();
        space = p.w;
      } else {
        if (!current.length && clusters.length === 0) space = 0;
        current.push(p);
      }
    }
    flush();
    const lines: Piece[][][] = [];
    let line: Piece[][] = [];
    let w = 0;
    for (const c of clusters) {
      const add = (line.length ? c.space : 0) + c.w;
      if (line.length && w + add > width) {
        lines.push(line);
        line = [];
        w = 0;
      }
      line.push(c.parts);
      w += line.length > 1 ? c.space + c.w : c.w;
    }
    if (line.length) lines.push(line);
    return lines;
  }

  drawLine(line: Piece[][], x: number, baseline: number, size: number, color: [number, number, number]): void {
    let cx = x;
    const space = this.measure(" ", "normal", size);
    line.forEach((cluster, i) => {
      if (i > 0) cx += space;
      for (const p of cluster) {
        if (p.kind === "word") {
          this.pdf.setFont(FONT, p.style);
          this.pdf.setFontSize(p.size);
          this.pdf.setTextColor(...color);
          this.pdf.text(p.text, cx, baseline - p.rise);
        } else if (p.kind === "glyph") {
          const g = this.assets.glyphs.get(p.name);
          if (g) this.pdf.addImage(g.data, "PNG", cx, baseline - p.h * 0.82, p.w, p.h, `glyph-${p.name}`, "FAST");
        }
        cx += p.w;
      }
    });
  }

  paragraph(runs: Inline[], opts: { size?: number; indent?: number; bullet?: boolean; force?: { b?: boolean; i?: boolean }; after?: number } = {}): void {
    const size = opts.size ?? BODY;
    const indent = opts.indent ?? 0;
    const lh = size * LEADING;
    const lines = this.lines(this.pieces(runs, size, opts.force), COL_W - indent);
    lines.forEach((line, i) => {
      this.ensure(lh);
      const baseline = this.y + size * 0.9;
      if (i === 0 && opts.bullet) this.pdf.addImage(this.assets.bullet, "PNG", this.x0 + indent - 16, baseline - size * 0.33 - 3, 6, 6, "bullet", "FAST");
      this.drawLine(line, this.x0 + indent, baseline, size, INK);
      this.y += lh;
    });
    this.y += opts.after ?? size * 0.48;
  }

  /** Section heading: 32.7pt cap to cap after the text above, 19.3pt to the text below. */
  heading(text: string): void {
    const size = 13;
    this.ensure(size * 1.6 + BODY * LEADING * 2);
    if (this.y > this.top + 1) this.y += 13;
    this.pdf.setFont(FONT, "bold");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...INK);
    this.pdf.text(text.toUpperCase(), this.x0, this.y + size * 0.9);
    this.y += size * 1.52;
  }

  block(block: Block, next?: Block): void {
    switch (block.k) {
      case "heading":
        this.heading(block.text);
        break;
      case "para":
        this.paragraph(block.runs);
        break;
      case "label":
        this.paragraph(block.runs, { force: { b: true }, after: next?.k === "list" ? 1.5 : undefined });
        break;
      case "field":
        this.paragraph([{ t: "text", s: `${block.label}:`, b: true }, ...(block.runs.length ? [{ t: "text", s: " " } as Inline] : []), ...block.runs], {
          after: next?.k === "list" ? 1.5 : undefined,
        });
        break;
      case "list":
        block.items.forEach((item, i) => this.paragraph(item, { indent: 35, bullet: true, after: i === block.items.length - 1 ? BODY * 0.48 : 2.7 }));
        break;
    }
  }

  blocks(blocks: Block[]): void {
    blocks.forEach((b, i) => this.block(b, blocks[i + 1]));
  }

  /**
   * The marble heading. section_heading.png is 1200x339 with the frame at
   * 31..1168 x 31..307; the frame's outer edges line up with the columns. The
   * icon sits in a box 5-28% across the frame and the title block is centred
   * 59.7% across, as in the official book.
   */
  header(doc: ScenarioDoc): void {
    const stretch = doc.titleLines === 2 ? 1.25 : 1;
    const scale = CONTENT_W / 1138;
    const frameH = 277 * scale * stretch;
    const frameBottom = FRAME_TOP + frameH;
    this.pdf.addImage(this.assets.heading, "PNG", MARGIN_X - 31 * scale, FRAME_TOP - 31 * scale * stretch, 1200 * scale, 339 * scale * stretch, "heading", "FAST");
    const icon = this.assets.icon;
    if (icon) {
      const boxW = CONTENT_W * 0.23;
      const boxH = 277 * scale * 0.6;
      const w = Math.min(boxW, boxH * icon.ratio);
      const h = w / icon.ratio;
      const cy = FRAME_TOP + frameH * 0.495;
      this.pdf.addImage(icon.data, "PNG", MARGIN_X + CONTENT_W * 0.05 + (boxW - w) / 2, cy - h / 2, w, h, "icon", "FAST");
    }
    const textW = TITLE_W_PT;
    const cx = MARGIN_X + CONTENT_W * 0.597;
    const kindSize = 11.7;
    const fitted = fitTitle(doc.title, doc.titleLines === 2 ? 2 : 1, textW, (text, at) => this.measure(text, "bold", at));
    const size = fitted.size;
    const lines = fitted.lines.slice(0, 2);
    // Cap top of the kind line to the last title baseline, centred at 48.5% of the frame.
    const blockH = 0.655 * kindSize + 1.029 * size + (lines.length - 1) * size * 1.05;
    const kindBaseline = FRAME_TOP + frameH * 0.485 - blockH / 2 + 0.655 * kindSize;
    this.pdf.setFont(FONT, "bold");
    this.pdf.setFontSize(kindSize);
    this.pdf.setCharSpace(0.7);
    this.pdf.setTextColor(...KIND_INK);
    this.pdf.text(doc.kind.toUpperCase(), cx, kindBaseline, { align: "center", maxWidth: textW });
    this.pdf.setCharSpace(0);
    this.pdf.setFontSize(size);
    const first = kindBaseline + 1.029 * size;
    lines.forEach((line, i) => {
      const baseline = first + i * size * 1.05;
      this.pdf.setTextColor(...HEAD_SHADOW);
      this.pdf.text(line, cx, baseline + 0.8, { align: "center" });
      this.pdf.setTextColor(...HEAD_INK);
      this.pdf.text(line, cx, baseline, { align: "center" });
    });
    if (doc.rating) {
      const g = this.assets.glyphs.get(doc.rating);
      if (g) this.pdf.addImage(g.data, "PNG", MARGIN_X + CONTENT_W * 0.92 - 14 * g.ratio, frameBottom - frameH * 0.22 - 14, 14 * g.ratio, 14, `glyph-${doc.rating}`, "FAST");
    }
    this.top = frameBottom + 33;
    this.y = this.top;
  }

  /** Places an image centred across both columns, below the text or on a new page. */
  async figure(dataUrl: string, caption: string): Promise<void> {
    const img = await loadImage(dataUrl);
    const ratio = img.naturalHeight / img.naturalWidth;
    // Text in the right column means the left one is full: start a new page.
    if (this.col === 1) this.newPage();
    let startY = this.y + 14;
    let w = CONTENT_W * 0.92;
    let h = w * ratio;
    const avail = PAGE_H - MARGIN_BOTTOM - startY - 20;
    if (h > avail) {
      if (avail >= 250) {
        h = avail;
        w = h / ratio;
      } else {
        this.newPage();
        startY = MARGIN_TOP;
        const full = PAGE_H - MARGIN_BOTTOM - MARGIN_TOP - 20;
        if (h > full) {
          h = full;
          w = h / ratio;
        }
      }
    }
    this.pdf.addImage(dataUrl, "PNG", (PAGE_W - w) / 2, startY, w, h, undefined, "MEDIUM");
    this.pdf.setFont(FONT, "bold");
    this.pdf.setFontSize(9.5);
    this.pdf.setTextColor(...INK);
    this.pdf.text(caption, PAGE_W / 2, startY + h + 14, { align: "center" });
    this.col = 0;
    this.y = startY + h + 26;
  }
}

/** Builds the scenario PDF. */
export async function scenarioToPdf(scenario: Scenario, onProgress?: (what: string) => void): Promise<Blob> {
  onProgress?.("Loading fonts...");
  const { jsPDF } = await import("jspdf");
  const doc = buildDocument(scenario);
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const files: [string, Style][] = [
    ["LiberationSerif-Regular.ttf", "normal"],
    ["LiberationSerif-Bold.ttf", "bold"],
    ["LiberationSerif-Italic.ttf", "italic"],
    ["LiberationSerif-BoldItalic.ttf", "bolditalic"],
  ];
  for (const [file, style] of files) {
    pdf.addFileToVFS(file, await fontBase64(file));
    pdf.addFont(file, FONT, style);
  }
  pdf.setProperties({
    title: doc.title,
    subject: doc.kind,
    author: scenario.author || "",
    creator: "HoMM3 BG Scenario Creator",
    keywords: PDF_CREDIT,
  });

  onProgress?.("Loading images...");
  const assets = await loadAssets(doc);
  const w = new Writer(pdf, assets);
  w.header(doc);

  onProgress?.("Setting the text...");
  w.blocks(doc.body);

  for (const map of doc.maps) {
    onProgress?.(`Drawing the map ${map.layout.name}...`);
    const png = await blobToDataUrl(await renderMapPng(map.layout.tiles, 1.6, map.layout.tokens));
    await w.figure(png, map.caption);
  }

  if (doc.story.length) {
    w.newPage();
    w.blocks(doc.story);
  }
  w.credit();
  onProgress?.("Saving...");
  return pdf.output("blob");
}