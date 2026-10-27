// A PDF of the scenario laid out like a mission book page: parchment
// background, the marble heading with the title icon, two columns of text
// with inline game icons, then the map. Drawn with jsPDF as real text, so it
// stays sharp and searchable.

import type { jsPDF as JsPDF } from "jspdf";
import { assetUrl, glyphUrl, titleImageUrl } from "../data/catalog.ts";
import type { Scenario } from "../model/types.ts";
import { artUse, pdfCredit } from "./credits.ts";
import { type Block, buildDocument, type ListItem, type ScenarioDoc } from "./document.ts";
import { loadImage, rasterise } from "./images.ts";
import { renderMapPng } from "./mapdraw.ts";
import type { Inline } from "./markup.ts";
import { bookTable, layoutTable, TABLE_SHARE, type TableDoc, type TableLayout } from "./tables.ts";
import { breakLines, lineWidth, type Measure, numberNotes, type Piece, type Rgb, type Style, styleOf, toPieces } from "./textlayout.ts";
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

export { breakLines, type Piece };

// Footnotes: \footnotesize on the book's 11pt body, hung 1em (footmisc
// [hang], \footnotemargin 1em) under a rule 0.4 of the text width.
const NOTE = 9;
const NOTE_LEADING = 11 / 9;
const NOTE_GAP = 12;

// Lists: the first level's text 35pt in, each deeper level 15pt further
// (\setlist{leftmargin=15pt}); a numbered label ends 5.5pt before the text.
const LIST_INDENT = 35;
const LIST_STEP = 15;

export interface Assets {
  glyphs: Map<string, { data: string; ratio: number }>;
  background: string;
  heading: string;
  bullet: string;
  icon: { data: string; ratio: number } | null;
  /** the rules tables' dark background, when the scenario has tables */
  table?: string;
}

/** A table's cell pieces in reading order: header, then rows, left to right. */
function cellPieces(layout: TableLayout): Piece[] {
  return layout.rows.flatMap((row) => row.cells.flatMap((cell) => cell.lines.flat(2)));
}

/** Every piece a table draws, its title first. */
function tablePieces(t: PdfTable): Piece[] {
  return [...t.title.flat(2), ...cellPieces(t.layout)];
}

/** i, ii, iii... for the third level of a numbered list. */
function roman(n: number): string {
  const digits: [number, string][] = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let out = "";
  for (const [value, text] of digits) for (; n >= value; n -= value) out += text;
  return out;
}

// Rules tables, in the colours of the book's table macros.
const TABLE_SIZE = 10;
const TABLE_LEADING = 1.22;
const CELL_PAD = 4.5;
const ROW_GAP = 2.5;
const TITLE_INK: [number, number, number] = [245, 227, 148];
const CELL_INK: [number, number, number] = [255, 255, 255];
const FRAME_OUT: [number, number, number] = [219, 202, 134];
const FRAME_MID: [number, number, number] = [111, 103, 73];
const FRAME_IN: [number, number, number] = [176, 158, 105];
const CELL_FILL: [number, number, number] = [32, 22, 12];
const DARK_BORDER: [number, number, number] = [99, 72, 49];
const LIGHT_BORDER: [number, number, number] = [119, 84, 62];

/** A table laid out for the PDF, ready to draw. */
interface PdfTable {
  doc: TableDoc;
  layout: TableLayout;
  /** height of each row's cells */
  heights: number[];
  frameW: number;
  frameH: number;
  /** the title above the table, broken into lines; empty for none or a banner */
  title: Piece[][][];
  titleH: number;
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
  const visit = (runs: Inline[]): void =>
    runs.forEach((r) => {
      if (r.t === "glyph") names.add(r.name);
      else if (r.t === "red" || r.t === "link" || r.t === "note") visit(r.runs);
    });
  const visitTable = (t: TableDoc) => [t.title, ...(t.header ?? []), ...t.rows.flat()].forEach(visit);
  for (const block of [...doc.body, ...doc.story]) {
    if (block.k === "list") block.items.forEach((item) => visit(item.runs));
    else if (block.k === "table") visitTable(block.table);
    else if (block.k !== "heading" && block.k !== "subheading") visit(block.runs);
  }
  doc.wide.forEach(visitTable);
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
    table:
      doc.wide.length || doc.body.some((b) => b.k === "table")
        ? await rasterise(assetUrl("assets/layout/table-background.webp"), 1000, undefined, "image/jpeg")
        : undefined,
  };
}

/** Sets the pages; exported for the layout tests. */
export class Writer {
  pdf: JsPDF;
  assets: Assets;
  col = 0;
  y = MARGIN_TOP;
  top = MARGIN_TOP;
  page = 1;
  /** footnotes numbered so far */
  noteCount = 0;
  /** this page's footnotes, drawn at its foot when the page is done */
  notes: { n: number; lines: Piece[][][] }[] = [];
  /** how much of the page's foot the footnotes take */
  notesH = 0;
  /** where the last line of text ended, before any gap after it */
  textEnd = MARGIN_TOP;
  /** where the left column's text ended, once the right column is in use */
  leftEnd = 0;

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

  /**
   * The art credit, in small type between the last page's text and its page
   * number. It keeps to three lines, the room below the text column.
   */
  credit(text: string): void {
    this.pdf.setFont(FONT, "normal");
    this.pdf.setTextColor(110, 90, 70);
    let size = 6;
    let lines: string[] = [];
    for (; size >= 4.5; size -= 0.5) {
      this.pdf.setFontSize(size);
      lines = this.pdf.splitTextToSize(text, CONTENT_W);
      if (lines.length <= 3) break;
    }
    const leading = size + 1;
    lines.forEach((line, i) => {
      this.pdf.text(line, PAGE_W / 2, PAGE_H - 36 - (lines.length - 1 - i) * leading, { align: "center" });
    });
  }

  newPage(): void {
    this.drawNotes();
    this.pdf.addPage();
    this.page++;
    this.decorate();
    this.col = 0;
    this.top = MARGIN_TOP;
    this.y = this.top;
    this.textEnd = this.top;
  }

  get x0(): number {
    return MARGIN_X + this.col * (COL_W + GAP);
  }

  /** The lowest the text may reach on this page, above its footnotes. */
  get bottom(): number {
    return PAGE_H - MARGIN_BOTTOM - this.notesH;
  }

  /**
   * Room for `h` points, moving to the next column or page when needed.
   * `notes` is room the footnotes of the coming line take at the foot of the
   * page; it has to clear both columns.
   */
  ensure(h: number, notes = 0): void {
    for (let tries = 0; tries < 3; tries++) {
      const limit = this.bottom - notes;
      if (this.y + h <= limit && (this.col === 0 || this.leftEnd <= limit)) return;
      // a fresh page is as good as it gets
      if (this.col === 0 && this.y === this.top && !this.notes.length) return;
      if (this.col === 0) {
        this.leftEnd = Math.min(this.y, this.textEnd);
        this.col = 1;
        this.y = this.top;
      } else {
        this.newPage();
      }
    }
  }

  /** Lays out a footnote's text, hung 1em under its number. */
  noteLines(runs: Inline[]): Piece[][][] {
    return breakLines(this.pieces(runs, NOTE), CONTENT_W - NOTE);
  }

  /** Room a page's next footnotes take, counting the rule above the first. */
  notesRoom(lines: number): number {
    return lines * NOTE * NOTE_LEADING + (this.notes.length ? 2 : NOTE_GAP);
  }

  /** The page's footnotes, under a short rule at the foot of the page. */
  drawNotes(): void {
    if (!this.notes.length) return;
    let y = PAGE_H - MARGIN_BOTTOM - this.notesH + NOTE_GAP - 4;
    this.pdf.setDrawColor(...INK);
    this.pdf.setLineWidth(0.4);
    this.pdf.line(MARGIN_X, y - 4, MARGIN_X + CONTENT_W * 0.4, y - 4);
    for (const note of this.notes) {
      note.lines.forEach((line, i) => {
        const baseline = y + NOTE * 0.9;
        if (i === 0) {
          this.pdf.setFont(FONT, "normal");
          this.pdf.setFontSize(NOTE * 0.62);
          this.pdf.setTextColor(...INK);
          this.pdf.text(String(note.n), MARGIN_X, baseline - NOTE * 0.36);
        }
        this.drawLine(line, MARGIN_X + NOTE, baseline, NOTE, INK);
        y += NOTE * NOTE_LEADING;
      });
      y += 2;
    }
    this.notes = [];
    this.notesH = 0;
  }

  measure(text: string, style: Style, size: number): number {
    this.pdf.setFont(FONT, style);
    this.pdf.setFontSize(size);
    return this.pdf.getTextWidth(text);
  }

  /** How the PDF measures text and icons. */
  get measurer(): Measure {
    return {
      text: (text, style, at) => this.measure(text, style, at),
      glyph: (name, at) => {
        const g = this.assets.glyphs.get(name);
        const h = at * 1.05;
        return { w: g ? h * g.ratio : h, h };
      },
    };
  }

  /** Words and glyphs of runs at one size; their footnotes number on from the ones before. */
  pieces(runs: Inline[], size: number, force?: { b?: boolean; i?: boolean }): Piece[] {
    const out = toPieces(runs, size, this.measurer, force);
    this.noteCount = numberNotes(out, this.noteCount + 1, this.measurer) - 1;
    return out;
  }

  /** The footnotes marked among pieces, laid out for the foot of the page, and the room they need there. */
  notesOf(pieces: Iterable<Piece>): { notes: { n: number; lines: Piece[][][] }[]; room: number } {
    const notes = [...pieces].flatMap((p) => (p.kind === "word" && p.note ? [{ n: p.note.n, lines: this.noteLines(p.note.runs) }] : []));
    let room = notes.length && !this.notes.length ? NOTE_GAP : 0;
    for (const note of notes) room += note.lines.length * NOTE * NOTE_LEADING + 2;
    return { notes, room };
  }

  /** Puts footnotes on this page. */
  addNotes(notes: { n: number; lines: Piece[][][] }[]): void {
    for (const note of notes) {
      this.notesH += this.notesRoom(note.lines.length);
      this.notes.push(note);
    }
  }

  drawLine(line: Piece[][], x: number, baseline: number, size: number, color: Rgb): void {
    let cx = x;
    const space = this.measure(" ", "normal", size);
    line.forEach((cluster, i) => {
      if (i > 0) cx += space;
      for (const p of cluster) {
        if (p.kind === "word") {
          this.pdf.setFont(FONT, p.style);
          this.pdf.setFontSize(p.size);
          this.pdf.setTextColor(...(p.color ?? color));
          this.pdf.text(p.text, cx, baseline - p.rise);
        } else if (p.kind === "glyph") {
          const g = this.assets.glyphs.get(p.name);
          if (g) this.pdf.addImage(g.data, "PNG", cx, baseline - p.h * 0.82, p.w, p.h, `glyph-${p.name}`, "FAST");
        }
        if ((p.kind === "word" || p.kind === "glyph") && p.url) this.pdf.link(cx, baseline - size * 0.85, p.w, size * 1.1, { url: p.url });
        cx += p.w;
      }
    });
  }

  paragraph(
    runs: Inline[],
    opts: { size?: number; indent?: number; label?: "bullet" | string; force?: { b?: boolean; i?: boolean }; after?: number } = {},
  ): void {
    const size = opts.size ?? BODY;
    const indent = opts.indent ?? 0;
    const lh = size * LEADING;
    const lines = breakLines(this.pieces(runs, size, opts.force), COL_W - indent);
    lines.forEach((line, i) => {
      // A footnote goes on the page of the line that marks it.
      const { notes, room } = this.notesOf(line.flat());
      this.ensure(lh, room);
      this.addNotes(notes);
      const baseline = this.y + size * 0.9;
      if (i === 0 && opts.label === "bullet") {
        this.pdf.addImage(this.assets.bullet, "PNG", this.x0 + indent - 16, baseline - size * 0.33 - 3, 6, 6, "bullet", "FAST");
      } else if (i === 0 && opts.label === "triangle") {
        this.triangle(this.x0 + indent - 12, baseline - size * 0.3, size * 0.32);
      } else if (i === 0 && opts.label) {
        const style = styleOf(opts.force?.b, opts.force?.i);
        this.pdf.setFont(FONT, style);
        this.pdf.setFontSize(size);
        this.pdf.setTextColor(...INK);
        this.pdf.text(opts.label, this.x0 + indent - 5.5 - this.measure(opts.label, style, size), baseline);
      }
      this.drawLine(line, this.x0 + indent, baseline, size, INK);
      this.y += lh;
      this.textEnd = this.y;
    });
    this.y += opts.after ?? size * 0.48;
  }

  /** The book's second-level bullet, $\triangleright$: an outlined triangle pointing right. */
  triangle(x: number, cy: number, r: number): void {
    this.pdf.setDrawColor(...INK);
    this.pdf.setLineWidth(0.5);
    this.pdf.lines(
      [
        [r * 1.5, r],
        [-r * 1.5, r],
        [0, -r * 2],
      ],
      x,
      cy - r,
      [1, 1],
      "S",
      true,
    );
  }

  /** A list item's label: the book's bullet image, a triangle or an asterisk for deeper bullets, 1. (a) i. for numbers. */
  static itemLabel(numbered: boolean, level: number, n: number): string {
    if (!numbered) return level === 1 ? "bullet" : level === 2 ? "triangle" : "\u2217";
    if (level === 1) return `${n}.`;
    if (level === 2) return `(${String.fromCharCode(96 + n)})`;
    return `${roman(n)}.`;
  }

  /** Items in order; each level counts its numbers and knows its kind's level, as LaTeX nests them. */
  list(items: ListItem[]): void {
    // per depth: the kind open there, its level among lists of that kind, and its count
    const open: { numbered: boolean; level: number; n: number }[] = [];
    items.forEach((item, i) => {
      open.length = item.depth + 1;
      const parent = open.slice(0, item.depth).filter((o) => o?.numbered === item.numbered).length;
      const here = open[item.depth];
      const entry = here && here.numbered === item.numbered ? here : { numbered: item.numbered, level: parent + 1, n: 0 };
      entry.n++;
      open[item.depth] = entry;
      const last = i === items.length - 1;
      this.paragraph(item.runs, {
        indent: LIST_INDENT + LIST_STEP * item.depth,
        label: Writer.itemLabel(item.numbered, entry.level, entry.n),
        after: last ? BODY * 0.48 : 2.7,
      });
    });
  }

  /** Section heading: 32.7pt cap to cap after the text above, 19.3pt to the text below. */
  heading(text: string, keep = 2): void {
    const size = 13;
    this.ensure(size * 1.6 + BODY * LEADING * keep);
    if (this.y > this.top + 1) this.y += 13;
    this.pdf.setFont(FONT, "bold");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...INK);
    this.pdf.text(text.toUpperCase(), this.x0, this.y + size * 0.9);
    this.y += size * 1.52;
  }

  /** \subsubsection*: bold at body size, 3.25ex above and 1.5ex below as in the article class. */
  subheading(text: string): void {
    this.ensure(BODY * LEADING * 3);
    if (this.y > this.top + 1) this.y += 6;
    this.paragraph([{ t: "text", s: text, b: true }], { after: 3 });
  }

  block(block: Block, next?: Block): void {
    switch (block.k) {
      case "heading":
        // a sub-heading right below keeps its first lines with it
        this.heading(block.text, next?.k === "subheading" ? 4 : 2);
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
      case "subheading":
        this.subheading(block.text);
        break;
      case "list":
        this.list(block.items);
        break;
      case "table": {
        const t = this.layoutTable(block.table, COL_W);
        const { notes, room } = this.notesOf(tablePieces(t));
        // A table does not split. The right column starts as low as the left
        // one, under the heading, so check again there and go on to a new page.
        this.ensure(t.frameH + 3, room);
        this.ensure(t.frameH + 3, room);
        this.addNotes(notes);
        this.drawTable(t, this.x0, this.y + 3);
        this.y += t.frameH + 3 + BODY * 0.6;
        break;
      }
    }
  }

  /**
   * Sizes a table for the PDF with the column proportions of its .tex, so the
   * two read alike: cells grow with their lines, a row with its tallest cell.
   */
  layoutTable(doc: TableDoc, frameW: number): PdfTable {
    const measure = this.measurer;
    const lh = TABLE_SIZE * TABLE_LEADING;
    // the title first, so footnotes number in reading order
    const title = doc.title.length && !doc.banner ? breakLines(this.pieces(doc.title, TABLE_SIZE, { b: true }), frameW * 0.9) : [];
    const layout = layoutTable(doc, {
      lineWidth: 0.95 * frameW,
      size: TABLE_SIZE,
      tabcolsep: 3,
      leftskip: 4,
      inset: 2 * CELL_PAD,
      measure,
      key: bookTable(doc).layout.key,
    });
    this.noteCount = numberNotes(cellPieces(layout), this.noteCount + 1, measure) - 1;
    const heights = layout.rows.map((row) => Math.max(...row.cells.map((c) => Math.max(1, c.lines.length))) * lh + 2 * CELL_PAD);
    const titleH = title.length ? title.length * lh + 8 : 0;
    const frameH = 2 * 12 + titleH + heights.reduce((sum, h) => sum + h + ROW_GAP, -ROW_GAP);
    return { doc, layout, heights, frameW, frameH, title, titleH };
  }

  /** Draws a table's frame, background and cells with its top left corner at (x, y). */
  drawTable(t: PdfTable, x: number, y: number): void {
    const { pdf } = this;
    const { doc, layout, frameW, frameH } = t;
    if (this.assets.table) pdf.addImage(this.assets.table, "JPEG", x, y, frameW, frameH, "table-bg", "FAST");
    pdf.setLineWidth(0.8);
    const frame = (inset: number, color: [number, number, number]) => {
      pdf.setDrawColor(...color);
      pdf.rect(x + inset, y + inset, frameW - 2 * inset, frameH - 2 * inset, "S");
    };
    frame(0, FRAME_OUT);
    frame(1, FRAME_MID);
    frame(3, FRAME_IN);

    const lh = TABLE_SIZE * TABLE_LEADING;
    const space = this.measure(" ", "normal", TABLE_SIZE);
    let cy = y + 12;
    t.title.forEach((line, i) => {
      this.drawLine(line, x + (frameW - lineWidth(line, space)) / 2, cy + i * lh + TABLE_SIZE * 0.9, TABLE_SIZE, TITLE_INK);
    });
    cy += t.titleH;
    const tableW = TABLE_SHARE * 0.95 * frameW;
    const sep = 3;
    // Cell fills are translucent, as in the book; without graphics states only the borders are drawn.
    const GState = (pdf as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState;
    const translucent = typeof GState === "function" && !!GState.prototype;
    layout.rows.forEach((row, r) => {
      const h = t.heights[r];
      let cx = x + (frameW - tableW) / 2;
      row.cells.forEach((cell, c) => {
        const width = row.kind === "banner" ? tableW - 2 * sep : layout.widths[c];
        const cellX = cx + sep;
        cx += width + 2 * sep;
        // The book leaves an empty corner cell above the row names out.
        if (row.kind === "header" && c === 0 && !cell.runs.length) return;
        if (translucent) {
          pdf.setGState(new GState({ opacity: cell.dark ? 0.5 : 0.25 }) as never);
          pdf.setFillColor(...CELL_FILL);
          pdf.rect(cellX, cy, width, h, "F");
          pdf.setGState(new GState({ opacity: 1 }) as never);
        }
        pdf.setLineWidth(0.8);
        pdf.setDrawColor(...(cell.dark ? DARK_BORDER : LIGHT_BORDER));
        pdf.rect(cellX, cy, width, h, "S");
        const left = doc.align === "left" && row.kind === "body";
        const top = cy + (h - cell.lines.length * lh) / 2;
        cell.lines.forEach((line, i) => {
          const lx = left ? cellX + CELL_PAD + 4 : cellX + (width - lineWidth(line, space)) / 2;
          this.drawLine(line, lx, top + i * lh + TABLE_SIZE * 0.9, TABLE_SIZE, cell.dark ? TITLE_INK : CELL_INK);
        });
      });
      cy += h + ROW_GAP;
    });
  }

  /** Tables across both columns, below the text: on a new page when the right column has text or the table does not fit. */
  wideTables(tables: TableDoc[]): void {
    for (const table of tables) {
      const t = this.layoutTable(table, CONTENT_W);
      const { notes, room } = this.notesOf(tablePieces(t));
      if (this.col === 1 || this.y + 14 + t.frameH > this.bottom - room) this.newPage();
      this.addNotes(notes);
      const y = this.y + (this.y > this.top + 1 ? 14 : 0);
      this.drawTable(t, MARGIN_X, y);
      this.col = 0;
      this.y = y + t.frameH + 14;
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
    const avail = this.bottom - startY - 20;
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
  const credit = pdfCredit(artUse(scenario));
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
    keywords: credit,
  });

  onProgress?.("Loading images...");
  const assets = await loadAssets(doc);
  const w = new Writer(pdf, assets);
  w.header(doc);

  onProgress?.("Setting the text...");
  w.blocks(doc.body);
  w.wideTables(doc.wide);

  for (const map of doc.maps) {
    onProgress?.(`Drawing the map ${map.layout.name}...`);
    const png = await blobToDataUrl(await renderMapPng(map.layout.tiles, 1.6, map.layout.tokens));
    await w.figure(png, map.caption);
  }

  if (doc.story.length) {
    w.newPage();
    w.blocks(doc.story);
  }
  w.drawNotes();
  w.credit(credit);
  onProgress?.("Saving...");
  return pdf.output("blob");
}