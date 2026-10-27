import assert from "node:assert/strict";
import { test } from "node:test";
import { breakLine, itemDepths, itemPrefix, nestedDepth } from "../src/lib/markup.ts";

// ---- the line-break button: Shift+Enter for touch screens ----

test("the line-break button puts one newline at the caret and the caret after it", () => {
  assert.deepEqual(breakLine("Roll twice", 4), { value: "Roll\n twice", caret: 5 });
  assert.deepEqual(breakLine("", 0), { value: "\n", caret: 1 });
  assert.deepEqual(breakLine("end", 3), { value: "end\n", caret: 4 });
});

test("the line-break button replaces a selection, as typing does", () => {
  assert.deepEqual(breakLine("one, two", 3, 5), { value: "one\ntwo", caret: 4 });
});

test("after text the button adds one newline, where Enter's new paragraph adds a blank line", () => {
  assert.equal(breakLine("first line", 10).value, "first line\n");
  // two presses make the blank line of a paragraph
  assert.equal(breakLine(breakLine("ab", 1).value, 2).value, "a\n\nb");
});

// ---- the nesting buttons: Tab and Shift+Tab for touch screens ----

const list = (...depths: number[]) => depths.map((d, i) => `${itemPrefix(d, false)}item ${i + 1}`);

test("depths are as the list prints them: never more than one level below the item before", () => {
  assert.deepEqual(itemDepths(list(0, 1, 2, 0)), [0, 1, 2, 0]);
  // typed too deep: the first item is always top level, and a jump of two levels counts as one
  assert.deepEqual(itemDepths(list(2, 2)), [0, 1]);
  assert.deepEqual(itemDepths(list(0, 2)), [0, 1]);
  assert.deepEqual(itemDepths([]), []);
});

test("the first item can neither nest nor un-nest", () => {
  const d = itemDepths(list(0, 0));
  assert.equal(nestedDepth(d, 0, 1), null);
  assert.equal(nestedDepth(d, 0, -1), null);
});

test("an item nests at most one level below the item before it, and no deeper than the book goes", () => {
  const d = itemDepths(list(0, 0, 1, 2, 1));
  assert.equal(nestedDepth(d, 1, 1), 1);
  assert.equal(nestedDepth(d, 2, 1), null, "already one level below the item before");
  assert.equal(nestedDepth(d, 3, 1), null, "MAX_DEPTH");
  assert.equal(nestedDepth(d, 4, 1), 2);
});

test("un-nesting moves one level back and stops at the top level", () => {
  const d = itemDepths(list(0, 1, 2));
  assert.equal(nestedDepth(d, 2, -1), 1);
  assert.equal(nestedDepth(d, 1, -1), 0);
  assert.equal(nestedDepth(itemDepths(list(0, 0)), 1, -1), null);
});
