// Writes a scenario as a mission book .tex file, in the layout of
// templates/default.tex (and templates/campaign.tex for campaigns), so it
// drops into draft-scenarios/<category>/ as is.

import type { Scenario } from "../model/types.ts";
import { type Block, buildDocument, type ScenarioDoc, slugify } from "./document.ts";
import type { Inline } from "./markup.ts";
import { bookTable, columnCount, type TableDoc, UNIT_TIERS } from "./tables.ts";

const ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  "#": "\\#",
  $: "\\$",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  "\u201c": "``",
  "\u201d": "''",
  "\u2013": "--",
  "\u2014": "---",
  "\u00a7": "\\S{}",
  // a no-break space, e.g. between a number and the icon after it
  "\u00a0": "~",
  "\t": " ",
};

/** Makes plain text safe inside a .tex file. */
export function escapeLatex(text: string): string {
  let out = "";
  for (const ch of text) out += ESCAPES[ch] ?? ch;
  return out;
}

/**
 * Renders runs; consecutive runs with the same style share one command. A
 * line break ends the source line with \\; a following line that opens with
 * [ or * gets {} first, so LaTeX does not read it as an argument of \\.
 */
export function inlineToLatex(runs: Inline[], opts: { unitSize?: number } = {}): string {
  let out = "";
  for (const run of runs) {
    if (run.t === "glyph") {
      const unit = opts.unitSize && (UNIT_TIERS as readonly string[]).includes(run.name);
      out += unit ? `\\svg[${opts.unitSize}]{${run.name}}` : `\\svg{${run.name}}`;
    }
    else if (run.t === "ordinal") out += `\\nth{${run.n}}`;
    else if (run.t === "math") out += `$${run.s}$`;
    else if (run.t === "br") out += "\\\\\n";
    else {
      let s = escapeLatex(run.s);
      if (run.i) s = `\\textit{${s}}`;
      if (run.b) s = `\\textbf{${s}}`;
      out += s;
    }
  }
  return out.replace(/\\\\\n(?=[[*])/g, "\\\\\n{}").replace(/[ ]+$/g, "");
}

/** "1.4", "18", "17.5" */
function decimal(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** A cell macro with its height; 0.9cm, the macros' own default, is left out. */
function cellMacro(runs: Inline[], dark: boolean, left: boolean, height: number): string {
  const name = `${dark ? "darkcell" : "lightcell"}${left ? "left" : ""}`;
  const size = Math.abs(height - 0.9) < 1e-9 ? "" : `[${decimal(height)}]`;
  // A cell's later lines indent under its first.
  return `\\${name}${size}{${inlineToLatex(runs, { unitSize: 12 }).replace(/\n/g, "\n        ")}}`;
}

/**
 * A table in the mission book's frame: \hommtablemulticol inside a text
 * column, or \hommtable for one across the page, which the caller wraps in a
 * table* float. The first column is p{} as wide as its longest line needs and
 * the others share the rest (X). Cell heights and the frame height come from
 * the layout in tables.ts.
 */
export function tableToLatex(table: TableDoc): string {
  const { layout, heights, frame } = bookTable(table);
  const n = columnCount(table);
  const left = table.align === "left";
  const lines: string[] = [`\\${table.wide ? "hommtable" : "hommtablemulticol"}[]{${decimal(frame)}}{`, "  \\centering"];
  if (table.title.length && !table.banner) lines.push("  \\medskip", `  \\textbf{${inlineToLatex(table.title)}}\\\\`, "  \\bigskip");
  lines.push(`  \\begin{tabularx}{0.95\\linewidth}{p{${layout.key.toFixed(2)}\\linewidth}${"X".repeat(n - 1)}}`);
  layout.rows.forEach((row, r) => {
    const h = heights[r];
    if (row.kind === "banner") {
      const span = "p{\\dimexpr0.95\\linewidth-2\\tabcolsep\\relax}";
      lines.push(`    \\multicolumn{${n}}{${span}}{${cellMacro(row.cells[0].runs, true, false, h)}} \\\\`);
    } else if (row.kind === "header") {
      // An empty corner cell is left out, as the book does above a column of row names.
      const cells = row.cells.map((c, i) => (i === 0 && !c.runs.length ? "" : cellMacro(c.runs, true, false, h)));
      lines.push(`    ${cells.join(" & ")} \\\\`.replace(/^( +) &/, "$1&"));
    } else {
      const [key, ...rest] = row.cells;
      lines.push(`    ${cellMacro(key.runs, true, left, h)}`);
      rest.forEach((c, i) => lines.push(`      & ${cellMacro(c.runs, false, left, h)}${i === rest.length - 1 ? " \\\\" : ""}`));
      if (!rest.length) lines[lines.length - 1] += " \\\\";
    }
  });
  lines.push("  \\end{tabularx}", "}");
  return lines.join("\n");
}

function blockToLatex(block: Block): string {
  switch (block.k) {
    case "table":
      return tableToLatex(block.table);
    case "heading":
      return `\\subsection*{\\MakeUppercase{${escapeLatex(block.text)}}}`;
    case "para":
      return inlineToLatex(block.runs);
    case "label":
      return `\\textbf{${inlineToLatex(block.runs)}}`;
    case "field": {
      const value = block.href
        ? `\\href{${block.href.replace(/[\\{}%#]/g, (c) => `\\${c}`)}}{${inlineToLatex(block.runs)}}`
        : inlineToLatex(block.runs);
      return `\\textbf{${escapeLatex(block.label)}:}${value ? ` ${value}` : ""}`;
    }
    case "list":
      // An item's later lines indent under its first.
      return [
        "\\begin{itemize}",
        ...block.items.map((item) => `  \\item ${inlineToLatex(item).replace(/\n/g, "\n    ")}`),
        "\\end{itemize}",
      ].join("\n");
  }
}

/** Blocks separated by blank lines, except a list stays attached to the line that introduces it. */
function blocksToLatex(blocks: Block[]): string {
  let out = "";
  blocks.forEach((block, i) => {
    if (i > 0) {
      const prev = blocks[i - 1];
      out += block.k === "list" && prev.k !== "heading" && prev.k !== "list" && prev.k !== "table" ? "\n" : "\n\n";
    }
    out += blockToLatex(block);
  });
  return out;
}

/** The repository path of the title image, as the heading takes it. */
export function titleImagePath(scenario: Scenario): string {
  const image = scenario.titleImage;
  if (!image) return "\\images/title.png";
  if (image.kind === "upload") return `\\images/${slugify(scenario.name)}.png`;
  return `\\images/${image.name}.png`;
}

function heading(doc: ScenarioDoc, scenario: Scenario): string {
  const campaign = scenario.category === "campaigns";
  const kind = escapeLatex(doc.kind.replace(/ \u2013 /g, "\u0000")).replace(/\u0000/g, " $-$ ");
  const level = campaign ? "[subsection]" : "";
  const rating = doc.rating ? `[${doc.rating}]` : "";
  const lines: string[] = ["% !TeX spellcheck = en_US"];
  if (doc.campaignToc) {
    lines.push(
      `\\cleardoublepage\\phantomsection\\addcontentsline{toc}{section}{\\protect\\numberline{} {} {} {} {}${escapeLatex(doc.campaignToc)}}`,
    );
  }
  lines.push(
    `\\addscenariosection${level}{${doc.titleLines}}{${kind}}{${escapeLatex(doc.title)}}{${titleImagePath(scenario)}}${rating}`,
  );
  return lines.join("\n");
}

/** The scenario .tex source. */
export function scenarioToLatex(scenario: Scenario): string {
  const doc = buildDocument(scenario);
  const parts: string[] = [heading(doc, scenario), "\\begin{multicols*}{2}", blocksToLatex(doc.body), "\\end{multicols*}"];

  // Tables across the page float below the columns, as the book places them.
  for (const table of doc.wide) {
    parts.push(["\\begin{table*}[!hb]", tableToLatex(table).replace(/^/gm, "  "), "\\end{table*}"].join("\n"));
  }

  for (const map of doc.maps) {
    parts.push(
      [
        "\\vspace{3em}",
        "\\begin{center}",
        `  \\includegraphics[width=0.6\\paperwidth]{\\maps/${map.file}.png}`,
        `  \\captionof{figure}{\\textbf{${escapeLatex(map.caption)}}}`,
        "\\end{center}",
      ].join("\n"),
    );
  }

  if (doc.story.length) {
    parts.push("\\newpage", "\\begin{multicols*}{2}", blocksToLatex(doc.story), "\\end{multicols*}");
  }

  const text = parts.join("\n\n");
  // The mission book lint rejects tabs and trailing spaces and wants a final newline.
  return `${text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")}\n`;
}

/** The line the category main.tex needs so the book includes the scenario. */
export function registrationLines(scenario: Scenario, pathMacro: string): string {
  return `\\clearpage\n\n\\input{\\${pathMacro}/${slugify(scenario.name)}.tex}\n`;
}