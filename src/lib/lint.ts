// Checks a scenario before export: what the mission book CI would reject,
// and what a reviewer would ask for.

import { tileName } from "../data/catalog.ts";
import { BOOK_TERMS } from "../data/game.ts";
import type { Scenario } from "../model/types.ts";
import { connectedGroups } from "./hex.ts";
import { countTiles, duplicateTiles } from "./document.ts";
import { scenarioToLatex } from "./latex.ts";
import { brokenRefs, paragraphRefs } from "./storybook.ts";

export interface Finding {
  level: "error" | "warning";
  /** the editor step that fixes it */
  step: string;
  message: string;
}

/**
 * Lines of the .tex the lint-files workflow would flag: a book term in lower
 * case after a space (grep "\sword\b", plus -s and -es plurals).
 */
export function capsFindings(tex: string): { line: number; word: string; text: string }[] {
  const found: { line: number; word: string; text: string }[] = [];
  tex.split("\n").forEach((text, index) => {
    if (/% no-check-caps$/.test(text)) return;
    for (const word of BOOK_TERMS) {
      const re = new RegExp(`\\s(${word}|${word}s|${word}es)\\b`);
      const m = re.exec(text);
      if (m) found.push({ line: index + 1, word: m[1], text: text.trim() });
    }
  });
  return found;
}

export function lintScenario(s: Scenario): Finding[] {
  const out: Finding[] = [];
  const err = (step: string, message: string) => out.push({ level: "error", step, message });
  const warn = (step: string, message: string) => out.push({ level: "warning", step, message });

  if (s.name.trim().length < 3) err("basics", "Give the Scenario a name of at least 3 characters.");
  if (!s.author.trim()) warn("basics", "Add the author name.");
  if (!s.titleImage) warn("basics", "Pick a title image (the icon left of the heading).");
  if (s.category === "campaigns" && !s.campaignName.trim()) err("basics", "Name the Campaign this Scenario belongs to.");
  if (!s.lore.trim()) warn("story", "Add one or two paragraphs of flavor text.");
  if (s.rounds === null) err("setup", "Set the Scenario Length in Rounds.");
  if (!s.playerCounts.length && s.category !== "campaigns") err("setup", "Choose the player counts.");
  if (s.category === "solo" && s.playerCounts.join() !== "1") warn("setup", "A Solo Scenario is for 1 player.");
  if (!s.victory.trim()) err("conditions", "Write the Victory Conditions.");
  if (!s.defeat.trim()) warn("conditions", "Write the Defeat Conditions (or say there are none).");

  const maps = s.maps.filter((m) => m.tiles.length);
  if (!maps.length) err("map", "Place at least one Map Tile on the map.");
  for (const layout of maps) {
    const groups = connectedGroups(layout.tiles);
    if (groups.length > 1) warn("map", `Map "${layout.name}" falls apart into ${groups.length} unconnected parts.`);
    for (const [id, n] of duplicateTiles(layout.tiles)) {
      warn("map", `Map "${layout.name}" uses ${tileName(id)} ${n} times, but the game has only one of each printed tile.`);
    }
    const counts = countTiles(layout.tiles);
    if (s.category !== "campaigns" && s.playerCounts.length === 1 && counts.starting && counts.starting < s.playerCounts[0]) {
      warn("map", `Map "${layout.name}" has ${counts.starting} Starting Tiles for ${s.playerCounts[0]} players.`);
    }
  }
  if (!s.mapSetup.auto && maps.length) {
    const counts = countTiles(maps[0].tiles);
    for (const key of ["starting", "far", "near", "center"] as const) {
      const c = s.mapSetup.counts[key];
      if (!c.perPlayer && c.n !== counts[key]) {
        warn("map", `Map Setup lists ${c.n} ${key} Tiles but the first map has ${counts[key]}.`);
      }
    }
  }

  // Story book: every §n must lead to a paragraph, and every paragraph should be reachable.
  const paragraphs = s.storyBook.paragraphs;
  const refs = paragraphRefs(s);
  for (const n of [...refs.keys()].sort((a, b) => a - b)) {
    if (n < 1 || n > paragraphs.length) err("storybook", `The text refers to §${n}, but there is no paragraph ${n}.`);
  }
  const broken = brokenRefs(s);
  if (broken) err("storybook", `${broken} reference${broken === 1 ? "" : "s"} (§?) still point${broken === 1 ? "s" : ""} to a removed paragraph.`);
  paragraphs.forEach((p, i) => {
    if (!p.text.trim()) warn("storybook", `Paragraph §${i + 1} is empty.`);
    else if (!refs.has(i + 1)) warn("storybook", `Nothing leads to paragraph §${i + 1}.`);
  });
  if (s.category === "solo" && !paragraphs.length && !s.storyBook.locations.length) {
    warn("storybook", "Solo Scenarios usually have Story Locations that lead to numbered paragraphs.");
  }

  for (const f of capsFindings(scenarioToLatex(s))) {
    warn("review", `"${f.word}" should be capitalised (mission book style): ${f.text.slice(0, 90)}`);
  }
  return out;
}