// Checks a scenario before export: what the mission book CI would reject,
// and what a reviewer would ask for.

import { CREATURE_BANKS, MAP_LOCATIONS, TILES, tileGroup, tileName } from "../data/catalog.ts";
import { BOOK_TERMS } from "../data/game.ts";
import type { MapLayout, MapTile, Scenario } from "../model/types.ts";
import { cellKey, connectedGroups, fieldCell, neighbours } from "./hex.ts";
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

/** Subterranean Tiles, including the face-down ones that tileGroup files under near and center. */
function isSubterranean(tileId: string): boolean {
  return tileGroup(tileId) === "subterranean" || tileId === "NU0" || tileId === "CU0";
}

const GATE_SURFACE = "subterranean-gate-surface";
const GATE_UNDERGROUND = "subterranean-gate-underground";

/** The Monolith that pairs with a Monolith token, or null for any other token. */
function monolithPartner(id: string): string | null {
  let m = /^(monolith-2w-\d+)([ab])$/.exec(id);
  if (m) return m[1] + (m[2] === "a" ? "b" : "a");
  m = /^(monolith-1w-\d+)-(in|out)$/.exec(id);
  if (m) return `${m[1]}-${m[2] === "in" ? "out" : "in"}`;
  return null;
}

/**
 * Map tokens placed against the rules: Subterranean Gate halves without their
 * other half, a lone Whirlpool, unpaired Monoliths, and Creature Banks off the
 * Blocked Field of a Water or Subterranean Tile.
 */
export function tokenFindings(layout: MapLayout): string[] {
  const out: string[] = [];
  const map = `Map "${layout.name}"`;
  const tokenName = (id: string) => MAP_LOCATIONS[id]?.desc ?? id;

  // The tile and token on each board Field.
  const board = new Map<string, { tile: MapTile; token: string }>();
  for (const tile of layout.tiles) {
    tile.mapLocations.forEach((token, field) => {
      const [r, c] = fieldCell(tile, field);
      board.set(cellKey(r, c), { tile, token });
    });
  }
  const nextTo = (tile: MapTile, field: number, half: string, subterranean: boolean) =>
    neighbours(...fieldCell(tile, field)).some(([r, c]) => {
      const next = board.get(cellKey(r, c));
      return next?.token === half && isSubterranean(next.tile.tileId) === subterranean;
    });

  let surface = 0;
  let underground = 0;
  const whirlpools: MapTile[] = [];
  const monoliths = new Map<string, MapTile>();
  for (const tile of layout.tiles) {
    const name = tileName(tile.tileId);
    tile.mapLocations.forEach((token, field) => {
      if (token === GATE_SURFACE) {
        surface++;
        if (isSubterranean(tile.tileId)) {
          out.push(`${map} has the surface half of a Subterranean Gate on ${name}, which is a Subterranean Tile.`);
        } else if (!nextTo(tile, field, GATE_UNDERGROUND, true)) {
          out.push(`${map} has a Subterranean Gate on ${name} with no underground half on a neighbouring Subterranean Tile.`);
        }
      } else if (token === GATE_UNDERGROUND) {
        underground++;
        if (!isSubterranean(tile.tileId)) {
          out.push(`${map} has the underground half of a Subterranean Gate on ${name}, which is not a Subterranean Tile.`);
        } else if (!nextTo(tile, field, GATE_SURFACE, false)) {
          out.push(`${map} has a Subterranean Gate on ${name} with no surface half next to it.`);
        }
      } else if (token.startsWith("whirlpool-")) {
        whirlpools.push(tile);
      } else if (monolithPartner(token)) {
        monoliths.set(token, tile);
      }
    });

    // Water and Subterranean Tiles mark the Field a Creature Bank goes on as Blocked.
    // Those with no Blocked Field at all have unknown data and are not checked.
    const blocked = TILES[tile.tileId]?.blocked;
    if (blocked?.length === 7 && blocked.some(Boolean)) {
      tile.creaturebanks.forEach((bank, field) => {
        if (bank && !blocked[field]) {
          out.push(`${map} has the Creature Bank ${CREATURE_BANKS[bank]?.desc ?? bank} on ${name} off the Tile's Blocked Field.`);
        }
      });
    }
  }

  if (surface !== underground) {
    out.push(`${map} has ${surface} surface and ${underground} underground halves of Subterranean Gates; each Gate needs one of each.`);
  }
  if (whirlpools.length === 1) {
    out.push(`${map} has a single Whirlpool (on ${tileName(whirlpools[0].tileId)}), which leads nowhere: place at least two.`);
  }
  for (const [token, tile] of monoliths) {
    const partner = monolithPartner(token);
    if (partner && !monoliths.has(partner)) {
      out.push(`${map} has ${tokenName(token)} on ${tileName(tile.tileId)} without its partner ${tokenName(partner)}.`);
    }
  }
  return out;
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
    for (const message of tokenFindings(layout)) warn("map", message);
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
    if (n < 1 || n > paragraphs.length) err("story", `The text refers to §${n}, but there is no paragraph ${n}.`);
  }
  const broken = brokenRefs(s);
  if (broken) err("story", `${broken} reference${broken === 1 ? "" : "s"} (§?) still point${broken === 1 ? "s" : ""} to a removed paragraph.`);
  paragraphs.forEach((p, i) => {
    if (!p.text.trim()) warn("story", `Paragraph §${i + 1} is empty.`);
    else if (!refs.has(i + 1)) warn("story", `Nothing leads to paragraph §${i + 1}.`);
  });
  if (s.category === "solo" && !paragraphs.length && !s.storyBook.locations.length) {
    warn("story", "Solo Scenarios usually have Story Locations that lead to numbered paragraphs.");
  }

  for (const f of capsFindings(scenarioToLatex(s))) {
    warn("review", `"${f.word}" should be capitalised (mission book style): ${f.text.slice(0, 90)}`);
  }
  return out;
}