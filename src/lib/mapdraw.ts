// What a placed tile shows on top of its art (cubes, Hero portraits, blocked
// Fields, location tokens, faction borders), in board pixels, and a canvas
// renderer that turns a whole layout into the PNG the mission book prints.

import { assetUrl, CREATURE_BANKS, isRandomTile, MAP_LOCATIONS, PORTRAITS, TILES } from "../data/catalog.ts";
import { CUBE_COLORS, FACTION_BORDER } from "../data/game.ts";
import type { MapTile } from "../model/types.ts";
import { boardBounds, CELL_W, cellCenter, fieldCenter, type Point, ROW_PITCH, TILE_H, TILE_W } from "./hex.ts";
import { loadImage } from "./images.ts";

/** Corner offsets of a pointy-top hex the size of one Field. */
export const HEX_CORNERS: readonly Point[] = [
  { x: 0, y: -50 },
  { x: 43, y: -25 },
  { x: 43, y: 25 },
  { x: 0, y: 50 },
  { x: -43, y: 25 },
  { x: -43, y: -25 },
];

export function hexPoints(cx: number, cy: number, scale = 1): string {
  return HEX_CORNERS.map((p) => `${(cx + p.x * scale).toFixed(1)},${(cy + p.y * scale).toFixed(1)}`).join(" ");
}

const FLOWER_CENTERS: readonly Point[] = [
  { x: -43, y: -ROW_PITCH },
  { x: 43, y: -ROW_PITCH },
  { x: -CELL_W, y: 0 },
  { x: 0, y: 0 },
  { x: CELL_W, y: 0 },
  { x: -43, y: ROW_PITCH },
  { x: 43, y: ROW_PITCH },
];

/** Outline of a seven-Field tile around its centre, as segments (shared inner edges removed). */
export const FLOWER_OUTLINE: readonly [Point, Point][] = (() => {
  const edges = new Map<string, [Point, Point]>();
  const key = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;
  for (const c of FLOWER_CENTERS) {
    for (let i = 0; i < 6; i++) {
      const a = { x: c.x + HEX_CORNERS[i].x, y: c.y + HEX_CORNERS[i].y };
      const b = { x: c.x + HEX_CORNERS[(i + 1) % 6].x, y: c.y + HEX_CORNERS[(i + 1) % 6].y };
      const k = [key(a), key(b)].sort().join("|");
      if (edges.has(k)) edges.delete(k);
      else edges.set(k, [a, b]);
    }
  }
  return [...edges.values()];
})();

/** SVG path data of the tile outline centred at (cx, cy). */
export function flowerPath(cx: number, cy: number): string {
  return FLOWER_OUTLINE.map(([a, b]) => `M${cx + a.x} ${cy + a.y}L${cx + b.x} ${cy + b.y}`).join("");
}

export function tileImageUrl(tileId: string): string | null {
  const info = TILES[tileId];
  return info ? assetUrl(info.img) : null;
}

/**
 * Creature Bank and location token art is shown in a square this many board
 * pixels wide, centred on its Field, with the picture fitted inside (never
 * stretched). The community map editor draws a 150 px box scaled by 0.68.
 */
export const TOKEN_SIZE = 102;

/** Location tokens whose art is turned a fixed amount before the Field rotation is applied (the Whirlpool is a flat-topped hex). */
function baseRotation(tokenId: string): number {
  return tokenId.startsWith("whirlpool-") ? 30 : 0;
}

/** Size of a picture of the given proportions fitted inside a square box (object-fit: contain). */
export function fitContain(width: number, height: number, box: number): { w: number; h: number } {
  if (!(width > 0) || !(height > 0)) return { w: box, h: box };
  const k = box / Math.max(width, height);
  return { w: width * k, h: height * k };
}

export type Overlay =
  | { kind: "token"; x: number; y: number; url: string; rotation: number; label: string }
  | { kind: "blocked"; x: number; y: number }
  | { kind: "cube"; x: number; y: number; color: string }
  | { kind: "hero"; x: number; y: number; url: string; label: string };

/** Everything drawn on top of the tile art, in drawing order. */
export function tileOverlays(tile: MapTile): Overlay[] {
  const out: Overlay[] = [];
  for (let f = 0; f < 7; f++) {
    const p = fieldCenter(tile, f);
    const rotation = ((tile.fieldReplacementRotations[f] ?? 0) + tile.rotation) * 60;
    const bank = CREATURE_BANKS[tile.creaturebanks[f]];
    if (bank) out.push({ kind: "token", x: p.x, y: p.y, url: assetUrl(bank.img), rotation, label: bank.desc });
    const location = MAP_LOCATIONS[tile.mapLocations[f]];
    if (location) {
      const turned = rotation + baseRotation(tile.mapLocations[f]);
      out.push({ kind: "token", x: p.x, y: p.y, url: assetUrl(location.img), rotation: turned, label: location.desc });
    }
    if (tile.blockedHex[f]) out.push({ kind: "blocked", x: p.x, y: p.y });
  }
  for (let f = 0; f < 7; f++) {
    const p = fieldCenter(tile, f);
    const cube = CUBE_COLORS.find((c) => c.id === tile.cubes[f]);
    if (cube) out.push({ kind: "cube", x: p.x, y: p.y - 26, color: cube.color });
    const hero = PORTRAITS[tile.hero[f]];
    if (hero) out.push({ kind: "hero", x: p.x, y: p.y, url: assetUrl(hero.img), label: hero.desc });
  }
  return out;
}

/** The faction border colour of a random tile, or null. */
export function borderColor(tile: MapTile): string | null {
  return tile.faction && isRandomTile(tile.tileId) ? (FACTION_BORDER[tile.faction] ?? null) : null;
}

/** Faces of a small isometric cube centred at (x, y): top, left, right. */
export function cubeFaces(x: number, y: number, s = 10): [string, string, string] {
  const p = (px: number, py: number) => `${px.toFixed(1)},${py.toFixed(1)}`;
  const top = [p(x, y - s), p(x + s, y - s / 2), p(x, y), p(x - s, y - s / 2)].join(" ");
  const left = [p(x - s, y - s / 2), p(x, y), p(x, y + s), p(x - s, y + s / 2)].join(" ");
  const right = [p(x + s, y - s / 2), p(x, y), p(x, y + s), p(x + s, y + s / 2)].join(" ");
  return [top, left, right];
}

export function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

function polygon(ctx: CanvasRenderingContext2D, points: string): void {
  const pts = points.split(" ").map((p) => p.split(",").map(Number));
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/**
 * Renders a layout to a PNG with a transparent background, cropped to the
 * tiles, like the images under the mission book's assets/maps/.
 *
 * @param scale output pixels per board pixel
 */
export async function renderMapPng(tiles: MapTile[], scale = 2): Promise<Blob> {
  const box = boardBounds(tiles);
  if (!box) throw new Error("The map is empty.");
  const pad = 6;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((box.maxX - box.minX + pad * 2) * scale);
  canvas.height = Math.ceil((box.maxY - box.minY + pad * 2) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.scale(scale, scale);
  ctx.translate(-box.minX + pad, -box.minY + pad);
  ctx.imageSmoothingQuality = "high";

  for (const tile of tiles) {
    const url = tileImageUrl(tile.tileId);
    const c = cellCenter(tile.row, tile.col);
    ctx.save();
    if (tile.suggestedPlacement) ctx.globalAlpha = 0.5;
    ctx.translate(c.x, c.y);
    ctx.rotate((tile.rotation * Math.PI) / 3);
    if (url) ctx.drawImage(await loadImage(url), -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
    ctx.restore();
    const border = borderColor(tile);
    if (border) {
      ctx.save();
      ctx.strokeStyle = border;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const [a, b] of FLOWER_OUTLINE) {
        ctx.moveTo(c.x + a.x * 0.96, c.y + a.y * 0.96);
        ctx.lineTo(c.x + b.x * 0.96, c.y + b.y * 0.96);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const tile of tiles) {
    for (const o of tileOverlays(tile)) {
      ctx.save();
      if (o.kind === "token") {
        ctx.translate(o.x, o.y);
        ctx.rotate((o.rotation * Math.PI) / 180);
        const img = await loadImage(o.url);
        const { w, h } = fitContain(img.naturalWidth, img.naturalHeight, TOKEN_SIZE);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else if (o.kind === "blocked") {
        polygon(ctx, hexPoints(o.x, o.y, 0.92));
        ctx.fillStyle = "rgba(120, 0, 0, 0.35)";
        ctx.fill();
        ctx.strokeStyle = "rgba(200, 30, 30, 0.9)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(o.x - 18, o.y - 18);
        ctx.lineTo(o.x + 18, o.y + 18);
        ctx.moveTo(o.x + 18, o.y - 18);
        ctx.lineTo(o.x - 18, o.y + 18);
        ctx.stroke();
      } else if (o.kind === "cube") {
        const [top, left, right] = cubeFaces(o.x, o.y);
        const fills = [shade(o.color, 0.18), o.color, shade(o.color, -0.18)];
        [top, left, right].forEach((face, i) => {
          polygon(ctx, face);
          ctx.fillStyle = fills[i];
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });
      } else if (o.kind === "hero") {
        ctx.beginPath();
        ctx.arc(o.x, o.y, 26, 0, Math.PI * 2);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        ctx.drawImage(await loadImage(o.url), o.x - 26, o.y - 26, 52, 52);
        ctx.restore();
        ctx.strokeStyle = "#d8b45a";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the PNG."))), "image/png"),
  );
}