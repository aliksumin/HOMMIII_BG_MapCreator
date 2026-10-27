import assert from "node:assert/strict";
import { test } from "node:test";
import { authorsTitle, readmePlayers, readmeRow, submitGuide } from "../src/lib/bundle.ts";
import { type Block, buildDocument } from "../src/lib/document.ts";
import { scenarioToLatex } from "../src/lib/latex.ts";
import { capsFindings } from "../src/lib/lint.ts";
import { itemPrefix, parseInline, parseItem, plain, type Inline } from "../src/lib/markup.ts";
import { Writer } from "../src/lib/pdf.ts";
import { newTable, tableDoc } from "../src/lib/tables.ts";
import { newScenario } from "../src/model/defaults.ts";

const br: Inline = { t: "br" };
const text = (s: string, style: { b?: boolean; i?: boolean } = {}): Inline => ({ t: "text", s, ...style });
const glyph = (name: string): Inline => ({ t: "glyph", name });
const NBSP = "\u00a0";

// ---- the parser ----

test("!!red!! wraps its text, keeping bold, italics and glyphs inside", () => {
  assert.deepEqual(parseInline("Take !!all **3** :gold:!! now"), [
    text("Take "),
    { t: "red", runs: [text("all "), text("3", { b: true }), text(" "), glyph("gold")] },
    text(" now"),
  ]);
  assert.deepEqual(parseInline("**bold !!red!!**"), [text("bold ", { b: true }), { t: "red", runs: [text("red", { b: true })] }]);
});

test("exclamation marks in plain text stay plain", () => {
  for (const s of ["Stop!! Now", "Wow!! Really!!", "!! not red !!", "a!!b!!", "!!!"]) assert.equal(plain(parseInline(s)), s, s);
});

test("an escaped !! inside red text stays inside it", () => {
  assert.deepEqual(parseInline("!!Red \\!! literal and more!!"), [{ t: "red", runs: [text("Red !! literal and more")] }]);
  assert.deepEqual(parseInline("!!\\!!x!!"), [{ t: "red", runs: [text("!!x")] }]);
});

test("[text](url) is a link; other brackets stay text", () => {
  assert.deepEqual(parseInline("See [the *rulebook*](https://example.org/a_(b)?x=1#p) first"), [
    text("See "),
    { t: "link", href: "https://example.org/a_(b)?x=1#p", runs: [text("the "), text("rulebook", { i: true })] },
    text(" first"),
  ]);
  assert.deepEqual(parseInline("[mail](mailto:me@example.org)"), [{ t: "link", href: "mailto:me@example.org", runs: [text("mail")] }]);
  for (const s of ["[Cleanse] The player", "[x](optional)", "[x] (https://a.b)", "[](https://a.b)", "[x](https://a b)"]) {
    assert.equal(plain(parseInline(s)), s, s);
  }
});

test("^[note] is a footnote, which may hold a link but no footnote", () => {
  assert.deepEqual(parseInline("Level II^[See [the table](https://a.b), page 35.]."), [
    text("Level II"),
    { t: "note", runs: [text("See "), { t: "link", href: "https://a.b", runs: [text("the table")] }, text(", page 35.")] },
    text("."),
  ]);
  assert.deepEqual(parseInline("a^[b ^[c]]"), [text("a"), { t: "note", runs: [text("b ^[c]")] }]);
  for (const s of ["x^2", "^[]", "^[  ]", "^[open"]) assert.equal(plain(parseInline(s)), s, s);
});

test("+1 and -1 standing alone are signed numbers; ranges and words are not", () => {
  assert.deepEqual(parseInline("+1/-1 and \u22122"), [
    { t: "signed", s: "+1" },
    text("/"),
    { t: "signed", s: "-1" },
    text(" and "),
    { t: "signed", s: "-2" },
  ]);
  assert.deepEqual(parseInline("(+1.5)"), [text("("), { t: "signed", s: "+1.5" }, text(")")]);
  for (const s of ["2-1", "x-1", "1+1", "-1st", "a -b", "+x"]) assert.equal(plain(parseInline(s)), s, s);
});

test("a backslash keeps a markup character literal", () => {
  assert.deepEqual(parseInline("\\*a\\* \\!!b\\!! \\[c](https://d.e) \\^[f] \\+1 \\:gold: \\\\ \\--"), [
    text("*a* !!b!! [c](https://d.e) ^[f] +1 :gold: \\ --"),
  ]);
  // a backslash before anything else is just a backslash
  assert.equal(plain(parseInline("C:\\path")), "C:\\path");
});

test("a number keeps to the glyph after it with a no-break space", () => {
  assert.deepEqual(parseInline("Gain 10 :gold: and +1 :movement:, a :gold:"), [
    text(`Gain 10${NBSP}`),
    glyph("gold"),
    text(" and "),
    { t: "signed", s: "+1" },
    text(NBSP),
    glyph("movement"),
    text(", a "),
    glyph("gold"),
  ]);
});

test("the new markup works across line breaks and next to bold, italics and glyphs", () => {
  assert.deepEqual(parseInline("!!one\ntwo!!\n*it* ^[a\nb] [**x**](https://y.z)"), [
    { t: "red", runs: [text("one"), br, text("two")] },
    br,
    text("it", { i: true }),
    text(" "),
    { t: "note", runs: [text("a"), br, text("b")] },
    text(" "),
    { t: "link", href: "https://y.z", runs: [text("x", { b: true })] },
  ]);
  // in italic flavor text the wrappers keep the italics
  assert.deepEqual(parseInline("!!lost!!", { i: true }), [{ t: "red", runs: [text("lost", { i: true })] }]);
});

test("list items read their indent and marker", () => {
  assert.deepEqual(parseItem("plain"), { depth: 0, numbered: false, text: "plain", prefix: "" });
  assert.deepEqual(parseItem("- top"), { depth: 0, numbered: false, text: "top", prefix: "- " });
  assert.deepEqual(parseItem("  - sub"), { depth: 1, numbered: false, text: "sub", prefix: "  - " });
  assert.deepEqual(parseItem("    12. deep"), { depth: 2, numbered: true, text: "deep", prefix: "    12. " });
  assert.equal(parseItem("          - capped").depth, 2);
  // no marker without a space after it, and a backslash keeps it
  assert.deepEqual(parseItem("-1 :gold:"), { depth: 0, numbered: false, text: "-1 :gold:", prefix: "" });
  assert.deepEqual(parseItem("2026. A year"), { depth: 0, numbered: false, text: "2026. A year", prefix: "" });
  assert.deepEqual(parseItem("\\1. Not a number"), { depth: 0, numbered: false, text: "1. Not a number", prefix: "" });
  assert.equal(itemPrefix(0, false), "");
  assert.equal(itemPrefix(1, false), "  - ");
  assert.equal(itemPrefix(2, true), "    1. ");
  assert.deepEqual(parseItem(`${itemPrefix(1, true)}x`), { depth: 1, numbered: true, text: "x", prefix: "  1. " });
});

// ---- the document ----

function section(blocks: Block[], heading: string): Block[] {
  const at = blocks.findIndex((b) => b.k === "heading" && b.text === heading);
  assert.ok(at >= 0, `no ${heading} heading`);
  const end = blocks.findIndex((b, i) => i > at && b.k === "heading");
  return blocks.slice(at + 1, end < 0 ? undefined : end);
}

test("list items nest at most one level below the item before", () => {
  const s = newScenario("coops");
  s.rules = ["    - starts too deep", "    - jumps two levels", "1. numbered", "", "  1. under it"];
  const [list] = section(buildDocument(s).body, "Additional Rules");
  assert.equal(list.k, "list");
  assert.deepEqual(
    list.k === "list" && list.items.map((i) => [plain(i.runs), i.depth, i.numbered]),
    [
      ["starts too deep", 0, false],
      ["jumps two levels", 1, false],
      ["numbered", 0, true],
      ["under it", 1, true],
    ],
  );
});

test("own sections carry sub-headings with their own text and bullets", () => {
  const s = newScenario("clash");
  s.customSections = [
    {
      id: "a",
      title: "Additional Rules",
      text: "",
      items: [],
      tables: [],
      subsections: [
        { id: "b", title: "Setup Changes", text: "Before the game:", items: ["Remove the Prison."] },
        { id: "c", title: "", text: "", items: [] },
      ],
    },
  ];
  assert.deepEqual(section(buildDocument(s).body, "Additional Rules"), [
    { k: "subheading", text: "Setup Changes" },
    { k: "para", runs: [text("Before the game:")] },
    { k: "list", items: [{ runs: [text("Remove the Prison.")], depth: 0, numbered: false }] },
  ]);
});

// ---- the .tex ----

function sample() {
  const s = newScenario("clash");
  s.name = "Markup Trial";
  s.resources = { gold: 10, building_materials: 3 };
  s.victory = "Hold !!every Obelisk!! until the end^[See [the rulebook](https://example.org/rules?a=1%2C2#p35), page 35.].";
  s.rules = [
    "When a player Visits an Obelisk, they *must* choose:",
    "  1. **[Cleanse]** Gain +1 :movement:.",
    "    - Once per Round.",
    "  1. **[Sacrifice]** Lose 2 :gold:.",
    "  - Then discard a Card.",
    "[Optional] Play with 4 players.",
  ];
  s.customSections = [
    { id: "a", title: "Other Rules", text: "", items: [], tables: [], subsections: [{ id: "b", title: "Setup Changes", text: "", items: ["Remove -1 :gold:."] }] },
  ];
  return s;
}

test("the .tex writes each element the Mission Book way", () => {
  const tex = scenarioToLatex(sample());
  assert.ok(tex.includes("\\textbf{Starting Resources:} 10~\\svg{gold}, 3~\\svg{building_materials}"));
  assert.ok(
    tex.includes(
      "Hold \\textcolor{darkcandyapplered}{every Obelisk} until the end\\footnote{See \\href{https://example.org/rules?a=1\\%2C2\\#p35}{the rulebook}, page 35.}.",
    ),
  );
  assert.ok(
    tex.includes(
      [
        "\\begin{itemize}",
        "  \\item When a player Visits an Obelisk, they \\textit{must} choose:",
        "  \\begin{enumerate}[leftmargin=15pt]",
        "    \\item \\textbf{[Cleanse]} Gain $+1$~\\svg{movement}.",
        "    \\begin{itemize}",
        "      \\item Once per Round.",
        "    \\end{itemize}",
        "    \\item \\textbf{[Sacrifice]} Lose 2~\\svg{gold}.",
        "  \\end{enumerate}",
        "  \\begin{itemize}",
        "    \\item Then discard a Card.",
        "  \\end{itemize}",
        "  \\item {}[Optional] Play with 4 players.",
        "\\end{itemize}",
      ].join("\n"),
    ),
  );
  assert.ok(tex.includes("\\subsection*{\\MakeUppercase{Other Rules}}\n\n\\subsubsection*{Setup Changes}\n\n\\begin{itemize}\n  \\item Remove $-1$~\\svg{gold}.\n\\end{itemize}"));
});

test("an exported scenario with every new element passes the Mission Book lint", () => {
  const s = sample();
  s.lore = "!!Red!! *lore*\nwith a [link](https://a.b) and a note^[In *italics*\nover two lines.]";
  s.startingUnits = ["A Pack", "  - of Archers", "    1. +1 :attack:"];
  const tex = scenarioToLatex(s);
  // lint-files.yaml: tabs, trailing whitespace, final newline, capitalised book terms
  assert.ok(!tex.includes("\t"));
  assert.ok(!/[^\S\n]$/m.test(tex), "no trailing whitespace");
  assert.ok(tex.endsWith("\n") && !tex.endsWith("\n\n"));
  assert.deepEqual(capsFindings(tex), []);
  // no \\ ends a paragraph or comes right before a list
  assert.ok(!/\\\\\n\s*(\n|\\begin|\\end|\\item)/.test(tex));
  // every brace closes
  let depth = 0;
  for (const ch of tex.replace(/\\[{}]/g, "")) depth += ch === "{" ? 1 : ch === "}" ? -1 : 0;
  assert.equal(depth, 0);
});

// ---- the PDF ----

/** A jsPDF stand-in that records text with its colour, and link boxes; every letter is 5pt wide. */
function recorder() {
  const drawn: { text: string; x: number; y: number; color: string; size: number }[] = [];
  const links: { x: number; url: string }[] = [];
  let color = "";
  let size = 0;
  const pdf = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "text") return (text: string, x: number, y: number) => drawn.push({ text, x, y, color, size });
        if (key === "setTextColor") return (...rgb: number[]) => void (color = rgb.join(","));
        if (key === "setFontSize") return (n: number) => void (size = n);
        if (key === "link") return (x: number, _y: number, _w: number, _h: number, opts: { url: string }) => links.push({ x, url: opts.url });
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
  return { writer, at, links, drawn };
}

test("the PDF sets red words red, links in link ink with a clickable box, and signs as maths", () => {
  const { writer, at, links } = recorder();
  writer.paragraph(parseInline("Keep !!red!! [here](https://a.b) -1"));
  assert.equal(at("Keep").color, "32,24,16");
  assert.equal(at("red").color, "163,0,0");
  assert.equal(at("here").color, "0,255,255");
  assert.deepEqual(links, [{ x: at("here").x, url: "https://a.b" }]);
  assert.ok(at("\u22121"));
});

test("the PDF keeps a number with its glyph on one line", () => {
  const { writer, at } = recorder();
  writer.paragraph(parseInline("Gain 10 :gold:"));
  assert.ok(at(`10${NBSP}`));
});

test("the PDF numbers footnotes in order and sets them at the foot of their page", () => {
  const { writer, drawn } = recorder();
  writer.paragraph(parseInline("First^[One.] and second^[Two.]"));
  const marks = drawn.filter((d) => (d.text === "1" || d.text === "2") && d.size < 11 && d.y < 700);
  assert.equal(marks.length, 2);
  assert.ok(!drawn.some((d) => d.text === "One."), "notes wait for the page to end");
  writer.drawNotes();
  const one = drawn.find((d) => d.text === "One.");
  const two = drawn.find((d) => d.text === "Two.");
  assert.ok(one && two && two.y > one.y, "the notes stack in order");
  assert.ok(one.y > 700, "at the foot of the page");
  assert.equal(writer.notesH, 0);
});

test("the PDF keeps text clear of the page's footnotes", () => {
  const { writer } = recorder();
  writer.paragraph(parseInline("A note^[Long enough to take a line.]"));
  assert.ok(writer.notesH > 0);
  const limit = writer.bottom;
  // fill the column: the text never runs into the footnote area
  for (let i = 0; i < 80 && writer.col === 0; i++) {
    writer.paragraph([text("filler")]);
    // the paragraph gap after the last line may reach past it
    if (writer.col === 0) assert.ok(writer.y <= limit + 11 * 0.48 + 0.01);
  }
});

test("the PDF nests list items 15pt a level and labels them as LaTeX does", () => {
  const { writer, at } = recorder();
  const items = ["Top", "  1. First", "  1. Second", "    1. Inner", "  - Sub"].map((s) => {
    const line = parseItem(s);
    return { runs: parseInline(line.text), depth: line.depth, numbered: line.numbered };
  });
  writer.list(items);
  assert.equal(at("First").x - at("Top").x, 15);
  assert.equal(at("Inner").x - at("First").x, 15);
  assert.equal(at("Sub").x, at("First").x);
  assert.ok(at("1.") && at("2.") && at("(a)"));
});

// ---- the submission guide ----

test("the guide gives ready-to-paste README, scenario-authors.json and po4a.cfg lines", () => {
  const s = sample();
  s.author = "Jane Doe";
  s.playerCounts = [1, 2, 4];
  const guide = submitGuide(s);
  assert.ok(guide.includes("<td>\u2694\ufe0f Markup Trial (1, 2, or 4)</td>"));
  assert.ok(guide.includes('<a href="https://raw.githubusercontent.com/qwrtln/Homm3BG-mission-book-build-artifacts/en-markup_trial-color/markup_trial_en.pdf">click</a>'));
  assert.ok(guide.includes('<a href="https://raw.githubusercontent.com/qwrtln/Homm3BG-mission-book-build-artifacts/en-markup_trial-mono/markup_trial_en_mono.pdf"><em>click</em></a>'));
  assert.ok(guide.includes('  "janedoe": {\n    "scenarios": [\n      "Markup Trial"\n    ],\n    "on_discord": false\n  }'));
  assert.ok(guide.includes("[type: latex] clash/markup_trial.tex $lang:clash/translated/$lang/markup_trial.tex"));
  assert.equal(readmePlayers([2, 3, 4, 6]), "2-4 or 6");
  assert.equal(readmePlayers([]), "-");
});

test("campaign titles in the guide follow the existing entries", () => {
  const s = newScenario("campaigns");
  s.name = "Graduation Exercise";
  s.faction = "Rampart";
  s.campaignName = "Elixir of Life";
  s.playerCounts = [2];
  assert.equal(authorsTitle(s), "Elixir of Life: Graduation Exercise");
  assert.ok(readmeRow(s).includes("<td>\ud83d\uddfa\ufe0f Rampart: Graduation Exercise (2)</td>"));
  s.category = "solo";
  assert.ok(submitGuide(s).includes("no mark for this kind of scenario"));
});

// ---- rules tables ----

/** A two-column table whose cells use the new markup; a footnote in its title and in a cell. */
function markupTable(width: "column" | "page") {
  const t = newTable("lookup");
  t.width = width;
  t.title = "Omens^[Roll at the start of each Round.]";
  t.rows = [
    ["+1/-1", "!!Storm!!: lose 2 :gold:"],
    ["0/0", "Read the [rulebook](https://example.org/r)^[Page 35.]."],
  ];
  return t;
}

test("table cells write red, links, signed numbers and footnotes the Mission Book way", () => {
  const s = newScenario("clash");
  s.rules = ["Before^[One.]"];
  s.rulesTables = [markupTable("column")];
  s.customSections = [{ id: "a", title: "Wide", text: "After^[Four.]", items: [], tables: [markupTable("page")], subsections: [] }];
  const tex = scenarioToLatex(s);
  assert.ok(tex.includes("\\darkcell{$+1$/$-1$}"));
  assert.ok(tex.includes("\\lightcell{\\textcolor{darkcandyapplered}{Storm}: lose 2~\\svg{gold}}"));
  // \footnote is lost inside the cell macros: a mark there, the text after the table
  assert.ok(tex.includes("\\textbf{Omens\\footnotemark{}}"));
  assert.ok(tex.includes("Read the \\href{https://example.org/r}{rulebook}\\footnotemark{}."));
  const after = "\\addtocounter{footnote}{-2}\n\\stepcounter{footnote}\\footnotetext{Roll at the start of each Round.}\n\\stepcounter{footnote}\\footnotetext{Page 35.}";
  assert.ok(tex.includes(`  \\end{tabularx}\n}\n${after}`), "after a column table");
  assert.ok(tex.includes(`\\end{table*}\n${after}`), "after a page table, outside its float");
  assert.ok(tex.includes("Before\\footnote{One.}") && tex.includes("After\\footnote{Four.}"));
  assert.ok(!/[^\S\n]$/m.test(tex) && !tex.includes("\t"));
  assert.deepEqual(capsFindings(tex), []);
});

test("a footnote in the right column keeps clear of a table that ends the left one", () => {
  const { writer } = recorder();
  const table = newTable("lookup");
  table.rows = Array.from({ length: 25 }, (_, i) => [String(i + 1), "An omen."]);
  writer.block({ k: "table", table: tableDoc(table) });
  const page = writer.page;
  // the table's foot: where the text goes on, less the gap after a table
  const tableEnd = writer.y - 11 * 0.6;
  writer.ensure(writer.bottom - writer.y + 1); // on to the right column
  assert.equal(writer.col, 1);
  writer.paragraph(parseInline(`A note^[${"A long footnote that takes several lines at the foot of the page. ".repeat(20)}]`));
  // either the footnotes clear the table's foot, or the paragraph went to a new page
  assert.ok(writer.page > page || writer.bottom >= tableEnd, `footnotes at ${writer.bottom} over the table ending at ${tableEnd}`);
});

test("the preview and PDF number table footnotes in reading order with the text around them", () => {
  const s = newScenario("clash");
  s.rules = ["Before^[One.]"];
  s.rulesTables = [markupTable("column")];
  s.customSections = [{ id: "a", title: "Later", text: "After^[Four.]", items: [], tables: [], subsections: [] }];
  const doc = buildDocument(s);
  const { writer, drawn, links } = recorder();
  writer.blocks(doc.body);
  writer.drawNotes();
  const notes = ["One.", "Roll", "Page", "Four."].map((word) => drawn.find((d) => d.text === word));
  assert.ok(notes.every(Boolean), "every note is drawn");
  const ys = notes.map((d) => d!.y);
  assert.deepEqual([...ys].sort((a, b) => a - b), ys, "in the order 1-4");
  assert.equal(writer.noteCount, 4);
  // cell words keep their ink and link
  assert.equal(drawn.find((d) => d.text === "Storm")?.color, "163,0,0");
  assert.ok(links.some((l) => l.url === "https://example.org/r"));
  assert.ok(drawn.some((d) => d.text === "+1") && drawn.some((d) => d.text === "\u22121"));
  assert.ok(tableDoc(markupTable("column")).rows[0][0].some((r) => r.t === "signed"));
});
