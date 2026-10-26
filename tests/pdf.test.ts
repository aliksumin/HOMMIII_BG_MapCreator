import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDocument } from "../src/lib/document.ts";
import { breakLines, type Piece, Writer } from "../src/lib/pdf.ts";
import { newScenario } from "../src/model/defaults.ts";

const word = (text: string): Piece => ({ kind: "word", text, style: "normal", size: 11, w: 10, rise: 0 });
const space: Piece = { kind: "space", w: 3 };
const br: Piece = { kind: "break", w: 0 };

/** Each line as its words, joined by spaces. */
const read = (lines: Piece[][][]) => lines.map((line) => line.map((c) => c.map((p) => (p.kind === "word" ? p.text : "")).join("")).join(" "));

test("a typed line break starts a new line even when the line has room", () => {
  assert.deepEqual(read(breakLines([word("a"), space, word("b"), br, word("c"), space, word("d")], 100)), ["a b", "c d"]);
});

test("lines still wrap at spaces on either side of a typed break", () => {
  // 23pt holds two words and the space between them
  const pieces = [word("a"), space, word("b"), space, word("c"), br, word("d"), space, word("e"), space, word("f")];
  assert.deepEqual(read(breakLines(pieces, 23)), ["a b", "c", "d e", "f"]);
});

/** A jsPDF stand-in that records where each piece of text is drawn; every word is 5pt a letter. */
function recorder() {
  const drawn: { text: string; x: number; y: number }[] = [];
  const pdf = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "text") return (text: string, x: number, y: number) => drawn.push({ text, x, y });
        if (key === "getTextWidth") return (text: string) => text.length * 5;
        return () => undefined;
      },
    },
  );
  const writer = new Writer(pdf as never, { glyphs: new Map(), background: "", heading: "", bullet: "", icon: null });
  const at = (text: string) => {
    const found = drawn.find((d) => d.text === text);
    assert.ok(found, `${text} was not drawn`);
    return found;
  };
  return { writer, at };
}

test("the PDF sets a line break one line down and a new paragraph one line plus the paragraph gap down", () => {
  const s = newScenario("coops");
  s.victory = "Alpha\nBeta\n\nGamma";
  s.rules = ["Delta\nEpsilon"];
  const { writer, at } = recorder();
  writer.blocks(buildDocument(s).body);
  const line = 14; // 11pt type on 14pt leading
  const gap = 11 * 0.48;
  assert.ok(Math.abs(at("Beta").y - at("Alpha").y - line) < 1e-9);
  assert.ok(Math.abs(at("Gamma").y - at("Beta").y - (line + gap)) < 1e-9);
  assert.equal(at("Beta").x, at("Alpha").x);
  // the second line of a list item stays indented under the first
  assert.ok(Math.abs(at("Epsilon").y - at("Delta").y - line) < 1e-9);
  assert.equal(at("Epsilon").x, at("Delta").x);
});
