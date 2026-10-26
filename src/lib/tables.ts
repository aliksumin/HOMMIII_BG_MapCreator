// Rules tables: the framed tables published scenarios use for difficulty
// matrices, dice lookups, difficulty settings and AI Hero setups. This module
// holds the presets, the table as the outputs read it, and the layout that
// sizes the mission book's cells, so authors never tune heights by hand.

import { LIBERATION_SERIF, METRIC_CHARS } from "../data/fontmetrics.ts";
import { YELLOW_GLYPHS } from "../data/game.ts";
import type { RulesTable, Scenario, TablePreset } from "../model/types.ts";
import { uid } from "./id.ts";
import { type Inline, parseInline, plain } from "./markup.ts";
import { breakLines, type Measure, type Piece, toPieces } from "./textlayout.ts";

export const TIERS = ["Easy", "Normal", "Hard", "Impossible"] as const;

export const UNIT_TIERS = ["bronze", "silver", "golden", "azure"] as const;
export type UnitTier = (typeof UNIT_TIERS)[number];

/** Two Attack Dice rolled one after the other, each -1, 0 or +1. */
export const DICE_KEYS: readonly string[] = ["-1/-1", "-1/0", "-1/+1", "0/-1", "0/0", "0/+1", "+1/-1", "+1/0", "+1/+1"];

export const PRESETS: readonly { key: TablePreset; label: string; hint: string }[] = [
  { key: "difficulty", label: "Difficulty matrix", hint: "Armies per difficulty, one row per wave, Round or player count" },
  { key: "lookup", label: "Lookup table", hint: "A roll, cost or key and what it does" },
  { key: "settings", label: "Difficulty settings", hint: "What changes on each difficulty" },
  { key: "aiSetup", label: "AI Hero setup", hint: "Faction, Units, AI Deck and Artifacts of each enemy" },
  { key: "grid", label: "Grid", hint: "Any rows and columns, e.g. a Round by variant schedule" },
];

/** A new table of a preset, filled with what that kind of table usually holds. */
export function newTable(preset: TablePreset): RulesTable {
  const base = { id: uid(), preset, banner: false, align: "center" as const, showHeader: true, after: null };
  const empty = (key: string, n: number) => [key, ...Array<string>(n).fill("")];
  switch (preset) {
    case "difficulty":
      return {
        ...base,
        title: "Enemy Armies",
        width: "page",
        columns: ["", ...TIERS],
        rows: [empty("First wave", 4), empty("Second wave", 4), empty("Third wave", 4)],
      };
    case "lookup":
      return { ...base, title: "", width: "column", columns: ["Roll", "Effect"], showHeader: false, rows: [empty("", 1), empty("", 1), empty("", 1)] };
    case "settings":
      return {
        ...base,
        title: "Difficulty Settings",
        width: "column",
        columns: ["Difficulty", "Changes"],
        rows: TIERS.map((tier) => [tier, tier === "Normal" ? "No Change" : ""]),
      };
    case "aiSetup":
      return {
        ...base,
        title: "AI Hero Setup",
        width: "page",
        align: "left",
        columns: ["Faction", "Units", "AI Deck", "Artifacts/Abilities"],
        rows: [empty("", 3)],
      };
    case "grid":
      return { ...base, title: "", width: "column", columns: ["Round", "", ""], rows: [empty("", 2), empty("", 2)] };
  }
}

/**
 * Rows keyed by the nine results of two Attack Dice. A row already keyed by
 * a result stays on it; the other filled rows take the free results in order.
 */
export function diceRows(rows: string[][], columns: number): string[][] {
  const filled = rows.filter((r) => r.some((c) => c.trim()));
  const keyed = new Map(filled.filter((r) => DICE_KEYS.includes(r[0].trim())).map((r) => [r[0].trim(), r]));
  const others = filled.filter((r) => !keyed.has(r[0].trim()) || keyed.get(r[0].trim()) !== r);
  return DICE_KEYS.map((key) => {
    const row = keyed.get(key) ?? others.shift();
    return [key, ...Array.from({ length: columns - 1 }, (_, c) => row?.[c + 1] ?? "")];
  });
}

/** "3 :bronze: 2 :silver:" for unit counts per tier; tiers at 0 are left out. */
export function unitString(counts: Partial<Record<UnitTier, number>>): string {
  return UNIT_TIERS.filter((tier) => (counts[tier] ?? 0) > 0)
    .map((tier) => `${counts[tier]} :${tier}:`)
    .join(" ");
}

/** The unit counts a cell holds, or null when it holds anything else. Repeated icons count one each. */
export function parseUnits(text: string): Record<UnitTier, number> | null {
  const counts: Record<UnitTier, number> = { bronze: 0, silver: 0, golden: 0, azure: 0 };
  const rest = text.replace(/(?:(\d+)\s*)?:(bronze|silver|golden|azure):/g, (_, n: string | undefined, tier: UnitTier) => {
    counts[tier] += n ? Number(n) : 1;
    return " ";
  });
  return rest.trim() ? null : counts;
}

/** A row for the AI Hero setup preset from the AI Opponent step, one cell per column. */
export function aiSetupRow(s: Scenario, columns: number): string[] {
  const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join("\n");
  const ai = s.aiHero;
  const cells = [ai.faction, ai.army, join(ai.deck, ai.spellDeck), join(ai.skills, ai.special)];
  return Array.from({ length: columns }, (_, i) => cells[i] ?? "");
}

/** Whether a table has nothing in it at all; such tables are left out of the outputs. */
export function isBlankTable(t: RulesTable): boolean {
  return !t.title.trim() && t.columns.every((c) => !c.trim()) && t.rows.every((r) => r.every((c) => !c.trim()));
}

/** The table as the outputs draw it. */
export interface TableDoc {
  title: Inline[];
  /** the title is a merged dark row across the table, not a line above it */
  banner: boolean;
  /** spans both text columns */
  wide: boolean;
  align: "center" | "left";
  /** the header row, or null for none */
  header: Inline[][] | null;
  rows: Inline[][][];
}

/**
 * A cell's runs. The table is dark, so icons take their yellow variant where
 * the book has one (unit tiers and resources have none), and a number keeps
 * to the icon after it (the book writes 3~\svg{bronze}).
 */
export function cellRuns(text: string): Inline[] {
  const runs = parseInline(text.trim());
  return runs.map((run, i) => {
    const next = runs[i + 1];
    if (run.t === "text" && next?.t === "glyph" && /\d ?$/.test(run.s)) return { ...run, s: run.s.replace(/(\d) ?$/, "$1 ") };
    if (run.t === "glyph" && YELLOW_GLYPHS.has(run.name)) return { ...run, name: `${run.name}-yellow` };
    return run;
  });
}

export function tableDoc(t: RulesTable): TableDoc {
  const title = cellRuns(t.title);
  return {
    title,
    banner: t.banner && title.length > 0,
    wide: t.width === "page",
    align: t.align,
    header: t.showHeader ? t.columns.map(cellRuns) : null,
    rows: t.rows.map((row) => row.map(cellRuns)),
  };
}

export function columnCount(doc: TableDoc): number {
  return Math.max(doc.header?.length ?? 0, ...doc.rows.map((r) => r.length), 1);
}

// ---- layout ----

/** Where a table is set and with what. */
export interface TableGeometry {
  /** the width \linewidth stands for inside the frame; the table takes 95% of it */
  lineWidth: number;
  size: number;
  /** space on each side of every column */
  tabcolsep: number;
  /** indent of left-aligned cells */
  leftskip: number;
  /** room kept free inside a cell on top of the indent; the book's macros keep none */
  inset?: number;
  measure: Measure;
  /** the first column's share of lineWidth; computed when left out */
  key?: number;
}

export interface TableLayout {
  /** the first column's share of the line width */
  key: number;
  /** text width of each column */
  widths: number[];
  /** every row as drawn, top down: the banner, the header row, then the body */
  rows: { kind: "banner" | "header" | "body"; cells: { runs: Inline[]; dark: boolean; lines: Piece[][][] }[] }[];
  /** words or icon runs wider than their column */
  overflow: { col: number; text: string; need: number; have: number }[];
}

/** Share of the line width the table takes. */
export const TABLE_SHARE = 0.95;

function widest(lines: Piece[][][], space: number): number {
  return Math.max(0, ...lines.map((line) => line.reduce((sum, c, i) => sum + (i ? space : 0) + c.reduce((s, p) => s + p.w, 0), 0)));
}

/** Lays the table out: column widths, and each cell broken into lines. */
export function layoutTable(doc: TableDoc, g: TableGeometry): TableLayout {
  const n = columnCount(doc);
  const pieces = (runs: Inline[], dark: boolean) => toPieces(runs, g.size, g.measure, dark ? { b: true } : undefined);
  const space = g.measure.text(" ", "normal", g.size);
  const inner = 2 * g.tabcolsep;

  // The first column takes the room its widest line needs, between 12% and 40%.
  let key = g.key;
  if (key === undefined) {
    const keyCells = [...(doc.header ? [doc.header[0]] : []), ...doc.rows.map((r) => r[0] ?? [])];
    const natural = Math.max(0, ...keyCells.map((runs) => widest(breakLines(pieces(runs, true), Infinity), space)));
    const pad = doc.align === "left" ? g.leftskip : 0;
    key = Math.min(0.4, Math.max(0.12, Math.ceil(((natural + pad + 2) / g.lineWidth) * 100) / 100));
  }
  const total = TABLE_SHARE * g.lineWidth;
  const first = key * g.lineWidth;
  const rest = n > 1 ? (total - first - inner * n) / (n - 1) : 0;
  const widths = n > 1 ? [first, ...Array<number>(n - 1).fill(rest)] : [total - inner];

  const overflow: TableLayout["overflow"] = [];
  const cell = (runs: Inline[], dark: boolean, col: number, width: number, align: "center" | "left") => {
    const have = (align === "left" ? width - g.leftskip : width) - (g.inset ?? 0);
    const p = pieces(runs, dark);
    // a cluster is a word with the icons and numbers glued to it
    for (const line of breakLines(p, 0)) {
      const need = widest([line], space);
      if (need > have + 0.01) overflow.push({ col, text: plainOf(line), need, have });
    }
    return { runs, dark, lines: breakLines(p, have) };
  };

  const rows: TableLayout["rows"] = [];
  if (doc.banner) rows.push({ kind: "banner", cells: [cell(doc.title, true, 0, total - inner, "center")] });
  if (doc.header) rows.push({ kind: "header", cells: doc.header.map((runs, c) => cell(runs, true, c, widths[c], "center")) });
  for (const row of doc.rows) {
    rows.push({ kind: "body", cells: widths.map((w, c) => cell(row[c] ?? [], c === 0, c, w, doc.align)) });
  }
  return { key, widths, rows, overflow };
}

function plainOf(line: Piece[][]): string {
  return line.map((c) => c.map((p) => (p.kind === "word" ? p.text : p.kind === "glyph" ? `:${p.name}:` : "")).join("")).join(" ");
}

// ---- the mission book's geometry ----

const CM = 72.27 / 2.54;
/** \baselineskip of the book's 12pt type */
const BASELINESKIP = 14.5;
/** A4 less the 1.5cm side margins, and one of its two columns 1cm apart */
const TEXT_WIDTH = 18 * CM;
const COLUMN_WIDTH = (TEXT_WIDTH - CM) / 2;
/** an icon's width per unit of height; unit tiers are a little narrower than most */
const GLYPH_RATIO = 1.2;
const UNIT_RATIO = 1.08;
/** \svg sizes are in px, which XeTeX sets at 1bp */
const PX = 72.27 / 72;

const widthOf = (() => {
  const index = new Map([...METRIC_CHARS].map((ch, i) => [ch, i]));
  return (text: string, style: keyof typeof LIBERATION_SERIF, size: number) => {
    const table = LIBERATION_SERIF[style];
    let sum = 0;
    for (const ch of text) sum += table[index.get(ch) ?? -1] ?? 500;
    return (sum / 1000) * size;
  };
})();

/** Widths as the book sets them: Liberation Serif, icons at \svg's 10px (12px for unit tiers in tables). */
export const BOOK_MEASURE: Measure = {
  text: widthOf,
  glyph: (name) => {
    const unit = (UNIT_TIERS as readonly string[]).includes(name);
    const h = (unit ? 12 : 10) * PX;
    return { w: h * (unit ? UNIT_RATIO : GLYPH_RATIO), h };
  },
};

/** The table frame's inner \linewidth: 95% of the column, or of the page for a wide table. */
export function bookGeometry(wide: boolean): TableGeometry {
  return { lineWidth: 0.95 * (wide ? TEXT_WIDTH : COLUMN_WIDTH), size: 12, tabcolsep: 0.3 * 12, leftskip: 0.4 * 12, measure: BOOK_MEASURE };
}

/** Height of a \darkcell or \lightcell in cm for its lines: the lines and the node's padding, at least the macro's 0.9. */
export function cellHeight(lines: number): number {
  const cm = (0.3 * CM + Math.max(1, lines) * BASELINESKIP) / CM;
  return Math.max(0.9, Math.ceil(cm * 10 - 1e-6) / 10);
}

export interface BookTable {
  layout: TableLayout;
  /** height of each row's cells in cm, as layout.rows */
  heights: number[];
  /** the frame height in lines (\baselineskip), the second argument of \hommtable */
  frame: number;
}

/** A row's cells are all as tall as its tallest; each row adds the array strut's depth and the cell border. */
const ROW_EXTRA = 0.3 * BASELINESKIP + 1;
/** \medskip, the title line and \bigskip */
const TITLE_BLOCK = 6 + BASELINESKIP + 12;

/** The table as the mission book macros set it, with cell heights and the frame height worked out. */
export function bookTable(doc: TableDoc): BookTable {
  const layout = layoutTable(doc, bookGeometry(doc.wide));
  const heights = layout.rows.map((row) => cellHeight(Math.max(...row.cells.map((c) => c.lines.length))));
  const content = heights.reduce((sum, h) => sum + h * CM + ROW_EXTRA, 0) + (doc.title.length && !doc.banner ? TITLE_BLOCK : 0);
  // A line of room above and below, rounded up to half a line.
  const frame = Math.ceil((content / BASELINESKIP + 2) * 2) / 2;
  return { layout, heights, frame };
}

/** The tallest frame that fits a page: A4 less the book's 2.43cm top and 3cm bottom margins. */
export const MAX_FRAME = Math.floor(((29.7 - 2.43 - 3) * CM) / BASELINESKIP);

/** Plain text of a cell, for messages. */
export function cellText(runs: Inline[]): string {
  return plain(runs).replace(/ /g, " ").replace(/\n/g, " ");
}
