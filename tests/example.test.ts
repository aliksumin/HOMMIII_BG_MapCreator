import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GLYPHS } from "../src/data/catalog.ts";
import { parseProject } from "../src/lib/bundle.ts";
import { mapFiles } from "../src/lib/document.ts";
import { scenarioToLatex } from "../src/lib/latex.ts";
import { lintScenario } from "../src/lib/lint.ts";
import { decodeMap, encodeMap } from "../src/lib/mapfile.ts";
import { setKnownGlyphs } from "../src/lib/markup.ts";

// The template scenario under examples/ was built and exported with the app.
// These tests keep it openable, clean and consistent with its exported files.
const DIR = new URL("../examples/template-scenario/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, DIR), "utf8");
const SLUG = "lanterns_over_the_mistfall_marches";

setKnownGlyphs(GLYPHS);

function template() {
  return parseProject(read(`${SLUG}.scenario.json`));
}

test("the template project file opens and passes the checklist", () => {
  const s = template();
  assert.equal(s.category, "campaigns");
  assert.deepEqual(lintScenario(s), []);
});

test("the template fills every step of the editor", () => {
  const s = template();
  assert.ok(s.name && s.author && s.sourceUrl && s.kindOverride && s.rating && s.titleLines === 2);
  assert.equal(s.titleImage?.kind, "upload");
  assert.ok(s.lore && s.story);
  assert.ok(s.rounds && s.roundsNote && s.playerCounts.length > 1);
  assert.ok(s.startingUnits.length && s.buildings.length && s.tilePool.enabled && s.bonus.options.length > 1);
  assert.ok(s.aiHero.enabled && s.aiHero.army && s.heroesPlacement);
  assert.ok(s.victory && s.defeat && s.rules.length && s.customSections.length > 1);
  assert.ok(s.timedEvents.some((e) => e.rounds.length > 1));
  assert.ok(s.mapSetup.extra.length && Object.values(s.mapSetup.notes).some(Boolean));
  assert.ok(s.maps.length > 1 && s.maps.every((m) => m.playerCounts.length));
});

test("the template map layouts place every kind of map element", () => {
  const tiles = template().maps.flatMap((m) => m.tiles);
  const used = (pick: (t: (typeof tiles)[number]) => unknown[]) => tiles.some((t) => pick(t).some(Boolean));
  assert.ok(tiles.some((t) => t.tileId.endsWith("0")), "face-down tiles");
  assert.ok(tiles.some((t) => !t.tileId.endsWith("0")), "printed tiles");
  assert.ok(tiles.some((t) => t.faction), "faction border");
  assert.ok(tiles.some((t) => t.rotation > 0), "rotated tile");
  assert.ok(tiles.some((t) => t.suggestedPlacement), "suggested placement");
  assert.ok(used((t) => t.cubes), "cubes");
  assert.ok(used((t) => t.hero), "heroes");
  assert.ok(used((t) => t.mapLocations), "location tokens");
  assert.ok(used((t) => t.creaturebanks), "creature banks");
  assert.ok(used((t) => t.blockedHex), "blocked fields");
  assert.ok(used((t) => t.fieldReplacementRotations), "rotated tokens");
});

test("the exported files match what the app writes from the project file", () => {
  const s = template();
  assert.equal(scenarioToLatex(s), read(`${SLUG}.tex`));
  for (const map of mapFiles(s)) {
    const text = read(`assets/map-files/${map.file}.map`);
    assert.equal(`${encodeMap(map.layout.tiles)}\n`, text);
    assert.equal(decodeMap(text).length, map.layout.tiles.length);
  }
});
