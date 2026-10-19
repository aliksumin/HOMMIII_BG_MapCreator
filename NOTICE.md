# Notices

Copyright (C) 2026 Albert Sumin.

The code of this app is free software, licensed under the GNU Affero General Public License, version 3
or (at your option) any later version (AGPL-3.0-or-later; see `LICENSE`, or
https://www.gnu.org/licenses/agpl-3.0.html). It comes with no warranty. If you run a
changed version for other people over a network, the AGPL asks you to offer them its source code. The AGPL covers
the code only, not the art and data listed below.

Code from other projects:

- `BASE_TILE` in `src/lib/mapfile.ts` follows the tile defaults of the HoMM3 Board Game Scenario Map Editor by
  zedero and contributors (https://github.com/zedero/homm3boardgame, MIT as declared in its `package.json`), so
  `.map` files stay compatible with that editor.
- Earlier versions of `src/lib/document.ts`, `src/lib/markup.ts` and `src/data/game.ts` (up to commit `a0311e0`)
  held code adapted from the Scenario Builder of the Fan-Made Mission Book by qwrtln and contributors
  (https://github.com/qwrtln/Homm3BG-mission-book/tree/main/web, AGPL-3.0). That code has been rewritten; the app's
  AGPL-3.0 license also covers the earlier versions.
- Game terms and rule phrases follow the Rewritten Rule Book and the Mission Book templates (see below).

The art and data under `public/assets/` and `src/data/catalog.json` come from other community projects and keep
their own licenses (see also `public/assets/LICENSE.md`):

- **Map tiles, Hero portraits, location tokens and the tile catalog** (`public/assets/tiles/`, `portraits/`,
  `map-locations/` and `src/data/catalog.json`) - from the HoMM3 Board Game Scenario Map Editor by zedero and
  contributors, https://github.com/zedero/homm3boardgame. That repository has no LICENSE file; its `package.json`
  declares the MIT license. Resized to WebP. The tile, portrait and token pictures are components of
  *Heroes of Might & Magic III: The Board Game*; their art belongs to Archon Studio and is used here as fan content.
- **Creature Banks** (`public/assets/creature-banks/`) - plain name tokens drawn by `tools/bank-tokens.mjs` until the
  map editor has art for all twelve (issue #14); same AGPL-3.0 license as the code.
- **Game icons (glyphs), scenario title icons, page layout art and section headings** (`public/assets/glyphs/`,
  `images/`, `layout/` and `pdf/`) - from the Fan-Made Mission Book by qwrtln and contributors,
  https://github.com/qwrtln/Homm3BG-mission-book, licensed CC BY-NC-SA 4.0
  (https://creativecommons.org/licenses/by-nc-sa/4.0/). Resized to WebP (the copies under `pdf/` are PNG/JPEG for
  the PDF writer; glyph SVGs are copied unchanged). The same layout originates in the Rewritten Rule Book by
  Heegu-sama and contributors, https://github.com/Heegu-sama/Homm3BG, licensed CC BY-NC-SA 4.0
  (https://creativecommons.org/licenses/by-nc-sa/4.0/).
- **App icon** (`public/favicon.svg` and the PNG and ICO files made from it) - an original emblem drawn for this
  project (a map hex with a banner), not game art; same AGPL-3.0 license as the code.
- **Liberation Serif fonts** - SIL Open Font License; see `public/assets/fonts/Liberation-license.txt`.

The files under `public/assets/` that come from the Mission Book and the Rewritten Rule Book, and any changed
versions of them, are licensed under CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/), not
under the AGPL-3.0 license of the code.

Because of the CC BY-NC-SA 4.0 parts, the app as distributed with these assets is for non-commercial use, and
changes to those assets must be shared under the same license. Exported PDFs contain this CC BY-NC-SA 4.0 art and
are for non-commercial use too. Exported map images contain only the map tile, token and portrait art described
above (Archon Studio's art, used as fan content), not the Mission Book art; share them as non-commercial fan
content.

This is an unofficial fan project. Heroes of Might and Magic is a trademark of Ubisoft Entertainment.
Heroes of Might & Magic III: The Board Game is published by Archon Studio. Game art belongs to its owners.
