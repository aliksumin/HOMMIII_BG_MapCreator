// Location tokens beyond one Field. The Subterranean Gate is one token over
// two Fields: on tiles the .map file stores it as two halves, one on a Field
// of each tile, while beside the tiles it stays whole.

import { MAP_LOCATIONS } from "../data/catalog.ts";
import type { BoardToken, MapTile } from "../model/types.ts";
import { cellKey, fieldCell, neighbours, occupancy, type TokenSpot } from "./hex.ts";

/** The whole Subterranean Gate, as a token beside the tiles. */
export const GATE = "subterranean-gate";
export const GATE_NAME = "Subterranean Gate";
export const GATE_SURFACE = "subterranean-gate-surface";
export const GATE_UNDERGROUND = "subterranean-gate-underground";

export const isGateHalf = (location: string): boolean => location === GATE_SURFACE || location === GATE_UNDERGROUND;

/** The name of a token beside the tiles. */
export function boardTokenName(location: string): string {
  return location === GATE ? GATE_NAME : (MAP_LOCATIONS[location]?.desc ?? location);
}

/**
 * The turn (steps of 60 degrees clockwise) that makes a Gate half face its
 * other half on side `sideToOther` (0 = upper-right, clockwise). Unturned,
 * the Gate lies flat with the underground half on the left and the surface
 * half on the right, as published maps draw it, so a half turned r steps
 * meets its other half on side (1 + r) mod 6 (underground) or (4 + r) mod 6
 * (surface).
 */
export function gateTurn(half: string, sideToOther: number): number {
  return (sideToOther + (half === GATE_UNDERGROUND ? 5 : 2)) % 6;
}

/**
 * The Fields a token beside the tiles covers. A whole Gate has its
 * underground half at (row, col) and the surface half on side
 * (1 + rotation) mod 6 of it.
 */
export function tokenCells(t: Pick<BoardToken, "location" | "row" | "col" | "rotation">): [number, number][] {
  if (t.location !== GATE) return [[t.row, t.col]];
  return [[t.row, t.col], neighbours(t.row, t.col)[(1 + t.rotation) % 6]];
}

export const tokenSpot = (t: BoardToken): TokenSpot => ({ id: t.id, row: t.row, col: t.col, cells: tokenCells(t) });

/** A Gate half on one Field of a tile. */
export interface GateHalf {
  tile: MapTile;
  field: number;
  half: string;
  cell: [number, number];
}

/**
 * Pairs underground halves with surface halves on neighbouring Fields, as
 * many as possible (augmenting paths), so one half next to two others never
 * leaves a third without its partner. `side` is where the surface half lies
 * seen from the underground one.
 */
function matchHalves(undergrounds: [number, number][], surfaces: [number, number][]): { u: number; s: number; side: number }[] {
  const at = new Map(surfaces.map((cell, i) => [cellKey(...cell), i]));
  const near = undergrounds.map((cell) =>
    neighbours(...cell).flatMap(([r, c], side) => {
      const s = at.get(cellKey(r, c));
      return s === undefined ? [] : [{ s, side }];
    }),
  );
  const owner = new Map<number, number>();
  const claim = (u: number, seen: Set<number>): boolean => {
    for (const { s } of near[u]) {
      if (seen.has(s)) continue;
      seen.add(s);
      const other = owner.get(s);
      if (other === undefined || claim(other, seen)) {
        owner.set(s, u);
        return true;
      }
    }
    return false;
  };
  undergrounds.forEach((_, u) => claim(u, new Set()));
  return [...owner].map(([s, u]) => ({ u, s, side: near[u].find((n) => n.s === s)?.side ?? 0 }));
}

/**
 * The Gate halves on the tiles, matched into Gates: an underground and a
 * surface half on neighbouring Fields, each half in one Gate at most.
 * `side` is where the surface half lies seen from the underground one.
 */
export function gateHalves(tiles: MapTile[]): { pairs: { underground: GateHalf; surface: GateHalf; side: number }[]; unpaired: GateHalf[] } {
  const halves: GateHalf[] = [];
  for (const tile of tiles) {
    tile.mapLocations.forEach((half, field) => {
      if (isGateHalf(half)) halves.push({ tile, field, half, cell: fieldCell(tile, field) });
    });
  }
  const undergrounds = halves.filter((h) => h.half === GATE_UNDERGROUND);
  const surfaces = halves.filter((h) => h.half === GATE_SURFACE);
  const pairs = matchHalves(
    undergrounds.map((h) => h.cell),
    surfaces.map((h) => h.cell),
  ).map(({ u, s, side }) => ({ underground: undergrounds[u], surface: surfaces[s], side }));
  const paired = new Set(pairs.flatMap((p) => [p.underground, p.surface]));
  return { pairs, unpaired: halves.filter((h) => !paired.has(h)) };
}

/** Turns each Gate half on the tiles that has its other half next to it to face that half (stored per Field, as the .map file keeps it). */
export function orientGates(tiles: MapTile[]): void {
  const turn = (h: GateHalf, world: number) => {
    const local = (world - h.tile.rotation + 6) % 6;
    if (h.tile.fieldReplacementRotations[h.field] !== local) h.tile.fieldReplacementRotations[h.field] = local;
  };
  for (const { underground, surface, side } of gateHalves(tiles).pairs) {
    turn(underground, gateTurn(GATE_UNDERGROUND, side));
    turn(surface, gateTurn(GATE_SURFACE, (side + 3) % 6));
  }
}

/** Sides tried, in order, when a lone Gate half is made whole: the right first, as the Gate lies unturned. */
const SIDE_ORDER = [1, 0, 2, 3, 4, 5];

/** How many Fields to search, outwards, for room for a lone half's Gate (far more than any board holds). */
const SEARCH_LIMIT = 100_000;

/**
 * A whole Gate for a lone half: on the half's own Field with the other half
 * on a free side, or, with no room there, on the nearest two free Fields side
 * by side, so it never covers a tile or another token.
 */
function wholeGate(h: BoardToken, free: (cell: [number, number]) => boolean): BoardToken {
  const freeSide = (cell: [number, number]) => SIDE_ORDER.find((i) => free(neighbours(...cell)[i]));
  const side = freeSide([h.row, h.col]);
  if (side !== undefined && free([h.row, h.col])) {
    // the underground half stays put with the surface half on `side`, or the
    // surface half stays put and the underground half goes on `side` of it
    const [r, c] = neighbours(h.row, h.col)[side];
    return h.location === GATE_UNDERGROUND
      ? { ...h, location: GATE, rotation: (side + 5) % 6 }
      : { ...h, location: GATE, row: r, col: c, rotation: (side + 2) % 6 };
  }
  const seen = new Set([cellKey(h.row, h.col)]);
  const queue: [number, number][] = [[h.row, h.col]];
  for (let i = 0; i < queue.length && i < SEARCH_LIMIT; i++) {
    const cell = queue[i];
    const s = free(cell) ? freeSide(cell) : undefined;
    if (s !== undefined) return { ...h, location: GATE, row: cell[0], col: cell[1], rotation: (s + 5) % 6 };
    for (const next of neighbours(...cell)) {
      if (next[0] < 0 || next[1] < 0 || seen.has(cellKey(...next))) continue;
      seen.add(cellKey(...next));
      queue.push(next);
    }
  }
  return { ...h, location: GATE };
}

/**
 * Tokens beside the tiles with the Gate halves of older projects made whole:
 * underground and surface halves on neighbouring Fields become Gates (matched
 * like the halves on tiles), and each lone half gets its other half on a free
 * neighbouring Field, or moves with it to the nearest free pair of Fields.
 */
export function mergeGateHalves(tiles: MapTile[], tokens: BoardToken[]): BoardToken[] {
  if (!tokens.some((t) => isGateHalf(t.location))) return tokens;
  const out = tokens.filter((t) => !isGateHalf(t.location));
  const undergrounds = tokens.filter((t) => t.location === GATE_UNDERGROUND);
  const surfaces = tokens.filter((t) => t.location === GATE_SURFACE);
  const pairs = matchHalves(
    undergrounds.map((t): [number, number] => [t.row, t.col]),
    surfaces.map((t): [number, number] => [t.row, t.col]),
  );
  for (const { u, side } of pairs) out.push({ ...undergrounds[u], location: GATE, rotation: (side + 5) % 6 });

  const paired = new Set(pairs.flatMap(({ u, s }) => [undergrounds[u].id, surfaces[s].id]));
  const lone = tokens.filter((t) => isGateHalf(t.location) && !paired.has(t.id));
  const taken = new Set([
    ...occupancy(tiles).keys(),
    ...out.flatMap((t) => tokenCells(t).map(([r, c]) => cellKey(r, c))),
    ...lone.map((t) => cellKey(t.row, t.col)),
  ]);
  const free = ([r, c]: [number, number]) => r >= 0 && c >= 0 && !taken.has(cellKey(r, c));
  for (const h of lone) {
    taken.delete(cellKey(h.row, h.col));
    const gate = wholeGate(h, free);
    for (const [r, c] of tokenCells(gate)) taken.add(cellKey(r, c));
    out.push(gate);
  }
  return out;
}
