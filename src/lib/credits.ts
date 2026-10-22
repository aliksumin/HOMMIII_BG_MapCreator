// Attribution that travels with the exported files: a credit line in the PDF
// and a CREDITS.md in the ZIP bundle. NOTICE.md in the repository holds the
// full credits for the app itself.

import type { Scenario } from "../model/types.ts";

export const CC_BY_NC_SA = "CC BY-NC-SA 4.0";
export const CC_BY_NC_SA_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
export const MISSION_BOOK_URL = "https://github.com/qwrtln/Homm3BG-mission-book";
export const RULE_BOOK_URL = "https://github.com/Heegu-sama/Homm3BG";
export const MAP_EDITOR_URL = "https://github.com/zedero/homm3boardgame";
export const APP_URL = "https://github.com/aliksumin/HOMMIII_BG_MapCreator";

/** What an export holds that changes its credits. */
export interface ArtUse {
  /** the title image is the author's own upload, not Mission Book art */
  uploadedTitle: boolean;
  /** a map shows Creature Bank tokens, which this app draws itself */
  creatureBanks: boolean;
}

export function artUse(s: Scenario): ArtUse {
  return {
    uploadedTitle: s.titleImage?.kind === "upload",
    creatureBanks: s.maps.some((m) => m.tiles.some((t) => t.creaturebanks.some(Boolean))),
  };
}

/** The credit printed at the foot of the PDF's last page and stored in its metadata. */
export function pdfCredit(use: ArtUse): string {
  return [
    `Page art, section headings, icons${use.uploadedTitle ? "" : " and title image"}: Fan-Made Mission Book by qwrtln`,
    `and contributors (github.com/qwrtln/Homm3BG-mission-book) and Rewritten Rule Book by Heegu-sama and contributors`,
    `(github.com/Heegu-sama/Homm3BG), ${CC_BY_NC_SA} (${CC_BY_NC_SA_URL}); resized.`,
    use.uploadedTitle ? "Title image: the author's own." : "",
    "Map tiles, location tokens and portraits: Archon Studio's game art via zedero's community map editor.",
    use.creatureBanks ? "Creature Bank tokens: drawn by the HoMM3 BG Scenario Creator." : "",
    "Unofficial, non-commercial fan content.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** CREDITS.md for the ZIP bundle: where the art in the exported files comes from. */
export function creditsMarkdown(slug: string, use: ArtUse): string {
  return [
    "# Credits",
    "",
    "Where the art in these exported files comes from, and under which terms it may be shared.",
    "",
    `- **\`${slug}.pdf\`** contains page art, section headings and icons (glyphs)${use.uploadedTitle ? "" : " and the title image"}`,
    `  from the Fan-Made Mission Book by qwrtln and contributors (${MISSION_BOOK_URL}). Its layout comes from the`,
    `  Rewritten Rule Book by Heegu-sama and contributors (${RULE_BOOK_URL}). Both are licensed`,
    `  ${CC_BY_NC_SA} (${CC_BY_NC_SA_URL}). Changes: resized and converted for the PDF. Share the PDF only`,
    "  for non-commercial purposes, with this attribution, and share changed versions of that art under the same license.",
    ...(use.uploadedTitle
      ? [
          `- **The title image** (\`assets/images/${slug}.png\`, also in the PDF) was supplied by the scenario's author;`,
          "  the licenses above do not cover it.",
        ]
      : []),
    "- **The map images** (`assets/maps/*.png`) and the maps in the PDF show map tiles, location tokens and Hero",
    `  portraits from the community map editor by zedero and contributors (${MAP_EDITOR_URL}). The art belongs to`,
    "  Archon Studio and is used as unofficial, non-commercial fan content.",
    ...(use.creatureBanks
      ? [
          "- **Creature Bank tokens** on the maps are plain name tokens drawn by the HoMM3 BG Scenario Creator",
          "  (AGPL-3.0-or-later), not game art.",
        ]
      : []),
    "- **Fonts** embedded in the PDF: Liberation Serif, SIL Open Font License.",
    "",
    `Made with the HoMM3 BG Scenario Creator (${APP_URL}).`,
    "",
    "Unofficial fan content. Heroes of Might and Magic is a trademark of Ubisoft Entertainment.",
    "Heroes of Might & Magic III: The Board Game is published by Archon Studio.",
    "",
  ].join("\n");
}
