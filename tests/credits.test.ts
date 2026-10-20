import assert from "node:assert/strict";
import { test } from "node:test";
import { submitGuide } from "../src/lib/bundle.ts";
import { CC_BY_NC_SA, CC_BY_NC_SA_URL, creditsMarkdown, PDF_CREDIT } from "../src/lib/credits.ts";
import { newScenario } from "../src/model/defaults.ts";

test("the PDF credit names the CC art, its license and the map art", () => {
  for (const part of ["Fan-Made Mission Book", "Rewritten Rule Book", CC_BY_NC_SA, CC_BY_NC_SA_URL, "Archon Studio", "non-commercial"]) {
    assert.ok(PDF_CREDIT.includes(part), part);
  }
});

test("CREDITS.md credits the PDF art under CC and the map images to Archon Studio", () => {
  const md = creditsMarkdown("lost_tower");
  assert.match(md, /`lost_tower\.pdf`[\s\S]*Mission Book[\s\S]*CC BY-NC-SA 4\.0/);
  assert.match(md, /map images[\s\S]*Archon Studio/);
  assert.ok(md.includes(CC_BY_NC_SA_URL));
});

test("the submit guide points to CREDITS.md", () => {
  const s = newScenario("clash");
  s.name = "Lost Tower";
  assert.ok(submitGuide(s).includes("CREDITS.md"));
});
