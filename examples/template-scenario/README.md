# Template scenario: Lanterns over the Mistfall Marches

A finished, fictional Campaign Scenario that uses nearly every feature of the Scenario Creator. Everything here was
produced by driving the app itself; the text and the title icon are original. It is an example to copy from, not a
real Mission Book scenario.

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

The map PNGs were re-compressed losslessly (about 0.5 MB each instead of 2 MB); the whole folder is about 4.5 MB, most of
it the PDF. `tests/example.test.ts` checks that the project file opens, the checklist is clean and the `.tex` and `.map`
files still match what the app writes from it.

## What each step demonstrates

| Step | Shown |
| --- | --- |
| Basics | Campaign type with campaign name and Scenario number 1 (opens the campaign in the table of contents), Faction, own heading line, 2-line title, silver rating, author, source label and link, uploaded title icon |
| Story | flavor text, a long "The Story" page, the B / I / Icon buttons |
| Player Setup | Rounds with a note, player counts 1 and 2, Faction Hero, Starting Resources and Income (on the track), Starting Units (chips and a custom line), Town Buildings, Map Tile Pool with an extra sentence, a Bonus with three options |
| Map | two layouts (1 player, 2 players, own caption), face-down and printed tiles, a Water tile, rotated tiles, faction borders, cubes of several colours, Heroes, location tokens (Monolith, Gate, Whirlpool), Creature Banks, blocked Fields, rotated tokens, a suggested-placement tile, drag to move, Duplicate layout |
| Map Setup | automatic tile counts, one list per layout, notes on the tile lines, extra lines, Heroes Placement |
| AI Opponent | AI Hero Setup with Faction, army, decks, skills and a special rule |
| Victory & Defeat | two paragraphs each |
| Timed Events | a single Round, a repeating event (5th and 8th Rounds) and a "Repeat the Timed Events of ..." line |
| Rules | introduction, Additional Rules, two own sections (reordered) |
| Review & Export | clean checklist (including the Mission Book capitalisation lint), preview, `.tex`, PDF, map PNGs and `.map` files, project file, ZIP bundle |

Text markup used: `**bold**`, `*italic*`, `:gold:` style icons, `"quotes"` and `--` for a dash.

## Not shown

- Map Setup counts typed by hand (`2P` x Far Tiles): the template counts tiles from the map instead, and the two options
  exclude each other.
- Alliance and Clash specifics (the Campaign type was picked because it shows the most).
- Subterranean tiles, other expansions' printed tiles, Heroes on every Field.
