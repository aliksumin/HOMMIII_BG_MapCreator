// Writes a scenario as a mission book .tex file, in the layout of
// templates/default.tex (and templates/campaign.tex for campaigns), so it
// drops into draft-scenarios/<category>/ as is.

import type { Scenario } from "../model/types.ts";
import { type Block, buildDocument, type ScenarioDoc, slugify } from "./document.ts";
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
  "\t": " ",
};

/** Makes plain text safe inside a .tex file. */
export function escapeLatex(text: string): string {
  let out = "";
  for (const ch of text) out += ESCAPES[ch] ?? ch;
  return out;
}

/** Renders runs; consecutive runs with the same style share one command. */
export function inlineToLatex(runs: Inline[]): string {
  let out = "";
  for (const run of runs) {
    if (run.t === "glyph") out += `\\svg{${run.name}}`;
    else if (run.t === "ordinal") out += `\\nth{${run.n}}`;
    else if (run.t === "math") out += `$${run.s}$`;
    else {
      let s = escapeLatex(run.s);
      if (run.i) s = `\\textit{${s}}`;
      if (run.b) s = `\\textbf{${s}}`;
      out += s;
    }
  }
  return out.replace(/[ ]+$/g, "");
}

function blockToLatex(block: Block): string {
  switch (block.k) {
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
      return ["\\begin{itemize}", ...block.items.map((item) => `  \\item ${inlineToLatex(item)}`), "\\end{itemize}"].join(
        "\n",
      );
  }
}

/** Blocks separated by blank lines, except a list stays attached to the line that introduces it. */
function blocksToLatex(blocks: Block[]): string {
  let out = "";
  blocks.forEach((block, i) => {
    if (i > 0) {
      const prev = blocks[i - 1];
      out += block.k === "list" && prev.k !== "heading" && prev.k !== "list" ? "\n" : "\n\n";
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