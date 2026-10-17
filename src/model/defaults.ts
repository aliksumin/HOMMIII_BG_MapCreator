import { uid } from "../lib/id.ts";
import type { Category, MapLayout, Scenario } from "./types.ts";

export function newMapLayout(name = "Scenario map", playerCounts: number[] = []): MapLayout {
  return { id: uid(), name, playerCounts, caption: "", tiles: [] };
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
    playerCounts: [2],
    faction: "",
    factionHero: "",
    resources: { gold: 10, building_materials: 2, valuables: 1 },
    income: { gold: 10, building_materials: 0, valuables: 0 },
    startingUnits: [],
    buildings: ["bronze"],
    tilePool: { enabled: false, far: 1, near: 1, note: "" },
    bonus: { label: "Additional Bonus", options: [] },
    aiHero: { enabled: category === "campaigns", faction: "", army: "", deck: "", spellDeck: "", skills: "", special: "" },
    mapSetup: {
      auto: true,
      counts: {
        starting: { n: 2, perPlayer: false },
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
    customSections: [],
    story: "",
    maps: [newMapLayout()],
    updatedAt: new Date().toISOString(),
  };
}

/** An independent project made from a scenario: a new id (so autosave never overwrites the original) and time. */
export function copyScenario(s: Scenario): Scenario {
  return { ...structuredClone(s), id: uid(), updatedAt: new Date().toISOString() };
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
    aiHero: { ...base.aiHero, ...input.aiHero },
    mapSetup: {
      ...base.mapSetup,
      ...input.mapSetup,
      counts: { ...base.mapSetup.counts, ...input.mapSetup?.counts },
      notes: { ...base.mapSetup.notes, ...input.mapSetup?.notes },
    },
    maps: input.maps?.length ? input.maps : base.maps,
    version: 1,
  };
}