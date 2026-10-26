// Writes a scenario as a mission book .tex file, in the layout of
// templates/default.tex (and templates/campaign.tex for campaigns), so it
// drops into draft-scenarios/<category>/ as is.

import type { Scenario } from "../model/types.ts";
import { type Block, buildDocument, type ListItem, type ScenarioDoc, slugify } from "./document.ts";
import type { Inline } from "./markup.ts";

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
export function inlineToLatex(runs: Inline[]): string {
  return runsToLatex(runs).replace(/\\\\\n(?=[[*])/g, "\\\\\n{}").replace(/[ ]+$/g, "");
}

/** A URL as the first argument of \href. */
function hrefTarget(url: string): string {
  return url.replace(/[\\{}%#]/g, (c) => `\\${c}`);
}

function runsToLatex(runs: Inline[]): string {
  let out = "";
  for (const run of runs) {
    if (run.t === "glyph") out += `\\svg{${run.name}}`;
    else if (run.t === "ordinal") out += `\\nth{${run.n}}`;
    else if (run.t === "math" || run.t === "signed") out += `$${run.s}$`;
    else if (run.t === "br") out += "\\\\\n";
    else if (run.t === "red") out += `\\textcolor{darkcandyapplered}{${runsToLatex(run.runs)}}`;
    else if (run.t === "link") out += `\\href{${hrefTarget(run.href)}}{${runsToLatex(run.runs)}}`;
    else if (run.t === "note") out += `\\footnote{${runsToLatex(run.runs)}}`;
    else {
      let s = escapeLatex(run.s);
      if (run.i) s = `\\textit{${s}}`;
      if (run.b) s = `\\textbf{${s}}`;
      out += s;
    }
  }
  return out;
}

/**
 * A list as nested itemize and enumerate environments. Items of one kind at
 * one depth share an environment; an item's deeper items nest inside it. A
 * list nested in the other kind starts that kind's first level, which the
 * book narrows to 15pt as its own second levels are.
 */
function listToLatex(items: ListItem[]): string {
  const lines: string[] = [];
  let k = 0;
  const env = (depth: number, levels: { itemize: number; enumerate: number }) => {
    const numbered = items[k].numbered;
    const name = numbered ? "enumerate" : "itemize";
    const level = levels[name] + 1;
    const pad = "  ".repeat(depth);
    lines.push(`${pad}\\begin{${name}}${depth > 0 && level === 1 ? "[leftmargin=15pt]" : ""}`);
    while (k < items.length && items[k].depth === depth && items[k].numbered === numbered) {
      // An item's later lines indent under its first; a leading [ would read as \item's label.
      const text = inlineToLatex(items[k++].runs).replace(/^\[/, "{}[").replace(/\n/g, `\n${pad}    `);
      lines.push(`${pad}  \\item ${text}`);
      while (k < items.length && items[k].depth > depth) env(depth + 1, { ...levels, [name]: level });
    }
    lines.push(`${pad}\\end{${name}}`);
  };
  while (k < items.length) env(0, { itemize: 0, enumerate: 0 });
  return lines.join("\n");
}

function blockToLatex(block: Block): string {
  switch (block.k) {
    case "heading":
      return `\\subsection*{\\MakeUppercase{${escapeLatex(block.text)}}}`;
    case "subheading":
      return `\\subsubsection*{${escapeLatex(block.text)}}`;
    case "para":
      return inlineToLatex(block.runs);
    case "label":
      return `\\textbf{${inlineToLatex(block.runs)}}`;
    case "field": {
      const value = block.href ? `\\href{${hrefTarget(block.href)}}{${inlineToLatex(block.runs)}}` : inlineToLatex(block.runs);
      return `\\textbf{${escapeLatex(block.label)}:}${value ? ` ${value}` : ""}`;
    }
    case "list":
      return listToLatex(block.items);
  }
}

/** Blocks separated by blank lines, except a list stays attached to the line that introduces it. */
function blocksToLatex(blocks: Block[]): string {
  let out = "";
  blocks.forEach((block, i) => {
    if (i > 0) {
      const prev = blocks[i - 1];
      out += block.k === "list" && prev.k !== "heading" && prev.k !== "subheading" && prev.k !== "list" ? "\n" : "\n\n";
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