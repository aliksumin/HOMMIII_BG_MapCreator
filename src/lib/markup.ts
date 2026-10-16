// The small markup every text field accepts, so contributors never write
// LaTeX:
//
//   **bold**      *italic*      :gold:  (any glyph name between colons)
//   "quotes"      --  (en dash)
//
// parseInline() turns it into Inline runs; the LaTeX, preview and PDF
// writers each render those runs their own way.

export type Inline =
  | { t: "text"; s: string; b?: boolean; i?: boolean }
  | { t: "glyph"; name: string }
  | { t: "ordinal"; n: number }
  /** a short formula such as 2P, set in math italics */
  | { t: "math"; s: string };

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

/** Splits one line or paragraph of markup into runs. */
export function parseInline(source: string, base: { b?: boolean; i?: boolean } = {}): Inline[] {
  const runs: Inline[] = [];
  const text = (s: string, b: boolean, i: boolean) => {
    if (!s) return;
    const last = runs[runs.length - 1];
    const value = typography(s);
    if (last && last.t === "text" && !!last.b === b && !!last.i === i) last.s += value;
    else runs.push({ t: "text", s: value, ...(b ? { b } : {}), ...(i ? { i } : {}) });
  };
  let bold = !!base.b;
  let italic = !!base.i;
  let buffer = "";
  let k = 0;
  while (k < source.length) {
    const rest = source.slice(k);
    if (rest.startsWith("**")) {
      text(buffer, bold, italic);
      buffer = "";
      bold = !bold;
      k += 2;
      continue;
    }
    if (rest[0] === "*" && rest[1] !== " ") {
      text(buffer, bold, italic);
      buffer = "";
      italic = !italic;
      k += 1;
      continue;
    }
    if (rest[0] === "*" && italic) {
      text(buffer, bold, italic);
      buffer = "";
      italic = false;
      k += 1;
      continue;
    }
    const glyph = /^:([a-z0-9_-]+):/.exec(rest);
    if (glyph && isGlyph(glyph[1])) {
      text(buffer, bold, italic);
      buffer = "";
      runs.push({ t: "glyph", name: glyph[1] });
      k += glyph[0].length;
      continue;
    }
    buffer += rest[0];
    k += 1;
  }
  text(buffer, bold, italic);
  return runs;
}

/** Non-empty trimmed lines. */
export function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Paragraphs separated by blank lines, each joined into one line. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((p) => lines(p).join(" "))
    .filter(Boolean);
}

/** Plain text of runs, for search and checks. */
export function plain(runs: Inline[]): string {
  return runs.map((r) => (r.t === "text" ? r.s : r.t === "glyph" ? `:${r.name}:` : r.t === "math" ? r.s : ordinalText(r.n))).join("");
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
