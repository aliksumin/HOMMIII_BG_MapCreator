import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeMap, encodeMap, newTile } from "../src/lib/mapfile.ts";

// The first tiles of the mission book file assets/map-files/sentinels.map.
const SENTINELS =
  "eJy11LGKHDEMBuB3cT0CWbJlezvLsiFNmpTHFcllIQtHBjZ7XBHy7vGGGViOlLu4mmFgPvT/8tNvd17f3YEW97K+uoP3izt9dwcnvTBrbECJDDymCNzMQ2ZfEmbOfUS3uMvp9fjp+v1nnE8vb9+Ov9zhCZeb87y4H8fz+p/X5/Xy9XJaf7oD/lk2SPwIsdoUE1bAniaEbZIKIqShpMSd46BbyLgTJG2QsjnaaBlVI5BvDYZQBsuVQU3i6KEz5XLr+HInR94HQhtkdC5FpQLVwFCMECxUBCKfs1Go0eQRENkhYYP4nqWN0mcxOkKQLKCcPQy1WQ+fJbI8MhkvO8QEa+MBvheBJrMiTH02xriIMWpUe0RXywZJe1VDabXSHIigQfIZQTHKjIc05rk5FusjBuJxnwhuEo4c+jWQ3igBRcswgiL0qIk6JS5BHyLhj5KYas4dCWqyCiIcAMUGqNrQ0Ybqv3/fPZt9beLmoNpaTaXCIK+zoteUwrxVpBJVrn0mpPd0PP8Fj6JZKQ==";

test("reads a mission book .map file", () => {
  const tiles = decodeMap(SENTINELS);
  assert.equal(tiles.length, 10);
  assert.deepEqual(
    tiles.slice(0, 3).map((t) => [t.tileId, t.row, t.col]),
    [
      ["N0", 2, 11],
      ["F0", 5, 11],
      ["S0", 7, 9],
    ],
  );
  // old files write 0 for "no hero" and lack newer fields
  assert.deepEqual(tiles[0].hero, ["", "", "", "", "", "", ""]);
  assert.deepEqual(tiles[0].blockedHex, [false, false, false, false, false, false, false]);
});

test("round-trips through encode and decode", () => {
  const tile = newTile("F3", 6, 9);
  tile.rotation = 4;
  tile.cubes[2] = 3;
  tile.hero[3] = "CATHERINE";
  const again = decodeMap(encodeMap([tile]));
  assert.deepEqual(again, [tile]);
});

test("rejects text that is not a map", () => {
  assert.throws(() => decodeMap("hello"), /not a map file/);
});