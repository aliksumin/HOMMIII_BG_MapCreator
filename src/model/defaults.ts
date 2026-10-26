import { uid } from "../lib/id.ts";
import { mergeGateHalves, orientGates } from "../lib/tokens.ts";
import type { Category, MapLayout, RulesTable, Scenario } from "./types.ts";

export function newMapLayout(name = "Scenario map", playerCounts: number[] = []): MapLayout {
  return { id: uid(), name, playerCounts, caption: "", tiles: [], tokens: [] };
}

/** A blank scenario with the defaults the mission book templates suggest. */
export function newScenario(category: Category = "clash"): Scenario {
  return {
    version: 1,
    id: uid(),
    name: "",
    category,
    campaignName: "",
    campaignIndex: 1,
    kindOverride: "",
    titleLines: 1,
    rating: "",
    author: "",
    sourceLabel: "",
    sourceUrl: "",
    titleImage: null,
    lore: "",
    rounds: 12,
    roundsNote: "",
    playerCounts: category === "solo" ? [1] : [2],
    faction: "",
    factionHero: "",
    resources: { gold: 10, building_materials: 2, valuables: 1 },
    income: { gold: 10, building_materials: 0, valuables: 0 },
    startingUnits: [],
    buildings: ["bronze"],
    tilePool: { enabled: false, far: 1, near: 1, note: "" },
    bonus: { label: "Additional Bonus", options: [] },
    aiHero: { enabled: category === "campaigns", faction: "", army: "", deck: "", spellDeck: "", skills: "", special: "", tables: [] },
    mapSetup: {
      auto: true,
      counts: {
        starting: { n: category === "solo" ? 1 : 2, perPlayer: false },
        far: { n: 4, perPlayer: false },
        near: { n: 2, perPlayer: false },
        center: { n: 1, perPlayer: false },
      },
      notes: { starting: "", far: "", near: "", center: "" },
      extra: [],
    },
    heroesPlacement: "",
    victory: "",
    defeat: "",
    timedEvents: [],
    rulesIntro: "",
    rules: [],
    rulesTables: [],
    customSections: [],
    story: "",
    storyBook: { locations: [], locationsNote: "", specialTiles: [], paragraphs: [] },
    maps: [newMapLayout()],
    updatedAt: new Date().toISOString(),
  };
}

/** An independent project made from a scenario: a new id (so autosave never overwrites the original) and time. */
export function copyScenario(s: Scenario): Scenario {
  return { ...structuredClone(s), id: uid(), updatedAt: new Date().toISOString() };
}

/**
 * A layout as a project or a map file holds it, made current: Gate halves on
 * neighbouring Fields turned to face each other, and Gate halves beside the
 * tiles made whole. The tiles are copied, so the input stays as it was.
 */
function upgradeLayout(m: MapLayout): MapLayout {
  const tiles = structuredClone(m.tiles ?? []);
  orientGates(tiles);
  return { ...m, tiles, tokens: mergeGateHalves(tiles, m.tokens ?? []) };
}

/** A table as a project file holds it, made rectangular: one cell per column in every row. */
function upgradeTable(t: RulesTable): RulesTable {
  const columns = t.columns?.length ? [...t.columns] : ["", ""];
  const rows = (t.rows ?? []).map((row) => columns.map((_, i) => row[i] ?? ""));
  return {
    id: t.id,
    preset: t.preset ?? "grid",
    title: t.title ?? "",
    banner: !!t.banner,
    width: t.width === "page" ? "page" : "column",
    align: t.align === "left" ? "left" : "center",
    columns,
    showHeader: t.showHeader ?? true,
    rows,
    after: typeof t.after === "number" ? t.after : null,
  };
}

/** Fills fields a project file from an older version lacks. */
export function upgradeScenario(input: Partial<Scenario>): Scenario {
  const base = newScenario(input.category ?? "clash");
  return {
    ...base,
    ...input,
    resources: { ...base.resources, ...input.resources },
    income: { ...base.income, ...input.income },
    tilePool: { ...base.tilePool, ...input.tilePool },
    bonus: { ...base.bonus, ...input.bonus },
    aiHero: { ...base.aiHero, ...input.aiHero, tables: (input.aiHero?.tables ?? []).map(upgradeTable) },
    rulesTables: (input.rulesTables ?? []).map(upgradeTable),
    customSections: (input.customSections ?? []).map((c) => ({ ...c, tables: (c.tables ?? []).map(upgradeTable) })),
    storyBook: { ...base.storyBook, ...input.storyBook },
    mapSetup: {
      ...base.mapSetup,
      ...input.mapSetup,
      counts: { ...base.mapSetup.counts, ...input.mapSetup?.counts },
      notes: { ...base.mapSetup.notes, ...input.mapSetup?.notes },
    },
    maps: input.maps?.length ? input.maps.map(upgradeLayout) : base.maps,
    version: 1,
  };
}