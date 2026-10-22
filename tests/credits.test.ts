import assert from "node:assert/strict";
import { test } from "node:test";
import { submitGuide } from "../src/lib/bundle.ts";
import { artUse, CC_BY_NC_SA, CC_BY_NC_SA_URL, creditsMarkdown, pdfCredit } from "../src/lib/credits.ts";
import { BASE_TILE } from "../src/lib/mapfile.ts";
import { newMapLayout, newScenario } from "../src/model/defaults.ts";

const plain = { uploadedTitle: false, creatureBanks: false };
const both = { uploadedTitle: true, creatureBanks: true };

test("the PDF credit names the CC art, its license and the map art", () => {
  const credit = pdfCredit(plain);
  for (const part of ["Fan-Made Mission Book", "Rewritten Rule Book", CC_BY_NC_SA, CC_BY_NC_SA_URL, "Archon Studio", "non-commercial"]) {
    assert.ok(credit.includes(part), part);
  }
  assert.ok(credit.includes("and title image"));
  assert.ok(!credit.includes("Creature Bank"));
});

test("an uploaded title image and Creature Banks are credited apart from the game art", () => {
  const credit = pdfCredit(both);
  assert.ok(!credit.includes("and title image"));
  assert.ok(credit.includes("Title image: the author's own."));
  assert.ok(credit.includes("Creature Bank tokens: drawn by the HoMM3 BG Scenario Creator."));

  const md = creditsMarkdown("lost_tower", both);
  assert.match(md, /\*\*The title image\*\*.*`assets\/images\/lost_tower\.png`/);
  assert.match(md, /\*\*Creature Bank tokens\*\*[\s\S]*not game art/);
  assert.doesNotMatch(md, /and the title image/);
});

test("CREDITS.md credits the PDF art under CC and the map images to Archon Studio", () => {
  const md = creditsMarkdown("lost_tower", plain);
  assert.match(md, /`lost_tower\.pdf`[\s\S]*and the title image[\s\S]*Mission Book[\s\S]*CC BY-NC-SA 4\.0/);
  assert.match(md, /map images[\s\S]*Archon Studio/);
  assert.ok(md.includes(CC_BY_NC_SA_URL));
  assert.doesNotMatch(md, /Creature Bank|The title image/);
});

test("artUse reads the title image kind and the Creature Banks on the maps", () => {
  const s = newScenario("clash");
  assert.deepEqual(artUse(s), plain);
  s.titleImage = { kind: "upload", dataUrl: "data:image/png;base64," } as typeof s.titleImage;
  const layout = newMapLayout();
  layout.tiles.push({ ...structuredClone(BASE_TILE), id: "t1", creaturebanks: ["", "", "", "", "", "", "x"] });
  s.maps = [layout];
  assert.deepEqual(artUse(s), both);
});

test("the submit guide points to CREDITS.md", () => {
  const s = newScenario("clash");
  s.name = "Lost Tower";
  assert.ok(submitGuide(s).includes("CREDITS.md"));
});
