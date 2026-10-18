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
  const at = new Map(surfaces.map((s, i) => [cellKey(...s.cell), i]));
  const near = undergrounds.map((u) =>
    neighbours(...u.cell).flatMap(([r, c], side) => {
      const i = at.get(cellKey(r, c));
      return i === undefined ? [] : [{ i, side }];
    }),
  );

  // A matching with as many Gates as possible (augmenting paths), so one
  // half next to two others never leaves a third half without its partner.
  const owner = new Map<number, number>();
  const claim = (u: number, seen: Set<number>): boolean => {
    for (const { i } of near[u]) {
      if (seen.has(i)) continue;
      seen.add(i);
      const other = owner.get(i);
      if (other === undefined || claim(other, seen)) {
        owner.set(i, u);
        return true;
      }
    }
    return false;
  };
  undergrounds.forEach((_, u) => claim(u, new Set()));

  const pairs = [...owner].map(([i, u]) => ({
    underground: undergrounds[u],
    surface: surfaces[i],
    side: near[u].find((n) => n.i === i)?.side ?? 0,
  }));
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

/**
 * Tokens beside the tiles with the Gate halves of older projects made whole:
 * an underground and a surface half on neighbouring Fields become one Gate,
 * and a lone half gets its other half on a free neighbouring Field.
 */
export function mergeGateHalves(tiles: MapTile[], tokens: BoardToken[]): BoardToken[] {
  if (!tokens.some((t) => isGateHalf(t.location))) return tokens;
  const out = tokens.filter((t) => !isGateHalf(t.location));
  const surfaces = tokens.filter((t) => t.location === GATE_SURFACE);
  const used = new Set<string>();
  for (const u of tokens.filter((t) => t.location === GATE_UNDERGROUND)) {
    const side = neighbours(u.row, u.col).findIndex(([r, c]) => surfaces.some((s) => !used.has(s.id) && s.row === r && s.col === c));
    if (side < 0) continue;
    const [r, c] = neighbours(u.row, u.col)[side];
    const s = surfaces.find((x) => !used.has(x.id) && x.row === r && x.col === c) as BoardToken;
    used.add(u.id).add(s.id);
    out.push({ ...u, location: GATE, rotation: (side + 5) % 6 });
  }

  const lone = tokens.filter((t) => isGateHalf(t.location) && !used.has(t.id));
  const taken = new Set([
    ...occupancy(tiles).keys(),
    ...out.flatMap((t) => tokenCells(t).map(([r, c]) => cellKey(r, c))),
    ...lone.map((t) => cellKey(t.row, t.col)),
  ]);
  for (const h of lone) {
    const around = neighbours(h.row, h.col);
    const side = SIDE_ORDER.find((i) => around[i][0] >= 0 && around[i][1] >= 0 && !taken.has(cellKey(...around[i]))) ?? 1;
    const [r, c] = around[side];
    taken.add(cellKey(r, c));
    // the underground half stays put with the surface half on `side`, or the
    // surface half stays put and the underground half goes on `side` of it
    out.push(
      h.location === GATE_UNDERGROUND
        ? { ...h, location: GATE, rotation: (side + 5) % 6 }
        : { ...h, location: GATE, row: r, col: c, rotation: (side + 2) % 6 },
    );
  }
  return out;
}
