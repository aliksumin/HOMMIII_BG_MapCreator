import assert from "node:assert/strict";
import { test } from "node:test";
import { submitGuide, texPath } from "../src/lib/bundle.ts";
import { buildDocument } from "../src/lib/document.ts";
import { scenarioToLatex } from "../src/lib/latex.ts";
import { lintScenario } from "../src/lib/lint.ts";
import { newTile } from "../src/lib/mapfile.ts";
import { moveParagraph, paragraphRefs, removeParagraph } from "../src/lib/storybook.ts";
import { newScenario } from "../src/model/defaults.ts";

function solo() {
  const s = newScenario("solo");
  s.name = "Island of Fire";
  s.victory = "Win Combat at every Creature Bank on the map.";
  s.maps[0].tiles = [newTile("S0", 7, 9)];
  s.storyBook.locations = [{ id: "l1", title: "Water Wheel", text: "On your first visit, read §1." }];
  s.storyBook.specialTiles = [{ id: "t1", title: "F5 Mystical Garden", text: "On your first visit, read §3." }];
  s.storyBook.paragraphs = [
    { id: "p1", text: "If you help the peasants, read §2. Otherwise, read §3." },
    { id: "p2", text: "Grateful, they collect a gift for you." },
    { id: "p3", text: "The peasants are unhappy. Go back to §1." },
  ];
  return s;
}

test("a Solo Scenario is for one player and exports to its own folder", () => {
  const s = solo();
  assert.deepEqual(s.playerCounts, [1]);
  assert.equal(buildDocument(s).kind, "Solo Scenario");
  assert.equal(texPath(s), "draft-scenarios/solo/island_of_fire.tex");
  const guide = submitGuide(s);
  assert.ok(guide.includes(String.raw`\def\solopath{solo}`));
  assert.ok(guide.includes(String.raw`\input{\solopath/island_of_fire.tex}`));
});

test("the story book prints after the map with numbered paragraphs", () => {
  const tex = scenarioToLatex(solo());
  const story = tex.slice(tex.indexOf(String.raw`\newpage`));
  const order = ["Story Locations", "Water Wheel", "Special Tiles", "Paragraphs"];
  let at = -1;
  for (const text of order) {
    const next = story.indexOf(text);
    assert.ok(next > at, `${text} out of order`);
    at = next;
  }
  assert.ok(story.includes(String.raw`\textbf{F5 Mystical Garden:} On your first visit, read \S{}3.`));
  assert.ok(story.includes(String.raw`\textbf{\S{}2}` + "\n\nGrateful, they collect a gift for you."));
});

test("moving a paragraph keeps every reference on the same text", () => {
  const s = solo();
  moveParagraph(s, 2, 0); // the third paragraph becomes the first
  assert.deepEqual(
    s.storyBook.paragraphs.map((p) => p.id),
    ["p3", "p1", "p2"],
  );
  assert.equal(s.storyBook.locations[0].text, "On your first visit, read §2.");
  assert.equal(s.storyBook.specialTiles[0].text, "On your first visit, read §1.");
  assert.equal(s.storyBook.paragraphs[1].text, "If you help the peasants, read §3. Otherwise, read §1.");
  assert.equal(s.storyBook.paragraphs[0].text, "The peasants are unhappy. Go back to §2.");
});

test("removing a paragraph renumbers later ones and flags references to it", () => {
  const s = solo();
  s.rules = ["When you enter a location, read §3 first."];
  removeParagraph(s, 1);
  assert.equal(s.storyBook.paragraphs[0].text, "If you help the peasants, read §?. Otherwise, read §2.");
  assert.equal(s.rules[0], "When you enter a location, read §2 first.");
  assert.equal(s.storyBook.specialTiles[0].text, "On your first visit, read §2.");
  const errors = lintScenario(s).filter((f) => f.step === "story" && f.level === "error");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /removed paragraph/);
});

test("the checklist catches missing and unreachable paragraphs", () => {
  const s = solo();
  s.storyBook.paragraphs[2].text = "The end. See §9.";
  s.storyBook.locations[0].text = "Nothing happens.";
  const found = lintScenario(s).filter((f) => f.step === "story");
  assert.ok(found.some((f) => f.level === "error" && f.message.includes("§9")));
  assert.ok(found.some((f) => f.level === "warning" && f.message.includes("Nothing leads to paragraph §1")));
  assert.equal(paragraphRefs(s).get(3), 2);
});
