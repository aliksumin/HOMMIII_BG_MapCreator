import assert from "node:assert/strict";
import { test } from "node:test";
import { paragraphs, parseInline, plain } from "../src/lib/markup.ts";

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

test("a newline breaks the line, and bold and italics carry on over it", () => {
  assert.deepEqual(parseInline("**one\ntwo** and *three\nfour*"), [
    { t: "text", s: "one", b: true },
    { t: "br" },
    { t: "text", s: "two", b: true },
    { t: "text", s: " and " },
    { t: "text", s: "three", i: true },
    { t: "br" },
    { t: "text", s: "four", i: true },
  ]);
});

test("glyphs, quotes and dashes work on both sides of a line break", () => {
  assert.deepEqual(parseInline('Gain 2 :gold:\n"Run" -- now'), [
    { t: "text", s: "Gain 2\u00a0" },
    { t: "glyph", name: "gold" },
    { t: "br" },
    { t: "text", s: "\u201cRun\u201d \u2013 now" },
  ]);
});

test("line breaks lose the spaces around them, never double up and never open or close the text", () => {
  assert.deepEqual(parseInline("\n  a  \r\n\n  \n  **b** \n"), [{ t: "text", s: "a" }, { t: "br" }, { t: "text", s: "b", b: true }]);
  assert.equal(plain(parseInline("a\nb")), "a\nb");
});

test("a blank line separates paragraphs; a single newline stays inside its paragraph", () => {
  assert.deepEqual(paragraphs("one\n  two  \n \t\nthree\r\n\r\n\n\nfour"), ["one\ntwo", "three", "four"]);
  assert.deepEqual(paragraphs("  \n\n"), []);
});
