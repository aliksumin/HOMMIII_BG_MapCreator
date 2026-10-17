import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GLYPHS, tileGroup } from "../src/data/catalog.ts";
import { parseProject } from "../src/lib/bundle.ts";
import { mapFiles } from "../src/lib/document.ts";
import { cellKey, fieldCell, neighbours } from "../src/lib/hex.ts";
import { scenarioToLatex } from "../src/lib/latex.ts";
import { lintScenario } from "../src/lib/lint.ts";
import { decodeMap, encodeMap } from "../src/lib/mapfile.ts";
import { setKnownGlyphs } from "../src/lib/markup.ts";
import { copyScenario } from "../src/model/defaults.ts";

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
  assert.ok(!tiles.some((t) => t.tileId === "S0"), "the Factions are fixed, so their printed Starting Tiles are used");
  assert.ok(tiles.some((t) => t.rotation > 0), "rotated tile");
  assert.ok(tiles.some((t) => t.suggestedPlacement), "suggested placement");
  assert.ok(used((t) => t.cubes), "cubes");
  assert.ok(used((t) => t.hero), "heroes");
  assert.ok(used((t) => t.mapLocations), "location tokens");
  assert.ok(used((t) => t.creaturebanks), "creature banks");
  assert.ok(used((t) => t.blockedHex), "blocked fields");
  assert.ok(used((t) => t.fieldReplacementRotations), "rotated tokens");
});

test("the template map tokens are placed the way the rules allow", () => {
  for (const layout of template().maps) {
    const placed = (pick: (id: string) => boolean) =>
      layout.tiles.flatMap((tile) => tile.mapLocations.flatMap((id, f) => (pick(id) ? [{ id, tile, cell: fieldCell(tile, f) }] : [])));
    // A Subterranean Gate is one token on two Fields: one on a surface Tile, the other next to it on a Subterranean Tile.
    const surface = placed((id) => id === "subterranean-gate-surface");
    const underground = placed((id) => id === "subterranean-gate-underground");
    assert.equal(surface.length, underground.length, `${layout.name}: every Gate has both halves`);
    for (const half of surface) {
      assert.notEqual(tileGroup(half.tile.tileId), "subterranean", `${layout.name}: a Gate's surface half lies on a surface Tile`);
      const next = new Set(neighbours(...half.cell).map(([r, c]) => cellKey(r, c)));
      assert.ok(
        underground.some((u) => tileGroup(u.tile.tileId) === "subterranean" && next.has(cellKey(...u.cell))),
        `${layout.name}: a Gate's underground half lies next to its surface half, on a Subterranean Tile`,
      );
    }
    // A Whirlpool or a Monolith sends the Hero to its partner, so none of them stands alone.
    assert.notEqual(placed((id) => id.startsWith("whirlpool-")).length, 1, `${layout.name}: a lone Whirlpool leads nowhere`);
    const monoliths = new Set(placed((id) => id.startsWith("monolith-")).map((m) => m.id));
    const ends: Record<string, string> = { a: "b", b: "a", "-in": "-out", "-out": "-in" };
    const partner = (id: string) => id.replace(/a$|b$|-in$|-out$/, (end) => ends[end] ?? end);
    for (const id of monoliths) assert.ok(monoliths.has(partner(id)), `${layout.name}: ${id} has no partner`);
  }
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

test("opening the template makes an independent project, so edits are never overwritten by a second opening", () => {
  const original = template();
  const copy = copyScenario(original);
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.id, copyScenario(original).id);
  assert.deepEqual({ ...copy, id: "", updatedAt: "" }, { ...original, id: "", updatedAt: "" });
  copy.maps[0].tiles.length = 0;
  assert.ok(original.maps[0].tiles.length > 0);
});
