// The export bundle: every file a mission book pull request needs, at the
// path it takes in that repository, plus the PDF and the project file.

import { strToU8, zipSync } from "fflate";
import { categoryInfo } from "../data/game.ts";
import { upgradeScenario } from "../model/defaults.ts";
import type { Scenario } from "../model/types.ts";
import { creditsMarkdown } from "./credits.ts";
import { mapFiles, slugify } from "./document.ts";
import { dataUrlToBytes } from "./images.ts";
import { registrationLines, scenarioToLatex } from "./latex.ts";
import { encodeMap } from "./mapfile.ts";
import { renderMapPng } from "./mapdraw.ts";
import { scenarioToPdf } from "./pdf.ts";

export const PROJECT_EXTENSION = ".scenario.json";

/** The repository path of the scenario .tex file. */
export function texPath(s: Scenario): string {
  return `draft-scenarios/${s.category}/${slugify(s.name)}.tex`;
}

/** The project file: the whole editor state, to reopen later. */
export function projectJson(s: Scenario): string {
  return `${JSON.stringify({ app: "homm3bg-scenario-creator", ...s }, null, 2)}\n`;
}

/** Reads a project file. */
export function parseProject(text: string): Scenario {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not a scenario project (it is not JSON).");
  }
  if (typeof data !== "object" || data === null || (data as { version?: unknown }).version !== 1) {
    throw new Error("This file is not a scenario project of this app.");
  }
  const { app: _app, ...rest } = data as Record<string, unknown>;
  return upgradeScenario(rest as Partial<Scenario>);
}

export function submitGuide(s: Scenario): string {
  const info = categoryInfo(s.category);
  const slug = slugify(s.name);
  const maps = mapFiles(s);
  const lines = [
    `# Submitting "${s.name || "Untitled Scenario"}" to the Mission Book`,
    "",
    "This folder mirrors the layout of https://github.com/qwrtln/Homm3BG-mission-book.",
    "New scenarios start in the Draft Scenarios booklet (`draft-scenarios/`).",
    "",
    "## 1. Copy the files into your clone of the repository",
    "",
    `- \`${texPath(s)}\``,
    ...maps.flatMap((m) => [`- \`assets/maps/${m.file}.png\``, `- \`assets/map-files/${m.file}.map\``]),
    ...(s.titleImage?.kind === "upload" ? [`- \`assets/images/${slug}.png\``] : []),
    "",
    "## 2. Register the scenario",
    "",
    ...(s.category === "solo" ? soloSectionSteps() : []),
    `Add these lines at the end of \`draft-scenarios/${s.category}/main.tex\`:`,
    "",
    "```latex",
    registrationLines(s, info.pathMacro).trimEnd(),
    "```",
    "",
    "## 3. Build and check",
    "",
    "Build only your scenario with the repository's container script:",
    "",
    "```bash",
    `./run.sh tools/build.sh -s '${(s.name || slug).toLowerCase().split(/\s+/).slice(0, 2).join(" ")}'`,
    "```",
    "",
    "Or paste the `.tex` into the online Scenario Builder (https://qwrtln.github.io/Homm3BG-mission-book/builder/),",
    "which compiles it in the browser and opens the pull request for you.",
    "",
    "## 4. Open a pull request",
    "",
    "One scenario per pull request. Attach screenshots of the built pages (or the PDF from this folder).",
    "",
    "The `.scenario.json` file reopens this scenario in the Scenario Creator.",
    "`CREDITS.md` says where the art in the PDF and map images comes from; keep it with them when you share them.",
    "",
  ];
  return lines.join("\n");
}

/** The book has no solo section yet: what the first Solo Scenario adds before it registers. */
function soloSectionSteps(): string[] {
  return [
    "The Mission Book has no Solo section yet. If `draft-scenarios/solo/` does not exist, add it first:",
    "",
    "1. In `draft-scenarios/drafts.tex`, next to the other paths: `\\def\\solopath{solo}`",
    "2. In `draft-scenarios/structure.tex`, after the campaigns line: `\\include{\\solopath/main.tex}`",
    "3. Create `draft-scenarios/solo/main.tex` with:",
    "",
    "```latex",
    "\\addscenariogroup{Solo}{\\layout/rampart_background.png}",
    "",
    "\\clearpage",
    "```",
    "",
  ];
}

/** Builds the ZIP. */
export async function buildBundle(s: Scenario, onProgress?: (what: string) => void): Promise<Uint8Array> {
  const slug = slugify(s.name);
  const root = `${slug}/`;
  const files: Record<string, Uint8Array> = {};
  files[`${root}${texPath(s)}`] = strToU8(scenarioToLatex(s));
  for (const map of mapFiles(s)) {
    onProgress?.(`Rendering ${map.file}.png...`);
    files[`${root}assets/maps/${map.file}.png`] = new Uint8Array(await (await renderMapPng(map.layout.tiles, 2, map.layout.tokens)).arrayBuffer());
    files[`${root}assets/map-files/${map.file}.map`] = strToU8(`${encodeMap(map.layout.tiles)}\n`);
  }
  if (s.titleImage?.kind === "upload" && s.titleImage.dataUrl) {
    files[`${root}assets/images/${slug}.png`] = dataUrlToBytes(s.titleImage.dataUrl);
  }
  const pdf = await scenarioToPdf(s, onProgress);
  files[`${root}${slug}.pdf`] = new Uint8Array(await pdf.arrayBuffer());
  files[`${root}${slug}${PROJECT_EXTENSION}`] = strToU8(projectJson(s));
  files[`${root}HOW-TO-SUBMIT.md`] = strToU8(submitGuide(s));
  files[`${root}CREDITS.md`] = strToU8(creditsMarkdown(slug));
  onProgress?.("Zipping...");
  return zipSync(files, { level: 6 });
}