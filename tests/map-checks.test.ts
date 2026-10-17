import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { CREATURE_BANKS, TILES } from "../src/data/catalog.ts";
import { duplicateTiles } from "../src/lib/document.ts";
import { newTile } from "../src/lib/mapfile.ts";

test("duplicateTiles reports printed tiles placed twice, not face-down ones", () => {
  assert.ok(TILES.N15 && TILES.N14);
  const tiles = [newTile("N15", 0, 0), newTile("N15", 0, 3), newTile("N15", 3, 0), newTile("N14", 3, 3), newTile("N0", 6, 0), newTile("N0", 6, 3)];
  assert.deepEqual([...duplicateTiles(tiles)], [["N15", 3]]);
  assert.equal(duplicateTiles(tiles.slice(3)).size, 0);
});

test("every Creature Bank of the Naval Battles Mission Book can be placed", () => {
  const names = Object.values(CREATURE_BANKS).map((b) => b.desc);
  for (const name of [
    "Derelict Ship",
    "Pyramid",
    "Shipwreck",
    "Dragon Fly Hive",
    "Medusa Stores",
    "Dwarven Treasury",
    "Griffin Conservatory",
    "Naga Bank",
    "Crypt",
    "Imp Cache",
    "Cyclops Stockpile",
    "Dragon Utopia",
    "Random (Near)",
    "Random (Far)",
  ]) {
    assert.ok(names.includes(name), `${name} is missing`);
  }
  for (const bank of Object.values(CREATURE_BANKS)) {
    assert.ok(existsSync(new URL(`../public/${bank.img}`, import.meta.url)), `${bank.img} is missing`);
  }
});
