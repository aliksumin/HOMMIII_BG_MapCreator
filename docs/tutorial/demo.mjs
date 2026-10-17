// The demo scenario typed in the video. Original and fictional, written for
// this tutorial; not taken from the Mission Book.

export const DEMO = {
  name: "Lanterns of Brindlemere",
  author: "Tutorial Demo",
  sourceLabel: "Scenario Creator tutorial",
  titleIconFilter: "obelisk",
  titleIcon: "obelisk",
  lore:
    "Every autumn the marsh town of Brindlemere lights a thousand lanterns to guide its ferrymen home. " +
    "This year the lanterns went dark, and two rival lords rode out to claim the old ford before the mist rises.",
  rounds: 10,
  roundsNote: "(+2 if no one holds the Ford)",
  victoryText: "Be the first player to bring **3 Lanterns** to your Town.",
  heroesPlacement: "Each player places their Main Hero on the Town Field of their Starting Tile.",
  centerNote: "with the Ford in the middle",
  rulesIntro: "During this Scenario, the following rules apply:",
  section: {
    title: "Lanterns",
    text: "Lanterns are the tokens this Scenario adds.",
    // "hero" in lower case on purpose: the Mission Book lint flags it in step X.
    bullet: "A hero who visits a Mine flips it and takes a Lantern.",
  },
  layout2: "2 players",
  layout3: "3 players",
};
