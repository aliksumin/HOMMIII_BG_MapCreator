import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canPlace,
  boardBounds,
  canPlaceGroup,
  canPlaceToken,
  cellKey,
  connectedGroups,
  fieldCell,
  footprint,
  neighbours,
  pixelToCell,
  cellCenter,
  shiftCell,
  tilesTouch,
} from "../src/lib/hex.ts";
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

test("a group shifted by an odd number of rows keeps its shape", () => {
  const a = newTile("S0", 7, 9);
  const b = newTile("S0", 8, 12);
  const touching = (x: [number, number], y: [number, number]) => tilesTouch({ ...a, row: x[0], col: x[1] }, { ...b, row: y[0], col: y[1] });
  for (const to of [
    [8, 9],
    [9, 10],
    [12, 4],
    [7, 9],
  ] as [number, number][]) {
    const movedA = shiftCell(a.row, a.col, [a.row, a.col], to);
    const movedB = shiftCell(b.row, b.col, [a.row, a.col], to);
    assert.deepEqual(movedA, to);
    const gap = cellCenter(movedB[0], movedB[1]).x - cellCenter(movedA[0], movedA[1]).x;
    assert.equal(gap, cellCenter(8, 12).x - cellCenter(7, 9).x);
    assert.equal(movedB[0] - movedA[0], 1);
    assert.ok(touching(movedA, movedB));
  }
});

test("a group may move onto its own old Fields but not onto other tiles", () => {
  const a = newTile("S0", 7, 9);
  const b = newTile("S0", 8, 12);
  const c = newTile("F1", 10, 7);
  const tiles = [a, b, c];
  const move = (to: [number, number]) =>
    [a, b].map((t) => {
      const [row, col] = shiftCell(t.row, t.col, [a.row, a.col], to);
      return { id: t.id, row, col };
    });
  assert.equal(canPlaceGroup(tiles, move([7, 10])), true);
  assert.equal(canPlaceGroup(tiles, move([9, 8])), false);
  assert.equal(canPlaceGroup(tiles, move([0, 9])), false);
});

/** A token beside the tiles over the given Fields, the first being where it stands. */
const spot = (id: string, cells: [number, number][]) => ({ id, row: cells[0][0], col: cells[0][1], cells });

test("a Location token sits only on Fields no tile covers and no token holds", () => {
  const a = newTile("S0", 8, 12);
  const token = spot("t1", [[8, 14]]);
  assert.equal(canPlaceToken([a], [], [[8, 13]]), false);
  assert.equal(canPlaceToken([a], [], [[8, 14]]), true);
  assert.equal(canPlaceToken([a], [token], [[8, 14]]), false);
  assert.equal(canPlaceToken([a], [token], [[8, 14]], "t1"), true);
  assert.equal(canPlaceToken([a], [], [[-1, 3]]), false);
  // a token over two Fields needs both of them free
  assert.equal(
    canPlaceToken(
      [a],
      [],
      [
        [8, 14],
        [8, 13],
      ],
    ),
    false,
  );
  assert.equal(
    canPlaceToken(
      [a],
      [],
      [
        [8, 14],
        [8, 15],
      ],
    ),
    true,
  );
  assert.equal(canPlace([a], 8, 15, undefined, [token]), false);
  assert.equal(canPlace([a], 8, 15), true);
  const gate = spot("g", [
    [8, 18],
    [8, 17],
  ]);
  assert.equal(canPlace([a], 8, 16, undefined, [gate]), false);
  assert.equal(canPlace([a], 8, 16), true);
});

test("tokens move along with a group but block tiles that stay put", () => {
  const a = newTile("S0", 8, 12);
  const b = newTile("F1", 8, 17);
  const token = spot("t1", [[8, 14]]);
  // the token alone may not move onto a tile
  assert.equal(canPlaceGroup([a, b], [{ id: "t1", row: 8, col: 16 }], [token]), false);
  // tile a moving onto the token's Field is blocked unless the token moves too
  const shifted = (p: { row: number; col: number }) => shiftCell(p.row, p.col, [8, 12], [8, 13]);
  const moveA = { id: a.id, row: 8, col: 13 };
  assert.equal(canPlaceGroup([a, b], [moveA], [token]), false);
  const [tr, tc] = shifted(token);
  assert.equal(canPlaceGroup([a, b], [moveA, { id: "t1", row: tr, col: tc }], [token]), true);
});

test("a token over two Fields moves whole: both Fields must land free", () => {
  const b = newTile("F1", 8, 17);
  const gate = spot("g", [
    [4, 10],
    [4, 11],
  ]);
  assert.equal(canPlaceGroup([b], [{ id: "g", row: 8, col: 14 }], [gate]), true);
  // its second Field would land on (8, 16), under tile b
  assert.equal(canPlaceGroup([b], [{ id: "g", row: 8, col: 15 }], [gate]), false);
});

test("the board box takes in tokens beside the tiles", () => {
  const a = newTile("S0", 8, 12);
  const tilesOnly = boardBounds([a]);
  const withToken = boardBounds([a], [spot("t1", [[8, 15]])]);
  const withGate = boardBounds(
    [a],
    [
      spot("g", [
        [8, 15],
        [8, 16],
      ]),
    ],
  );
  assert.ok(withGate && withGate.maxX >= cellCenter(8, 16).x + 51 * Math.SQRT2);
  assert.ok(tilesOnly && withToken);
  assert.ok(withToken.maxX > tilesOnly.maxX);
  // room for the token picture turned to any angle
  assert.ok(withToken.maxX >= cellCenter(8, 15).x + 51 * Math.SQRT2);
  assert.equal(withToken.minX, tilesOnly.minX);
  assert.equal(boardBounds([], []), null);
});
