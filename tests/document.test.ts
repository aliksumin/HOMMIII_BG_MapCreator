import assert from "node:assert/strict";
import { test } from "node:test";
import { type Block, buildDocument } from "../src/lib/document.ts";
import type { Inline } from "../src/lib/markup.ts";
import { newScenario } from "../src/model/defaults.ts";

const br: Inline = { t: "br" };
const text = (s: string, style: { b?: boolean; i?: boolean } = {}): Inline => ({ t: "text", s, ...style });

/** The blocks after a heading, up to the next one. */
function section(blocks: Block[], heading: string): Block[] {
  const at = blocks.findIndex((b) => b.k === "heading" && b.text === heading);
  assert.ok(at >= 0, `no ${heading} heading`);
  const end = blocks.findIndex((b, i) => i > at && b.k === "heading");
  return blocks.slice(at + 1, end < 0 ? undefined : end);
}

test("Enter starts a new paragraph block and Shift+Enter breaks the line inside it", () => {
  const s = newScenario("coops");
  s.victory = "Win the battle.\nThen hold the Town.\n\nOr capture every Mine.";
  assert.deepEqual(section(buildDocument(s).body, "Victory Conditions"), [
    { k: "para", runs: [text("Win the battle."), br, text("Then hold the Town.")] },
    { k: "para", runs: [text("Or capture every Mine.")] },
  ]);
});

test("the flavor text keeps its paragraphs and line breaks, all in italics", () => {
  const s = newScenario("coops");
  s.lore = "First line\nsecond *line*\n\nSecond paragraph";
  const lore = buildDocument(s).body.filter((b) => b.k === "para").slice(0, 2);
  assert.deepEqual(lore, [
    { k: "para", runs: [text("First line", { i: true }), br, text("second ", { i: true }), text("line")] },
    { k: "para", runs: [text("Second paragraph", { i: true })] },
  ]);
});

test("a field keeps its first paragraph on the label's line and sets later ones apart", () => {
  const s = newScenario("campaigns");
  s.aiHero.army = "A Pack of Skeletons\nA Few Liches\n\nShe never retreats.";
  s.storyBook.specialTiles = [{ id: "t", title: "F5 Garden", text: "Read §2.\nThen rest.\n\nOnce per game." }];
  const doc = buildDocument(s);
  assert.deepEqual(section(doc.body, "AI Hero Setup"), [
    { k: "field", label: "Enemy Army", runs: [text("A Pack of Skeletons"), br, text("A Few Liches")] },
    { k: "para", runs: [text("She never retreats.")] },
  ]);
  assert.deepEqual(section(doc.story, "Special Tiles"), [
    { k: "field", label: "F5 Garden", runs: [text("Read §2."), br, text("Then rest.")] },
    { k: "para", runs: [text("Once per game.")] },
  ]);
});

test("a list item holds no paragraphs: every break in it is one line break", () => {
  const s = newScenario("coops");
  s.rules = ["One rule\nwith a second line", "Blank\n\n  lines fold into one break  "];
  assert.deepEqual(section(buildDocument(s).body, "Additional Rules"), [
    {
      k: "list",
      items: [
        [text("One rule"), br, text("with a second line")],
        [text("Blank"), br, text("lines fold into one break")],
      ],
    },
  ]);
});
