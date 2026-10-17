# Template scenario: Lanterns over the Mistfall Marches

A finished, fictional Campaign Scenario that uses nearly every feature of the Scenario Creator, each one for a reason the
rules support. The exports were written by the app's own exporters from the project file; the text and the title icon are
original. It is an example to copy from, not a real Mission Book scenario.

## Open it

- In the app, press **Open the template** on the start screen, or
- choose **Open a project** and pick `lanterns_over_the_mistfall_marches.scenario.json`.

Then walk through the steps, or open **Review & Export** to see the checklist (clean), the live page, the LaTeX and
the exports.

## Files

| File | What it is |
| --- | --- |
| `lanterns_over_the_mistfall_marches.scenario.json` | the project file (reopen and edit) |
| `lanterns_over_the_mistfall_marches.tex` | the Mission Book page (`draft-scenarios/campaigns/`) |
| `lanterns_over_the_mistfall_marches.pdf` | the book-style PDF |
| `assets/maps/*_1p.png`, `*_2p.png` | the map images, one per layout (`assets/maps/`) |
| `assets/map-files/*_1p.map`, `*_2p.map` | the maps in the community map editor format (`assets/map-files/`) |
| `assets/images/lanterns_over_the_mistfall_marches.png` | the uploaded title icon (`assets/images/`) |

The map PNGs were reduced to 256-colour palettes (about 1 MB each instead of 4 MB); the whole folder is about 7 MB, most
of it the PDF. `tests/example.test.ts` checks that the project file opens, the checklist is clean, the map tokens are
placed the way the rules allow, and the `.tex` and `.map` files still match what the app writes from it.

## How the scenario works

Gem, a Rampart Lantern Keeper, must relight the Lanterns of the old road, light the Beacon on Mistfall Hill and defeat
the Mist Witch, a Necropolis AI Hero, within 12 Rounds (+2 once the Beacon burns). In a 2-player game a Castle ally
joins from the south.

- **Map.** Greywatch (the printed Rampart Starting Tile S4, since the Faction is fixed) lies in the west, Mistfall Hill
  (N7) in the east. Two roads run around the Mere (W1): the northern one past the Lantern of N3, the southern one past
  the Lantern of N4. The Barrow (Subterranean Tile U2) lies under the hill and is reached only through the Subterranean
  Gate, a two-Field token with one half on N7 and one on U2.
- **The fog.** Every Tile is in the fog except the Tiles at and next to a Town or a lit Lantern. In the fog, guarded
  Fields are one Level higher (the next row of the Field Difficulty Level Table). Mist Walls (the red crosses) are
  Blocked Fields while in the fog and seal the hill, so at least one Lantern has to be lit.
- **Lanterns and the Beacon** are the Obelisks of N3, N4 and N7 (Obelisk effects are Scenario-defined). A Black Cube marks
  a dark one; flagging it lights it. A Lantern gives 1 Experience and reveals the Tiles around it; the Beacon lifts all
  fog, adds 2 Rounds and wakes the Mist Witch.
- **Fog Armies** of Necropolis Neutral Units rise through the Gate in the 5th, 8th and 11th Rounds (Level III, IV, V; one
  Level higher for 2 players) and hunt the closest Hero, with no Quick Combat and no Retreat. They stop once the Witch
  falls.
- **Balance.** Starting Resources (10/3/1), Income (10/0/0), two "Few" bronze Units and a bronze Dwelling with a Citadel
  match the first chapter of the published Castle Campaign. The Witch fields five Units (two "Packs" and three "Fews",
  one of them golden) with a 6-card AI Deck and three Spells, stronger in a 2-player game, and Main Heroes stop at
  Level V.

## What each step demonstrates

| Step | Shown |
| --- | --- |
| Basics | Campaign type with campaign name and Scenario number 1 (opens the campaign in the table of contents), Faction, own heading line, 2-line title, silver rating, author, source label and link, uploaded title icon |
| Story | flavor text, a long "The Story" page with four sections read at set moments, the B / I / Icon buttons |
| Player Setup | Rounds with a note, player counts 1 and 2, Faction Hero, Starting Resources and Income (on the track), named Starting Units with a 2-player line, Town Buildings, Map Tile Pool with an extra sentence, a Bonus with three options |
| Map | two layouts (1 player, 2 players, own caption), face-down and printed tiles, a Water tile, a Subterranean tile, a rotated tile, Black Cubes, Heroes, a location token in two halves (the Subterranean Gate), a Creature Bank on its Tile's Blocked Field, blocked Fields (Mist Walls), rotated tokens, a suggested-placement (faded) tile |
| Map Setup | automatic tile counts, one list per layout, notes on the tile lines, extra lines, Heroes Placement |
| AI Opponent | AI Hero Setup with Faction, army, AI Deck, Spell Deck, skill and a special rule |
| Victory & Defeat | two paragraphs each |
| Timed Events | a single Round and one event repeating in three Rounds (5th, 8th and 11th) |
| Rules | introduction, Additional Rules with 2-player lines, four own sections |
| Review & Export | clean checklist (including the Mission Book capitalisation lint), preview, `.tex`, PDF, map PNGs and `.map` files, project file, ZIP bundle |

Text markup used: `**bold**`, `*italic*`, `:gold:` style icons, `"quotes"` and `--` for a dash.

## Not shown

- Faction borders: they mark random Starting Tiles, and both Factions here are fixed, so their printed Starting Tiles are
  used.
- Monoliths and Whirlpools: on this compact map a teleport pair would only let Heroes skip the Lanterns, and a lone
  Whirlpool or Monolith leads nowhere.
- Map Setup counts typed by hand (`2P` x Far Tiles): the template counts tiles from the map instead, and the two options
  exclude each other.
- Alliance and Clash specifics (the Campaign type was picked because it shows the most).
