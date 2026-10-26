// The small markup every text field accepts, so contributors never write
// LaTeX:
//
//   **bold**      *italic*      :gold:  (any glyph name between colons)
//   "quotes"      --  (en dash)
//   !!red!!       [text](https://...)   ^[a footnote]
//   +1 / -1       (signed numbers, set as maths like the book does)
//   \*  \!  \[  \^  \:  \+  \-  \\   (a backslash keeps the next character literal)
//
// Line breaks: a blank line (Enter in the editor) starts a new paragraph,
// a single newline (Shift+Enter) breaks the line inside the paragraph.
//
// List items may start with an indent and a marker: "  - " nests a bullet
// one level deeper, "1. " numbers the item (see parseItem).
//
// parseInline() turns it into Inline runs; the LaTeX, preview and PDF
// writers each render those runs their own way.

export type Inline =
  | { t: "text"; s: string; b?: boolean; i?: boolean }
  | { t: "glyph"; name: string }
  | { t: "ordinal"; n: number }
  /** a short formula such as 2P, set in math italics */
  | { t: "math"; s: string }
  /** a line break inside the paragraph */
  | { t: "br" }
  /** a signed number such as +1 or -2 (with an ASCII sign), upright */
  | { t: "signed"; s: string }
  /** red emphasis, the book's \textcolor{darkcandyapplered} */
  | { t: "red"; runs: Inline[] }
  | { t: "link"; href: string; runs: Inline[] }
  | { t: "note"; runs: Inline[] };

/** The Mission Book's darkcandyapplered, rgb(0.64, 0, 0). */
export const RED: [number, number, number] = [163, 0, 0];
/** hyperref's urlcolor=cyan in the Mission Book. */
export const LINK: [number, number, number] = [0, 255, 255];

/** Characters a backslash keeps literal. */
const ESCAPABLE = new Set(["\\", "*", "!", "[", "]", "^", ":", "+", "-"]);

/** Which wrappers are open around the text being parsed; none of them nests in itself. */
interface Nest {
  red?: boolean;
  link?: boolean;
  note?: boolean;
}

/** Glyph names the markup recognises; set once the catalog loads. */
let knownGlyphs: ReadonlySet<string> = new Set([
  "gold",
  "building_materials",
  "valuables",
  "bronze",
  "silver",
  "golden",
  "azure",
  "movement",
  "experience",
  "artifact",
  "spellpower",
  "treasure",
  "resource",
  "morale_positive",
  "morale_negative",
  "attack",
  "defense",
  "damage",
  "health_points",
  "initiative",
]);

export function setKnownGlyphs(names: Iterable<string>): void {
  knownGlyphs = new Set(names);
}

export function isGlyph(name: string): boolean {
  return knownGlyphs.has(name);
}

/** Straight double quotes become typographic ones; -- becomes an en dash. */
function typography(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      const prev = i > 0 ? text[i - 1] : "";
      out += prev === "" || /[\s([{]/.test(prev) ? "\u201c" : "\u201d";
    } else if (ch === "-" && text[i + 1] === "-" && text[i + 2] === "-") {
      out += "\u2014";
      i += 2;
    } else if (ch === "-" && text[i + 1] === "-") {
      out += "\u2013";
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

/** The index of the ] that closes the [ at `open`, skipping escaped characters and nested pairs; -1 if none. */
function closingBracket(source: string, open: number): number {
  let depth = 0;
  for (let k = open; k < source.length; k++) {
    const ch = source[k];
    if (ch === "\\") k++;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return k;
  }
  return -1;
}

/** A link target right after the ](: http(s) or mailto, no spaces, balanced parentheses. Returns its length up to the closing ). */
function linkTarget(source: string, from: number): string | null {
  const m = /^((?:https?:\/\/|mailto:)(?:[^\s()]|\([^\s()]*\))+)\)/.exec(source.slice(from));
  return m ? m[1] : null;
}

const WORD = /[\p{L}\p{N}_]/u;

/** Splits one paragraph of markup into runs; each newline in it becomes a line break. */
export function parseInline(source: string, base: { b?: boolean; i?: boolean } = {}): Inline[] {
  return tidyBreaks(tieGlyphs(scan(source, base, {})));
}

function scan(source: string, base: { b?: boolean; i?: boolean }, nest: Nest): Inline[] {
  const runs: Inline[] = [];
  const text = (s: string, b: boolean, i: boolean, literal = false) => {
    if (!s) return;
    const last = runs[runs.length - 1];
    const value = literal ? s : typography(s);
    if (last && last.t === "text" && !!last.b === b && !!last.i === i) last.s += value;
    else runs.push({ t: "text", s: value, ...(b ? { b } : {}), ...(i ? { i } : {}) });
  };
  let bold = !!base.b;
  let italic = !!base.i;
  let emphasis = false;
  let buffer = "";
  let k = 0;
  const flush = () => {
    text(buffer, bold, italic);
    buffer = "";
  };
  /** The text between two markers, parsed with the style around it. */
  const inner = (from: number, to: number, open: Nest) => tidyBreaks(tieGlyphs(scan(source.slice(from, to), { b: bold, i: italic }, { ...nest, ...open })));
  while (k < source.length) {
    const rest = source.slice(k);
    const prev = k > 0 ? source[k - 1] : "";
    if (rest[0] === "\\" && ESCAPABLE.has(rest[1])) {
      flush();
      text(rest[1], bold, italic, true);
      k += 2;
      continue;
    }
    // !!red!!: opens before a non-space where no word or ! precedes it, closes
    // after a non-space where no word follows, so "Stop!!" stays plain text.
    if (!nest.red && rest.startsWith("!!") && rest[2] && !/\s|!/.test(rest[2]) && !WORD.test(prev) && prev !== "!") {
      let end = k + 3;
      while ((end = source.indexOf("!!", end)) !== -1 && (/\s/.test(source[end - 1]) || WORD.test(source[end + 2] ?? ""))) end++;
      if (end !== -1) {
        flush();
        runs.push({ t: "red", runs: inner(k + 2, end, { red: true }) });
        k = end + 2;
        continue;
      }
    }
    if (!nest.note && rest.startsWith("^[")) {
      const end = closingBracket(source, k + 1);
      if (end > k + 2 && source.slice(k + 2, end).trim()) {
        flush();
        runs.push({ t: "note", runs: inner(k + 2, end, { note: true }) });
        k = end + 1;
        continue;
      }
    }
    if (!nest.link && rest[0] === "[") {
      const end = closingBracket(source, k);
      const href = end > k + 1 && source[end + 1] === "(" ? linkTarget(source, end + 2) : null;
      if (href) {
        flush();
        runs.push({ t: "link", href, runs: inner(k + 1, end, { link: true }) });
        k = end + 2 + href.length + 1;
        continue;
      }
    }
    // +1 and -1 (or a typed minus sign) standing alone: not "2-1" or "x-1".
    const signed = /^[+\-\u2212]\d+(?:[.,]\d+)?/.exec(rest);
    if (signed && (prev === "" || /[\s([/*!"]/.test(prev)) && !WORD.test(rest[signed[0].length] ?? "")) {
      flush();
      runs.push({ t: "signed", s: signed[0].replace("\u2212", "-") });
      k += signed[0].length;
      continue;
    }
    if (rest.startsWith("**")) {
      flush();
      bold = !bold;
      k += 2;
      continue;
    }
    // A single * opens emphasis (unless a space follows) and the next * closes
    // it. Inside text that is already italic (the flavor text) emphasis turns
    // italics off, so what closes it is tracked apart from the italic state.
    if (rest[0] === "*" && (emphasis || rest[1] !== " ")) {
      flush();
      italic = !italic;
      emphasis = !emphasis;
      k += 1;
      continue;
    }
    const glyph = /^:([a-z0-9_-]+):/.exec(rest);
    if (glyph && isGlyph(glyph[1])) {
      flush();
      runs.push({ t: "glyph", name: glyph[1] });
      k += glyph[0].length;
      continue;
    }
    // Bold and italics carry on over a line break, as they do over a space.
    if (rest[0] === "\n" || rest.startsWith("\r\n")) {
      flush();
      runs.push({ t: "br" });
      k += rest[0] === "\n" ? 1 : 2;
      continue;
    }
    buffer += rest[0];
    k += 1;
  }
  flush();
  return runs;
}

/**
 * A number and the glyph after it stay on one line: the space between them
 * becomes a no-break space, which the .tex writes as ~ (a review rule of the
 * Mission Book). Covers "10 :gold:" and "+1 :movement:".
 */
export function tieGlyphs(runs: Inline[]): Inline[] {
  return runs.map((run, k) => {
    const next = runs[k + 1];
    if (run.t !== "text" || next?.t !== "glyph" || !run.s.endsWith(" ")) return run;
    const before = run.s.length > 1 ? run.s[run.s.length - 2] : runs[k - 1]?.t === "signed" ? "1" : "";
    return /\d/.test(before) ? { ...run, s: `${run.s.slice(0, -1)}\u00a0` } : run;
  });
}

/**
 * One break wherever several meet (a blank line inside a list item or a
 * field), none at either end, and no spaces next to a break: the LaTeX `\\`
 * must not end or open a paragraph, and the lint rejects trailing spaces.
 */
function tidyBreaks(runs: Inline[]): Inline[] {
  const out: Inline[] = [];
  // set by a break dropped at the very start, whose line still starts afresh
  let opened = false;
  for (const run of runs) {
    if (run.t === "br") {
      for (let last = out.at(-1); last?.t === "text"; last = out.at(-1)) {
        last.s = last.s.replace(/[ \t]+$/, "");
        if (last.s) break;
        out.pop();
      }
      if (!out.length) opened = true;
      else if (out.at(-1)?.t !== "br") out.push(run);
    } else if (run.t === "text" && (out.at(-1)?.t === "br" || (opened && !out.length))) {
      const s = run.s.replace(/^[ \t]+/, "");
      if (s) out.push({ ...run, s });
    } else {
      out.push(run);
    }
  }
  if (out.at(-1)?.t === "br") out.pop();
  return out;
}

/** Paragraphs separated by blank lines (spaces and tabs only); the lines inside one keep their breaks. */
export function paragraphs(text: string): string[] {
  const found: string[] = [];
  let open: string[] = [];
  const close = () => {
    if (open.length) found.push(open.join("\n"));
    open = [];
  };
  for (const line of text.split("\n")) {
    if (/^[ \t]*\r?$/.test(line)) close();
    else if (line.trim()) open.push(line.trim());
  }
  close();
  return found;
}

/** Plain text of runs, for search and checks. */
export function plain(runs: Inline[]): string {
  return runs
    .map((r) => {
      switch (r.t) {
        case "text":
        case "math":
        case "signed":
          return r.s;
        case "glyph":
          return `:${r.name}:`;
        case "br":
          return "\n";
        case "ordinal":
          return ordinalText(r.n);
        case "red":
        case "link":
          return plain(r.runs);
        case "note":
          return ` (${plain(r.runs)})`;
      }
    })
    .join("");
}

/** How deep list items nest: three levels, as deep as the book goes. */
export const MAX_DEPTH = 2;

export interface ItemLine {
  /** 0 for a top-level item */
  depth: number;
  numbered: boolean;
  /** the item's markup without its indent and marker */
  text: string;
  /** the indent and marker as typed, e.g. "  - " or "1. " */
  prefix: string;
}

/**
 * Reads the indent and marker of a list item: "  - text" is a bullet one
 * level down (two spaces a level), "1. text" (any number up to 99) a
 * numbered item, "- text" a top-level bullet. A backslash before the
 * marker keeps it as text.
 */
export function parseItem(source: string): ItemLine {
  const m = /^( *)(-|\d{1,2}\.)[ \t]+/.exec(source);
  if (!m) {
    const text = /^\\(?:-|\d{1,2}\.)[ \t]/.test(source) ? source.slice(1) : source;
    return { depth: 0, numbered: false, text, prefix: "" };
  }
  return { depth: Math.min(Math.floor(m[1].length / 2), MAX_DEPTH), numbered: m[2] !== "-", text: source.slice(m[0].length), prefix: m[0] };
}

/** The prefix that stores an item's depth and numbering; a top-level bullet has none. */
export function itemPrefix(depth: number, numbered: boolean): string {
  if (!depth && !numbered) return "";
  return `${"  ".repeat(depth)}${numbered ? "1." : "-"} `;
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st ... */
export function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

export function ordinalText(n: number): string {
  return `${n}${ordinalSuffix(n)}`;
}
