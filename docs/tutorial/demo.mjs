// The demo scenario typed in the video. Original and fictional, written for
// this tutorial; not taken from the Mission Book. It is a small Clash that
// the rules support: players choose their Factions (so the Starting Tiles
// are face-down, with a cube in each player's colour on them, as published
// Mission Book maps do), the Center Tile is C4 with the Grail in the middle,
// its Mystical Garden is flooded (a Blocked Field) until a Timed Event opens
// it, and an optional Creature Bank waits on a Far Tile.

export const DEMO = {
  name: "The Flooded Ford",
  author: "Tutorial Demo",
  sourceLabel: "Scenario Creator tutorial",
  titleIconFilter: "obelisk",
  titleIcon: "obelisk",
  lore:
    "Every spring the river Brindle floods the old ford, and every spring the lords of the valley race to the drowned shrine " +
    "in the middle, where the Grail is said to rest. This year the water is higher than ever.",
  rounds: 10,
  roundsNote: "(12 Rounds for 3 players)",
  victoryText: "Be the first player to carry the **Grail** from the Center Tile to your Town.",
  heroesPlacement: "Each player places their Main Hero on the Town Field of their Starting Tile.",
  centerTile: "C4",
  centerNote: "C4, with the Grail in the middle",
  floodEvent: "The flood recedes: the Mystical Garden of the Center Tile is no longer a Blocked Field.",
  rulesIntro: "During this Scenario, the following rules apply:",
  section: {
    title: "The flood",
    text: "The Mystical Garden of the Center Tile is under water at the start.",
    // "round", "hero" and "field" in lower case on purpose: the Mission Book lint flags them in step X.
    bullet: "Until the 6th round, no hero can enter the flooded field.",
    fixed: "Until the 6th Round, no Hero can enter the flooded Field.",
  },
  // typed in step XIII with the B and Icon buttons: before **bold** after :gold:
  markupRule: {
    before: "Play with the optional ",
    bold: "Creature Banks",
    after: ' rule -- the "Random (Far)" token marks the Far Tile that gets one, and the first Hero to clear it gains 3',
  },
  layout2: "2 players",
  layout3: "3 players",
};
