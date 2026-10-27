// The floating action bar over the map: what it offers for the selected
// tiles and tokens, and which edge of the board it sits on.

import type { BoardToken, MapTile } from "../model/types.ts";
import type { Box } from "./hex.ts";

/** A tile or token for the palette to hold ready again (the shape of Board's Armed). */
export interface Again {
  kind: "tile" | "token";
  id: string;
  turn?: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The board's pan and zoom: board pixel p shows at screen pixel p * k + (x, y). */
export interface View {
  x: number;
  y: number;
  k: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "2 tiles and 1 token": the selection in words. */
export function selectionName(tiles: number, tokens: number): string {
  return [tiles && plural(tiles, "tile"), tokens && plural(tokens, "token")].filter(Boolean).join(" and ");
}

/** "Same again" for one selected tile or token: the same tile, or the same token turned the same way. A group has none. */
export function sameAgain(tiles: readonly MapTile[], tokens: readonly BoardToken[]): Again | null {
  if (tiles.length + tokens.length !== 1) return null;
  if (tiles.length) return { kind: "tile", id: tiles[0].tileId };
  return { kind: "token", id: tokens[0].location, turn: tokens[0].rotation };
}

/** Where a box on the board shows inside the board element. */
export function screenBox(box: Box, view: View): Box {
  return {
    minX: box.minX * view.k + view.x,
    maxX: box.maxX * view.k + view.x,
    minY: box.minY * view.k + view.y,
    maxY: box.maxY * view.k + view.y,
  };
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));

/**
 * The edge the bar sits on, centred: the bottom, in thumb reach, unless it
 * covers more of the selection there than it would at the top.
 */
export function barEdge(selection: Box | null, board: Size, bar: Size, margin: number): "bottom" | "top" {
  if (!selection) return "bottom";
  const minX = (board.width - bar.width) / 2;
  const at = (minY: number): Box => ({ minX, maxX: minX + bar.width, minY, maxY: minY + bar.height });
  const below = overlap(selection, at(board.height - margin - bar.height));
  return below > 0 && overlap(selection, at(margin)) < below ? "top" : "bottom";
}
