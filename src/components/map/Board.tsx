import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canPlace, cellCenter, fieldCenter, type Point, pixelToCell, TILE_H, TILE_W, boardBounds } from "../../lib/hex.ts";
import { flowerPath, hexPoints, tileImageUrl } from "../../lib/mapdraw.ts";
import { MapLayers } from "./MapLayers.tsx";
import type { MapTile } from "../../model/types.ts";

interface Props {
  tiles: MapTile[];
  selectedId: string | null;
  selectedField: number | null;
  /** a palette tile waiting to be placed */
  armed: string | null;
  onPlace: (tileId: string, row: number, col: number) => void;
  onMove: (id: string, row: number, col: number) => void;
  onSelect: (id: string | null, field: number | null) => void;
  /** changes when another layout is shown, to refit the view */
  layoutKey: string;
}

type Drag =
  | { mode: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { mode: "tile"; id: string; sx: number; sy: number; grab: Point; moved: boolean; cell: [number, number] };

const MIN_K = 0.15;
const MAX_K = 2.5;

export function Board({ tiles, selectedId, selectedField, armed, onPlace, onMove, onSelect, layoutKey }: Props) {
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
    const box = boardBounds(tiles);
    if (!el) return;
    if (!box) {
      setView({ x: 40, y: 30, k: 0.55 });
      return;
    }
    const w = el.clientWidth;
    const h = el.clientHeight;
    const k = Math.max(MIN_K, Math.min(1.2, Math.min((w - 60) / (box.maxX - box.minX), (h - 60) / (box.maxY - box.minY))));
    setView({ k, x: (w - (box.maxX - box.minX) * k) / 2 - box.minX * k, y: (h - (box.maxY - box.minY) * k) / 2 - box.minY * k });
  }, [tiles]);

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
    const rows = Math.max(26, ...tiles.map((t) => t.row + 8));
    const cols = Math.max(26, ...tiles.map((t) => t.col + 8));
    return { rows, cols };
  }, [tiles]);

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

  const dragging = drag?.mode === "tile" && drag.moved ? drag : null;
  const shown = tiles.map((t) => (dragging && t.id === dragging.id ? { ...t, row: dragging.cell[0], col: dragging.cell[1] } : t));
  const dragValid = dragging ? canPlace(tiles, dragging.cell[0], dragging.cell[1], dragging.id) : true;
  const ghostValid = armed && hover ? canPlace(tiles, hover[0], hover[1]) : false;

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

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = (e.target as Element).closest("[data-tile]");
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (target && !armed && e.button === 0) {
      const id = target.getAttribute("data-tile") as string;
      const tile = tiles.find((t) => t.id === id);
      if (!tile) return;
      const p = toBoard(e.clientX, e.clientY);
      const c = cellCenter(tile.row, tile.col);
      setDrag({ mode: "tile", id, sx: e.clientX, sy: e.clientY, grab: { x: p.x - c.x, y: p.y - c.y }, moved: false, cell: [tile.row, tile.col] });
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
    if (d.mode === "tile") {
      const tile = tiles.find((t) => t.id === d.id);
      if (!tile) return;
      if (d.moved) {
        if (canPlace(tiles, d.cell[0], d.cell[1], d.id)) onMove(d.id, d.cell[0], d.cell[1]);
        onSelect(d.id, null);
      } else {
        onSelect(d.id, nearestField(tile, p));
      }
    } else if (!d.moved) {
      if (armed) {
        const [row, col] = pixelToCell(p.x, p.y);
        if (canPlace(tiles, row, col)) onPlace(armed, row, col);
      } else {
        onSelect(null, null);
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

  const selected = shown.find((t) => t.id === selectedId) ?? null;
  const ghostUrl = armed ? tileImageUrl(armed) : null;

  return (
    <div
      className={`board ${armed ? "placing" : ""} ${drag?.mode === "pan" && drag.moved ? "panning" : ""}`}
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
        if (!tileId) return;
        const p = toBoard(e.clientX, e.clientY);
        const [row, col] = pixelToCell(p.x, p.y);
        if (canPlace(tiles, row, col)) onPlace(tileId, row, col);
      }}
    >
      <svg className="board-svg" role="img" aria-label="Scenario map">
        <title>Scenario map</title>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path d={gridPath} className="grid-hex" />
          <MapLayers tiles={shown} fadedId={dragging?.id} clipId="board-hero-clip" />
          {selected && (
            <g className="selection">
              <path d={flowerPath(cellCenter(selected.row, selected.col).x, cellCenter(selected.row, selected.col).y)} className={dragValid ? "" : "invalid"} />
              {selectedField !== null && !dragging && (
                <polygon points={hexPoints(fieldCenter(selected, selectedField).x, fieldCenter(selected, selectedField).y, 0.9)} className="field-sel" />
              )}
            </g>
          )}
          {armed && hover && (
            <g className={`ghost ${ghostValid ? "ok" : "bad"}`}>
              {ghostUrl && (
                <image
                  href={ghostUrl}
                  x={cellCenter(hover[0], hover[1]).x - TILE_W / 2}
                  y={cellCenter(hover[0], hover[1]).y - TILE_H / 2}
                  width={TILE_W}
                  height={TILE_H}
                />
              )}
              <path d={flowerPath(cellCenter(hover[0], hover[1]).x, cellCenter(hover[0], hover[1]).y)} />
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
      {!tiles.length && !armed && (
        <div className="board-empty">Pick a tile on the left, then click the board to place it &mdash; or drag it in.</div>
      )}
    </div>
  );
}