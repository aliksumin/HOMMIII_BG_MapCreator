import assert from "node:assert/strict";
import { test } from "node:test";
import { cellKey, fieldCell, neighbours } from "../src/lib/hex.ts";
import { boardTokenOverlays } from "../src/lib/mapdraw.ts";
import { newTile } from "../src/lib/mapfile.ts";
import { GATE, GATE_SURFACE, GATE_UNDERGROUND, gateHalves, mergeGateHalves, orientGates, tokenCells } from "../src/lib/tokens.ts";
import type { BoardToken } from "../src/model/types.ts";

const S = GATE_SURFACE;
const U = GATE_UNDERGROUND;

test("Gate halves on neighbouring Fields turn to face each other, as published maps draw them", () => {
  // the surface half on Field 6 of a tile, the underground half on Field 1 of the tile below it
  const surface = newTile("N0", 6, 10);
  surface.mapLocations[6] = S;
  const underground = newTile("NU0", 9, 10);
  underground.mapLocations[1] = U;
  assert.ok(neighbours(...fieldCell(surface, 6)).some(([r, c]) => cellKey(r, c) === cellKey(...fieldCell(underground, 1))));
  orientGates([surface, underground]);
  assert.equal(surface.fieldReplacementRotations[6], 4);
  assert.equal(underground.fieldReplacementRotations[1], 4);
});

test("the turn a Gate half keeps is relative to its tile", () => {
  // the same board Field as above, reached through Field 4 of a tile turned once
  const surface = newTile("N0", 6, 10);
  surface.rotation = 1;
  surface.mapLocations[4] = S;
  const underground = newTile("NU0", 9, 10);
  underground.mapLocations[1] = U;
  orientGates([surface, underground]);
  assert.equal((surface.fieldReplacementRotations[4] + surface.rotation) % 6, 4);
  assert.equal(underground.fieldReplacementRotations[1], 4);
});

test("Gate halves pair up so that as many Gates as possible are whole", () => {
  // the underground half on Field 0 touches both surface halves, the one on Field 4 only the half on Field 1
  const t = newTile("N0", 8, 12);
  t.mapLocations[0] = U;
  t.mapLocations[1] = S;
  t.mapLocations[2] = S;
  t.mapLocations[4] = U;
  const { pairs, unpaired } = gateHalves([t]);
  assert.equal(pairs.length, 2);
  assert.deepEqual(unpaired, []);
  assert.deepEqual(pairs.map((p) => [p.underground.field, p.surface.field]).sort(), [
    [0, 2],
    [4, 1],
  ]);
});

test("a half with no other half next to it stays unpaired and keeps its turn", () => {
  const t = newTile("N0", 8, 12);
  t.mapLocations[0] = U;
  t.mapLocations[6] = S;
  t.fieldReplacementRotations[0] = 3;
  const { pairs, unpaired } = gateHalves([t]);
  assert.equal(pairs.length, 0);
  assert.deepEqual(unpaired.map((h) => h.field).sort(), [0, 6]);
  orientGates([t]);
  assert.equal(t.fieldReplacementRotations[0], 3);
});

test("a whole Gate covers its Field and the Field of its surface half", () => {
  const gate: BoardToken = { id: "g", location: GATE, row: 4, col: 10, rotation: 0 };
  assert.deepEqual(tokenCells(gate), [
    [4, 10],
    [4, 11],
  ]);
  assert.deepEqual(tokenCells({ ...gate, rotation: 3 }), [
    [4, 10],
    [4, 9],
  ]);
  assert.deepEqual(tokenCells({ ...gate, location: "whirlpool-plus1" }), [[4, 10]]);
});

test("a whole Gate is drawn as both halves, turned together", () => {
  const overlays = boardTokenOverlays([{ id: "g", location: GATE, row: 4, col: 10, rotation: 2 }]);
  assert.equal(overlays.length, 2);
  assert.ok(overlays.every((o) => o.kind === "token" && o.rotation === 120));
  assert.ok(overlays[0].kind === "token" && overlays[0].url.includes("underground"));
  assert.ok(overlays[1].kind === "token" && overlays[1].url.includes("surface"));
});

test("Gate halves beside the tiles from older projects become whole Gates", () => {
  const u: BoardToken = { id: "u", location: U, row: 4, col: 10, rotation: 0 };
  const s: BoardToken = { id: "s", location: S, row: 4, col: 11, rotation: 2 };
  const w: BoardToken = { id: "w", location: "whirlpool-plus1", row: 2, col: 2, rotation: 0 };
  const merged = mergeGateHalves([], [u, s, w]);
  assert.equal(merged.length, 2);
  const gate = merged.find((t) => t.location === GATE);
  assert.ok(gate);
  assert.deepEqual(tokenCells(gate), [
    [4, 10],
    [4, 11],
  ]);

  // a lone surface half keeps its Field and gets the underground half beside it
  const lone = mergeGateHalves([], [s]);
  assert.equal(lone.length, 1);
  assert.equal(lone[0].location, GATE);
  assert.deepEqual(tokenCells(lone[0])[1], [4, 11]);

  // nothing to merge: the same list comes back
  const plain = [w];
  assert.equal(mergeGateHalves([], plain), plain);
});

test("a lone half is made whole on a side no tile covers", () => {
  const tile = newTile("N0", 4, 13); // covers (4, 12), right of the half
  const merged = mergeGateHalves([tile], [{ id: "u", location: U, row: 4, col: 11, rotation: 0 }]);
  const cells = tokenCells(merged[0]);
  assert.deepEqual(cells[0], [4, 11]);
  assert.notDeepEqual(cells[1], [4, 12]);
});
