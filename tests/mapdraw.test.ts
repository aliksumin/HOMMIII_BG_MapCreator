import assert from "node:assert/strict";
import { test } from "node:test";
import { fitContain, TOKEN_SIZE, tileOverlays } from "../src/lib/mapdraw.ts";
import { newTile } from "../src/lib/mapfile.ts";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test("fitContain keeps the proportions of the picture inside the box", () => {
  const square = fitContain(150, 150, TOKEN_SIZE);
  close(square.w, TOKEN_SIZE);
  close(square.h, TOKEN_SIZE);
  const whirlpool = fitContain(200, 173, TOKEN_SIZE);
  close(whirlpool.w, TOKEN_SIZE);
  assert.ok(Math.abs(whirlpool.w / whirlpool.h - 200 / 173) < 1e-9);
  const monolith = fitContain(200, 231, TOKEN_SIZE);
  close(monolith.h, TOKEN_SIZE);
  assert.ok(Math.abs(monolith.w / monolith.h - 200 / 231) < 1e-9);
  assert.deepEqual(fitContain(0, 0, TOKEN_SIZE), { w: TOKEN_SIZE, h: TOKEN_SIZE });
});

test("a Whirlpool token is turned 30 degrees more than other tokens", () => {
  const tile = newTile("F0", 4, 4);
  tile.mapLocations[3] = "whirlpool-plus1";
  tile.mapLocations[1] = "monolith-2w-01a";
  tile.fieldReplacementRotations[3] = 1;
  tile.rotation = 2;
  const tokens = tileOverlays(tile).filter((o) => o.kind === "token");
  const rotations = tokens.map((o) => (o.kind === "token" ? o.rotation : NaN));
  assert.deepEqual(rotations.sort((a, b) => a - b), [120, 210]);
});
