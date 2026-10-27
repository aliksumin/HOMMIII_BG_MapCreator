// Line breaking shared by the PDF writer, which measures with the fonts it
// embeds, and the table layout, which estimates the book's line breaks from
// font metrics.

import type { Inline } from "./markup.ts";
import { ordinalSuffix } from "./markup.ts";

export type Style = "normal" | "bold" | "italic" | "bolditalic";

export type Piece =
  | { kind: "word"; text: string; style: Style; size: number; w: number; rise: number }
  | { kind: "glyph"; name: string; w: number; h: number }
  | { kind: "space"; w: number }
  /** a line break the contributor typed */
  | { kind: "break"; w: 0 };

/** How wide text and icons are set. */
export interface Measure {
  text(text: string, style: Style, size: number): number;
  glyph(name: string, size: number): { w: number; h: number };
}

export function styleOf(b?: boolean, i?: boolean): Style {
  return b && i ? "bolditalic" : b ? "bold" : i ? "italic" : "normal";
}

/** Splits runs into words, spaces, icons and breaks. A no-break space keeps its neighbours in one word. */
export function toPieces(runs: Inline[], size: number, measure: Measure, force?: { b?: boolean; i?: boolean }): Piece[] {
  const out: Piece[] = [];
  for (const run of runs) {
    if (run.t === "glyph") {
      out.push({ kind: "glyph", name: run.name, ...measure.glyph(run.name, size) });
    } else if (run.t === "ordinal") {
      const style = styleOf(force?.b, force?.i);
      const n = String(run.n);
      const suffix = ordinalSuffix(run.n);
      out.push({ kind: "word", text: n, style, size, w: measure.text(n, style, size), rise: 0 });
      out.push({ kind: "word", text: suffix, style, size: size * 0.62, w: measure.text(suffix, style, size * 0.62), rise: size * 0.36 });
    } else if (run.t === "br") {
      out.push({ kind: "break", w: 0 });
    } else {
      const style = run.t === "math" ? styleOf(force?.b, true) : styleOf(run.b || force?.b, run.i || force?.i);
      for (const part of run.s.split(/([^\S\u00a0]+)/)) {
        if (!part) continue;
        if (/^[^\S\u00a0]+$/.test(part)) out.push({ kind: "space", w: measure.text(" ", style, size) });
        else out.push({ kind: "word", text: part, style, size, w: measure.text(part, style, size), rise: 0 });
      }
    }
  }
  return out;
}

/**
 * Breaks pieces into lines no wider than `width`: at spaces when the line is
 * full, and always at a break the contributor typed.
 */
export function breakLines(pieces: Piece[], width: number): Piece[][][] {
  const clusters: { parts: Piece[]; w: number; space: number; newLine: boolean }[] = [];
  let current: Piece[] = [];
  let space = 0;
  let newLine = false;
  const flush = () => {
    if (!current.length) return;
    clusters.push({ parts: current, w: current.reduce((s, p) => s + p.w, 0), space, newLine });
    current = [];
    newLine = false;
  };
  for (const p of pieces) {
    if (p.kind === "break") {
      flush();
      newLine = true;
      space = 0;
    } else if (p.kind === "space") {
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
    if (line.length && (c.newLine || w + add > width)) {
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

/** Width of a line as breakLines sets it: its clusters and one space between each two. */
export function lineWidth(line: Piece[][], space: number): number {
  return line.reduce((sum, cluster, i) => sum + (i ? space : 0) + cluster.reduce((s, p) => s + p.w, 0), 0);
}
