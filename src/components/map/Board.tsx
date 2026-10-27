import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tileName } from "../../data/catalog.ts";
import { barEdge, screenBox, type View } from "../../lib/actionbar.ts";
import { duplicateTiles } from "../../lib/document.ts";
import { HOLD_MS, pinchView, TOUCH_SLOP, tapToPlace, touchStart, zoomAt } from "../../lib/gestures.ts";
import {
  type Blocker,
  boardBounds,
  canPlaceGroup,
  cellCenter,
  fieldCenter,
  type Piece,
  type Point,
  pixelToCell,
  shiftCell,
  TILE_H,
  TILE_W,
  tileBlocker,
  tokenBlocker,
} from "../../lib/hex.ts";
import { boardTokenOverlays, cellsOutlinePath, flowerPath, hexPoints, TOKEN_SIZE, tileImageUrl } from "../../lib/mapdraw.ts";
import { boardTokenName, GATE, gateHalves, tokenCells, tokenSpot } from "../../lib/tokens.ts";
import { useTouch } from "./ActionBar.tsx";
import { MapLayers } from "./MapLayers.tsx";
import { PlaceBanner } from "./PlaceBanner.tsx";
import type { BoardToken, MapTile } from "../../model/types.ts";

/** What the palette holds ready to place: a tile, or a Location token for empty Fields. */
export interface Armed {
  kind: "tile" | "token";
  id: string;
  /** how far the tile or token is turned before it is placed, in steps of 60 degrees */
  turn?: number;
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
  /** turns the waiting tile or token, or stops placing (null) */
  onArm?: (armed: Armed | null) => void;
  onPlace: (armed: Armed, row: number, col: number) => void;
  onMove: (moves: Piece[]) => void;
  onSelect: (ids: string[], field: number | null) => void;
  /** changes when another layout is shown, to refit the view */
  layoutKey: string;
  /** taps add to the selection or drop from it, as Shift+click does */
  adding?: boolean;
  /** the action bar for the selection, shown over the board while nothing is dragged */
  actions?: ReactNode;
  /** the map fills the screen */
  full?: boolean;
  onFull?: (full: boolean) => void;
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
      /** a finger on an unselected piece: a swipe pans until the finger has held still long enough */
      waiting?: boolean;
      /** the hold is over and the piece follows the finger */
      lifted?: boolean;
    }
  | { mode: "frame"; sx: number; sy: number; start: Point; end: Point; moved: boolean; base: string[]; pieceId: string | null };

/** Two fingers on the board: who they are, where they started and the view then. */
interface Pinch {
  a: number;
  b: number;
  a0: Point;
  b0: Point;
  view: View;
}

const MIN_K = 0.15;
const MAX_K = 2.5;
/** gap between the action bar and the board's edge, in screen pixels */
const BAR_MARGIN = 10;

const toggled = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

/** A finger or a pen; everything else is handled as the mouse always was. */
const isTouch = (e: React.PointerEvent) => e.pointerType === "touch" || e.pointerType === "pen";

/** A token about to be placed from the palette, at a board Field. */
const armedToken = (a: Armed, row: number, col: number): BoardToken => ({ id: "armed", location: a.id, row, col, rotation: a.turn ?? 0 });

export function Board({
  tiles,
  tokens,
  selectedIds,
  selectedField,
  armed,
  onArm,
  onPlace,
  onMove,
  onSelect,
  layoutKey,
  adding = false,
  actions,
  full = false,
  onFull,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<"bottom" | "top">("bottom");
  /** the bar's height; on a narrow board it wraps onto two rows */
  const [barHeight, setBarHeight] = useState(0);
  const [view, setView] = useState({ x: 40, y: 30, k: 0.55 });
  const [hover, setHover] = useState<[number, number] | null>(null);
  /** where a tap on a touch screen shows the waiting piece before a second tap places it */
  const [shown, setShown] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  /** fingers on the board, by pointer id, in client pixels */
  const fingers = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);
  const holdTimer = useRef(0);
  const touch = useTouch();

  const spots = useMemo(() => tokens.map(tokenSpot), [tokens]);

  const toBoard = useCallback((clientX: number, clientY: number): Point => {
    const r = wrapRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - (r?.left ?? 0) - v.x) / v.k, y: (clientY - (r?.top ?? 0) - v.y) / v.k };
  }, []);

  /** A client point in pixels inside the board. */
  const local = useCallback((p: Point): Point => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: p.x - (r?.left ?? 0), y: p.y - (r?.top ?? 0) };
  }, []);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    const box = boardBounds(tiles, spots);
    if (!el) return;
    if (!box) {
      setView({ x: 40, y: 30, k: 0.55 });
      return;
    }
    const w = el.clientWidth;
    const h = el.clientHeight;
    const k = Math.max(MIN_K, Math.min(1.2, Math.min((w - 60) / (box.maxX - box.minX), (h - 60) / (box.maxY - box.minY))));
    setView({ k, x: (w - (box.maxX - box.minX) * k) / 2 - box.minX * k, y: (h - (box.maxY - box.minY) * k) / 2 - box.minY * k });
  }, [tiles, spots]);

  // Refit when another layout is shown (not on every edit).
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the layout switch should refit
  useEffect(() => {
    fit();
  }, [layoutKey]);

  // A piece shown by a tap goes when another one waits, or none.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only another tile or token clears it
  useEffect(() => {
    setShown(null);
  }, [armed?.kind, armed?.id]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => zoomAt(v, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015), MIN_K, MAX_K));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

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

  /** Tiles whose middle Field, and tokens whose middle, lies inside the selection frame. */
  const inFrame = (d: Extract<Drag, { mode: "frame" }>): string[] => {
    const [x0, x1] = [Math.min(d.start.x, d.end.x), Math.max(d.start.x, d.end.x)];
    const [y0, y1] = [Math.min(d.start.y, d.end.y), Math.max(d.start.y, d.end.y)];
    const inside = ({ x, y }: Point) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const middle = (cells: [number, number][]): Point => {
      const centres = cells.map(([r, c]) => cellCenter(r, c));
      return { x: centres.reduce((s, p) => s + p.x, 0) / centres.length, y: centres.reduce((s, p) => s + p.y, 0) / centres.length };
    };
    return [...tiles.filter((t) => inside(cellCenter(t.row, t.col))), ...spots.filter((s) => inside(middle(s.cells)))].map((p) => p.id);
  };

  const dragging = drag?.mode === "piece" && drag.moved && !drag.waiting ? drag : null;
  const lifted = drag?.mode === "piece" && drag.lifted ? drag : null;
  const framing = drag?.mode === "frame" && drag.moved ? drag : null;
  const moves = dragging ? groupMoves(dragging) : [];
  const moveById = new Map(moves.map((m) => [m.id, m]));
  const moved = <T extends Piece>(p: T): T => {
    const m = moveById.get(p.id);
    return m ? { ...p, row: m.row, col: m.col } : p;
  };
  const shownTiles = tiles.map(moved);
  const shownTokens = tokens.map(moved);
  const dragValid = dragging ? canPlaceGroup(tiles, moves, spots) : true;

  /** What keeps the waiting piece off (row, col), or null when it fits there. */
  const blocker = (a: Armed, row: number, col: number): Blocker | null =>
    a.kind === "tile" ? tileBlocker(tiles, row, col, spots) : tokenBlocker(tiles, spots, tokenCells(armedToken(a, row, col)));

  const spot = shown ?? hover;
  const ghostToken = armed?.kind === "token" && spot ? armedToken(armed, spot[0], spot[1]) : null;
  const ghostBlocker = armed && spot ? blocker(armed, spot[0], spot[1]) : null;
  const ghostValid = !!armed && !!spot && !ghostBlocker;

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

  /** Places the waiting piece if it fits; says whether it did. */
  const place = (a: Armed, row: number, col: number): boolean => {
    const ok = !blocker(a, row, col);
    if (ok) onPlace(a, row, col);
    return ok;
  };

  const stopHold = () => window.clearTimeout(holdTimer.current);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isTouch(e)) {
      onTouchDown(e);
      return;
    }
    if (e.button !== 0 && e.button !== 1) return;
    const target = (e.target as Element).closest("[data-tile], [data-token]");
    const id = target ? (target.getAttribute("data-tile") ?? target.getAttribute("data-token")) : null;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const shift = e.shiftKey || adding;
    if (!armed && e.button === 0 && (e.ctrlKey || e.metaKey)) {
      const p = toBoard(e.clientX, e.clientY);
      setDrag({ mode: "frame", sx: e.clientX, sy: e.clientY, start: p, end: p, moved: false, base: shift ? selectedIds : [], pieceId: id });
    } else if (id && !armed && e.button === 0) {
      const piece = pieceById.get(id);
      if (!piece) return;
      const group = selectedIds.includes(id) ? selectedIds : shift ? [...selectedIds, id] : [id];
      const p = toBoard(e.clientX, e.clientY);
      const c = cellCenter(piece.row, piece.col);
      setDrag({
        mode: "piece",
        id,
        group,
        toggle: shift,
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

  /** A finger lands: a second one starts a pinch, a single one a pan, a hold, a piece drag or a frame. */
  const onTouchDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size === 2) {
      stopHold();
      setDrag(null);
      const [[a, pa], [b, pb]] = [...fingers.current];
      pinch.current = { a, b, a0: local(pa), b0: local(pb), view: viewRef.current };
      return;
    }
    if (fingers.current.size > 2 || pinch.current) return;
    const target = (e.target as Element).closest("[data-tile], [data-token]");
    const id = target ? (target.getAttribute("data-tile") ?? target.getAttribute("data-token")) : null;
    const piece = id ? pieceById.get(id) : undefined;
    const start = touchStart({ piece: !!piece, selected: !!piece && selectedIds.includes(piece.id), armed: !!armed, adding });
    const p = toBoard(e.clientX, e.clientY);
    if (start === "frame") {
      setDrag({ mode: "frame", sx: e.clientX, sy: e.clientY, start: p, end: p, moved: false, base: selectedIds, pieceId: null });
    } else if (piece && (start === "piece" || start === "hold")) {
      const group = selectedIds.includes(piece.id) ? selectedIds : adding ? [...selectedIds, piece.id] : [piece.id];
      const c = cellCenter(piece.row, piece.col);
      setDrag({
        mode: "piece",
        id: piece.id,
        group,
        toggle: adding,
        sx: e.clientX,
        sy: e.clientY,
        grab: { x: p.x - c.x, y: p.y - c.y },
        moved: false,
        cell: [piece.row, piece.col],
        waiting: start === "hold",
      });
      if (start === "hold") {
        stopHold();
        holdTimer.current = window.setTimeout(() => {
          setDrag((d) => (d?.mode === "piece" && d.id === piece.id && d.waiting ? { ...d, waiting: false, lifted: true } : d));
          navigator.vibrate?.(12);
        }, HOLD_MS);
      }
    } else {
      setDrag({ mode: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const finger = isTouch(e);
    if (finger) {
      if (!fingers.current.has(e.pointerId)) return;
      fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pz = pinch.current;
      if (pz) {
        const a = fingers.current.get(pz.a);
        const b = fingers.current.get(pz.b);
        if (a && b) setView(pinchView(pz.view, pz.a0, pz.b0, local(a), local(b), MIN_K, MAX_K));
        return;
      }
    }
    const p = toBoard(e.clientX, e.clientY);
    if (!finger) setHover(pixelToCell(p.x, p.y));
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > (finger ? TOUCH_SLOP : 5);
    if (drag.mode === "pan") {
      if (moved) setView((v) => ({ ...v, x: drag.vx + e.clientX - drag.sx, y: drag.vy + e.clientY - drag.sy }));
      if (moved !== drag.moved) setDrag({ ...drag, moved });
    } else if (drag.mode === "frame") {
      if (moved) setDrag({ ...drag, moved, end: p });
    } else if (drag.waiting) {
      // a swipe before the hold is over pans the map
      if (moved) {
        stopHold();
        setView((v) => ({ ...v, x: view.x + e.clientX - drag.sx, y: view.y + e.clientY - drag.sy }));
        setDrag({ mode: "pan", sx: drag.sx, sy: drag.sy, vx: view.x, vy: view.y, moved: true });
      }
    } else {
      const cell = pixelToCell(p.x - drag.grab.x, p.y - drag.grab.y);
      if (moved !== drag.moved || cell[0] !== drag.cell[0] || cell[1] !== drag.cell[1]) setDrag({ ...drag, moved, cell });
    }
  };

  /** A finger lifts or is taken over by the browser; true when the pinch it was part of still holds the board. */
  const liftFinger = (e: React.PointerEvent): boolean => {
    fingers.current.delete(e.pointerId);
    if (!pinch.current) return false;
    if (fingers.current.size < 2) {
      pinch.current = null;
      // the finger left behind pans on, and lifting it is no tap
      const rest = [...fingers.current.values()][0];
      setDrag(rest ? { mode: "pan", sx: rest.x, sy: rest.y, vx: viewRef.current.x, vy: viewRef.current.y, moved: true } : null);
    }
    return true;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const finger = isTouch(e);
    if (finger && liftFinger(e)) return;
    stopHold();
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
      if (d.moved && !d.waiting) {
        const m = groupMoves(d);
        if (canPlaceGroup(tiles, m, spots)) onMove(m);
        onSelect(d.group, null);
      } else if (d.toggle) {
        onSelect(toggled(selectedIds, d.id), null);
      } else {
        onSelect([d.id], tile ? nearestField(tile, p) : null);
      }
    } else if (!d.moved) {
      if (armed) {
        const [row, col] = pixelToCell(p.x, p.y);
        if (!finger) place(armed, row, col);
        else if (tapToPlace(shown, [row, col]) === "show") setShown([row, col]);
        else if (place(armed, row, col)) setShown(null);
      } else if (!e.shiftKey && !adding) {
        onSelect([], null);
      }
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (isTouch(e) && liftFinger(e)) return;
    stopHold();
    setDrag(null);
  };

  const zoom = (factor: number) => {
    const el = wrapRef.current;
    if (!el) return;
    setView((v) => zoomAt(v, el.clientWidth / 2, el.clientHeight / 2, factor, MIN_K, MAX_K));
  };

  const held = dragging ?? lifted;
  const outlinedIds = held ? held.group : framing ? [...new Set([...framing.base, ...inFrame(framing)])] : selectedIds;
  const outlinedTiles = shownTiles.filter((t) => outlinedIds.includes(t.id));
  const outlinedTokens = shownTokens.filter((t) => outlinedIds.includes(t.id));
  const dupes = duplicateTiles(tiles);
  // Gate halves on the tiles with no other half next to them
  const unpaired = gateHalves(shownTiles).unpaired;
  const single = !framing && outlinedTiles.length === 1 && !outlinedTokens.length ? outlinedTiles[0] : null;
  const ghostUrl = armed?.kind === "tile" ? tileImageUrl(armed.id) : null;
  const ghostTurn = armed?.kind === "tile" ? (armed.turn ?? 0) * 60 : 0;
  const showBar = !!actions && !dragging && !lifted && !framing;

  // Keep the bar off the selection: after each render, move it to the top when it would cover the selection at the bottom.
  // While a piece waits to be placed its banner holds the top.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    // the toolbar itself, not its full-width holder
    const bar = barRef.current?.firstElementChild as HTMLElement | null | undefined;
    if (!el || !bar) return;
    const box = boardBounds(
      tiles.filter((t) => selectedIds.includes(t.id)),
      spots.filter((t) => selectedIds.includes(t.id)),
    );
    setEdge(
      armed
        ? "bottom"
        : barEdge(box && screenBox(box, view), { width: el.clientWidth, height: el.clientHeight }, { width: bar.offsetWidth, height: bar.offsetHeight }, BAR_MARGIN),
    );
    setBarHeight(bar.offsetHeight);
  });

  /** The reason the waiting piece can't go where it is shown, in words. */
  const blockerText = (b: Blocker): string => {
    if (b.kind === "edge") return "Too near the top or left edge of the board";
    if (b.kind === "tile") {
      const t = tiles.find((x) => x.id === b.id);
      return `Overlaps ${t ? tileName(t.tileId) : "a tile"}`;
    }
    const t = tokens.find((x) => x.id === b.id);
    return `Overlaps the ${t ? boardTokenName(t.location) : "token"} beside the tiles`;
  };

  const placeHint = (a: Armed): string => {
    const where = a.kind === "tile" ? "a spot on the board" : a.id === GATE ? "two empty Fields side by side" : "an empty Field";
    if (!touch) return `click ${where}`;
    return shown && ghostValid ? "tap it again to place it" : `tap ${where}`;
  };

  return (
    <div
      className={`board ${armed ? "placing" : ""} ${drag?.mode === "pan" && drag.moved ? "panning" : ""} ${framing ? "framing" : ""}`}
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => setHover(null)}
      onContextMenu={(e) => {
        // a long press picks up a piece, not the browser's menu
        if (fingers.current.size) e.preventDefault();
      }}
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
          <MapLayers tiles={shownTiles} tokens={shownTokens} fadedIds={dragging?.group} clipId="board-hero-clip" />
          {dupes.size > 0 && (
            <g className="dupes">
              {shownTiles
                .filter((t) => dupes.has(t.tileId))
                .map((t) => (
                  <path key={t.id} d={flowerPath(cellCenter(t.row, t.col).x, cellCenter(t.row, t.col).y)} />
                ))}
            </g>
          )}
          {unpaired.length > 0 && (
            <g className="gate-unpaired">
              {unpaired.map((h) => (
                <path key={`${h.tile.id}-${h.field}`} d={cellsOutlinePath([h.cell])} />
              ))}
            </g>
          )}
          {(outlinedTiles.length > 0 || outlinedTokens.length > 0) && (
            <g className={`selection ${lifted && !dragging ? "lifted" : ""}`}>
              {outlinedTiles.map((t) => (
                <path key={t.id} d={flowerPath(cellCenter(t.row, t.col).x, cellCenter(t.row, t.col).y)} className={dragValid ? "" : "invalid"} />
              ))}
              {outlinedTokens.map((t) => (
                <path key={t.id} d={cellsOutlinePath(tokenCells(t))} className={dragValid ? "" : "invalid"} />
              ))}
              {single && selectedField !== null && !dragging && !lifted && (
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
          {armed && spot && (
            <g className={`ghost ${ghostValid ? "ok" : "bad"}`}>
              {ghostUrl && (
                <image
                  href={ghostUrl}
                  x={cellCenter(spot[0], spot[1]).x - TILE_W / 2}
                  y={cellCenter(spot[0], spot[1]).y - TILE_H / 2}
                  width={TILE_W}
                  height={TILE_H}
                  transform={ghostTurn ? `rotate(${ghostTurn} ${cellCenter(spot[0], spot[1]).x} ${cellCenter(spot[0], spot[1]).y})` : undefined}
                />
              )}
              {ghostToken &&
                boardTokenOverlays([ghostToken]).map((o, i) =>
                  o.kind === "token" ? (
                    <image
                      key={i}
                      href={o.url}
                      x={o.x - TOKEN_SIZE / 2}
                      y={o.y - TOKEN_SIZE / 2}
                      width={TOKEN_SIZE}
                      height={TOKEN_SIZE}
                      transform={`rotate(${o.rotation} ${o.x} ${o.y})`}
                    />
                  ) : null,
                )}
              <path d={ghostToken ? cellsOutlinePath(tokenCells(ghostToken)) : flowerPath(cellCenter(spot[0], spot[1]).x, cellCenter(spot[0], spot[1]).y)} />
            </g>
          )}
        </g>
      </svg>
      {armed && (
        <PlaceBanner
          name={armed.kind === "tile" ? tileName(armed.id) : boardTokenName(armed.id)}
          hint={placeHint(armed)}
          problem={ghostBlocker ? blockerText(ghostBlocker) : ""}
          keys={armed.kind === "token"}
          onTurn={onArm && ((step) => onArm({ ...armed, turn: ((armed.turn ?? 0) + step) % 6 }))}
          onPlace={touch && shown && ghostValid ? () => place(armed, shown[0], shown[1]) && setShown(null) : undefined}
          onCancel={onArm && (() => onArm(null))}
        />
      )}
      {showBar && (
        <div ref={barRef} className={`board-actions ${edge}`} onPointerDown={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
      <div
        className="board-zoom"
        // step down below a bar at the top
        style={showBar && edge === "top" ? { top: BAR_MARGIN * 2 + barHeight } : undefined}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" title="Zoom in" onClick={() => zoom(1.25)}>
          +
        </button>
        <button type="button" title="Zoom out" onClick={() => zoom(0.8)}>
          &minus;
        </button>
        <button type="button" title="Fit the map" onClick={fit}>
          &#x2922;
        </button>
        {onFull && (
          <button type="button" className={full ? "on" : ""} title={full ? "Leave full screen" : "Full screen"} aria-pressed={full} onClick={() => onFull(!full)}>
            {full ? <>&#x2715;</> : <>&#x26F6;</>}
          </button>
        )}
      </div>
      {!tiles.length && !tokens.length && !armed && (
        <div className="board-empty">
          {touch ? "Pick a tile above, then tap the board to place it." : "Pick a tile on the left, then click the board to place it — or drag it in."}
        </div>
      )}
    </div>
  );
}
