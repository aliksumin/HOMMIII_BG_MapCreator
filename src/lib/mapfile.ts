// The .map file the mission book keeps under assets/map-files/: the tile
// list as JSON, zlib-deflated, then base64. It is exactly what the Import /
// Export dialog of the community map editor reads and writes.

import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import type { HexArray, MapTile } from "../model/types.ts";
import { guid } from "./id.ts";

export const BASE_TILE: Omit<MapTile, "id"> = {
  row: 0,
  col: 0,
  tileId: "PLACEHOLDER",
  cubes: [0, 0, 0, 0, 0, 0, 0],
  creaturebanks: ["", "", "", "", "", "", ""],
  mapLocations: ["", "", "", "", "", "", ""],
  fieldReplacementRotations: [0, 0, 0, 0, 0, 0, 0],
  hero: ["", "", "", "", "", "", ""],
  rotation: 0,
  suggestedPlacement: false,
  blockedHex: [false, false, false, false, false, false, false],
  faction: "",
};

/** A new tile of the given type at (row, col). */
export function newTile(tileId: string, row: number, col: number): MapTile {
  return structuredClone({ ...BASE_TILE, tileId, row, col, id: guid() });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The .map text for a tile list. */
export function encodeMap(tiles: MapTile[]): string {
  const ordered = tiles.map((t) => ({
    row: t.row,
    col: t.col,
    id: t.id,
    tileId: t.tileId,
    cubes: t.cubes,
    hero: t.hero,
    rotation: t.rotation,
    creaturebanks: t.creaturebanks,
    suggestedPlacement: t.suggestedPlacement,
    blockedHex: t.blockedHex,
    faction: t.faction,
    mapLocations: t.mapLocations,
    fieldReplacementRotations: t.fieldReplacementRotations,
  }));
  return bytesToBase64(zlibSync(strToU8(JSON.stringify(ordered)), { level: 9 }));
}

function hexArray<T>(value: unknown, fallback: HexArray<T>, fix: (v: unknown) => T): HexArray<T> {
  if (!Array.isArray(value)) return [...fallback] as HexArray<T>;
  return fallback.map((d, i) => (i < value.length ? fix(value[i]) : d)) as HexArray<T>;
}

/**
 * Reads a .map file (or its text pasted from the map editor). Old files lack
 * some fields and write 0 for "no hero"; both are normalised.
 *
 * @throws Error when the text is not a map
 */
export function decodeMap(text: string): MapTile[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(unzlibSync(base64ToBytes(text.trim()))));
  } catch {
    throw new Error("This is not a map file: expected the text the map editor exports.");
  }
  if (!Array.isArray(parsed)) throw new Error("This map file holds no tile list.");
  return parsed.map((raw): MapTile => {
    if (typeof raw !== "object" || raw === null) throw new Error("This map file holds a broken tile.");
    const t = raw as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    if (typeof t.tileId !== "string" || typeof t.row !== "number" || typeof t.col !== "number") {
      throw new Error("This map file holds a tile without a type or position.");
    }
    return {
      row: t.row,
      col: t.col,
      id: str(t.id) || guid(),
      tileId: t.tileId,
      cubes: hexArray(t.cubes, BASE_TILE.cubes, num),
      creaturebanks: hexArray(t.creaturebanks, BASE_TILE.creaturebanks, str),
      mapLocations: hexArray(t.mapLocations, BASE_TILE.mapLocations, str),
      fieldReplacementRotations: hexArray(t.fieldReplacementRotations, BASE_TILE.fieldReplacementRotations, num),
      hero: hexArray(t.hero, BASE_TILE.hero, str),
      rotation: ((num(t.rotation) % 6) + 6) % 6,
      suggestedPlacement: t.suggestedPlacement === true,
      blockedHex: hexArray(t.blockedHex, BASE_TILE.blockedHex, (v) => v === true),
      faction: str(t.faction),
    };
  });
}
