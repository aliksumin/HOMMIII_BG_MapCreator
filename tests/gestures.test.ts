import assert from "node:assert/strict";
import { test } from "node:test";
import { pinchView, tapToPlace, touchStart, zoomAt } from "../src/lib/gestures.ts";
import { canPlace, canPlaceToken, tileBlocker, tokenBlocker } from "../src/lib/hex.ts";
import { newTile } from "../src/lib/mapfile.ts";
import { GATE, tokenCells, tokenSpot } from "../src/lib/tokens.ts";
import type { BoardToken } from "../src/model/types.ts";

const near = (a: { x: number; y: number; k: number }, b: { x: number; y: number; k: number }) => {
  for (const key of ["x", "y", "k"] as const) assert.ok(Math.abs(a[key] - b[key]) < 1e-9, `${key}: ${a[key]} != ${b[key]}`);
};

test("a finger on the empty board pans, or frames a selection with More on", () => {
  assert.equal(touchStart({ piece: false, selected: false, armed: false, adding: false }), "pan");
  assert.equal(touchStart({ piece: false, selected: false, armed: false, adding: true }), "frame");
});

test("a finger on an unselected piece waits for a hold, so a swipe over it pans", () => {
  assert.equal(touchStart({ piece: true, selected: false, armed: false, adding: false }), "hold");
  assert.equal(touchStart({ piece: true, selected: false, armed: false, adding: true }), "hold");
});

test("a finger on a selected piece moves it at once", () => {
  assert.equal(touchStart({ piece: true, selected: true, armed: false, adding: false }), "piece");
  assert.equal(touchStart({ piece: true, selected: true, armed: false, adding: true }), "piece");
});

test("while a piece waits to be placed every finger pans or taps a spot", () => {
  for (const piece of [false, true]) for (const adding of [false, true]) assert.equal(touchStart({ piece, selected: piece, armed: true, adding }), "pan");
});

test("zooming about a point keeps the board point under it in place", () => {
  const v = { x: 40, y: 30, k: 0.5 };
  const z = zoomAt(v, 200, 100, 2, 0.15, 2.5);
  assert.equal(z.k, 1);
  // board point under (200, 100) before and after
  assert.deepEqual([(200 - v.x) / v.k, (100 - v.y) / v.k], [(200 - z.x) / z.k, (100 - z.y) / z.k]);
});

test("zoom stays within its limits", () => {
  assert.equal(zoomAt({ x: 0, y: 0, k: 2 }, 0, 0, 4, 0.15, 2.5).k, 2.5);
  assert.equal(zoomAt({ x: 0, y: 0, k: 0.2 }, 0, 0, 0.1, 0.15, 2.5).k, 0.15);
});

test("two fingers moving together pan the map without zooming", () => {
  const v = { x: 10, y: 20, k: 0.6 };
  const p = pinchView(v, { x: 100, y: 100 }, { x: 200, y: 100 }, { x: 130, y: 60 }, { x: 230, y: 60 }, 0.15, 2.5);
  near(p, { x: 40, y: -20, k: 0.6 });
});

test("two fingers spreading zoom in about the point between them", () => {
  const v = { x: 10, y: 20, k: 0.5 };
  const p = pinchView(v, { x: 100, y: 100 }, { x: 200, y: 100 }, { x: 50, y: 100 }, { x: 250, y: 100 }, 0.15, 2.5);
  assert.equal(p.k, 1);
  // the midpoint (150, 100) shows the same board point before and after
  near({ x: (150 - p.x) / p.k, y: (100 - p.y) / p.k, k: 1 }, { x: (150 - v.x) / v.k, y: (100 - v.y) / v.k, k: 1 });
});

test("a pinch zooms no further than the limits and survives fingers on one spot", () => {
  const v = { x: 0, y: 0, k: 2 };
  assert.equal(pinchView(v, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }, 0.15, 2.5).k, 2.5);
  assert.equal(pinchView(v, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 50, y: 5 }, 0.15, 2.5).k, 2);
});

test("the first tap on a Field shows the piece there, a second tap on it places it", () => {
  assert.equal(tapToPlace(null, [4, 4]), "show");
  assert.equal(tapToPlace([4, 4], [4, 5]), "show");
  assert.equal(tapToPlace([4, 4], [4, 4]), "place");
});

test("a blocked tile spot names the tile or token in the way", () => {
  const f2 = newTile("F2", 4, 4);
  const token: BoardToken = { id: "tok", location: GATE, row: 4, col: 9, rotation: 0 };
  const spots = [tokenSpot(token)];
  assert.deepEqual(tileBlocker([f2], 4, 6, spots), { kind: "tile", id: f2.id });
  assert.deepEqual(tileBlocker([f2], 4, 10, spots), { kind: "token", id: "tok" });
  assert.deepEqual(tileBlocker([f2], 0, 6, spots), { kind: "edge" });
  assert.equal(tileBlocker([f2], 10, 4, spots), null);
});

test("a blocked token spot names what is in the way", () => {
  const f2 = newTile("F2", 4, 4);
  const other: BoardToken = { id: "tok", location: "obelisk", row: 8, col: 8, rotation: 0 };
  const spots = [tokenSpot(other)];
  assert.deepEqual(tokenBlocker([f2], spots, [[4, 4]]), { kind: "tile", id: f2.id });
  assert.deepEqual(tokenBlocker([f2], spots, [[8, 8]]), { kind: "token", id: "tok" });
  assert.deepEqual(tokenBlocker([f2], spots, [[-1, 3]]), { kind: "edge" });
  assert.equal(tokenBlocker([f2], spots, [[8, 2]]), null);
});

test("a spot is blocked exactly when canPlace and canPlaceToken refuse it", () => {
  const tiles = [newTile("F2", 4, 4), newTile("N3", 6, 8)];
  const spots = [tokenSpot({ id: "g", location: GATE, row: 2, col: 10, rotation: 1 })];
  for (let row = -1; row < 12; row++) {
    for (let col = -1; col < 14; col++) {
      assert.equal(tileBlocker(tiles, row, col, spots) === null, canPlace(tiles, row, col, undefined, spots), `tile at ${row}.${col}`);
      const cells = tokenCells({ location: GATE, row, col, rotation: 2 });
      assert.equal(tokenBlocker(tiles, spots, cells) === null, canPlaceToken(tiles, spots, cells), `gate at ${row}.${col}`);
    }
  }
});
