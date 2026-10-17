// The scenario as the editor holds it. Plain JSON: it is what autosave keeps,
// what the project file (.scenario.json) holds, and what every exporter reads.

/** The mission book's scenario directories, which are also its categories. */
export type Category = "clash" | "coops" | "alliances" | "campaigns" | "solo";

export type ResourceKey = "gold" | "building_materials" | "valuables";

/** One value per resource; null means not set. */
export type ResourceValues = Record<ResourceKey, number | null>;

/** A Map Setup count: a fixed number, or a multiple of the player count ($kP$). */
export type TileCount = { n: number; perPlayer: boolean };

export type TileGroupKey = "starting" | "far" | "near" | "center" | "water" | "subterranean";

export type Rating = "" | "bronze" | "silver" | "golden" | "azure";

/** Seven values, one per Field of a Map Tile (see lib/hex.ts for the order). */
export type HexArray<T> = [T, T, T, T, T, T, T];

/**
 * One placed Map Tile, field for field the shape the community map editor
 * (zedero.github.io/homm3boardgame) imports and exports, so a .map file
 * round-trips unchanged.
 */
export interface MapTile {
  row: number;
  col: number;
  id: string;
  tileId: string;
  cubes: HexArray<number>;
  creaturebanks: HexArray<string>;
  mapLocations: HexArray<string>;
  fieldReplacementRotations: HexArray<number>;
  hero: HexArray<string>;
  rotation: number;
  suggestedPlacement: boolean;
  blockedHex: HexArray<boolean>;
  faction: string;
}

/** One map layout: the whole board, or the board for some player counts. */
export interface MapLayout {
  id: string;
  name: string;
  /** player counts this layout is for; empty = every count */
  playerCounts: number[];
  /** caption under the image; empty = derived from playerCounts */
  caption: string;
  tiles: MapTile[];
}

export interface TimedEvent {
  id: string;
  /** the Rounds the events happen in */
  rounds: number[];
  /** one bullet each (markup) */
  items: string[];
}

export interface CustomSection {
  id: string;
  title: string;
  /** paragraphs before the list (markup) */
  text: string;
  /** bullets (markup) */
  items: string[];
}

/** A Story Location or Special Tile entry: a bold name and what happens there (markup). */
export interface StoryEntry {
  id: string;
  /** e.g. "Witch Hut", or "F5 Mystical Garden" for a Special Tile */
  title: string;
  text: string;
}

/** One numbered paragraph of the story book; its number is its position, from 1. */
export interface StoryParagraph {
  id: string;
  /** markup; "§12" refers to paragraph 12 */
  text: string;
}

/**
 * The story book of a solo Scenario (as in the official Naval Battles mission
 * book): locations and tiles send the player to numbered paragraphs.
 */
export interface StoryBook {
  locations: StoryEntry[];
  /** printed after the Story Locations, e.g. "Whenever you visit one of the locations above..." */
  locationsNote: string;
  specialTiles: StoryEntry[];
  paragraphs: StoryParagraph[];
}

export interface TitleImage {
  kind: "library" | "upload";
  /** library: a file name under the mission book's assets/images/ (no extension) */
  name: string;
  /** upload: a PNG data URL */
  dataUrl?: string;
}

export interface Scenario {
  version: 1;
  id: string;
  name: string;
  category: Category;
  /** campaigns only: the campaign the scenario belongs to */
  campaignName: string;
  /** campaigns only: the scenario's number within its campaign */
  campaignIndex: number;
  /** replaces the kind line of the heading, e.g. "Clash/Alliance Scenario"; empty = from the category */
  kindOverride: string;
  /** how many lines the heading's title takes in the book (1 or 2) */
  titleLines: 1 | 2;
  rating: Rating;
  author: string;
  sourceLabel: string;
  sourceUrl: string;
  titleImage: TitleImage | null;
  /** italic flavor text */
  lore: string;

  rounds: number | null;
  /** extra words after "N Rounds", e.g. "(+3 after the Grail is found)" */
  roundsNote: string;
  playerCounts: number[];

  /** campaigns: Faction and Faction Hero lines */
  faction: string;
  factionHero: string;
  resources: ResourceValues;
  income: ResourceValues;
  startingUnits: string[];
  buildings: string[];
  tilePool: { enabled: boolean; far: number; near: number; note: string };
  bonus: { label: string; options: string[] };

  /** campaigns (and some coops): the AI opponent */
  aiHero: {
    enabled: boolean;
    faction: string;
    army: string;
    deck: string;
    spellDeck: string;
    skills: string;
    special: string;
  };

  mapSetup: {
    /** count tiles from the first map layout instead of typing them */
    auto: boolean;
    counts: Record<"starting" | "far" | "near" | "center", TileCount>;
    /** notes appended to a tile line, e.g. "with the Obelisk Field" */
    notes: Record<"starting" | "far" | "near" | "center", string>;
    /** extra bullets after the tile lines */
    extra: string[];
  };

  heroesPlacement: string;
  victory: string;
  defeat: string;
  timedEvents: TimedEvent[];
  rulesIntro: string;
  rules: string[];
  customSections: CustomSection[];
  /** campaigns: The Story, on its own page */
  story: string;
  /** Story Locations, Special Tiles and Paragraphs, on the story page */
  storyBook: StoryBook;

  maps: MapLayout[];
  updatedAt: string;
}
