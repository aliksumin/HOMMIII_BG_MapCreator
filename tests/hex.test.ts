import assert from "node:assert/strict";
import { test } from "node:test";
import { canPlace, cellKey, connectedGroups, fieldCell, footprint, neighbours, pixelToCell, cellCenter } from "../src/lib/hex.ts";
import { newTile } from "../src/lib/mapfile.ts";

test("neighbours follow the map editor offsets", () => {
  assert.deepEqual(neighbours(8, 12), [
    [7, 12],
    [8, 13],
    [9, 12],
    [9, 11],
    [8, 11],
    [7, 11],
  ]);
  assert.deepEqual(neighbours(7, 9), [
    [6, 10],
    [7, 10],
    [8, 10],
    [8, 9],
    [7, 8],
    [6, 9],
  ]);
});

test("the two Starting tiles of Sentinels sit side by side without overlap", () => {
  const a = newTile("S0", 7, 9);
  const b = newTile("S0", 8, 12);
  const cellsA = new Set(footprint(a.row, a.col).map(([r, c]) => cellKey(r, c)));
  assert.ok(footprint(b.row, b.col).every(([r, c]) => !cellsA.has(cellKey(r, c))));
  assert.equal(connectedGroups([a, b]).length, 1);
  assert.equal(canPlace([a], 8, 12), true);
  assert.equal(canPlace([a], 8, 10), false);
});

test("rotation moves Field 1 clockwise round the middle", () => {
  const tile = newTile("F1", 8, 12);
  assert.deepEqual(fieldCell(tile, 1), [7, 12]);
  tile.rotation = 1;
  assert.deepEqual(fieldCell(tile, 1), [8, 13]);
  assert.deepEqual(fieldCell(tile, 3), [8, 12]);
});

test("pixelToCell inverts cellCenter", () => {
  for (const [r, c] of [
    [3, 4],
    [4, 4],
    [10, 7],
  ]) {
    const p = cellCenter(r, c);
    assert.deepEqual(pixelToCell(p.x + 5, p.y - 7), [r, c]);
  }
});