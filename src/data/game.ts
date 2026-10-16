// Game vocabulary the editor offers as choices. Sources: the rewritten rule
// book (github.com/Heegu-sama/Homm3BG) and the mission book templates and
// scenario builder (github.com/qwrtln/Homm3BG-mission-book).

import type { Category, ResourceKey, TileGroupKey } from "../model/types.ts";

export interface CategoryInfo {
  key: Category;
  label: string;
  /** what the heading says above the title */
  kind: string;
  /** the macro the category main.tex uses for its directory */
  pathMacro: string;
  blurb: string;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { key: "clash", label: "Clash", kind: "Clash Scenario", pathMacro: "clashpath", blurb: "Competitive, player against player." },
  {
    key: "coops",
    label: "Cooperative",
    kind: "Cooperative Scenario",
    pathMacro: "coopspath",
    blurb: "Players together against the Scenario.",
  },
  {
    key: "alliances",
    label: "Alliance",
    kind: "Alliance Scenario",
    pathMacro: "alliancespath",
    blurb: "Teams of allies, usually 2 against 2.",
  },
  {
    key: "campaigns",
    label: "Campaign",
    kind: "Campaign",
    pathMacro: "campaignspath",
    blurb: "One chapter of a linked story, often solo against an AI Hero.",
  },
];

export function categoryInfo(key: Category): CategoryInfo {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

export const FACTIONS: readonly string[] = [
  "Castle",
  "Necropolis",
  "Dungeon",
  "Tower",
  "Rampart",
  "Fortress",
  "Inferno",
  "Stronghold",
  "Conflux",
  "Cove",
];

/** Cube colours of the community map editor, by id (0 = no cube). */
export const CUBE_COLORS: readonly { id: number; label: string; color: string }[] = [
  { id: 1, label: "Black", color: "#111111" },
  { id: 2, label: "Necropolis", color: "#a8a8a7" },
  { id: 3, label: "Castle", color: "#549ad2" },
  { id: 4, label: "Dungeon", color: "#6a4a97" },
  { id: 5, label: "Tower", color: "#d3d3d3" },
  { id: 6, label: "Rampart", color: "#a1c564" },
  { id: 7, label: "Fortress", color: "#3e4a2e" },
  { id: 8, label: "Inferno", color: "#951d1e" },
  { id: 9, label: "Stronghold", color: "#cccc99" },
  { id: 10, label: "Conflux", color: "#f5b2cd" },
  { id: 11, label: "Cove", color: "#66cc99" },
];

/** Faction border colours for random Starting tiles (the map editor "faction" field). */
export const FACTION_BORDER: Record<string, string> = {
  CASTLE: "#549ad2",
  NECROPOLIS: "#a8a8a7",
  DUNGEON: "#6a4a97",
  TOWER: "#d3d3d3",
  RAMPART: "#a1c564",
  FORTRESS: "#3e4a2e",
  INFERNO: "#951d1e",
  STRONGHOLD: "#cccc99",
  CONFLUX: "#f5b2cd",
  COVE: "#66cc99",
};

export const RESOURCES: readonly { key: ResourceKey; label: string }[] = [
  { key: "gold", label: "Gold" },
  { key: "building_materials", label: "Building Materials" },
  { key: "valuables", label: "Valuables" },
];

/** The positions the income tracks of the Town board hold. */
export const INCOME_TRACK: Record<ResourceKey, readonly number[]> = {
  gold: [10, 15, 20, 25, 30, 35, 40, 45],
  building_materials: [0, 2, 4, 6, 8, 10, 12, 14],
  valuables: [0, 1, 2, 3, 4, 5, 6, 7],
};

export interface Building {
  key: string;
  label: string;
  glyph: string;
  /** what the Town Buildings line says, in markup */
  output: string;
}

export const BUILDINGS: readonly Building[] = [
  { key: "bronze", label: "Bronze Dwelling", glyph: "bronze", output: ":bronze: Dwelling" },
  { key: "silver", label: "Silver Dwelling", glyph: "silver", output: ":silver: Dwelling" },
  { key: "golden", label: "Golden Dwelling", glyph: "golden", output: ":golden: Dwelling" },
  { key: "city_hall", label: "City Hall", glyph: "building_city_hall", output: "City Hall" },
  { key: "citadel", label: "Citadel", glyph: "building_citadel", output: "Citadel" },
  { key: "mage_guild", label: "Mage Guild", glyph: "building_mage_guild", output: "Mage Guild" },
  {
    key: "building_special_tent",
    label: "Faction Building (tent)",
    glyph: "building_special_tent",
    output: ":building_special_tent: Building",
  },
  {
    key: "building_special_gears",
    label: "Faction Building (gears)",
    glyph: "building_special_gears",
    output: ":building_special_gears: Building",
  },
];

/** One-click starting Unit lines, as the published scenarios word them. */
export const UNIT_CHIPS: readonly string[] = [
  'A "Pack" of the cheapest :bronze: Units',
  'A "Few" of the most expensive :bronze: Units',
  'A "Few" of the cheapest :silver: Units',
  'A "Pack" of :bronze: Units of your choice',
  "A :golden: Unit of your choice",
];

export const BONUS_CHIPS: readonly string[] = [
  "Search (2) the Artifact Deck",
  "Search (2) the Spell Deck",
  "Roll two Resource Dice and take both results",
  "Roll a Treasure Die",
  "6 :gold:",
  "+1 :experience:",
  "Add a :bronze: Dwelling to your Town",
];

export const VICTORY_CHIPS: readonly string[] = [
  "Capture all enemy Towns.",
  "Defeat all enemy Main Heroes.",
  "Be the first player to bring the Grail to your Town.",
  "Hold the Obelisk Field at the end of the last Round.",
  "Defeat all invading armies.",
  "Have the most Flagged Mines and Settlements at the end of the last Round.",
];

export const DEFEAT_CHIPS: readonly string[] = [
  "The Scenario ends after the last Round without a winner.",
  "Your Town is captured.",
  "Your Main Hero is defeated in battle (retreat does not count).",
  "An enemy Hero reaches your Town.",
];

export const EVENT_CHIPS: readonly string[] = [
  "Remove all Black Cubes from every Windmill, Water Wheel, and Mystical Garden on the map.",
  "All Heroes gain 1 :movement: this Round.",
  "Each player gains 1 :experience:.",
  "Spawn an enemy army following the rules below.",
  "Each player rolls a Resource Die and gains the result.",
];

export const RULE_CHIPS: readonly string[] = [
  "Ignore all yellow borders on Starting Tiles.",
  "Players cannot attack the Heroes of other players.",
  "Players can trade resources when their Heroes stand on adjacent Fields.",
  "Neutral Units do not respawn.",
  "Astrologers Proclaim Cards are not used.",
];

export const TILE_GROUPS: readonly { key: TileGroupKey; label: string; book: string; roman: string }[] = [
  { key: "starting", label: "Starting", book: "Starting (I)", roman: "I" },
  { key: "far", label: "Far", book: "Far (II\u2013III)", roman: "II\u2013III" },
  { key: "near", label: "Near", book: "Near (IV\u2013V)", roman: "IV\u2013V" },
  { key: "center", label: "Center", book: "Center (VI\u2013VII)", roman: "VI\u2013VII" },
  { key: "water", label: "Water", book: "Water", roman: "" },
  { key: "subterranean", label: "Subterranean", book: "Subterranean", roman: "" },
];

/** Book terms the mission book lint wants capitalised. */
export const BOOK_TERMS: readonly string[] = [
  "card",
  "cube",
  "deck",
  "faction",
  "field",
  "grail",
  "hero",
  "level",
  "round",
  "scenario",
  "tile",
  "unit",
];

/** Glyphs offered first in the glyph picker. */
export const COMMON_GLYPHS: readonly string[] = [
  "gold",
  "building_materials",
  "valuables",
  "bronze",
  "silver",
  "golden",
  "azure",
  "movement",
  "experience",
  "artifact",
  "spellpower",
  "treasure",
  "resource",
  "morale_positive",
  "morale_negative",
  "attack",
  "defense",
  "damage",
  "health_points",
  "initiative",
  "unit_ranged",
  "unit_flying",
  "unit_ground",
  "might",
  "magic",
  "skill",
  "hand",
  "pay",
];