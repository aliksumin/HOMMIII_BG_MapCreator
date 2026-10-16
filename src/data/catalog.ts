// Typed access to catalog.json, which tools/import-assets.mjs generates from
// the community map editor and the mission book.

import raw from "./catalog.json" with { type: "json" };
import type { TileGroupKey } from "../model/types.ts";

export interface TileInfo {
  id: string;
  img: string;
  desc: string;
  expansion: string;
  ground: string;
  group: string;
  blocked: number[];
}

export interface PortraitInfo {
  img: string;
  desc: string;
  faction: string;
}

export interface TokenInfo {
  id: string;
  img: string;
  desc: string;
}

export const TILES: Readonly<Record<string, TileInfo>> = raw.tiles as Record<string, TileInfo>;
export const PORTRAITS: Readonly<Record<string, PortraitInfo>> = raw.portraits as Record<string, PortraitInfo>;
export const MAP_LOCATIONS: Readonly<Record<string, TokenInfo>> = raw.mapLocations as Record<string, TokenInfo>;
export const CREATURE_BANKS: Readonly<Record<string, TokenInfo>> = raw.creatureBanks as Record<string, TokenInfo>;
export const GLYPHS: readonly string[] = raw.glyphs;
export const TITLE_IMAGES: readonly string[] = raw.titleImages;
export const EXPANSIONS: Readonly<Record<string, string>> = raw.expansions;

const RANDOM_GROUPS: Record<string, TileGroupKey> = {
  S0: "starting",
  F0: "far",
  N0: "near",
  NW0: "near",
  NU0: "near",
  C0: "center",
  CW0: "center",
  CU0: "center",
};

const GROUPS: Record<string, TileGroupKey> = {
  STARTINGTILE: "starting",
  FAR: "far",
  NEAR: "near",
  CENTER: "center",
  WATER: "water",
  SUBTERRANEAN: "subterranean",
};

/** Which kind of Map Tile a tile id is, for the Map Setup counts. */
export function tileGroup(tileId: string): TileGroupKey | null {
  if (RANDOM_GROUPS[tileId]) return RANDOM_GROUPS[tileId];
  const info = TILES[tileId];
  return info ? (GROUPS[info.group] ?? null) : null;
}

/** A readable name for a tile id, e.g. "Starting Tile S1". */
export function tileName(tileId: string): string {
  const info = TILES[tileId];
  if (!info) return tileId;
  return info.desc.replace(/^Startingtile Tile/, "Starting Tile").replace(/^Random Starting tile$/, "Random Starting Tile");
}

/** Whether a tile id is a face-down (random) tile. */
export function isRandomTile(tileId: string): boolean {
  return tileId in RANDOM_GROUPS;
}

const base: string =
  (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "./";

/** URL of a file under public/. */
export function assetUrl(path: string): string {
  return `${base}${path}`;
}

export function glyphUrl(name: string): string {
  return assetUrl(`assets/glyphs/${name}.svg`);
}

export function titleImageUrl(name: string): string {
  return assetUrl(`assets/images/${name}.webp`);
}