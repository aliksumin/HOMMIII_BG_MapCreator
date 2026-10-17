// Imports the art this app needs from local clones of the two community
// projects it builds on, resized and converted to WebP, and writes the
// catalog the app reads (src/data/catalog.json).
//
//   node tools/import-assets.mjs <zedero-homm3boardgame-dir> <Homm3BG-mission-book-dir>
//
// Sources (see NOTICE.md for licenses):
//   https://github.com/zedero/homm3boardgame        map tiles, portraits, locations
//   https://github.com/qwrtln/Homm3BG-mission-book  glyphs, scenario icons, layout, fonts

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { bankTokenSvg } from "./bank-tokens.mjs";

const [zederoDir, missionDir] = process.argv.slice(2);
if (!zederoDir || !missionDir) {
  console.error("usage: node tools/import-assets.mjs <zedero-dir> <mission-book-dir>");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "assets");
const zPublic = path.join(zederoDir, "public");
const zJson = path.join(zederoDir, "libs", "shared", "config", "src", "lib", "data", "json");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

/** assets/map-editor/tiles/special/random-1.png -> special-random-1 */
function flatName(img, prefix) {
  return img
    .replace(prefix, "")
    .replace(/\.png$/i, "")
    .replace(/[\/]/g, "-");
}

async function toWebp(src, dest, width, quality = 72) {
  await mkdir(path.dirname(dest), { recursive: true });
  await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(dest);
}

let converted = 0;
async function convertSet(entries, prefix, dir, width) {
  const result = {};
  for (const [key, value] of Object.entries(entries)) {
    const img = value.img ?? value.image;
    const src = path.join(zPublic, img);
    if (!existsSync(src)) {
      console.warn(`  missing ${img}, skipped ${key}`);
      continue;
    }
    const name = flatName(img, prefix);
    await toWebp(src, path.join(out, dir, `${name}.webp`), width);
    converted++;
    const { image: _image, ...rest } = value;
    result[key] = { ...rest, img: `assets/${dir}/${name}.webp` };
  }
  return result;
}

// --- zedero: tiles, portraits, creature banks, map locations -----------------

const tilesJson = await readJson(path.join(zJson, "tiles.json"));
const dataJson = await readJson(path.join(zJson, "data.json"));
const portraitsJson = await readJson(path.join(zJson, "portraits.json"));
const banksJson = await readJson(path.join(zJson, "creature-banks.json"));
const locationsJson = await readJson(path.join(zJson, "map-locations.json"));

const allTiles = { ...tilesJson.TILES, ...tilesJson.UPCOMING_TILES, ...tilesJson.RANDOM_TILES };
delete allTiles.PLACEHOLDER;
console.log(`tiles: ${Object.keys(allTiles).length}`);
const tiles = await convertSet(allTiles, "assets/map-editor/tiles/", "tiles", 400);

console.log(`portraits: ${Object.keys(portraitsJson.PORTRAITS).length}`);
const portraits = await convertSet(portraitsJson.PORTRAITS, "assets/map-editor/portraits/", "portraits", 96);

// All twelve banks of the Naval Battles Mission Book: the editor keeps the ones
// it has no art for yet under UNFINISHED, with the two face-down tokens (R1, R2).
const allBanks = { ...banksJson.CREATURE_BANKS, ...banksJson.UNFINISHED };
for (const bank of Object.values(allBanks)) bank.desc = bank.desc.replace(/^Random - ([A-Za-z]+)$/, "Random ($1)");
const bankArt = await convertSet(allBanks, "assets/map-editor/creature-banks/", "creature-banks", 200);
const bankOrder = (key) => (key.startsWith("CB") ? Number(key.slice(2)) : 100 + Number(key.slice(1)));
const banks = {};
for (const key of Object.keys(allBanks).sort((a, b) => bankOrder(a) - bankOrder(b))) {
  if (bankArt[key]) {
    banks[key] = bankArt[key];
    continue;
  }
  await writeFile(path.join(out, "creature-banks", `${key}.svg`), bankTokenSvg(allBanks[key].desc));
  const { image: _image, ...rest } = allBanks[key];
  banks[key] = { ...rest, img: `assets/creature-banks/${key}.svg` };
}
const locations = await convertSet(locationsJson.MAP_LOCATIONS, "assets/map-editor/map-locations/", "map-locations", 200);

const strip = (value) => (typeof value === "string" && value.includes(".") ? value.split(".")[1] : value);
const catalogTiles = Object.fromEntries(
  Object.entries(tiles).map(([key, t]) => [
    key,
    {
      id: t.id,
      img: t.img,
      desc: t.desc,
      expansion: strip(t.expansionID),
      ground: strip(t.groundType),
      group: strip(t.group),
      blocked: t.blocked,
    },
  ]),
);

// --- mission book: glyphs, scenario icons, layout, fonts -----------------------

const mAssets = path.join(missionDir, "assets");

const glyphDir = path.join(out, "glyphs");
await mkdir(glyphDir, { recursive: true });
const glyphs = [];
for (const file of (await readdir(path.join(mAssets, "glyphs"))).sort()) {
  if (!file.endsWith(".svg")) continue;
  await copyFile(path.join(mAssets, "glyphs", file), path.join(glyphDir, file));
  if (!/-(yellow|mono|red|gray)\.svg$|_gray\.svg$/.test(file)) glyphs.push(file.replace(/\.svg$/, ""));
}

const images = [];
for (const file of (await readdir(path.join(mAssets, "images"))).sort()) {
  if (!file.endsWith(".png")) continue;
  const name = file.replace(/\.png$/, "");
  await toWebp(path.join(mAssets, "images", file), path.join(out, "images", `${name}.webp`), 256);
  converted++;
  images.push(name);
}

const layout = [
  ["section_heading.png", 1535],
  ["section_heading_monochrome.png", 1535],
  ["grouping_heading.png", 1457],
  ["tausta.png", 1210],
  ["listdot.png", 60],
  ["bottom.png", 1701],
  ["cover.jpg", 1400],
  ["castle_background.jpg", 1278],
  ["coops.png", 900],
  ["clash.png", 726],
  ["campaigns.png", 900],
  ["alliance.png", 900],
  ["table-background.jpg", 1000],
];
for (const [file, width] of layout) {
  const name = file.replace(/\.(png|jpg)$/, "");
  await toWebp(path.join(mAssets, "layout", file), path.join(out, "layout", `${name}.webp`), width, 86);
  converted++;
}
// The PDF writer embeds PNG/JPEG (jsPDF does not read WebP).
await mkdir(path.join(out, "pdf"), { recursive: true });
await sharp(path.join(mAssets, "layout", "section_heading.png")).resize({ width: 1200 }).png().toFile(path.join(out, "pdf", "section_heading.png"));
await sharp(path.join(mAssets, "layout", "tausta.png")).jpeg({ quality: 80 }).toFile(path.join(out, "pdf", "tausta.jpg"));
await sharp(path.join(mAssets, "layout", "listdot.png")).png().toFile(path.join(out, "pdf", "listdot.png"));

const fontDir = path.join(out, "fonts");
await mkdir(fontDir, { recursive: true });
for (const file of await readdir(path.join(mAssets, "fonts"))) {
  if (file.endsWith(".ttf") || file.endsWith(".txt")) await copyFile(path.join(mAssets, "fonts", file), path.join(fontDir, file));
}

const catalog = {
  generatedFrom: {
    zedero: "https://github.com/zedero/homm3boardgame",
    missionBook: "https://github.com/qwrtln/Homm3BG-mission-book",
  },
  factions: dataJson.FACTIONS,
  expansions: dataJson.EXPANSION_FILTER_DESC,
  tiles: catalogTiles,
  portraits,
  creatureBanks: banks,
  mapLocations: locations,
  glyphs,
  titleImages: images,
};
await writeFile(path.join(root, "src", "data", "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`converted ${converted} images, ${glyphs.length} glyphs, ${images.length} scenario icons`);
