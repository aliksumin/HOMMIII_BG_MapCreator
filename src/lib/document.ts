// The scenario laid out as the mission book page reads, top to bottom, in a
// form independent of any output. The LaTeX writer, the live preview and the
// PDF writer all render this, so the three never disagree on order or
// wording.

import { CATEGORIES, categoryInfo, RESOURCES, BUILDINGS, TILE_GROUPS, INCOME_TRACK } from "../data/game.ts";
import { tileGroup } from "../data/catalog.ts";
import type { MapLayout, MapTile, ResourceValues, Scenario, TileCount, TileGroupKey, TitleImage, Rating } from "../model/types.ts";
import { type Inline, lines, paragraphs, parseInline } from "./markup.ts";

export type Block =
  | { k: "heading"; text: string }
  | { k: "para"; runs: Inline[] }
  | { k: "label"; runs: Inline[] }
  | { k: "field"; label: string; runs: Inline[]; href?: string }
  | { k: "list"; items: Inline[][] };

export interface DocMap {
  layout: MapLayout;
  /** file name without extension, used under assets/maps/ and assets/map-files/ */
  file: string;
  caption: string;
}

export interface ScenarioDoc {
  kind: string;
  title: string;
  titleLines: 1 | 2;
  rating: Rating;
  image: TitleImage | null;
  /** campaigns: set on the first scenario, which opens the campaign in the table of contents */
  campaignToc: string;
  body: Block[];
  maps: DocMap[];
  story: Block[];
}

/** File name for a scenario: lower case, ASCII, words joined by underscores. */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "untitled";
}

/** "2", "2-4" (with an en dash), "2 or 3", "1, 2 or 4": a run of three or more becomes a range. */
export function formatPlayerCount(counts: number[]): string {
  const sorted = [...new Set(counts)].sort((a, b) => a - b);
  const items: string[] = [];
  let start = 0;
  while (start < sorted.length) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++;
    if (end - start >= 2) items.push(`${sorted[start]}\u2013${sorted[end]}`);
    else for (let k = start; k <= end; k++) items.push(`${sorted[k]}`);
    start = end + 1;
  }
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/** The caption the book writes under a map image. */
export function mapCaption(layout: MapLayout): string {
  if (layout.caption.trim()) return layout.caption.trim().toUpperCase();
  const counts = [...new Set(layout.playerCounts)].sort((a, b) => a - b);
  return counts.length ? `${counts.join("/")}-PLAYER SCENARIO` : "SCENARIO MAP LAYOUT";
}

/** File names of the map images and map files, one per layout. */
export function mapFiles(scenario: Scenario): DocMap[] {
  const slug = slugify(scenario.name);
  const used = new Set<string>();
  return scenario.maps
    .filter((layout) => layout.tiles.length > 0)
    .map((layout, index, all) => {
      let file = slug;
      if (all.length > 1) {
        const counts = [...new Set(layout.playerCounts)].sort((a, b) => a - b);
        file = counts.length ? `${slug}_${counts.join("_")}p` : `${slug}_${index + 1}`;
      }
      while (used.has(file)) file += "_b";
      used.add(file);
      return { layout, file, caption: mapCaption(layout) };
    });
}

/** How many tiles of each kind a layout uses. */
export function countTiles(tiles: MapTile[]): Record<TileGroupKey, number> {
  const counts: Record<TileGroupKey, number> = { starting: 0, far: 0, near: 0, center: 0, water: 0, subterranean: 0 };
  for (const tile of tiles) {
    const group = tileGroup(tile.tileId);
    if (group) counts[group]++;
  }
  return counts;
}

function md(text: string): Inline[] {
  return parseInline(text);
}

function paraBlocks(text: string): Block[] {
  return paragraphs(text).map((p) => ({ k: "para", runs: md(p) }));
}

function listBlock(items: string[]): Block | null {
  const kept = items.map((item) => item.trim()).filter(Boolean);
  return kept.length ? { k: "list", items: kept.map(md) } : null;
}

function resourceRuns(values: ResourceValues, unset: ResourceValues, skipZero: boolean): Inline[] {
  const parts = RESOURCES.map(({ key }) => ({ key, value: values[key] ?? unset[key] ?? 0 })).filter(
    ({ value }) => !skipZero || value !== 0,
  );
  if (!parts.length) return [{ t: "text", s: "None" }];
  const runs: Inline[] = [];
  parts.forEach(({ key, value }, i) => {
    runs.push({ t: "text", s: `${i ? ", " : ""}${value} ` });
    runs.push({ t: "glyph", name: key });
  });
  return runs;
}

function anySet(values: ResourceValues): boolean {
  return Object.values(values).some((v) => typeof v === "number");
}

function tileLine(count: TileCount, book: string, note: string): Inline[] {
  const plural = count.perPlayer || count.n !== 1 ? "s" : "";
  const runs: Inline[] = count.perPlayer
    ? [{ t: "math", s: count.n === 1 ? "P" : `${count.n}P` }, { t: "text", s: ` \u00d7 ${book} Map Tile${plural}` }]
    : [{ t: "text", s: `${count.n} \u00d7 ${book} Map Tile${plural}` }];
  if (note.trim()) runs.push(...md(` ${note.trim()}`));
  return runs;
}

function roundsLabel(rounds: number[]): Inline[] {
  const sorted = [...new Set(rounds)].sort((a, b) => a - b);
  const runs: Inline[] = [];
  sorted.forEach((n, i) => {
    if (i > 0) runs.push({ t: "text", s: i === sorted.length - 1 ? " and " : ", " });
    runs.push({ t: "ordinal", n });
  });
  runs.push({ t: "text", s: sorted.length > 1 ? " Rounds:" : " Round:" });
  return runs;
}

/** The heading kind line, e.g. "Clash Scenario" or "Castle Campaign - The Queen's Gambit". */
export function scenarioKind(s: Scenario): string {
  if (s.kindOverride.trim()) return s.kindOverride.trim();
  if (s.category === "campaigns") {
    const head = s.faction ? `${s.faction} Campaign` : "Campaign";
    return s.campaignName.trim() ? `${head} \u2013 ${s.campaignName.trim()}` : head;
  }
  return categoryInfo(s.category).kind;
}

export function scenarioTitle(s: Scenario): string {
  const name = s.name.trim() || "Untitled Scenario";
  return s.category === "campaigns" ? `${s.campaignIndex}. ${name}` : name;
}

/** Lays the scenario out. */
export function buildDocument(s: Scenario): ScenarioDoc {
  const body: Block[] = [];
  const push = (...blocks: (Block | null)[]) => {
    for (const b of blocks) if (b) body.push(b);
  };
  const campaign = s.category === "campaigns";

  if (s.author.trim()) push({ k: "field", label: "Author", runs: [{ t: "text", s: s.author.trim() }] });
  if (s.sourceUrl.trim() || s.sourceLabel.trim()) {
    push({
      k: "field",
      label: "Source",
      runs: [{ t: "text", s: s.sourceLabel.trim() || s.sourceUrl.trim() }],
      ...(s.sourceUrl.trim() ? { href: s.sourceUrl.trim() } : {}),
    });
  }
  if (s.lore.trim()) push({ k: "para", runs: parseInline(lines(s.lore).join(" "), { i: true }) });

  if (s.rounds !== null) {
    push({ k: "heading", text: "Scenario Length" });
    const note = s.roundsNote.trim() ? ` ${s.roundsNote.trim()}` : "";
    push({ k: "para", runs: md(`${s.rounds} Round${s.rounds === 1 ? "" : "s"}${note}`) });
  }

  push({ k: "heading", text: "Player Setup" });
  if (s.playerCounts.length) {
    push({ k: "field", label: "Player Count", runs: [{ t: "text", s: formatPlayerCount(s.playerCounts) }] });
  }
  if (s.faction.trim()) push({ k: "field", label: "Faction", runs: md(s.faction.trim()) });
  if (s.factionHero.trim()) push({ k: "field", label: "Faction Hero", runs: md(s.factionHero.trim()) });
  if (anySet(s.resources)) {
    const zero: ResourceValues = { gold: 0, building_materials: 0, valuables: 0 };
    push({ k: "field", label: "Starting Resources", runs: resourceRuns(s.resources, zero, true) });
  }
  if (anySet(s.income)) {
    const min: ResourceValues = {
      gold: INCOME_TRACK.gold[0],
      building_materials: INCOME_TRACK.building_materials[0],
      valuables: INCOME_TRACK.valuables[0],
    };
    push({ k: "field", label: "Starting Income", runs: resourceRuns(s.income, min, false) });
  }
  const units = listBlock(s.startingUnits);
  if (units) push({ k: "field", label: "Starting Units", runs: [] }, units);
  const chosen = BUILDINGS.filter((b) => s.buildings.includes(b.key));
  push({
    k: "field",
    label: "Town Buildings",
    runs: chosen.length ? md(chosen.map((b) => b.output).join(", ")) : [{ t: "text", s: "None" }],
  });
  if (s.tilePool.enabled && (s.tilePool.far > 0 || s.tilePool.near > 0)) {
    const parts: string[] = [];
    const plural = (n: number) => (n === 1 ? "" : "s");
    if (s.tilePool.far > 0) parts.push(`${s.tilePool.far} random Far (II--III) Map Tile${plural(s.tilePool.far)}`);
    if (s.tilePool.near > 0) parts.push(`${s.tilePool.near} random Near (IV--V) Map Tile${plural(s.tilePool.near)}`);
    const note = s.tilePool.note.trim() ? ` ${s.tilePool.note.trim()}` : "";
    push({ k: "field", label: "Map Tile Pool", runs: md(`Each player takes ${parts.join(" and ")}.${note}`) });
  }
  const options = s.bonus.options.map((o) => o.trim()).filter(Boolean);
  const bonusLabel = s.bonus.label.trim() || "Additional Bonus";
  if (options.length === 1) push({ k: "field", label: bonusLabel, runs: md(options[0]) });
  if (options.length > 1) {
    push({ k: "field", label: bonusLabel, runs: md("Choose one of the following options:") }, listBlock(options));
  }

  if (s.aiHero.enabled) {
    const ai = s.aiHero;
    const fields: [string, string][] = [
      ["Faction", ai.faction],
      ["Enemy Army", ai.army],
      ["Enemy Deck", ai.deck],
      ["Enemy Spell Deck", ai.spellDeck],
      ["Enemy Skills", ai.skills],
      ["Special", ai.special],
    ];
    const filled = fields.filter(([, v]) => v.trim());
    if (filled.length) {
      push({ k: "heading", text: "AI Hero Setup" });
      for (const [label, value] of filled) push({ k: "field", label, runs: md(lines(value).join(" ")) });
    }
  }

  // Map Setup
  const groups = TILE_GROUPS.filter((g) => g.key in s.mapSetup.counts) as typeof TILE_GROUPS;
  const tileItems: Inline[][] = [];
  let perPlayer = false;
  if (s.mapSetup.auto) {
    const firstMap = s.maps.find((m) => m.tiles.length);
    if (firstMap) {
      const counts = countTiles(firstMap.tiles);
      for (const g of TILE_GROUPS) {
        if (!counts[g.key]) continue;
        const note = (s.mapSetup.notes as Record<string, string>)[g.key] ?? "";
        tileItems.push(tileLine({ n: counts[g.key], perPlayer: false }, g.book, note));
      }
    }
  } else {
    for (const g of groups) {
      const key = g.key as keyof Scenario["mapSetup"]["counts"];
      const count = s.mapSetup.counts[key];
      if (!count || count.n <= 0) continue;
      perPlayer ||= count.perPlayer;
      tileItems.push(tileLine(count, g.book, s.mapSetup.notes[key]));
    }
  }
  const extra = s.mapSetup.extra.map((e) => e.trim()).filter(Boolean).map(md);
  if (tileItems.length || extra.length) {
    push({ k: "heading", text: "Map Setup" });
    const intro: Inline[] = [{ t: "text", s: "Take the following Map Tiles and arrange them as shown in the Scenario map layout" }];
    if (perPlayer) intro.push({ t: "text", s: " (" }, { t: "math", s: "P" }, { t: "text", s: " stands for the number of players)" });
    intro.push({ t: "text", s: ":" });
    push({ k: "para", runs: intro }, { k: "list", items: [...tileItems, ...extra] });
  }

  if (s.heroesPlacement.trim()) push({ k: "heading", text: "Heroes Placement" }, ...paraBlocks(s.heroesPlacement));
  if (s.victory.trim()) push({ k: "heading", text: "Victory Conditions" }, ...paraBlocks(s.victory));
  if (s.defeat.trim()) push({ k: "heading", text: "Defeat Conditions" }, ...paraBlocks(s.defeat));

  const events = s.timedEvents
    .filter((e) => e.rounds.length && e.items.some((i) => i.trim()))
    .sort((a, b) => Math.min(...a.rounds) - Math.min(...b.rounds));
  if (events.length) {
    push({ k: "heading", text: "Timed Events" });
    for (const event of events) push({ k: "label", runs: roundsLabel(event.rounds) }, listBlock(event.items));
  }

  const rules = listBlock(s.rules);
  if (rules || s.rulesIntro.trim()) {
    push({ k: "heading", text: "Additional Rules" }, ...paraBlocks(s.rulesIntro), rules);
  }

  for (const section of s.customSections) {
    if (!section.title.trim()) continue;
    push({ k: "heading", text: section.title.trim() }, ...paraBlocks(section.text), listBlock(section.items));
  }

  const story = s.story.trim() ? [{ k: "heading", text: "The Story" } as Block, ...paraBlocks(s.story)] : [];

  return {
    kind: scenarioKind(s),
    title: scenarioTitle(s),
    titleLines: s.titleLines,
    rating: s.rating,
    image: s.titleImage,
    campaignToc: campaign && s.campaignIndex === 1 ? s.campaignName.trim() : "",
    body,
    maps: mapFiles(s),
    story: campaign || story.length ? story : [],
  };
}

export { CATEGORIES };