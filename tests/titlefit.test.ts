import assert from "node:assert/strict";
import { test } from "node:test";
import { fitTitle, wrapTitle } from "../src/lib/titlefit.ts";

// Every character is 0.7em wide, spaces included.
const measure = (text: string, size: number) => text.length * size * 0.7;

test("a short title keeps the book's 31pt size on one line", () => {
  assert.deepEqual(fitTitle("Monk's Retreat", 1, 395, measure), { size: 31, lines: ["MONK'S RETREAT"] });
});

test("a long one-line title shrinks until it fits the width", () => {
  const { size, lines } = fitTitle("Lanterns over the Mistfall Marches", 1, 395, measure);
  assert.equal(lines.length, 1);
  assert.ok(measure(lines[0], size) <= 395);
  assert.ok(measure(lines[0], size + 1) > 395, "one point larger would not fit");
});

test("a two-line title starts at 26pt and breaks at a space", () => {
  const { size, lines } = fitTitle("Lanterns over the Mistfall Marches", 2, 395, measure);
  assert.equal(size, 26);
  assert.deepEqual(lines, ["LANTERNS OVER THE", "MISTFALL MARCHES"]);
});

test("the size never drops below 12pt", () => {
  assert.equal(fitTitle("x".repeat(200), 1, 395, measure).size, 12);
});

test("a word wider than the line gets a line of its own", () => {
  assert.deepEqual(wrapTitle("A WIDEWORD B", 10, 30, measure), ["A", "WIDEWORD", "B"]);
});
