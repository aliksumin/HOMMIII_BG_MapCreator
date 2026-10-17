import assert from "node:assert/strict";
import { test } from "node:test";
import { TILES } from "../src/data/catalog.ts";
import { cellKey, fieldCell, footprint, neighbours } from "../src/lib/hex.ts";
import { tokenFindings } from "../src/lib/lint.ts";
import { newTile } from "../src/lib/mapfile.ts";
import type { BoardToken, MapLayout, MapTile } from "../src/model/types.ts";

const layout = (...tiles: MapTile[]): MapLayout => ({ id: "m", name: "Test", playerCounts: [], caption: "", tiles, tokens: [] });

/** A Location token on an empty Field beside the tiles. */
const beside = (location: string, row: number, col: number): BoardToken => ({ id: `b-${row}-${col}`, location, row, col, rotation: 0 });

/** An empty Field next to Field `field` of a tile, for a token beside the tiles. */
function freeNeighbour(t: MapTile, field: number): [number, number] {
  const taken = new Set(footprint(t.row, t.col).map(([r, c]) => cellKey(r, c)));
  const free = neighbours(...fieldCell(t, field)).find(([r, c]) => !taken.has(cellKey(r, c)));
  if (!free) throw new Error("no free neighbour");
  return free;
}

/** A tile with Map Location tokens on the given Fields. */
function tile(tileId: string, row: number, col: number, tokens: Record<number, string> = {}): MapTile {
  const t = newTile(tileId, row, col);
  for (const [field, token] of Object.entries(tokens)) t.mapLocations[Number(field)] = token;
  return t;
}

/** A tile with a Creature Bank on one Field. */
function bank(tileId: string, field: number): MapTile {
  const t = newTile(tileId, 2, 2);
  t.creaturebanks[field] = "CB1";
  return t;
}

const adjacent = (a: MapTile, fa: number, b: MapTile, fb: number) =>
  neighbours(...fieldCell(a, fa)).some(([r, c]) => cellKey(r, c) === cellKey(...fieldCell(b, fb)));

// Two unrotated tiles side by side: Field 4 (east) of the left one touches Field 2 (west) of the right one.
const LEFT: [number, number] = [2, 2];
const RIGHT: [number, number] = [2, 5];

test("a Subterranean Gate with both halves on neighbouring Fields is fine", () => {
  const surface = tile("N7", ...LEFT, { 4: "subterranean-gate-surface" });
  const underground = tile("U1", ...RIGHT, { 2: "subterranean-gate-underground" });
  assert.ok(adjacent(surface, 4, underground, 2));
  assert.deepEqual(tokenFindings(layout(surface, underground)), []);
});

test("a face-down Subterranean Tile counts as Subterranean", () => {
  const surface = tile("N7", ...LEFT, { 4: "subterranean-gate-surface" });
  const underground = tile("NU0", ...RIGHT, { 2: "subterranean-gate-underground" });
  assert.deepEqual(tokenFindings(layout(surface, underground)), []);
});

test("half a Subterranean Gate is reported", () => {
  const found = tokenFindings(layout(tile("N7", ...LEFT, { 4: "subterranean-gate-surface" }), tile("U1", ...RIGHT)));
  assert.equal(found.length, 2);
  assert.match(found[0], /^Map "Test" has a Subterranean Gate on Near Tile N7 with no underground half/);
  assert.match(found[1], /1 surface and 0 underground halves/);
});

test("Subterranean Gate halves that do not touch are reported", () => {
  const surface = tile("N7", ...LEFT, { 4: "subterranean-gate-surface" });
  const underground = tile("U1", ...RIGHT, { 4: "subterranean-gate-underground" });
  assert.ok(!adjacent(surface, 4, underground, 4));
  const found = tokenFindings(layout(surface, underground));
  assert.equal(found.length, 2);
  assert.match(found[0], /no underground half on a neighbouring Subterranean Tile/);
  assert.match(found[1], /Subterranean Tile U1 with no surface half next to it/);
});

test("Subterranean Gate halves on the wrong kind of Tile are reported", () => {
  const surface = tile("U1", ...LEFT, { 4: "subterranean-gate-surface" });
  const underground = tile("N7", ...RIGHT, { 2: "subterranean-gate-underground" });
  const found = tokenFindings(layout(surface, underground));
  assert.equal(found.length, 2);
  assert.match(found[0], /surface half of a Subterranean Gate on Subterranean Tile U1, which is a Subterranean Tile/);
  assert.match(found[1], /underground half of a Subterranean Gate on Near Tile N7, which is not a Subterranean Tile/);
});

test("one Whirlpool leads nowhere, two are fine", () => {
  const one = tokenFindings(layout(tile("W1", ...LEFT, { 0: "whirlpool-plus1" })));
  assert.deepEqual(one, ['Map "Test" has a single Whirlpool (on Water Near Tile W1), which leads nowhere: place at least two.']);
  assert.deepEqual(tokenFindings(layout(tile("W1", ...LEFT, { 0: "whirlpool-plus1" }), tile("W2", ...RIGHT, { 1: "whirlpool-minus1" }))), []);
});

test("Monoliths need their partner", () => {
  assert.deepEqual(tokenFindings(layout(tile("N7", ...LEFT, { 0: "monolith-2w-01a" }), tile("N8", ...RIGHT, { 1: "monolith-2w-01b" }))), []);
  assert.deepEqual(tokenFindings(layout(tile("N7", ...LEFT, { 0: "monolith-1w-02-in", 1: "monolith-1w-02-out" }))), []);
  assert.deepEqual(tokenFindings(layout(tile("N7", ...LEFT, { 0: "monolith-2w-01a", 1: "monolith-1w-03-out" }))), [
    'Map "Test" has Monolith 2W 01A on Near Tile N7 without its partner Monolith 2W 01B.',
    'Map "Test" has Monolith 1W 03 Exit on Near Tile N7 without its partner Monolith 1W 03 Entrance.',
  ]);
});

test("a Creature Bank on a Water or Subterranean Tile belongs on its Blocked Field", () => {
  assert.equal(TILES.W1.blocked[5], 1);
  assert.equal(TILES.U1.blocked[6], 1);
  assert.deepEqual(tokenFindings(layout(bank("W1", 5))), []);
  assert.deepEqual(tokenFindings(layout(bank("U1", 6))), []);
  assert.deepEqual(tokenFindings(layout(bank("W1", 2))), [
    "Map \"Test\" has the Creature Bank Derelict Ship on Water Near Tile W1 off the Tile's Blocked Field.",
  ]);
  assert.equal(tokenFindings(layout(bank("U1", 0))).length, 1);
});

test("Creature Banks are not checked on land Tiles or Tiles without a known Blocked Field", () => {
  assert.equal(TILES.N7.blocked.length, 6);
  assert.ok(!TILES.W2.blocked.some(Boolean));
  assert.deepEqual(tokenFindings(layout(bank("N7", 0))), []);
  assert.deepEqual(tokenFindings(layout(bank("W2", 0))), []);
  assert.deepEqual(tokenFindings(layout(bank("NU0", 0))), []);
});

test("tokens beside the tiles count toward Whirlpool, Monolith and Gate pairs", () => {
  const monolith = tile("N7", ...LEFT, { 0: "monolith-2w-01a" });
  assert.deepEqual(tokenFindings({ ...layout(monolith), tokens: [beside("monolith-2w-01b", 8, 8)] }), []);

  const lone = tokenFindings({ ...layout(tile("N7", ...LEFT)), tokens: [beside("whirlpool-plus1", 8, 8)] });
  assert.deepEqual(lone, ['Map "Test" has a single Whirlpool (beside the tiles), which leads nowhere: place at least two.']);

  const surface = tile("N7", ...LEFT, { 4: "subterranean-gate-surface" });
  const [r, c] = freeNeighbour(surface, 4);
  assert.deepEqual(tokenFindings({ ...layout(surface), tokens: [beside("subterranean-gate-underground", r, c)] }), []);
  assert.equal(tokenFindings({ ...layout(tile("N7", ...LEFT)), tokens: [beside("subterranean-gate-surface", 8, 8)] }).length, 1);
});
