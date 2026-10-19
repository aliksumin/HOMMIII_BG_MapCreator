import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPlayerCount, slugify } from "../src/lib/document.ts";
import { escapeLatex, scenarioToLatex } from "../src/lib/latex.ts";
import { capsFindings } from "../src/lib/lint.ts";
import { newTile } from "../src/lib/mapfile.ts";
import { newScenario } from "../src/model/defaults.ts";

function sample() {
  const s = newScenario("coops");
  s.name = "Dances with Dwarves";
  s.author = "Tester";
  s.lore = 'The "old" dwarves -- gone.';
  s.rounds = 12;
  s.playerCounts = [2, 3, 4];
  s.titleImage = { kind: "library", name: "sentinel" };
  s.startingUnits = ['A "Pack" of the cheapest :bronze: Units'];
  s.buildings = ["bronze", "citadel"];
  s.bonus.options = ["Search (2) the Artifact Deck"];
  s.victory = "Defeat all invading armies.";
  s.defeat = "Your Town is captured.";
  s.timedEvents = [{ id: "e", rounds: [8, 7], items: ["Spawn an enemy army."] }];
  s.rules = ["Players gain 2 :experience: & 5% more."];
  s.maps[0].tiles = [newTile("S0", 7, 9), newTile("S0", 8, 12), newTile("F0", 5, 11)];
  return s;
}

test("writes the heading and sections in template order", () => {
  const tex = scenarioToLatex(sample());
  assert.match(tex, /^% !TeX spellcheck = en_US\n\\addscenariosection\{1\}\{Cooperative Scenario\}\{Dances with Dwarves\}\{\\images\/sentinel.png\}\n/);
  const order = ["Author", "Scenario Length", "Player Setup", "Map Setup", "Victory Conditions", "Defeat Conditions", "Timed Events", "Additional Rules"];
  let at = -1;
  for (const heading of order) {
    const next = tex.indexOf(heading);
    assert.ok(next > at, `${heading} out of order`);
    at = next;
  }
  assert.ok(tex.includes("\\textbf{Player Count:} 2--4"));
  assert.ok(tex.includes("\\textit{The ``old'' dwarves -- gone.}"));
  assert.ok(tex.includes("\\textbf{Starting Units:}\n\\begin{itemize}\n  \\item A ``Pack'' of the cheapest \\svg{bronze} Units\n\\end{itemize}"));
  assert.ok(tex.includes("\\textbf{Town Buildings:} \\svg{bronze} Dwelling, Citadel"));
  assert.ok(tex.includes("  \\item 2 \u00d7 Starting (I) Map Tiles\n  \\item 1 \u00d7 Far (II--III) Map Tile\n"));
  assert.ok(tex.includes("\\textbf{\\nth{7} and \\nth{8} Rounds:}\n\\begin{itemize}"));
  assert.ok(tex.includes("2 \\svg{experience} \\& 5\\% more."));
  assert.ok(tex.includes("\\includegraphics[width=0.6\\paperwidth]{\\maps/dances_with_dwarves.png}"));
  assert.ok(tex.endsWith("\n") && !/[ \t]$/m.test(tex));
});

test("campaign headings carry the campaign and open its table of contents entry", () => {
  const s = sample();
  s.category = "campaigns";
  s.faction = "Castle";
  s.campaignName = "The Queen\u2019s Gambit";
  s.campaignIndex = 1;
  s.story = "Long ago...";
  const tex = scenarioToLatex(s);
  assert.ok(tex.includes("{\\protect\\numberline{} {} {} {} {}The Queen\u2019s Gambit}"));
  assert.ok(tex.includes("\\addscenariosection[subsection]{1}{Castle Campaign $-$ The Queen\u2019s Gambit}{1. Dances with Dwarves}"));
  assert.ok(tex.includes("\\newpage\n\n\\begin{multicols*}{2}\n\n\\subsection*{\\MakeUppercase{The Story}}"));
});

test("automatic Map Setup lists each layout with different tiles", () => {
  const s = sample();
  s.maps[0].playerCounts = [2];
  s.maps.push({ id: "m2", name: "Big", playerCounts: [3, 4], caption: "", tiles: [newTile("S0", 7, 9), newTile("S0", 8, 12), newTile("S0", 12, 9)] });
  s.maps.push({ id: "m3", name: "Same as first", playerCounts: [5], caption: "", tiles: s.maps[0].tiles.map((t) => ({ ...t })) });
  const tex = scenarioToLatex(s);
  assert.ok(tex.includes("\\textbf{For 2/5 players:}\n\\begin{itemize}\n  \\item 2 \u00d7 Starting (I) Map Tiles\n  \\item 1 \u00d7 Far (II--III) Map Tile\n\\end{itemize}"));
  assert.ok(tex.includes("\\textbf{For 3/4 players:}\n\\begin{itemize}\n  \\item 3 \u00d7 Starting (I) Map Tiles\n\\end{itemize}"));
  // one layout (or several with the same tiles) keeps the plain list
  s.maps = [s.maps[0]];
  assert.ok(!scenarioToLatex(s).includes("players:}"));
});

test("helpers", () => {
  assert.equal(formatPlayerCount([4, 2]), "2 or 4");
  assert.equal(formatPlayerCount([5, 1, 3, 3]), "1, 3 or 5");
  assert.equal(formatPlayerCount([6, 2, 4, 3]), "2–4 or 6");
  assert.equal(formatPlayerCount([]), "");
  assert.equal(slugify("Titans\u2019 Stronghold!"), "titans_stronghold");
  assert.equal(escapeLatex("a_b {c}"), "a\\_b \\{c\\}");
  assert.deepEqual(
    capsFindings("Each hero gains\nEach Hero gains\nthe heroes % no-check-caps").map((f) => f.word),
    ["hero"],
  );
});