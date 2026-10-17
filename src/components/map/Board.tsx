import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assetUrl, MAP_LOCATIONS } from "../../data/catalog.ts";
import { duplicateTiles } from "../../lib/document.ts";
import {
  boardBounds,
  canPlace,
  canPlaceGroup,
  canPlaceToken,
  cellCenter,
  fieldCenter,
  type Piece,
  type Point,
  pixelToCell,
  shiftCell,
  TILE_H,
  TILE_W,
} from "../../lib/hex.ts";
import { flowerPath, hexPoints, TOKEN_SIZE, tileImageUrl } from "../../lib/mapdraw.ts";
import { MapLayers } from "./MapLayers.tsx";
import type { BoardToken, MapTile } from "../../model/types.ts";

/** What the palette holds ready to place: a tile, or a Location token for an empty Field. */
export interface Armed {
  kind: "tile" | "token";
  id: string;
}

interface Props {
  tiles: MapTile[];
  /** Location tokens on empty Fields beside the tiles */
  tokens: BoardToken[];
  /** the selected tiles and tokens; a Field is only picked when exactly one tile is selected */
  selectedIds: string[];
  selectedField: number | null;
  /** a palette tile or token waiting to be placed */
  armed: Armed | null;
  onPlace: (armed: Armed, row: number, col: number) => void;
  onMove: (moves: Piece[]) => void;
  onSelect: (ids: string[], field: number | null) => void;
  /** changes when another layout is shown, to refit the view */
  layoutKey: string;
}

type Drag =
  | { mode: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | {
      mode: "piece";
      id: string;
      /** every tile and token that moves along with the grabbed one */
      group: string[];
      /** Shift was held: a click adds or drops the piece instead of selecting it alone */
      toggle: boolean;
      sx: number;
      sy: number;
      grab: Point;
      moved: boolean;
      cell: [number, number];
    }
  | { mode: "frame"; sx: number; sy: number; start: Point; end: Point; moved: boolean; base: string[]; pieceId: string | null };

const MIN_K = 0.15;
const MAX_K = 2.5;

const toggled = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

const hexPath = (row: number, col: number, scale: number) => {
  const c = cellCenter(row, col);
  return `M${hexPoints(c.x, c.y, scale).replace(/ /g, "L")}Z`;
};

export function Board({ tiles, tokens, selectedIds, selectedField, armed, onPlace, onMove, onSelect, layoutKey }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 40, y: 30, k: 0.55 });
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const toBoard = useCallback((clientX: number, clientY: number): Point => {
    const r = wrapRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - (r?.left ?? 0) - v.x) / v.k, y: (clientY - (r?.top ?? 0) - v.y) / v.k };
  }, []);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    const box = boardBounds(tiles, tokens);
    if (!el) return;
    if (!box) {
      setView({ x: 40, y: 30, k: 0.55 });
      return;
    }
    const w = el.clientWidth;
    const h = el.clientHeight;
    const k = Math.max(MIN_K, Math.min(1.2, Math.min((w - 60) / (box.maxX - box.minX), (h - 60) / (box.maxY - box.minY))));
    setView({ k, x: (w - (box.maxX - box.minX) * k) / 2 - box.minX * k, y: (h - (box.maxY - box.minY) * k) / 2 - box.minY * k });
  }, [tiles, tokens]);

  // Refit when another layout is shown (not on every edit).
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the layout switch should refit
  useEffect(() => {
    fit();
  }, [layoutKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setView((v) => {
        const k = Math.max(MIN_K, Math.min(MAX_K, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const extent = useMemo(() => {
    const rows = Math.max(26, ...tiles.map((t) => t.row + 8), ...tokens.map((t) => t.row + 8));
    const cols = Math.max(26, ...tiles.map((t) => t.col + 8), ...tokens.map((t) => t.col + 8));
    return { rows, cols };
  }, [tiles, tokens]);

  const gridPath = useMemo(() => {
    const parts: string[] = [];
    for (let r = 0; r < extent.rows; r++) {
      for (let c = 0; c < extent.cols; c++) {
        const p = cellCenter(r, c);
        parts.push(`M${hexPoints(p.x, p.y, 0.97).replace(/ /g, "L")}Z`);
      }
    }
    return parts.join("");
  }, [extent]);

  const pieces: Piece[] = [...tiles, ...tokens];
  const pieceById = new Map(pieces.map((p) => [p.id, p]));

  /** Where each piece of a dragged group lands, keeping the group's shape. */
  const groupMoves = (d: Extract<Drag, { mode: "piece" }>): Piece[] => {
    const grabbed = pieceById.get(d.id);
    if (!grabbed) return [];
    return pieces
      .filter((p) => d.group.includes(p.id))
      .map((p) => {
        const [row, col] = shiftCell(p.row, p.col, [grabbed.row, grabbed.col], d.cell);
        return { id: p.id, row, col };
      });
  };

  /** Tiles and tokens whose middle lies inside the selection frame. */
  const inFrame = (d: Extract<Drag, { mode: "frame" }>): string[] => {
    const [x0, x1] = [Math.min(d.start.x, d.end.x), Math.max(d.start.x, d.end.x)];
    const [y0, y1] = [Math.min(d.start.y, d.end.y), Math.max(d.start.y, d.end.y)];
    return pieces
      .filter((p) => {
        const c = cellCenter(p.row, p.col);
        return c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1;
      })
      .map((p) => p.id);
  };

  const dragging = drag?.mode === "piece" && drag.moved ? drag : null;
  const framing = drag?.mode === "frame" && drag.moved ? drag : null;
  const moves = dragging ? groupMoves(dragging) : [];
  const moveById = new Map(moves.map((m) => [m.id, m]));
  const moved = <T extends Piece>(p: T): T => {
    const m = moveById.get(p.id);
    return m ? { ...p, row: m.row, col: m.col } : p;
  };
  const shown = tiles.map(moved);
  const shownTokens = tokens.map(moved);
  const dragValid = dragging ? canPlaceGroup(tiles, moves, tokens) : true;
  const ghostValid =
    armed && hover
      ? armed.kind === "tile"
        ? canPlace(tiles, hover[0], hover[1], undefined, tokens)
        : canPlaceToken(tiles, tokens, hover[0], hover[1])
      : false;

  const nearestField = (tile: MapTile, p: Point): number => {
    let best = 3;
    let bestD = Infinity;
    for (let f = 0; f < 7; f++) {
      const c = fieldCenter(tile, f);
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  };

  const place = (a: Armed, row: number, col: number) => {
    const ok = a.kind === "tile" ? canPlace(tiles, row, col, undefined, tokens) : canPlaceToken(tiles, tokens, row, col);
    if (ok) onPlace(a, row, col);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = (e.target as Element).closest("[data-tile], [data-token]");
    const id = target ? (target.getAttribute("data-tile") ?? target.getAttribute("data-token")) : null;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (!armed && e.button === 0 && (e.ctrlKey || e.metaKey)) {
      const p = toBoard(e.clientX, e.clientY);
      setDrag({ mode: "frame", sx: e.clientX, sy: e.clientY, start: p, end: p, moved: false, base: e.shiftKey ? selectedIds : [], pieceId: id });
    } else if (id && !armed && e.button === 0) {
      const piece = pieceById.get(id);
      if (!piece) return;
      const group = selectedIds.includes(id) ? selectedIds : e.shiftKey ? [...selectedIds, id] : [id];
      const p = toBoard(e.clientX, e.clientY);
      const c = cellCenter(piece.row, piece.col);
      setDrag({
        mode: "piece",
        id,
        group,
        toggle: e.shiftKey,
        sx: e.clientX,
        sy: e.clientY,
        grab: { x: p.x - c.x, y: p.y - c.y },
        moved: false,
        cell: [piece.row, piece.col],
      });
    } else {
      setDrag({ mode: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toBoard(e.clientX, e.clientY);
    setHover(pixelToCell(p.x, p.y));
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5;
    if (drag.mode === "pan") {
      if (moved) setView((v) => ({ ...v, x: drag.vx + e.clientX - drag.sx, y: drag.vy + e.clientY - drag.sy }));
      if (moved !== drag.moved) setDrag({ ...drag, moved });
    } else if (drag.mode === "frame") {
      if (moved) setDrag({ ...drag, moved, end: p });
    } else {
      const cell = pixelToCell(p.x - drag.grab.x, p.y - drag.grab.y);
      if (moved !== drag.moved || cell[0] !== drag.cell[0] || cell[1] !== drag.cell[1]) setDrag({ ...drag, moved, cell });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    const p = toBoard(e.clientX, e.clientY);
    if (d.mode === "frame") {
      if (d.moved) onSelect([...new Set([...d.base, ...inFrame(d)])], null);
      else if (d.pieceId) onSelect(toggled(selectedIds, d.pieceId), null);
    } else if (d.mode === "piece") {
      if (!pieceById.has(d.id)) return;
      const tile = tiles.find((t) => t.id === d.id);
      if (d.moved) {
        const m = groupMoves(d);
        if (canPlaceGroup(tiles, m, tokens)) onMove(m);
        onSelect(d.group, null);
      } else if (d.toggle) {
        onSelect(toggled(selectedIds, d.id), null);
      } else {
        onSelect([d.id], tile ? nearestField(tile, p) : null);
      }
    } else if (!d.moved) {
      if (armed) {
        const [row, col] = pixelToCell(p.x, p.y);
        place(armed, row, col);
      } else if (!e.shiftKey) {
        onSelect([], null);
      }
    }
  };

  const zoom = (factor: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    setView((v) => {
      const k = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });
  };

  const outlinedIds = dragging ? dragging.group : framing ? [...new Set([...framing.base, ...inFrame(framing)])] : selectedIds;
  const outlinedTiles = shown.filter((t) => outlinedIds.includes(t.id));
  const outlinedTokens = shownTokens.filter((t) => outlinedIds.includes(t.id));
  const dupes = duplicateTiles(tiles);
  const single = !framing && outlinedTiles.length === 1 && !outlinedTokens.length ? outlinedTiles[0] : null;
  const ghostUrl = !armed ? null : armed.kind === "tile" ? tileImageUrl(armed.id) : MAP_LOCATIONS[armed.id] ? assetUrl(MAP_LOCATIONS[armed.id].img) : null;

  return (
    <div
      className={`board ${armed ? "placing" : ""} ${drag?.mode === "pan" && drag.moved ? "panning" : ""} ${framing ? "framing" : ""}`}
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDragOver={(e) => {
        e.preventDefault();
        const p = toBoard(e.clientX, e.clientY);
        setHover(pixelToCell(p.x, p.y));
      }}
      onDrop={(e) => {
        e.preventDefault();
        const tileId = e.dataTransfer.getData("text/x-tile");
        const tokenId = e.dataTransfer.getData("text/x-token");
        if (!tileId && !tokenId) return;
        const p = toBoard(e.clientX, e.clientY);
        const [row, col] = pixelToCell(p.x, p.y);
        place(tileId ? { kind: "tile", id: tileId } : { kind: "token", id: tokenId }, row, col);
      }}
    >
      <svg className="board-svg" role="img" aria-label="Scenario map">
        <title>Scenario map</title>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path d={gridPath} className="grid-hex" />
          <MapLayers tiles={shown} tokens={shownTokens} fadedIds={dragging?.group} clipId="board-hero-clip" />
          {dupes.size > 0 && (
            <g className="dupes">
              {shown
                .filter((t) => dupes.has(t.tileId))
                .map((t) => (
                  <path key={t.id} d={flowerPath(cellCenter(t.row, t.col).x, cellCenter(t.row, t.col).y)} />
                ))}
            </g>
          )}
          {(outlinedTiles.length > 0 || outlinedTokens.length > 0) && (
            <g className="selection">
              {outlinedTiles.map((t) => (
                <path key={t.id} d={flowerPath(cellCenter(t.row, t.col).x, cellCenter(t.row, t.col).y)} className={dragValid ? "" : "invalid"} />
              ))}
              {outlinedTokens.map((t) => (
                <path key={t.id} d={hexPath(t.row, t.col, 0.96)} className={dragValid ? "" : "invalid"} />
              ))}
              {single && selectedField !== null && !dragging && (
                <polygon points={hexPoints(fieldCenter(single, selectedField).x, fieldCenter(single, selectedField).y, 0.9)} className="field-sel" />
              )}
            </g>
          )}
          {framing && (
            <rect
              className="select-frame"
              x={Math.min(framing.start.x, framing.end.x)}
              y={Math.min(framing.start.y, framing.end.y)}
              width={Math.abs(framing.end.x - framing.start.x)}
              height={Math.abs(framing.end.y - framing.start.y)}
            />
          )}
          {armed && hover && (
            <g className={`ghost ${ghostValid ? "ok" : "bad"}`}>
              {ghostUrl && armed.kind === "tile" && (
                <image
                  href={ghostUrl}
                  x={cellCenter(hover[0], hover[1]).x - TILE_W / 2}
                  y={cellCenter(hover[0], hover[1]).y - TILE_H / 2}
                  width={TILE_W}
                  height={TILE_H}
                />
              )}
              {ghostUrl && armed.kind === "token" && (
                <image
                  href={ghostUrl}
                  x={cellCenter(hover[0], hover[1]).x - TOKEN_SIZE / 2}
                  y={cellCenter(hover[0], hover[1]).y - TOKEN_SIZE / 2}
                  width={TOKEN_SIZE}
                  height={TOKEN_SIZE}
                />
              )}
              <path
                d={armed.kind === "tile" ? flowerPath(cellCenter(hover[0], hover[1]).x, cellCenter(hover[0], hover[1]).y) : hexPath(hover[0], hover[1], 0.96)}
              />
            </g>
          )}
        </g>
      </svg>
      <div className="board-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" title="Zoom in" onClick={() => zoom(1.25)}>
          +
        </button>
        <button type="button" title="Zoom out" onClick={() => zoom(0.8)}>
          &minus;
        </button>
        <button type="button" title="Fit the map" onClick={fit}>
          &#x2922;
        </button>
      </div>
      {!tiles.length && !tokens.length && !armed && (
        <div className="board-empty">Pick a tile on the left, then click the board to place it &mdash; or drag it in.</div>
      )}
    </div>
  );
}
