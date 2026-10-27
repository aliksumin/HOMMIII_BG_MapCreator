// Fingers on the map: what one finger starts, how two fingers pan and zoom,
// and the two taps that place a tile or token on a touch screen.

import type { View } from "./actionbar.ts";
import type { Point } from "./hex.ts";

/** How far a finger may wander, in screen pixels, and still count as a tap. */
export const TOUCH_SLOP = 10;
/** How long a finger rests on an unselected tile or token before it picks it up, in milliseconds. */
export const HOLD_MS = 350;

/** What one finger starts: a pan, a wait to see whether it holds a piece, a piece drag or a selection frame. */
export type TouchStart = "pan" | "hold" | "piece" | "frame";

/**
 * What one finger starts on the board. A swipe pans, so a finger that lands
 * on a tile or token moves it only when it is selected already, or after a
 * hold. While a piece waits to be placed every finger pans or taps a spot.
 * With "More" on, a swipe over the empty board draws a selection frame.
 */
export function touchStart(on: { piece: boolean; selected: boolean; armed: boolean; adding: boolean }): TouchStart {
  if (on.armed) return "pan";
  if (on.piece) return on.selected ? "piece" : "hold";
  return on.adding ? "frame" : "pan";
}

/** The view zoomed by `factor` about the screen point (px, py), within the zoom limits. */
export function zoomAt(v: View, px: number, py: number, factor: number, minK: number, maxK: number): View {
  const k = Math.max(minK, Math.min(maxK, v.k * factor));
  return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
}

const middle = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * The view after two fingers moved from (a0, b0) to (a1, b1), in screen
 * pixels inside the board: the zoom follows their spread, and the board point
 * that lay between them stays between them.
 */
export function pinchView(start: View, a0: Point, b0: Point, a1: Point, b1: Point, minK: number, maxK: number): View {
  const spread0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const spread1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const k = Math.max(minK, Math.min(maxK, spread0 > 0 ? (start.k * spread1) / spread0 : start.k));
  const m0 = middle(a0, b0);
  const m1 = middle(a1, b1);
  const bx = (m0.x - start.x) / start.k;
  const by = (m0.y - start.y) / start.k;
  return { k, x: m1.x - bx * k, y: m1.y - by * k };
}

/** A tap while placing on a touch screen: the first tap on a Field shows the piece there, a second tap on the same Field places it. */
export function tapToPlace(shown: readonly [number, number] | null, cell: readonly [number, number]): "show" | "place" {
  return shown && shown[0] === cell[0] && shown[1] === cell[1] ? "place" : "show";
}
