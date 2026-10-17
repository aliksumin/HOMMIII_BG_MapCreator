import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInline, plain } from "../src/lib/markup.ts";

test("*italic* and **bold** toggle their own runs", () => {
  assert.deepEqual(parseInline("a *b* **c** d"), [
    { t: "text", s: "a " },
    { t: "text", s: "b", i: true },
    { t: "text", s: " " },
    { t: "text", s: "c", b: true },
    { t: "text", s: " d" },
  ]);
});

test("a lone * before a space stays literal", () => {
  assert.equal(plain(parseInline("2 * 3")), "2 * 3");
});

test("*emphasis* inside italic base text turns italics off and closes cleanly", () => {
  // Flavor text is italic as a whole; the closing * before a space used to print as a literal *.
  assert.deepEqual(parseInline("with *far too many eyes* is walking", { i: true }), [
    { t: "text", s: "with ", i: true },
    { t: "text", s: "far too many eyes" },
    { t: "text", s: " is walking", i: true },
  ]);
});
