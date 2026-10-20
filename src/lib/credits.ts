// Attribution that travels with the exported files: a credit line in the PDF
// and a CREDITS.md in the ZIP bundle. NOTICE.md in the repository holds the
// full credits for the app itself.

export const CC_BY_NC_SA = "CC BY-NC-SA 4.0";
export const CC_BY_NC_SA_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
export const MISSION_BOOK_URL = "https://github.com/qwrtln/Homm3BG-mission-book";
export const RULE_BOOK_URL = "https://github.com/Heegu-sama/Homm3BG";
export const MAP_EDITOR_URL = "https://github.com/zedero/homm3boardgame";
export const APP_URL = "https://github.com/aliksumin/HOMMIII_BG_MapCreator";

/** The credit printed at the foot of the PDF's last page and stored in its metadata. */
export const PDF_CREDIT =
  `Page art, section headings, icons and title images: Fan-Made Mission Book by qwrtln and contributors ` +
  `(${MISSION_BOOK_URL}) and Rewritten Rule Book by Heegu-sama and contributors (${RULE_BOOK_URL}), ` +
  `${CC_BY_NC_SA} (${CC_BY_NC_SA_URL}); resized. Map tiles, tokens and portraits: Archon Studio's game art via ` +
  `the community map editor by zedero and contributors. Unofficial, non-commercial fan content.`;

/** CREDITS.md for the ZIP bundle: where the art in the exported files comes from. */
export function creditsMarkdown(slug: string): string {
  return [
    "# Credits",
    "",
    "Where the art in these exported files comes from, and under which terms it may be shared.",
    "",
    `- **\`${slug}.pdf\`** contains page art, section headings, icons (glyphs) and title images from the`,
    `  Fan-Made Mission Book by qwrtln and contributors (${MISSION_BOOK_URL}). Its layout comes from the`,
    `  Rewritten Rule Book by Heegu-sama and contributors (${RULE_BOOK_URL}). Both are licensed`,
    `  ${CC_BY_NC_SA} (${CC_BY_NC_SA_URL}). Changes: resized and converted for the PDF. Share the PDF only`,
    "  for non-commercial purposes, with this attribution, and share changed versions under the same license.",
    "- **The map images** (`assets/maps/*.png`) and the maps in the PDF show map tiles, tokens and Hero portraits",
    `  from the community map editor by zedero and contributors (${MAP_EDITOR_URL}). The art belongs to`,
    "  Archon Studio and is used as unofficial, non-commercial fan content.",
    "- **Fonts** embedded in the PDF: Liberation Serif, SIL Open Font License.",
    "",
    `Made with the HoMM3 BG Scenario Creator (${APP_URL}).`,
    "",
    "Unofficial fan content. Heroes of Might and Magic is a trademark of Ubisoft Entertainment.",
    "Heroes of Might & Magic III: The Board Game is published by Archon Studio.",
    "",
  ].join("\n");
}
