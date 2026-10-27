import assert from "node:assert/strict";
import { test } from "node:test";
import { barEdge, sameAgain, screenBox, selectionName } from "../src/lib/actionbar.ts";
import { newTile } from "../src/lib/mapfile.ts";
import { GATE } from "../src/lib/tokens.ts";
import type { BoardToken } from "../src/model/types.ts";

const token = (location: string, rotation = 0): BoardToken => ({ id: `t-${location}`, location, row: 4, col: 4, rotation });

test("the selection is named in words for the bar's label", () => {
  assert.equal(selectionName(1, 0), "1 tile");
  assert.equal(selectionName(3, 0), "3 tiles");
  assert.equal(selectionName(0, 1), "1 token");
  assert.equal(selectionName(2, 1), "2 tiles and 1 token");
});

test("Same again holds the same tile, or the same token turned the same way", () => {
  assert.deepEqual(sameAgain([newTile("S1", 2, 2)], []), { kind: "tile", id: "S1" });
  assert.deepEqual(sameAgain([], [token(GATE, 2)]), { kind: "token", id: GATE, turn: 2 });
});

test("Same again is left out for a group", () => {
  assert.equal(sameAgain([], []), null);
  assert.equal(sameAgain([newTile("S1", 2, 2), newTile("F1", 2, 6)], []), null);
  assert.equal(sameAgain([newTile("S1", 2, 2)], [token(GATE)]), null);
});

test("a board box shows on screen through the pan and zoom", () => {
  assert.deepEqual(screenBox({ minX: 100, minY: 50, maxX: 300, maxY: 250 }, { x: 20, y: -10, k: 0.5 }), {
    minX: 70,
    minY: 15,
    maxX: 170,
    maxY: 115,
  });
});

const board = { width: 340, height: 500 };
const bar = { width: 300, height: 56 };

test("the bar sits at the bottom when nothing is under it", () => {
  assert.equal(barEdge(null, board, bar, 10), "bottom");
  assert.equal(barEdge({ minX: 100, minY: 100, maxX: 240, maxY: 300 }, board, bar, 10), "bottom");
  // beside the bar, not under it
  assert.equal(barEdge({ minX: 0, minY: 400, maxX: 15, maxY: 500 }, board, bar, 10), "bottom");
});

test("the bar moves to the top when it would cover the selection at the bottom", () => {
  assert.equal(barEdge({ minX: 100, minY: 380, maxX: 240, maxY: 480 }, board, bar, 10), "top");
});

test("the bar stays at the bottom when the selection fills the board", () => {
  // as much of the selection is under the bar at either edge
  assert.equal(barEdge({ minX: -50, minY: -50, maxX: 400, maxY: 600 }, board, bar, 10), "bottom");
  // a tall selection that reaches higher up than down: the top is worse
  assert.equal(barEdge({ minX: 100, minY: 0, maxX: 240, maxY: 450 }, board, bar, 10), "bottom");
});
