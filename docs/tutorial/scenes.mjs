// The tutorial, scene by scene. Each scene is one numbered step of the video
// (one row of the storyboard): a caption chip, lower-third descriptions, and
// the clicks and typing on the real app. `d` is the director from capture.mjs.

import fs from "node:fs";
import path from "node:path";

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (s) => new RegExp(`^\\s*${reEsc(s)}\\s*$`, "i");

const pageOf = (scope) => (typeof scope.page === "function" ? scope.page() : scope);
const field = (scope, label) => scope.locator(".field").filter({ has: pageOf(scope).locator(".field-label", { hasText: exact(label) }) }).first();
const panel = (page, title) => page.locator("section.panel").filter({ has: page.locator(".panel-head h2", { hasText: exact(title) }) }).first();
const stepBtn = (page, label) => page.locator("nav.steps button.step").filter({ has: page.locator(".step-label", { hasText: exact(label) }) }).first();
const paletteTile = (page, id) => page.locator(".palette-tile").filter({ has: page.locator("span", { hasText: exact(id) }) }).first();

async function goStep(d, label) {
  await d.click(stepBtn(d.page, label), { hold: 700 });
  await d.page.evaluate(() => window.scrollTo({ top: 0 }));
}

// ------------------------------------------------------------ board helpers

/** The board's transform, read from the SVG, and its box on screen. */
const VIEW_JS = `(() => {
  const wrap = document.querySelector(".board");
  const g = document.querySelector(".board-svg > g");
  const m = /translate\\(([-\\d.e]+) ([-\\d.e]+)\\) scale\\(([-\\d.e]+)\\)/.exec(g.getAttribute("transform"));
  const r = wrap.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, vx: +m[1], vy: +m[2], k: +m[3] };
})()`;

async function cellScreen(page, row, col) {
  return page.evaluate(
    async ([r, c, viewJs]) => {
      const hex = await import("/src/lib/hex.ts");
      const v = eval(viewJs);
      const p = hex.cellCenter(r, c);
      return { x: v.left + v.vx + p.x * v.k, y: v.top + v.vy + p.y * v.k };
    },
    [row, col, VIEW_JS],
  );
}

/** Screen point of Field `f` of the tile at row/col in layout `layout`. */
async function fieldScreen(page, layout, row, col, f) {
  return page.evaluate(
    async ([li, r, c, fi, viewJs]) => {
      const hex = await import("/src/lib/hex.ts");
      const { useStore } = await import("/src/model/store.ts");
      const tile = useStore.getState().scenario.maps[li].tiles.find((t) => t.row === r && t.col === c);
      if (!tile) throw new Error(`no tile at ${r},${c}`);
      const v = eval(viewJs);
      const p = hex.fieldCenter(tile, fi);
      return { x: v.left + v.vx + p.x * v.k, y: v.top + v.vy + p.y * v.k };
    },
    [layout, row, col, f, VIEW_JS],
  );
}

/**
 * A ring of six tiles around a center tile, in the middle of the visible
 * board: center, ring[0..5] (ring[0] east, going clockwise on screen) and a
 * cell two steps east of the center (for the "map falls apart" demo).
 */
async function planRing(page) {
  return page.evaluate(
    async ([viewJs]) => {
      const hex = await import("/src/lib/hex.ts");
      const v = eval(viewJs);
      const mid = hex.pixelToCell((v.width / 2 - v.vx) / v.k, (v.height / 2 - 20 - v.vy) / v.k);
      const c0 = hex.cellCenter(mid[0], mid[1]);
      const R = Math.sqrt(7) * hex.CELL_W;
      for (const tilt of [-19.1066, 19.1066]) {
        const at = (k, n = 1) => {
          const a = ((tilt + 60 * k) * Math.PI) / 180;
          return hex.pixelToCell(c0.x + n * R * Math.cos(a), c0.y + n * R * Math.sin(a));
        };
        const ring = [0, 1, 2, 3, 4, 5].map((k) => at(k));
        const tiles = [];
        let ok = true;
        for (const [r, c] of [mid, ...ring]) {
          if (!hex.canPlace(tiles, r, c)) ok = false;
          tiles.push({ id: `t${tiles.length}`, row: r, col: c });
        }
        if (ok && ring.every((cell) => hex.tilesTouch({ row: cell[0], col: cell[1] }, tiles[0]))) {
          const far = at(0, 2);
          return { center: mid, ring, far };
        }
      }
      throw new Error("no ring layout found");
    },
    [VIEW_JS],
  );
}

/** The free cell nearest to a board point that touches the map. */
async function freeSpotNear(page, layout, angleDeg, dist) {
  return page.evaluate(
    async ([li, ang, dd]) => {
      const hex = await import("/src/lib/hex.ts");
      const { useStore } = await import("/src/model/store.ts");
      const tiles = useStore.getState().scenario.maps[li].tiles;
      const cs = tiles.map((t) => hex.cellCenter(t.row, t.col));
      const cx = cs.reduce((s, p) => s + p.x, 0) / cs.length;
      const cy = cs.reduce((s, p) => s + p.y, 0) / cs.length;
      const a = (ang * Math.PI) / 180;
      const tx = cx + dd * Math.cos(a);
      const ty = cy + dd * Math.sin(a);
      let best = null;
      for (let r = 1; r < 60; r++)
        for (let c = 1; c < 60; c++) {
          if (!hex.canPlace(tiles, r, c)) continue;
          if (!tiles.some((t) => hex.tilesTouch({ row: r, col: c }, t))) continue;
          const p = hex.cellCenter(r, c);
          const dist = (p.x - tx) ** 2 + (p.y - ty) ** 2;
          if (!best || dist < best.dist) best = { row: r, col: c, dist };
        }
      return best;
    },
    [layout, angleDeg, dist],
  );
}

/** Scrolls so the whole board sits between the top bar and the lower third. */
async function mapView(d) {
  await d.smoothScroll(d.page.locator(".map-toolbar"), "start");
}

// ------------------------------------------------------------ chapters

const CHAPTERS = [
  "Welcome & a new project",
  "Basics",
  "Story",
  "Player Setup",
  "Map editor: placing tiles",
  "Map editor: tile details",
  "Map editor: layouts & files",
  "Map Setup",
  "AI Opponent",
  "Victory & Defeat",
  "Timed Events",
  "Rules",
  "Text markup & the Icon button",
  "Undo, autosave & Save file",
  "Review & Export: checks and preview",
  "Review & Export: the files",
];

// Map state shared between the map scenes.
const map = {};

export const SCENES = [
  {
    num: 0,
    title: "Title card",
    async run(d) {
      const start = d.time();
      await d.card(
        `<div class="kicker">Heroes of Might &amp; Magic III &middot; The Board Game</div>
         <h1>Scenario Creator</h1>
         <div class="sub">A step-by-step tutorial: write a Scenario, build its map, export it for the Mission Book</div>
         <div class="rule"></div>
         <ol>${CHAPTERS.map((c) => `<li>${c.replace(/&/g, "&amp;")}</li>`).join("")}</ol>
         <div class="note">Use it online at aliksumin.github.io/HOMMIII_BG_MapCreator &middot; the demo scenario &ldquo;${d.demo.name}&rdquo; is made up for this video.</div>`,
        9000,
      );
      d.cue("HoMM3 Board Game Scenario Creator", "A step-by-step tutorial: write a Scenario, build its map, export it for the Mission Book.", start, d.time());
      await d.card("", 700);
    },
  },

  {
    num: 1,
    title: CHAPTERS[0],
    async run(d) {
      const p = d.page;
      await d.chapter(1, CHAPTERS[0], "Start screen", "The start screen: the five Scenario types, the template button, the Continue list and the Open button.");
      await d.say("Welcome", "The Scenario Creator runs in your browser, online at `aliksumin.github.io/HOMMIII_BG_MapCreator`. Everything you make stays in this browser until you export it.");
      await d.hl(p.locator(".welcome .category-cards").first(), "Pick the kind of Scenario");
      await d.say("Five Scenario types", "Clash (player against player), Cooperative, Alliance, Campaign and Solo (one player and a story book). The type sets the heading and where the file goes in the Mission Book.");
      await d.hl(p.locator(".welcome-card button", { hasText: "Open the template" }), "A finished example");
      await d.say("The template", "New here? Open the template: a finished Campaign Scenario that uses nearly every feature, to explore step by step.");
      await d.hl(p.locator(".welcome-card").nth(1), "Reopen saved work");
      await d.say("Continue or open a file", "Projects you worked on are listed under Continue. You can also open a saved `.scenario.json` project, or a `.map` file from the community map editor.");
      await d.clear();
      await d.say("Start a Clash", "For this demo we start a Clash for two or three players.", 2600);
      await d.click(p.locator(".welcome .category-card").filter({ hasText: "Clash" }), { hold: 1200 });
      await d.say(
        "The editor",
        "Ten steps on the left, the form in the middle, and the live Mission Book page on the right. A red mark on a step means something there still needs filling in.",
      );
      await d.hl([p.locator("nav.steps"), p.locator("aside.preview")], "", 0);
      await d.sleep(2500);
      await d.clear();
    },
  },

  {
    num: 2,
    title: CHAPTERS[1],
    async run(d) {
      const p = d.page;
      await d.chapter(2, CHAPTERS[1], "Step I · Basics", "Step I form: name, type, heading line, rating, author, title icon; live page on the right.");
      await d.say("Name the Scenario", "The name becomes the heading and the file name.", 1800);
      await d.type(field(p, "Scenario name").locator("input"), d.demo.name);
      await d.hl(field(p, "Scenario name"), "File name follows the name");
      await d.say("File name", "Below the field you see the `.tex` file name the Mission Book will get.", 3000);
      await d.hl(p.locator("aside.preview .bk-heading, aside.preview").first(), "Live page updates as you type");
      await d.say("Live page", "The page preview on the right updates with every change. Hide page gives the form more room.");
      await d.hl(p.locator(".topbar-actions button").filter({ hasText: /Hide page|Show page/ }), "Hide or show the page");
      await d.sleep(1800);
      await d.clear();
      await d.smoothScroll(p.locator(".category-cards").first());
      await d.hl(p.locator(".category-cards").first(), "Type: Clash, Cooperative, Alliance, Campaign, Solo");
      await d.say("Type and heading", "You can still change the type here. Campaigns add a campaign name, scenario number and faction; Solo sets one player.");
      await d.clear();
      await d.smoothScroll(field(p, "Heading line"));
      await d.hl([field(p, "Heading line"), field(p, "Title lines")], "Optional heading tweaks");
      await d.say("Heading line and title lines", "Leave the heading line empty for the standard one. Use two title lines for a long name.");
      await d.clear();
      await d.click(field(p, "Difficulty rating").locator('button[title="golden"]'));
      await d.hl(field(p, "Difficulty rating"), "Difficulty badge");
      await d.say("Difficulty rating", "An optional badge in the corner of the heading.", 2800);
      await d.clear();
      await d.say("Author", "Your name, and optionally where the Scenario first appeared, with a link.", 400);
      await d.type(field(p, "Author").locator("input"), d.demo.author);
      await d.type(field(p, "Source label").locator("input"), d.demo.sourceLabel);
      await d.hl(panel(p, "Author"), "Author and source");
      await d.finishCue();
      await d.clear();
      await d.smoothScroll(panel(p, "Title icon"), "start");
      await d.say("Title icon", "Pick the round icon left of the heading from the Mission Book's library, or upload your own PNG.", 2500);
      await d.type(panel(p, "Title icon").locator("input.filter"), d.demo.titleIconFilter);
      await d.click(panel(p, "Title icon").locator(`.icon-grid button[title="${d.demo.titleIcon}"]`), { hold: 600 });
      await d.hl([panel(p, "Title icon").locator(".icon-grid"), panel(p, "Title icon").locator(".panel-head label.btn")], "Library icon, or Upload PNG");
      await d.sleep(2800);
      await d.clear();
      await d.scrollTop();
    },
  },

  {
    num: 3,
    title: CHAPTERS[2],
    async run(d) {
      const p = d.page;
      await d.chapter(3, CHAPTERS[2], "Step II · Story", "Step II: flavor text, the long Story and the story book (Story Locations, Special Tiles, numbered Paragraphs).");
      await goStep(d, "Story");
      await d.say("Flavor text", "One or two paragraphs that set the scene. They print in italics under the Author line.", 2500);
      await d.type(field(p, "One or two paragraphs that set the story").locator("textarea"), d.demo.lore, { delay: 12 });
      await d.hl(p.locator("aside.preview"), "Printed in italics");
      await d.sleep(2500);
      await d.smoothScroll(panel(p, "The Story"), "start");
      await d.hl(panel(p, "The Story"), "A page after the map");
      await d.say("The story page", "Everything below prints on its own page after the map, and all of it is optional: the long story, Story Locations, Special Tiles and numbered Paragraphs.");
      await d.smoothScroll(panel(p, "Story Locations"), "start");
      await d.hl([panel(p, "Story Locations"), panel(p, "Special Tiles")], "They send the reader to a paragraph");
      await d.say(
        "A story book",
        "Campaign and Solo Scenarios can tell their story like a story book: a location or a special Field sends the reader to a numbered paragraph, written `§12` or picked from the § Read menu.",
      );
      await d.smoothScroll(panel(p, "Paragraphs"), "start");
      await d.hl(panel(p, "Paragraphs"), "Numbered paragraphs");
      await d.say("Paragraphs", "Paragraphs end with choices that point on. Moving or removing one renumbers every reference. Our Clash leaves the story book empty, so it prints nothing.");
      await d.clear();
      await d.scrollTop();
    },
  },

  {
    num: 4,
    title: CHAPTERS[3],
    async run(d) {
      const p = d.page;
      await d.chapter(4, CHAPTERS[3], "Step III · Player Setup", "Step III: Rounds, player counts, resources and income, Units, Town Buildings, tile pool, Bonus.");
      await goStep(d, "Player Setup");
      const rounds = field(p, "Rounds");
      await d.say("Length and players", "10 Rounds, for 2 or 3 players. The page prints it as “2 or 3”.", 400);
      await d.click(rounds.locator(".stepper button").first());
      await d.click(rounds.locator(".stepper button").first());
      await d.type(field(p, "Note after the Round count").locator("input"), d.demo.roundsNote, { delay: 18 });
      await d.click(field(p, "Player Count").locator(".count-picker button", { hasText: exact("3") }));
      await d.hl([rounds, field(p, "Player Count")], "Length and player counts");
      await d.finishCue();
      await d.clear();
      await d.smoothScroll(panel(p, "Resources"));
      await d.hl(p.locator(".resource-table"), "Starting Resources and Income");
      await d.say("Resources", "Starting Resources per resource, and Starting Income as a position on the income track. They start at the values of the Mission Book's templates.");
      await d.clear();
      await d.smoothScroll(panel(p, "Starting Units"));
      await d.click(panel(p, "Starting Units").locator(".chip").first());
      await d.hl(panel(p, "Starting Units"), "Click a suggestion to add it");
      await d.say("Starting Units", "Add lines yourself or click a suggestion. Lines take the text markup, so icons like Bronze print as game icons.");
      await d.clear();
      await d.smoothScroll(panel(p, "Town Buildings"));
      await d.hl(panel(p, "Town Buildings"), "Buildings players start with");
      await d.say("Town Buildings", "Tick the buildings every player starts with; a Bronze Dwelling is the usual start.", 3000);
      await d.clear();
      await d.smoothScroll(panel(p, "Bonus"));
      await d.hl([panel(p, "Map Tile Pool"), panel(p, "Bonus")], "");
      await d.click(panel(p, "Bonus").locator(".chip", { hasText: "Treasure Die" }));
      await d.say("Tile pool and Bonus", "Turn on the Map Tile Pool if players place random tiles while exploring. The Bonus line takes one option, or several to choose from.");
      await d.clear();
      await d.scrollTop();
    },
  },

  {
    num: 5,
    title: CHAPTERS[4],
    async run(d) {
      const p = d.page;
      await d.chapter(5, CHAPTERS[4], "Step IV · Map", "Step IV map editor: palette, hex board, inspector; tiles placed by click and drag.");
      await goStep(d, "Map");
      await mapView(d);
      await p.locator(".palette-tile img").first().waitFor();
      await d.sleep(800);
      await d.hl(p.locator(".palette"), "The tile box");
      await d.say("The tile box", "Face-down tiles first (Starting I, Far II–III, Near IV–V, Center VI–VII, plus water and underground), then every printed tile of every expansion.");
      const plan = await planRing(p);
      map.plan = plan;
      await d.clear();

      // Click to arm, click to place.
      await d.say("Click, then click the board", "Click a tile to pick it up, then click the board to place it. The outline shows whether it fits.", 1500);
      await d.click(paletteTile(p, "S0"));
      const w = await cellScreen(p, ...plan.ring[3]);
      await d.moveTo(w.x + 30, w.y + 20, 500);
      await d.clickAt(w.x, w.y, 600);
      await d.key("Escape", "Esc");
      await d.sleep(1600);

      // Drag and drop from the palette.
      await d.say("Drag and drop", "Or drag a tile from the box straight onto the board.", 1200);
      const f2 = await cellScreen(p, ...plan.ring[4]);
      await d.dragDrop(paletteTile(p, "F0"), p.locator(".board"), f2);
      await d.sleep(1500);

      // Several of the same.
      await d.say("Place several", "A picked tile stays in your hand, so you can place several. Esc puts it down.", 1000);
      await d.click(paletteTile(p, "F0"));
      for (const k of [2, 5, 1]) {
        const c = await cellScreen(p, ...plan.ring[k]);
        await d.clickAt(c.x, c.y, 500);
      }
      await d.key("Escape", "Esc");
      await d.sleep(1200);

      // A printed tile, found by search.
      await d.say("Printed tiles", "Search the box by tile number or terrain, or filter by expansion, and place a printed tile where the Scenario needs a specific one.", 1500);
      await d.type(p.locator(".palette-filters input[type=search]"), d.demo.centerTile, { delay: 80 });
      await d.sleep(500);
      await d.click(paletteTile(p, d.demo.centerTile));
      const c0 = await cellScreen(p, ...plan.center);
      await d.clickAt(c0.x, c0.y, 900);

      // The same printed tile twice: the game has only one of each.
      const dup = await freeSpotNear(p, 0, 180, 2 * Math.sqrt(7) * 86 * 0.87); // west of the ring, where the board has room
      const dupAt = await cellScreen(p, dup.row, dup.col);
      await d.clickAt(dupAt.x, dupAt.y, 700);
      await d.click(p.locator(".armed-note button.link"), { hold: 500 }); // put the tile down, keep the selection
      await d.hl([p.locator(".map-status .warn", { hasText: "Placed more than once" }), p.locator(".inspector-warn")], "Placed more than once");
      await d.say("One of each printed tile", "Place a printed tile twice and the editor warns, in the panel and in the status bar: the game has only one of each.");
      await d.clear();
      await d.key("Escape", "Esc"); // with nothing selected, both copies show their red outline
      await d.hl([p.locator(".dupes path").nth(0), p.locator(".dupes path").nth(1)], "Both copies");
      await d.say("Both copies in red", "With nothing selected, both copies are outlined in red. Select the extra one and press Del to remove it.");
      await d.clear();
      await d.clickAt(dupAt.x, dupAt.y, 600);
      await d.key("Delete", "Del");
      await d.type(p.locator(".palette-filters input[type=search]"), "", { clear: true });
      await d.hideText();
      await d.sleep(1200);

      // The second Starting tile, first in the wrong place.
      await d.click(paletteTile(p, "S0"));
      const far = await cellScreen(p, ...plan.far);
      await d.clickAt(far.x, far.y, 500);
      await d.key("Escape", "Esc");
      await d.hl(p.locator(".map-status"), "Tile counts and warnings");
      await d.say("The status bar", "It counts the tiles by kind and warns when the map falls apart into unconnected parts, like now.");
      await d.clear();

      // Move it by dragging.
      await d.say("Move a tile", "Drag a placed tile to move it. It snaps to the hex grid.", 800);
      const e = await cellScreen(p, ...plan.ring[0]);
      await d.drag(far, e);
      await d.hl(p.locator(".map-status"), "All connected again");
      await d.sleep(2600);
      await d.clear();

      // Rotate.
      await d.say("Rotate", "Select a tile and press R to rotate it (Shift+R the other way), or use the Rotate buttons in the panel on the right.", 800);
      await d.clickAt(c0.x, c0.y, 600);
      await d.key("r", "R");
      await d.key("r", "R");
      await d.hl(p.locator(".inspector-actions"), "Rotate, Same again, Delete");
      await d.click(p.locator(".inspector-actions button").nth(1));
      await d.sleep(2200);
      await d.clear();
      await d.hl(p.locator(".board-zoom"), "Zoom and fit");
      await d.say("Navigate the board", "Drag the empty board to pan, use the mouse wheel or these buttons to zoom, and the last button fits the whole map.");
      await d.clear();
    },
  },

  {
    num: 6,
    title: CHAPTERS[5],
    async run(d) {
      const p = d.page;
      const { plan } = map;
      await d.chapter(6, CHAPTERS[5], "Step IV · Map", "Map editor inspector: Fields, player cubes, faction border and Hero, Monoliths, a Creature Bank, a blocked Field.");
      const insp = p.locator(".inspector");
      await mapView(d);

      // The inspector, on the western Starting Tile.
      const w = await fieldScreen(p, 0, ...plan.ring[3], 3);
      await d.clickAt(w.x, w.y, 700);
      await d.hl(insp, "The selected tile");
      await d.say("The inspector", "Select a tile to edit it: rotate it, and say what stands on each of its seven Fields.");
      await d.clear();

      // Cubes: one in each player's colour on their face-down Starting Tile.
      await d.say("Fields", "Click a Field on the map, or pick it in the little flower, then put things on it.", 1200);
      await d.hl(insp.locator(".mini-flower"), "Field picker");
      await d.sleep(1800);
      await d.click(field(insp, "Cube").locator('button[title="Castle"]'));
      const e = await fieldScreen(p, 0, ...plan.ring[0], 3);
      await d.clickAt(e.x, e.y, 700);
      await d.click(field(insp, "Cube").locator('button[title="Inferno"]'));
      await d.hl(field(insp, "Cube"), "Player colours, or Black");
      await d.say("Cubes", "A cube in a player's colour on a face-down Starting Tile marks whose start it is, as published Mission Book maps do. A Black Cube marks a location as already visited.");
      await d.clear();

      // Faction borders and Heroes: shown, but this Clash leaves them to the players.
      await d.hl(field(insp, "Faction border"), "Optional faction border");
      await d.say("Faction borders", "A face-down Starting Tile can also get a faction border. Our players choose their own Factions, so the tiles stay plain.", 3600);
      await d.hl(field(insp, "Hero"), "For a set Hero");
      await d.say("Heroes", "A Hero portrait marks where a set Hero stands, such as a Campaign's AI Hero. In a Clash the players bring their own.", 3600);
      await d.clear();

      // Location tokens: a pair of two-way Monoliths.
      await d.say("Location tokens", "Monoliths, Whirlpools and Subterranean Gates go on Fields as tokens, always with their partner: here a two-way Monolith pair joins the two flanks.", 400);
      const a = await fieldScreen(p, 0, ...plan.ring[4], 3);
      await d.clickAt(a.x, a.y, 600);
      await d.select(field(insp, "Location token").locator("select"), "monolith-2w-01a");
      const b = await fieldScreen(p, 0, ...plan.ring[1], 3);
      await d.clickAt(b.x, b.y, 600);
      await d.select(field(insp, "Location token").locator("select"), "monolith-2w-01b");
      await d.hl(field(insp, "Location token"), "Monoliths, Whirlpools, Gates");
      await d.finishCue();
      await d.clear();

      // Creature Bank: a random Far one, on a face-down Far Tile.
      await d.say("Creature Banks", "With the optional Creature Banks rule, Far and Near Tiles can hold a bank. This Random (Far) token says: when the tile is revealed, draw a Far bank for its Blocked Field.", 400);
      const cb = await fieldScreen(p, 0, ...plan.ring[5], 3);
      await d.clickAt(cb.x, cb.y, 600);
      await d.select(field(insp, "Creature Bank").locator("select"), "R1");
      await d.hl(field(insp, "Creature Bank"), "All 12 banks, and Random Far / Near");
      await d.finishCue();
      await d.clear();

      // Blocked Field: the flooded Mystical Garden of the Center Tile.
      await d.say("Blocked Fields", "Mark a Field the Scenario closes off: here the flood covers the Mystical Garden of C4 until a Timed Event opens it. Suggested placement draws a tile faded, as a hint.", 400);
      const bl = await fieldScreen(p, 0, ...plan.center, 5);
      await d.clickAt(bl.x, bl.y, 600);
      await d.click(insp.locator(".toggle", { hasText: "Blocked Field" }));
      await d.hl(insp.locator(".toggle", { hasText: "Blocked Field" }), "Blocked Field");
      await d.finishCue();
      await d.clear();
      await d.key("Escape", "Esc");
      await d.hl(p.locator(".board"), "");
      await d.sleep(2500);
      await d.clear();
    },
  },

  {
    num: 7,
    title: CHAPTERS[6],
    async run(d) {
      const p = d.page;
      await d.chapter(7, CHAPTERS[6], "Step IV · Map", "Map editor toolbar: layout name, player counts, caption; Export .map and PNG; a second layout via Import .map.");
      const settings = p.locator(".layout-settings");
      await mapView(d);
      await d.say("Layouts", "A Scenario can have several map layouts, for example one per player count. Each has a name, the player counts it is for, and a caption under the image.", 400);
      await d.type(settings.locator("input").first(), d.demo.layout2, { clear: true });
      await d.click(settings.locator(".layout-counts button", { hasText: exact("2") }));
      await d.hl(settings, "Name, player counts, caption");
      await d.finishCue();
      await d.clear();

      // Export .map and PNG.
      const mapFile = await d.expectDownload(() => d.click(p.locator(".map-actions button", { hasText: "Export .map" })));
      await d.hl(p.locator(".map-actions"), "Import .map, Export .map, Export PNG");
      await d.say(
        ".map and PNG",
        "Export .map saves the layout in the community map editor's format (for `assets/map-files/`); Export PNG renders the map image (for `assets/maps/`).",
        1500,
      );
      await d.expectDownload(() => d.click(p.locator(".map-actions button", { hasText: "Export PNG" })));
      await d.sleep(2800);
      await d.clear();

      // A second layout, from the .map file.
      await d.say("A second layout", "Add a layout for three players, then fill it from the .map file we just saved.", 1200);
      await d.click(p.locator(".layout-tabs button.add", { hasText: "+ Layout" }), { hold: 900 });
      await d.type(settings.locator("input").first(), d.demo.layout3, { clear: true });
      await d.click(settings.locator(".layout-counts button", { hasText: exact("3") }));
      await d.click(p.locator(".map-actions button", { hasText: "Import .map" }), { hold: 800 });
      const modal = p.locator(".modal");
      await d.hl(modal, "Paste the map editor's export, or open a .map file");
      await d.say("Import .map", "Paste the text from the community map editor, or open a `.map` file. Replace the layout or add the tiles to it.", 1500);
      await modal.locator('input[type="file"]').setInputFiles(mapFile);
      await d.sleep(1600);
      await d.click(modal.locator("button", { hasText: "Replace this layout" }), { hold: 1500 });
      await mapView(d);
      await d.clear();

      // A third Starting tile for the third player.
      await d.say("The third player", "The three-player layout gets a third face-down Starting Tile, with a cube in the third player's colour.", 400);
      const spot = await freeSpotNear(p, 1, -90, 2 * Math.sqrt(7) * 86 * 0.87);
      await d.click(paletteTile(p, "S0"));
      const s3 = await cellScreen(p, spot.row, spot.col);
      await d.clickAt(s3.x, s3.y, 600);
      await d.key("Escape", "Esc");
      await d.click(p.locator('.board-zoom button[title="Fit the map"]'), { hold: 900 });
      const sf = await fieldScreen(p, 1, spot.row, spot.col, 3);
      await d.clickAt(sf.x, sf.y, 600);
      await d.click(field(p.locator(".inspector"), "Cube").locator('button[title="Rampart"]')); // the third player's colour
      await d.hl(field(p.locator(".inspector"), "Cube"), "A third player colour");
      await d.finishCue();
      await d.clear();
      await d.key("Escape", "Esc");
      await mapView(d);
      await d.hl(p.locator(".layout-tabs"), "One tab per layout");
      await d.say("Layout tabs", "Switch layouts with the tabs. Duplicate copies the current layout as a starting point.", 3200);
      await d.clear();
    },
  },

  {
    num: 8,
    title: CHAPTERS[7],
    async run(d) {
      const p = d.page;
      await d.chapter(8, CHAPTERS[7], "Step V · Map Setup", "Step V: the tile list counted from the map, per-player counts, notes, Heroes Placement.");
      await goStep(d, "Map Setup");
      await d.hl(p.locator(".tile-count-table"), "Counted from the map");
      await d.say("Tile list", "The Map Setup list is counted from the map. Layouts with different tiles each get their own list, labelled by their player counts.");
      await d.click(p.locator(".toggle", { hasText: "Count the tiles from the map" }), { hold: 800 });
      await d.hl(p.locator(".tile-count-table"), "Type counts, or “per player” (2P)");
      await d.say("Your own counts", "Turn counting off to type the counts, or mark a count as per player, which prints as “2P”.");
      await d.click(p.locator(".toggle", { hasText: "Count the tiles from the map" }), { hold: 600 });
      await d.clear();
      await d.say("Notes", "Add a note to any tile line.", 400);
      await d.type(p.locator(".tile-count-row").nth(3).locator("input[type=text]"), d.demo.centerNote, { delay: 18 });
      await d.hl(p.locator(".tile-count-row").nth(3), "A note on a tile line");
      await d.finishCue(2200);
      await d.clear();
      await d.say("Heroes Placement", "Say where the Heroes start. Campaigns use this for the AI Heroes too.", 400);
      await d.type(panel(p, "Heroes Placement").locator("textarea"), d.demo.heroesPlacement, { delay: 14 });
      await d.hl(panel(p, "Heroes Placement"), "Where Heroes start");
      await d.finishCue(2400);
      await d.clear();
      await d.scrollTop();
    },
  },

  {
    num: 9,
    title: CHAPTERS[8],
    async run(d) {
      const p = d.page;
      await d.chapter(9, CHAPTERS[8], "Step VI · AI Opponent", "Step VI: the AI Hero switch and its fields (army, decks, skills, special rules).");
      await goStep(d, "AI Opponent");
      const toggle = p.locator(".toggle", { hasText: "AI-controlled Hero" });
      await d.click(toggle, { hold: 700 });
      await d.hl(p.locator("section.panel").first(), "Faction, army, decks, skills, special");
      await d.say("AI Hero Setup", "Campaigns and some cooperative Scenarios fight an AI Hero: its faction, army, AI deck, spell deck, skills and special rules. Campaigns switch this on by itself.");
      await d.clear();
      await d.click(toggle, { hold: 500 });
      await d.say("Not for a Clash", "Our Clash has no AI Hero, so we switch it off again.", 2400);
    },
  },

  {
    num: 10,
    title: CHAPTERS[9],
    async run(d) {
      const p = d.page;
      await d.chapter(10, CHAPTERS[9], "Step VII · Victory & Defeat", "Step VII: Victory and Defeat text boxes with suggestion chips.");
      await goStep(d, "Victory & Defeat");
      const win = panel(p, "Victory Conditions");
      await d.say("Victory", "Write how the Scenario is won. Suggestions add a common condition as a new paragraph.", 400);
      await d.type(win.locator("textarea"), d.demo.victoryText, { delay: 18 });
      await d.click(win.locator(".chip", { hasText: "Capture all enemy Towns" }), { hold: 700 });
      await d.hl(win, "Type, or click a suggestion");
      await d.finishCue();
      await d.clear();
      const lose = panel(p, "Defeat Conditions");
      await d.say("Defeat", "And how it is lost, or say there is no defeat other than the end of the last Round.", 400);
      await d.click(lose.locator(".chip", { hasText: "Your Town is captured" }), { hold: 700 });
      await d.hl(lose, "How it is lost");
      await d.finishCue();
      await d.clear();
    },
  },

  {
    num: 11,
    title: CHAPTERS[10],
    async run(d) {
      const p = d.page;
      await d.chapter(11, CHAPTERS[10], "Step VIII · Timed Events", "Step VIII: events by Round, Round pickers, repeats, suggestion chips.");
      await goStep(d, "Timed Events");
      const add = p.locator(".panel-head button", { hasText: "+ Add event" });
      await d.say("Events by Round", "Add an event and pick its Rounds: several Rounds make it repeat, listed in Round order. Then type the events or click a suggestion.", 400);
      await d.click(add, { hold: 800 });
      let ev = p.locator("section.panel").nth(1);
      await d.click(ev.locator(".round-picker button", { hasText: exact("2") }));
      for (const r of ["3", "6", "9"]) await d.click(ev.locator(".round-picker button", { hasText: exact(r) }));
      await d.click(ev.locator(".chip", { hasText: "Remove all Black Cubes" }), { hold: 700 });
      await d.hl(ev, "Pick the Rounds, add the events");
      await d.finishCue();
      await d.clear();
      await d.say("The flood recedes", "A second event in the 6th Round opens the flooded Mystical Garden, the Blocked Field we marked on the map.", 400);
      await d.click(add, { hold: 800 });
      ev = p.locator("section.panel").nth(2);
      await d.smoothScroll(ev);
      await d.click(ev.locator(".round-picker button", { hasText: exact("2") }));
      await d.click(ev.locator(".round-picker button", { hasText: exact("6") }));
      await d.type(ev.locator(".list-row input[type=text]").first(), d.demo.floodEvent, { delay: 14 });
      await d.hl(ev, "Two events can share a Round");
      await d.finishCue();
      await d.clear();
      await d.scrollTop();
    },
  },

  {
    num: 12,
    title: CHAPTERS[11],
    async run(d) {
      const p = d.page;
      await d.chapter(12, CHAPTERS[11], "Step IX · Rules", "Step IX: Additional Rules with suggestions, and an own section with title, text and bullets.");
      await goStep(d, "Rules");
      const rules = panel(p, "Additional Rules");
      await d.say("Additional Rules", "Rules that change the game for this Scenario: an optional introduction and one bullet per rule.", 400);
      await d.type(field(rules, "Introduction (optional)").locator("textarea"), d.demo.rulesIntro, { delay: 16 });
      await d.click(rules.locator(".chip", { hasText: "Astrologers Proclaim Cards are not used" }), { hold: 700 });
      await d.hl(rules, "Additional Rules");
      await d.finishCue();
      await d.clear();
      await d.say("Own sections", "Sections of your own, such as “Enemy Spawning and Movement”, follow the Additional Rules, each with a title, text and bullets.", 400);
      await d.click(p.locator(".panel-head button", { hasText: "+ Add section" }), { hold: 700 });
      const sec = p.locator("section.panel").last();
      await d.smoothScroll(sec);
      await d.type(field(sec, "Title").locator("input"), d.demo.section.title);
      await d.type(field(sec, "Text").locator("textarea"), d.demo.section.text, { delay: 16 });
      await d.click(sec.locator(".list-actions button"), { hold: 400 });
      await d.type(sec.locator(".list-row textarea").last(), d.demo.section.bullet, { delay: 16 });
      await d.hl(sec, "Your own section");
      await d.finishCue();
      await d.clear();
    },
  },

  {
    num: 13,
    title: CHAPTERS[12],
    async run(d) {
      const p = d.page;
      await d.chapter(13, CHAPTERS[12], "Every text field", "A rule typed with the B button, a dash, quotes and the Icon picker; the live page renders them.");
      const rules = panel(p, "Additional Rules");
      await d.smoothScroll(rules);
      await d.say(
        "Markup instead of LaTeX",
        "Every text field takes a small markup: `**bold**`, `*italic*`, `:gold:` for any game icon, \"quotes\" and `--` for a dash.",
        2000,
      );
      await d.click(rules.locator(".list-actions button", { hasText: "Add a rule" }), { hold: 400 });
      const row = rules.locator(".list-row").last();
      const box = row.locator("textarea");
      const mr = d.demo.markupRule;
      await d.type(box, mr.before, { delay: 30 });
      await d.hl(row.locator(".markup-tools"), "B, I and Icon buttons");
      await d.click(row.locator('.markup-tools button[title^="Bold"]'), { hold: 300 });
      await box.pressSequentially(mr.bold, { delay: 40 });
      await d.page.keyboard.press("End");
      await box.pressSequentially(mr.after, { delay: 26 });
      await d.click(row.locator(".glyph-picker > button"), { hold: 700 });
      await d.hl(row.locator(".glyph-pop"), "Pick a game icon");
      await d.say("The Icon button", "The Icon button opens the game icons; “Show all” lists every one. A click inserts its `:name:`.", 2600);
      await d.click(row.locator('.glyph-pop button[title="gold"]'), { hold: 700 });
      await d.clear();
      const li = p.locator("aside.preview li").filter({ hasText: mr.bold }).first();
      await d.smoothScroll(li);
      await d.hl([row, li], "");
      await d.say("Rendered on the page", "The page shows bold text, the dash, curly quotes and the gold icon, exactly as the Mission Book prints them.");
      await d.clear();
    },
  },

  {
    num: 14,
    title: CHAPTERS[13],
    async run(d) {
      const p = d.page;
      await d.chapter(14, CHAPTERS[13], "Top bar", "Removing a rule and undoing it; the autosave note, Save file, and reopening from the start screen.");
      const rules = panel(p, "Additional Rules");
      await d.smoothScroll(rules);
      const first = rules.locator(".list-row").first();
      await d.say("Undo and redo", "Removed something by mistake? Undo it with the arrow buttons, or Ctrl+Z and Ctrl+Y.", 1200);
      await d.click(first.locator('button[title="Remove"]'), { hold: 900 });
      await d.scrollTop();
      await d.hl(p.locator('.topbar-actions button[title^="Undo"]'), "Undo (Ctrl+Z)");
      await d.key("Control+z", "Ctrl+Z");
      await d.sleep(1200);
      await d.smoothScroll(rules);
      await d.hl(rules.locator(".list-row").first(), "The rule is back");
      await d.sleep(2200);
      await d.clear();
      await d.scrollTop();
      await d.hl(p.locator(".save-state"), "Autosaved in this browser");
      await d.say("Autosave", "Every change is saved in this browser as you work. Clearing the browser's data clears it too, so keep a file.", 3600);
      await d.expectDownload(() => d.click(p.locator(".topbar-actions button", { hasText: "Save file" })));
      await d.hl(p.locator(".topbar-actions button", { hasText: "Save file" }), "Download the project file");
      await d.say("Save file", "Save file downloads the project as `.scenario.json`. Open it on the start screen to keep editing, on any computer.");
      await d.clear();
      await d.click(p.locator(".topbar .brand"), { hold: 1200 });
      await d.hl(p.locator(".project-list"), "Your saved project");
      await d.say("Back to the start", "The logo takes you to the start screen. The project is listed under Continue; click it to carry on.", 3200);
      await d.click(p.locator(".project-list .project-open").first(), { hold: 1200 });
      await d.clear();
    },
  },

  {
    num: 15,
    title: CHAPTERS[14],
    async run(d) {
      const p = d.page;
      await d.chapter(15, CHAPTERS[14], "Step X · Review & Export", "Step X: checklist with the Mission Book lint, then the Page, LaTeX and How to submit tabs.");
      await goStep(d, "Review & Export");
      const check = panel(p, "Checklist");
      await d.hl(check, "What the Mission Book checks");
      await d.say("Checklist", "The checklist lists what is missing (Fix) and what a reviewer would ask about (Check), with a link to the step.");
      const caps = check.locator("li", { hasText: "should be capitalised" }).first();
      await d.hl(caps, "Mission Book capitalisation lint");
      await d.say("Capitalisation lint", "It also runs the Mission Book's capitalisation check: game terms such as Hero, Field or Round are written with a capital.");
      await d.clear();
      await goStep(d, "Rules");
      const sec = p.locator("section.panel").last();
      await d.smoothScroll(sec);
      await d.type(sec.locator(".list-row textarea").last(), d.demo.section.fixed, { clear: true, delay: 10 });
      await d.sleep(600);
      await goStep(d, "Review & Export");
      await d.hl(check.locator(".panel-head"), "Ready");
      await d.say("Fixed", "With “Round”, “Hero” and “Field” capitalised, the checklist is clear.", 2800);
      await d.clear();

      const prev = panel(p, "Preview");
      await d.smoothScroll(prev, "start");
      await d.hl(prev.locator(".panel-head .segmented"), "Page, LaTeX, How to submit");
      await d.say("Page preview", "The Preview shows the full Mission Book page, map included.", 1800);
      await d.clear();
      await d.page.mouse.wheel(0, 500);
      await d.sleep(1800);
      await d.smoothScroll(prev, "start");
      await d.click(prev.locator(".segmented button", { hasText: "LaTeX" }), { hold: 700 });
      await d.hl(prev.locator(".code-actions"), "Copy, and the line for main.tex");
      await d.say("LaTeX", "The LaTeX tab shows the `.tex` file the app writes, a Copy button, and the line to register it in `main.tex`.");
      await d.clear();
      await d.click(prev.locator(".segmented button", { hasText: "How to submit" }), { hold: 700 });
      await d.hl(prev.locator("pre.code"), "HOW-TO-SUBMIT.md");
      await d.say("How to submit", "The submit guide: where each file goes, the `main.tex` line, how to build, and the pull request. It is also in the ZIP.");
      await d.clear();
    },
  },

  {
    num: 16,
    title: CHAPTERS[15],
    async run(d) {
      const p = d.page;
      await d.chapter(16, CHAPTERS[15], "Step X · Review & Export", "Export panel: ZIP bundle, PDF, LaTeX, project file, per-layout .map and PNG; then the closing card.");
      const exp = panel(p, "Export");
      await d.smoothScroll(exp);
      const zip = exp.locator("button.big", { hasText: "Mission Book bundle" }).first();
      await d.hl(zip, "Everything for the pull request");
      await d.say("The ZIP bundle", "One click builds the whole bundle: the `.tex`, each layout's map PNG and `.map` file, the PDF, the project file and HOW-TO-SUBMIT.md.", 1200);
      const zipFile = await d.expectDownload(() => d.click(zip, { hold: 200 }), 120000);
      await d.sleep(1500);
      const big = (title) => exp.locator("button.big").filter({ has: p.locator("span", { hasText: exact(title) }) }).first();
      const pdf = big("PDF");
      await d.hl(pdf, "Book-style PDF");
      await d.say("PDF", "The PDF lays out the Scenario like the book, to print or share.", 800);
      await d.expectDownload(() => d.click(pdf, { hold: 200 }), 120000);
      await d.sleep(1500);
      const tex = big("LaTeX (.tex)");
      const proj = big("Project file");
      await d.hl([tex, proj], "");
      await d.say("Single files", "Or download single files: the `.tex`, the project file, and each layout's `.map` and PNG below.", 800);
      await d.expectDownload(() => d.click(tex));
      await d.expectDownload(() => d.click(proj));
      await d.hl([exp.locator(".export-map").nth(0), exp.locator(".export-map").nth(1)], "Per layout");
      await d.sleep(2800);
      await d.clear();
      await d.hideText();

      // Closing card: what is in the ZIP and where it goes.
      const { unzipSync } = d.repoRequire("fflate");
      const files = Object.keys(unzipSync(new Uint8Array(fs.readFileSync(zipFile)))).filter((f) => !f.endsWith("/"));
      const where = (f) => {
        if (f.startsWith("draft-scenarios/")) return `Mission Book <b>${path.posix.dirname(f)}/</b> (+ one line in its main.tex)`;
        if (f.startsWith("assets/maps/")) return "Mission Book <b>assets/maps/</b>";
        if (f.startsWith("assets/map-files/")) return "Mission Book <b>assets/map-files/</b>";
        if (f.startsWith("assets/images/")) return "Mission Book <b>assets/images/</b>";
        if (f.endsWith(".pdf")) return "To print or share (not part of the pull request)";
        if (f.endsWith(".scenario.json")) return "Keep it: reopens the project in the Scenario Creator";
        if (f.endsWith(".md")) return "Read first: the main.tex line, build and pull request steps";
        return "";
      };
      const rows = files
        .map((f) => f.split("/").slice(1).join("/"))
        .sort()
        .map((f) => `<tr><td>${f}</td><td>${where(f)}</td></tr>`)
        .join("");
      const start = d.time();
      await d.card(
        `<div class="kicker">Exported</div>
         <h2>${path.basename(zipFile)}</h2>
         <table><tr><th>File in the bundle</th><th>Where it goes</th></tr>${rows}</table>
         <div class="note">The ZIP mirrors the Mission Book repository (github.com/qwrtln/Homm3BG-mission-book).
         New scenarios go to the Draft Scenarios booklet; open one pull request per scenario.</div>`,
        12000,
      );
      d.cue("Exported files", "The ZIP mirrors the Mission Book repository: the .tex goes to draft-scenarios/, the map PNGs to assets/maps/, the .map files to assets/map-files/. HOW-TO-SUBMIT.md has the rest.", start, d.time());
      const start2 = d.time();
      await d.card(
        `<div class="kicker">That's it</div>
         <h1>Happy scenario writing!</h1>
         <div class="sub">Write &rarr; lay out the map &rarr; check &rarr; export &rarr; open a pull request to the Mission Book</div>`,
        5000,
      );
      d.cue("Happy scenario writing!", "Write, lay out the map, check, export, and open a pull request to the Mission Book.", start2, d.time());
    },
  },
];
