// The scenario laid out as the mission book page reads, top to bottom, in a
// form independent of any output. The LaTeX writer, the live preview and the
// PDF writer all render this, so the three never disagree on order or
// wording.

import { CATEGORIES, categoryInfo, RESOURCES, BUILDINGS, TILE_GROUPS, INCOME_TRACK } from "../data/game.ts";
import { isRandomTile, tileGroup } from "../data/catalog.ts";
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

/** "2", "2-4" (with an en dash), "2 or 3", "1, 2 or 4": three or more counts in a row print as a range. */
export function formatPlayerCount(counts: number[]): string {
  // consecutive counts as [from, to], e.g. 1, 2, 3, 6 -> [1, 3], [6, 6]
  const spans: [number, number][] = [];
  for (const n of [...new Set(counts)].sort((a, b) => a - b)) {
    const span = spans.at(-1);
    if (span && n === span[1] + 1) span[1] = n;
    else spans.push([n, n]);
  }
  const words = spans.flatMap(([from, to]) =>
    to - from >= 2 ? [`${from}\u2013${to}`] : Array.from({ length: to - from + 1 }, (_, i) => String(from + i)),
  );
  const last = words.pop();
  if (last === undefined) return "";
  return words.length ? `${words.join(", ")} or ${last}` : last;
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

/**
 * Printed tiles placed more than once on a layout, with how many times. The
 * box holds one of each printed tile; face-down tiles repeat by design.
 */
export function duplicateTiles(tiles: MapTile[]): Map<string, number> {
  const seen = new Map<string, number>();
  for (const tile of tiles) {
    if (!isRandomTile(tile.tileId)) seen.set(tile.tileId, (seen.get(tile.tileId) ?? 0) + 1);
  }
  return new Map([...seen].filter(([, n]) => n > 1));
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

/**
 * "10 :gold:, 2 :building_materials:" for a resource line. Starting Resources
 * leave 0s out and read None when nothing is left; Starting Income prints
 * every track, an unset one at its lowest position.
 */
function resourceRuns(values: ResourceValues, income: boolean): Inline[] {
  const runs: Inline[] = [];
  for (const { key } of RESOURCES) {
    const value = values[key] ?? (income ? INCOME_TRACK[key][0] : 0);
    if (!income && value === 0) continue;
    runs.push({ t: "text", s: `${runs.length ? ", " : ""}${value} ` }, { t: "glyph", name: key });
  }
  return runs.length ? runs : [{ t: "text", s: "None" }];
}

function hasAnyValue(values: ResourceValues): boolean {
  return RESOURCES.some(({ key }) => typeof values[key] === "number");
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

/** "2/4 players" for layouts that name their player counts, else their names. */
function layoutsLabel(layouts: MapLayout[]): string {
  if (layouts.every((l) => l.playerCounts.length)) {
    const counts = [...new Set(layouts.flatMap((l) => l.playerCounts))].sort((a, b) => a - b);
    return `For ${counts.join("/")} player${counts.length === 1 && counts[0] === 1 ? "" : "s"}`;
  }
  return layouts.map((l) => l.name.trim() || "Unnamed map").join(" and ");
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

/** Story Locations, Special Tiles and the numbered Paragraphs, as the solo mission book prints them. */
function storyBookBlocks(s: Scenario): Block[] {
  const book = s.storyBook;
  const out: Block[] = [];
  const locations = book.locations.filter((e) => e.title.trim() || e.text.trim());
  if (locations.length || book.locationsNote.trim()) {
    out.push({ k: "heading", text: "Story Locations" });
    for (const e of locations) {
      if (e.title.trim()) out.push({ k: "label", runs: md(e.title.trim()) });
      out.push(...paraBlocks(e.text));
    }
    out.push(...paraBlocks(book.locationsNote));
  }
  const tiles = book.specialTiles.filter((e) => e.title.trim() || e.text.trim());
  if (tiles.length) {
    out.push({ k: "heading", text: "Special Tiles" });
    for (const e of tiles) {
      const [first = "", ...more] = paragraphs(e.text);
      out.push({ k: "field", label: e.title.trim() || "Special Tile", runs: md(first) });
      out.push(...more.map((p): Block => ({ k: "para", runs: md(p) })));
    }
  }
  if (book.paragraphs.length) {
    out.push({ k: "heading", text: "Paragraphs" });
    book.paragraphs.forEach((p, i) => {
      out.push({ k: "label", runs: [{ t: "text", s: `\u00a7${i + 1}` }] }, ...paraBlocks(p.text));
    });
  }
  return out;
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
  if (hasAnyValue(s.resources)) push({ k: "field", label: "Starting Resources", runs: resourceRuns(s.resources, false) });
  if (hasAnyValue(s.income)) push({ k: "field", label: "Starting Income", runs: resourceRuns(s.income, true) });
  const units = listBlock(s.startingUnits);
  if (units) push({ k: "field", label: "Starting Units", runs: [] }, units);
  const chosen = BUILDINGS.filter((b) => s.buildings.includes(b.key));
  push({
    k: "field",
    label: "Town Buildings",
    runs: chosen.length ? md(chosen.map((b) => b.output).join(", ")) : [{ t: "text", s: "None" }],
  });
  const pool = s.tilePool;
  const pooled = (
    [
      ["Far (II--III)", pool.far],
      ["Near (IV--V)", pool.near],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([band, n]) => `${n} random ${band} Map Tile${n === 1 ? "" : "s"}`);
  if (pool.enabled && pooled.length) {
    const note = pool.note.trim();
    push({ k: "field", label: "Map Tile Pool", runs: md(`Each player takes ${pooled.join(" and ")}.${note ? ` ${note}` : ""}`) });
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

  // Map Setup. Counted automatically, every layout with its own tile totals
  // gets its own list, labelled by its player counts (or its name).
  const groups = TILE_GROUPS.filter((g) => g.key in s.mapSetup.counts) as typeof TILE_GROUPS;
  const notes = s.mapSetup.notes as Record<string, string>;
  const lists: { label: string; items: Inline[][] }[] = [];
  let perPlayer = false;
  if (s.mapSetup.auto) {
    const distinct = new Map<string, { layouts: MapLayout[]; items: Inline[][] }>();
    for (const layout of s.maps.filter((m) => m.tiles.length)) {
      const counts = countTiles(layout.tiles);
      const key = JSON.stringify(counts);
      const entry = distinct.get(key) ?? {
        layouts: [],
        items: TILE_GROUPS.filter((g) => counts[g.key]).map((g) =>
          tileLine({ n: counts[g.key], perPlayer: false }, g.book, notes[g.key] ?? ""),
        ),
      };
      entry.layouts.push(layout);
      distinct.set(key, entry);
    }
    const entries = [...distinct.values()];
    for (const entry of entries) lists.push({ label: entries.length > 1 ? layoutsLabel(entry.layouts) : "", items: entry.items });
  } else {
    const items: Inline[][] = [];
    for (const g of groups) {
      const key = g.key as keyof Scenario["mapSetup"]["counts"];
      const count = s.mapSetup.counts[key];
      if (!count || count.n <= 0) continue;
      perPlayer ||= count.perPlayer;
      items.push(tileLine(count, g.book, s.mapSetup.notes[key]));
    }
    if (items.length) lists.push({ label: "", items });
  }
  const extra = s.mapSetup.extra.map((e) => e.trim()).filter(Boolean).map(md);
  if (lists.length || extra.length) {
    push({ k: "heading", text: "Map Setup" });
    const intro: Inline[] = [{ t: "text", s: "Take the following Map Tiles and arrange them as shown in the Scenario map layout" }];
    if (perPlayer) intro.push({ t: "text", s: " (" }, { t: "math", s: "P" }, { t: "text", s: " stands for the number of players)" });
    intro.push({ t: "text", s: ":" });
    push({ k: "para", runs: intro });
    if (lists.length === 1 && !lists[0].label) {
      push({ k: "list", items: [...lists[0].items, ...extra] });
    } else {
      for (const list of lists) push({ k: "label", runs: [{ t: "text", s: `${list.label}:` }] }, { k: "list", items: list.items });
      if (extra.length) push({ k: "list", items: extra });
    }
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
  story.push(...storyBookBlocks(s));

  return {
    kind: scenarioKind(s),
    title: scenarioTitle(s),
    titleLines: s.titleLines,
    rating: s.rating,
    image: s.titleImage,
    campaignToc: campaign && s.campaignIndex === 1 ? s.campaignName.trim() : "",
    body,
    maps: mapFiles(s),
    story,
  };
}

export { CATEGORIES };