// Board geometry, matching the community map editor so a .map file places
// every Map Tile where that editor would.
//
// The board is a grid of pointy-top hexes (Fields), addressed by row and
// column. Even rows sit half a hex to the left of odd rows. A Map Tile is a
// flower of seven Fields: the one at its (row, col) and the six around it.
// Inside a tile the Fields are numbered:
//
//        0   1
//      2   3   4
//        5   6
//
// Rotation turns the tile clockwise in steps of 60 degrees.

import type { MapTile } from "../model/types.ts";

export const CELL_W = 86;
export const CELL_H = 100;
export const ROW_PITCH = 74;
/** A Map Tile image is drawn at this size, centred on its middle Field. */
export const TILE_W = 258;
export const TILE_H = 249;

export interface Point {
  x: number;
  y: number;
}

/** Neighbour offsets [dcol, drow], clockwise from upper-right, for even and odd rows. */
const DIRECTIONS: readonly (readonly [number, number])[][] = [
  [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ],
  [
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 0],
    [0, -1],
  ],
];

/** The Field on each side of the middle one, side 0 being upper-right, for an unrotated tile. */
export const FIELD_BY_SIDE: readonly number[] = [1, 4, 6, 5, 2, 0];

/** Offsets of each Field centre from the tile centre, unrotated. */
const FIELD_OFFSETS: readonly Point[] = [
  { x: -43, y: -ROW_PITCH },
  { x: 43, y: -ROW_PITCH },
  { x: -86, y: 0 },
  { x: 0, y: 0 },
  { x: 86, y: 0 },
  { x: -43, y: ROW_PITCH },
  { x: 43, y: ROW_PITCH },
];

export function cellKey(row: number, col: number): string {
  return `${row}.${col}`;
}

/** Centre of a Field in board pixels. */
export function cellCenter(row: number, col: number): Point {
  return { x: col * CELL_W - (row % 2 === 0 ? CELL_W / 2 : 0) + CELL_W / 2, y: row * ROW_PITCH + CELL_H / 2 };
}

/** The six Fields around one, clockwise from upper-right, as [row, col]. */
export function neighbours(row: number, col: number): [number, number][] {
  return DIRECTIONS[row & 1].map(([dc, dr]) => [row + dr, col + dc]);
}

/** The board Field that holds Field number `field` (0..6) of a tile. */
export function fieldCell(tile: Pick<MapTile, "row" | "col" | "rotation">, field: number): [number, number] {
  if (field === 3) return [tile.row, tile.col];
  const localSide = FIELD_BY_SIDE.indexOf(field);
  const worldSide = (localSide + tile.rotation) % 6;
  return neighbours(tile.row, tile.col)[worldSide];
}

/** The seven board Fields a tile at (row, col) covers. */
export function footprint(row: number, col: number): [number, number][] {
  return [[row, col], ...neighbours(row, col)];
}

/** Where Field number `field` of a tile is drawn, in board pixels, taking rotation into account. */
export function fieldCenter(tile: Pick<MapTile, "row" | "col" | "rotation">, field: number): Point {
  const c = cellCenter(tile.row, tile.col);
  const o = FIELD_OFFSETS[field];
  const a = (tile.rotation * Math.PI) / 3;
  return { x: c.x + o.x * Math.cos(a) - o.y * Math.sin(a), y: c.y + o.x * Math.sin(a) + o.y * Math.cos(a) };
}

/** The Field under a board pixel. */
export function pixelToCell(x: number, y: number): [number, number] {
  const guessRow = Math.round((y - CELL_H / 2) / ROW_PITCH);
  let best: [number, number] = [guessRow, 0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let row = guessRow - 1; row <= guessRow + 1; row++) {
    const shift = row % 2 === 0 ? CELL_W / 2 : 0;
    const guessCol = Math.round((x - CELL_W / 2 + shift) / CELL_W);
    for (let col = guessCol - 1; col <= guessCol + 1; col++) {
      const c = cellCenter(row, col);
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = [row, col];
      }
    }
  }
  return best;
}

/** Board Fields covered by tiles, mapped to the id of the covering tile. */
export function occupancy(tiles: MapTile[], except?: string): Map<string, string> {
  const taken = new Map<string, string>();
  for (const tile of tiles) {
    if (tile.id === except) continue;
    for (const [r, c] of footprint(tile.row, tile.col)) taken.set(cellKey(r, c), tile.id);
  }
  return taken;
}

/** A tile or token on a board Field. */
export interface Piece {
  id: string;
  row: number;
  col: number;
}

/** A token beside the tiles and every Field it covers (two for a whole Subterranean Gate). */
export interface TokenSpot extends Piece {
  cells: [number, number][];
}

/** Whether a tile can sit at (row, col) without covering another tile or a token beside the tiles. */
export function canPlace(tiles: MapTile[], row: number, col: number, except?: string, tokens: readonly TokenSpot[] = []): boolean {
  if (row < 1 || col < 1) return false;
  const taken = occupancy(tiles, except);
  for (const t of tokens) for (const [r, c] of t.cells) taken.set(cellKey(r, c), t.id);
  return footprint(row, col).every(([r, c]) => !taken.has(cellKey(r, c)));
}

/** Axial coordinates [q, r] of a Field, so a shift by whole hexes is plain addition. */
function toAxial(row: number, col: number): [number, number] {
  return [col - (row - (row & 1)) / 2, row];
}

function fromAxial(q: number, r: number): [number, number] {
  return [r, q + (r - (r & 1)) / 2];
}

/**
 * Where the Field at (row, col) lands when the board shifts so that Field
 * `from` lands on Field `to`. Tiles moved together this way keep their shape,
 * whichever row parity the shift starts and ends on.
 */
export function shiftCell(row: number, col: number, from: [number, number], to: [number, number]): [number, number] {
  const [q, r] = toAxial(row, col);
  const [fq, fr] = toAxial(from[0], from[1]);
  const [tq, tr] = toAxial(to[0], to[1]);
  return fromAxial(q + tq - fq, r + tr - fr);
}

/** Whether a Location token can cover these Fields: ones no tile covers and no other token holds. */
export function canPlaceToken(tiles: MapTile[], tokens: readonly TokenSpot[], cells: [number, number][], except?: string): boolean {
  const taken = occupancy(tiles);
  for (const t of tokens) if (t.id !== except) for (const [r, c] of t.cells) taken.set(cellKey(r, c), t.id);
  return cells.every(([r, c]) => r >= 0 && c >= 0 && !taken.has(cellKey(r, c)));
}

/**
 * Whether several tiles and tokens can move together without leaving the
 * board or landing on a tile or token that stays put.
 */
export function canPlaceGroup(tiles: MapTile[], moves: Piece[], tokens: readonly TokenSpot[] = []): boolean {
  const moving = new Set(moves.map((m) => m.id));
  const tileIds = new Set(tiles.map((t) => t.id));
  const spots = new Map(tokens.map((t) => [t.id, t]));
  const taken = occupancy(tiles.filter((t) => !moving.has(t.id)));
  for (const t of tokens) if (!moving.has(t.id)) for (const [r, c] of t.cells) taken.set(cellKey(r, c), t.id);
  const free = ([r, c]: [number, number]) => !taken.has(cellKey(r, c));
  return moves.every((m) => {
    if (tileIds.has(m.id)) return m.row >= 1 && m.col >= 1 && footprint(m.row, m.col).every(free);
    const spot = spots.get(m.id);
    const cells = spot ? spot.cells.map(([r, c]) => shiftCell(r, c, [spot.row, spot.col], [m.row, m.col])) : [[m.row, m.col] as [number, number]];
    return cells.every(([r, c]) => r >= 0 && c >= 0 && free([r, c]));
  });
}

/** Whether two tiles share at least one edge (some pair of their Fields are neighbours). */
export function tilesTouch(a: MapTile, b: MapTile): boolean {
  const cellsB = new Set(footprint(b.row, b.col).map(([r, c]) => cellKey(r, c)));
  return footprint(a.row, a.col).some(([r, c]) => neighbours(r, c).some(([nr, nc]) => cellsB.has(cellKey(nr, nc))));
}

/** Groups of tiles that touch each other; more than one group means the map falls apart. */
export function connectedGroups(tiles: MapTile[]): MapTile[][] {
  const left = new Set(tiles.map((t) => t.id));
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const groups: MapTile[][] = [];
  while (left.size) {
    const first = left.values().next().value as string;
    left.delete(first);
    const group = [byId.get(first) as MapTile];
    for (let i = 0; i < group.length; i++) {
      for (const id of [...left]) {
        const other = byId.get(id) as MapTile;
        if (tilesTouch(group[i], other)) {
          left.delete(id);
          group.push(other);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * How far a token picture reaches from its Field centre at any rotation: the
 * corner of its TOKEN_SIZE (102 px, see mapdraw) square, 51 * sqrt(2).
 */
const TOKEN_REACH = Math.ceil(51 * Math.SQRT2);

/** The pixel box around every tile image and token; a seven-Field flower looks the same after any rotation. */
export function boardBounds(tiles: MapTile[], tokens: readonly TokenSpot[] = []): Box | null {
  if (!tiles.length && !tokens.length) return null;
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const tile of tiles) {
    const c = cellCenter(tile.row, tile.col);
    box.minX = Math.min(box.minX, c.x - TILE_W / 2);
    box.maxX = Math.max(box.maxX, c.x + TILE_W / 2);
    box.minY = Math.min(box.minY, c.y - TILE_H / 2);
    box.maxY = Math.max(box.maxY, c.y + TILE_H / 2);
  }
  for (const [row, col] of tokens.flatMap((t) => t.cells)) {
    const c = cellCenter(row, col);
    box.minX = Math.min(box.minX, c.x - TOKEN_REACH);
    box.maxX = Math.max(box.maxX, c.x + TOKEN_REACH);
    box.minY = Math.min(box.minY, c.y - TOKEN_REACH);
    box.maxY = Math.max(box.maxY, c.y + TOKEN_REACH);
  }
  return box;
}

/**
 * Shifts every tile by whole rows and columns so the map starts near the
 * top-left corner. Rows move in pairs so each tile keeps its row parity.
 */
export function normalise(tiles: MapTile[], margin = 2): MapTile[] {
  if (!tiles.length) return tiles;
  const minRow = Math.min(...tiles.map((t) => t.row));
  const minCol = Math.min(...tiles.map((t) => t.col));
  const dr = Math.floor((minRow - margin) / 2) * 2;
  const dc = minCol - margin;
  if (dr === 0 && dc === 0) return tiles;
  return tiles.map((t) => ({ ...t, row: t.row - dr, col: t.col - dc }));
}
