import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { GLYPHS } from "../src/data/catalog.ts";
import { YELLOW_GLYPHS } from "../src/data/game.ts";
import { parseProject, projectJson } from "../src/lib/bundle.ts";
import { buildDocument } from "../src/lib/document.ts";
import { scenarioToLatex, tableToLatex } from "../src/lib/latex.ts";
import { capsFindings, lintScenario, tableFindings } from "../src/lib/lint.ts";
import { setKnownGlyphs } from "../src/lib/markup.ts";
import { Writer } from "../src/lib/pdf.ts";
import { aiSetupRow, bookTable, cellHeight, cellRuns, DICE_KEYS, diceRows, newTable, parseUnits, tableDoc, unitString } from "../src/lib/tables.ts";
import { newScenario, upgradeScenario } from "../src/model/defaults.ts";
import type { RulesTable, Scenario, TablePreset } from "../src/model/types.ts";

setKnownGlyphs(GLYPHS);

const GOLDEN = new URL("./golden/tables/", import.meta.url);

/** One filled table per preset, shaped like the tables published scenarios use (the text is made up). */
function presetTable(preset: TablePreset): RulesTable {
  const t = newTable(preset);
  t.id = `t-${preset}`;
  switch (preset) {
    case "difficulty":
      t.title = "Marauder Warbands";
      t.rows = [
        ["Opening raid", "1 :bronze:", "2 :bronze:", "1 :bronze: 1 :silver:", "2 :bronze: 1 :silver:"],
        ["Second raid", "2 :bronze:", "1 :bronze: 1 :silver:", "2 :silver:", "1 :bronze: 2 :silver:"],
        ["Keep Garrison", "2 :bronze: 1 :silver: 1 :golden:", "2 :silver: 2 :golden:", "4 :golden:", "2 :silver: 2 :golden: 1 :azure:\nAfter that\n1 :golden:"],
      ];
      break;
    case "lookup":
      t.title = "Weather Omens";
      t.rows = DICE_KEYS.slice(0, 3).map((key, i) => [
        key,
        ["Low Clouds -- :unit_flying: Units cannot fly this Round.", "Hailstorm -- every Unit outside a Town loses 1 :initiative:.", "Calm -- nothing happens."][i],
      ]);
      break;
    case "settings":
      t.columns = ["Difficulty", "Changes to the Siege Waves"];
      t.rows = [
        ["Easy", "Each Siege Wave has one Unit fewer."],
        ["Normal", "No Change"],
        ["Hard", "From the 5th Round on, the strongest Unit of each Siege Wave starts Combat with one extra :attack: Token."],
        ["Impossible", "Every Siege Wave gains one :silver: Unit of its Faction."],
      ];
      break;
    case "aiSetup":
      t.rows = [
        ["Fortress Vanguard #1", '"Few" Gorgons\n"Pack" of Lizardmen\n"Pack" of Gnolls', "2 × Might :might: Card\n2 × Magic :magic: Card", "Helm of the Swamp *(Top effect)*"],
        ["Fortress Rearguard", '"Few" Wyverns\n"Pack" of Basilisks', "4 × Might :might: Card", "Archery *(Expert effect)*"],
      ];
      break;
    case "grid":
      t.title = "Tribute by variant";
      t.columns = ["Round", "Solo", "1v1", "2v2"];
      t.rows = [
        ["3rd", "10 :gold:", "8 :gold:", "16 :gold:"],
        ["6th", "25 :gold:", "20 :gold:", "40 :gold:"],
        ["10th", "45 :gold:", "--", "--"],
      ];
      break;
  }
  return t;
}

const PRESET_KEYS: TablePreset[] = ["difficulty", "lookup", "settings", "aiSetup", "grid"];

/** A scenario with tables in Additional Rules, an own section and the AI Hero Setup. */
function withTables(): Scenario {
  const s = newScenario("coops");
  s.name = "Siege of the Marsh Keep";
  s.author = "Tester";
  s.rules = ["Marauders march on the closest Town.", "A new raid begins at the start of every third Round."];
  s.rulesTables = [presetTable("difficulty"), { ...presetTable("lookup"), after: 1 }, presetTable("settings")];
  s.customSections = [{ id: "c", title: "Tribute", text: "Players pay tribute at the start of these Rounds:", items: [], tables: [presetTable("grid")] }];
  s.aiHero = { ...s.aiHero, enabled: true, faction: "Fortress", army: "2 :bronze:", tables: [presetTable("aiSetup")] };
  return s;
}

test("each preset exports the mission book macros as in the golden .tex", () => {
  for (const preset of PRESET_KEYS) {
    const tex = `${tableToLatex(tableDoc(presetTable(preset)))}\n`;
    const golden = readFileSync(new URL(`${preset}.tex`, GOLDEN), "utf8");
    assert.equal(tex, golden, preset);
  }
});

test("a project file keeps its tables through saving and opening", () => {
  const s = withTables();
  const reopened = parseProject(projectJson(s));
  assert.deepEqual(reopened, s);
  assert.equal(scenarioToLatex(reopened), scenarioToLatex(s));
});

test("projects from before tables open with none, and ragged rows are squared up", () => {
  const old = JSON.parse(projectJson(newScenario("coops")));
  delete old.rulesTables;
  delete old.aiHero.tables;
  old.customSections = [{ id: "c", title: "Boss", text: "", items: [] }];
  const s = upgradeScenario(old);
  assert.deepEqual(s.rulesTables, []);
  assert.deepEqual(s.aiHero.tables, []);
  assert.deepEqual(s.customSections[0].tables, []);

  const ragged = upgradeScenario({ ...old, rulesTables: [{ id: "r", preset: "grid", columns: ["A", "B", "C"], rows: [["1"], ["1", "2", "3", "4"]] }] });
  assert.deepEqual(ragged.rulesTables[0].rows, [["1", "", ""], ["1", "2", "3"]]);
  assert.equal(ragged.rulesTables[0].width, "column");
  assert.equal(ragged.rulesTables[0].after, null);
});

test("an exported scenario with every preset passes the mission book lint", () => {
  const tex = scenarioToLatex(withTables());
  // lint-files.yaml: no tabs, no trailing whitespace, a final newline, capitalised book terms
  assert.ok(!tex.includes("\t"));
  assert.deepEqual(
    tex.split("\n").filter((line) => /\s$/.test(line)),
    [],
    "trailing whitespace",
  );
  assert.ok(tex.endsWith("\n") && !tex.endsWith("\n\n"));
  assert.deepEqual(capsFindings(tex), []);
  // in the tables every number before an icon is tied to it
  const tables = tex.match(/\\hommtable[\s\S]*?\\end\{tabularx\}/g) ?? [];
  assert.equal(tables.length, 5);
  for (const table of tables) assert.doesNotMatch(table, /\d \\svg/);
  // the filled tables raise nothing on the checklist
  assert.deepEqual(
    lintScenario(withTables()).filter((f) => /Table/.test(f.message)),
    [],
  );
});

test("column tables sit in the text where placed; page tables float after the columns", () => {
  const s = withTables();
  const doc = buildDocument(s);
  const kinds = doc.body.map((b) => b.k);
  const rules = doc.body.findIndex((b) => b.k === "heading" && b.text === "Additional Rules");
  // after the heading: one bullet, the lookup table, the other bullet, the settings table
  assert.deepEqual(kinds.slice(rules + 1, rules + 5), ["list", "table", "list", "table"]);
  assert.equal(doc.wide.length, 2, "the difficulty matrix and the AI Hero setup span the page");

  const tex = scenarioToLatex(s);
  const end = tex.indexOf("\\end{multicols*}");
  assert.ok(tex.indexOf("\\hommtablemulticol[]") < end);
  assert.ok(tex.indexOf("\\begin{table*}[!hb]\n  \\hommtable[]") > end);
  assert.ok(tex.includes("Marauders march on the closest Town.\n\\end{itemize}\n\n\\hommtablemulticol"));
});

test("table text takes the yellow icons and ties numbers to them; unit tiers stay as they are", () => {
  const runs = cellRuns("Deal 1 :damage: to 2 :bronze: and :gold:");
  assert.deepEqual(
    runs.filter((r) => r.t === "glyph").map((r) => (r as { name: string }).name),
    ["damage-yellow", "bronze", "gold"],
  );
  assert.equal(runs[0].t === "text" && runs[0].s, "Deal 1\u00a0");
  const tex = tableToLatex(tableDoc({ ...newTable("grid"), rows: [["Hit", "Deal 1 :damage: to 2 :bronze:", ""]] }));
  assert.ok(tex.includes("Deal 1~\\svg{damage-yellow} to 2~\\svg[12]{bronze}"));
  for (const name of YELLOW_GLYPHS) {
    assert.ok(GLYPHS.includes(name), name);
    assert.ok(existsSync(new URL(`../public/assets/glyphs/${name}-yellow.svg`, import.meta.url)), `${name}-yellow.svg`);
  }
});

test("cell heights follow the lines, the frame follows the rows", () => {
  assert.equal(cellHeight(1), 0.9);
  assert.equal(cellHeight(2), 1.4);
  assert.equal(cellHeight(3), 1.9);
  // The settings fixture: one-line header and Normal row, the long Hard row on four lines.
  const book = bookTable(tableDoc(presetTable("settings")));
  assert.deepEqual(book.heights, [0.9, 1.4, 0.9, 2.4, 1.4]);
  assert.equal(book.frame, 20);
  // more rows, taller frame
  const t = presetTable("settings");
  const bigger = bookTable(tableDoc({ ...t, rows: [...t.rows, ["Heroic", "More."]] }));
  assert.ok(bigger.frame > book.frame);
});

test("the first column is as wide as its longest line needs, within 12-40%", () => {
  assert.equal(bookTable(tableDoc(presetTable("lookup"))).layout.key, 0.13);
  assert.equal(bookTable(tableDoc(presetTable("difficulty"))).layout.key, 0.17);
  const long = presetTable("lookup");
  long.rows[0][0] = "A very long first column label";
  assert.equal(bookTable(tableDoc(long)).layout.key, 0.4);
});

test("the checklist flags missing tiers, empty cells, Rounds across columns and words too wide", () => {
  const missing = presetTable("settings");
  missing.rows = missing.rows.filter((r) => r[0] !== "Normal");
  assert.match(tableFindings(missing, "T").join("\n"), /T has no Normal tier: list every difficulty, and write "No Change"/);

  const partial = presetTable("difficulty");
  partial.columns = ["", "Easy", "Hard"];
  partial.rows = partial.rows.map((r) => r.slice(0, 3));
  assert.match(tableFindings(partial, "T").join("\n"), /no Normal, Impossible tiers/);

  const empty = newTable("difficulty");
  assert.match(tableFindings(empty, "T").join("\n"), /T has 12 empty cells\./);

  const across = presetTable("grid");
  across.columns = ["Variant", "Round 4", "Round 8", "Round 12"];
  assert.match(tableFindings(across, "T").join("\n"), /runs its Rounds across the columns/);

  const narrow = presetTable("grid");
  narrow.columns = ["Round", "A", "B", "C", "D", "E", "F", "G"];
  narrow.rows = [["4th", "Necromancers", "x", "x", "x", "x", "x", "x"]];
  assert.match(tableFindings(narrow, "T").join("\n"), /"Necromancers" needs [\d.]+ cm but its column is [\d.]+ cm wide\. Use fewer columns, shorter words or the full page width\./);

  // lowercase book terms in cells reach the caps check too
  const s = withTables();
  s.rulesTables[0].rows[0][0] = "first round";
  assert.ok(lintScenario(s).some((f) => f.message.includes('"round" should be capitalised')));
});

test("checklist names point at the step that holds the table", () => {
  const s = withTables();
  s.rulesTables[2].rows[3][1] = "";
  s.aiHero.tables[0].rows[0][3] = "";
  const found = lintScenario(s).filter((f) => f.message.includes("empty cell"));
  assert.deepEqual(
    found.map((f) => [f.step, f.message]),
    [
      ["rules", 'Table "Difficulty Settings" has 1 empty cell.'],
      ["opponents", 'Table "AI Hero Setup" has 1 empty cell.'],
    ],
  );
});

test("unit counts read and write the cell markup", () => {
  assert.equal(unitString({ bronze: 3, silver: 2, golden: 0 }), "3 :bronze: 2 :silver:");
  assert.deepEqual(parseUnits("3 :bronze: 2 :silver:"), { bronze: 3, silver: 2, golden: 0, azure: 0 });
  assert.deepEqual(parseUnits(":bronze::bronze: :silver:"), { bronze: 2, silver: 1, golden: 0, azure: 0 });
  assert.equal(parseUnits("3 :bronze: then 2 :silver:"), null);
});

test("the dice keys keep a row on its own result and fill the rest in order", () => {
  const rows = diceRows(
    [
      ["", "Low Clouds"],
      ["0/0", "Calm"],
      ["", ""],
      ["x", "Hailstorm"],
    ],
    2,
  );
  assert.deepEqual(rows.map((r) => r[0]), DICE_KEYS);
  assert.deepEqual(rows.slice(0, 5).map((r) => r[1]), ["Low Clouds", "Hailstorm", "", "", "Calm"]);
});

test("an AI Hero setup row comes from the AI Opponent step", () => {
  const s = newScenario("campaigns");
  s.aiHero = { ...s.aiHero, faction: "Inferno", army: "2 :bronze:", deck: "Might AI Deck", spellDeck: "Fire Spells", skills: "Offense", special: "" };
  assert.deepEqual(aiSetupRow(s, 4), ["Inferno", "2 :bronze:", "Might AI Deck\nFire Spells", "Offense"]);
  assert.deepEqual(aiSetupRow(s, 2), ["Inferno", "2 :bronze:"]);
});

test("blank tables stay out of every output", () => {
  const s = newScenario("coops");
  s.rules = ["One rule."];
  s.rulesTables = [{ ...newTable("grid"), columns: ["", "", ""] }];
  assert.ok(!scenarioToLatex(s).includes("hommtable"));
  assert.equal(buildDocument(s).body.filter((b) => b.k === "table").length, 0);
});

/** A jsPDF stand-in that records the text it draws; every letter is 5pt wide. */
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
  return { writer: new Writer(pdf as never, { glyphs: new Map(), background: "", heading: "", bullet: "", icon: null }), drawn };
}

test("the PDF draws column tables in the flow and page tables across both columns", () => {
  const { writer, drawn } = recorder();
  const doc = buildDocument(withTables());
  writer.blocks(doc.body);
  writer.wideTables(doc.wide);
  const at = (text: string) => drawn.find((d) => d.text === text);
  for (const word of ["Weather", "Normal", "Tribute", "Garrison", "Vanguard"]) assert.ok(at(word), word);
  // the settings table rows go down the page in order
  assert.ok(at("Easy")!.y < at("Hard")!.y && at("Hard")!.y < at("Impossible")!.y);
  // the wide difficulty matrix spans more than one column: Impossible sits right of the page middle
  const header = drawn.filter((d) => d.text === "Impossible").at(-1)!;
  assert.ok(header.x > 595.28 / 2);
});
