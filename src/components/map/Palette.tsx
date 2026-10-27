import { useMemo, useRef, useState } from "react";
import { assetUrl, EXPANSIONS, MAP_LOCATIONS, TILES, type TileInfo, tileGroup, tileName } from "../../data/catalog.ts";
import { TILE_GROUPS } from "../../data/game.ts";
import { boardTokenName, GATE, GATE_NAME, isGateHalf } from "../../lib/tokens.ts";
import type { Armed } from "./Board.tsx";
import { GateArt } from "./GateArt.tsx";

const RANDOM_ORDER = ["S0", "F0", "N0", "C0", "NW0", "CW0", "NU0", "CU0"];

function tileNumber(id: string): number {
  return Number(id.replace(/\D+/g, "")) || 0;
}

/** The tile box: face-down random tiles first, then every tile by kind, then Location tokens for empty Fields. */
export function Palette({ armed, onArm }: { armed: Armed | null; onArm: (armed: Armed | null) => void }) {
  const [expansion, setExpansion] = useState("ALL");
  const [query, setQuery] = useState("");
  /** the kind of tile a phone shows in its one row; a wide screen shows every kind */
  const [shelf, setShelf] = useState("random");
  const scrollRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const all = Object.values(TILES);
    const random = RANDOM_ORDER.map((id) => TILES[id]).filter(Boolean) as TileInfo[];
    const real = all.filter((t) => t.expansion !== "RANDOM");
    const shown = real.filter(
      (t) =>
        (expansion === "ALL" || t.expansion === expansion) &&
        (!query.trim() || `${t.id} ${t.desc} ${t.ground}`.toLowerCase().includes(query.trim().toLowerCase())),
    );
    return [
      { key: "random", label: "Face-down (random)", short: "Face-down", tiles: random },
      ...TILE_GROUPS.map((g) => ({
        key: g.key,
        label: `${g.label}${g.roman ? ` (${g.roman})` : ""}`,
        short: g.label,
        tiles: shown
          .filter((t) => tileGroup(t.id) === g.key)
          .sort((a, b) => Number(a.id.startsWith("#")) - Number(b.id.startsWith("#")) || tileNumber(a.id) - tileNumber(b.id)),
      })),
    ].filter((g) => g.tiles.length);
  }, [expansion, query]);

  // Beside the tiles the Subterranean Gate is one token over two Fields, never two halves.
  const locations = useMemo(
    () =>
      [GATE, ...Object.keys(MAP_LOCATIONS).filter((k) => !isGateHalf(k))].filter(
        (k) => !query.trim() || `${k} ${boardTokenName(k)}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  const isArmed = (kind: Armed["kind"], id: string) => armed?.kind === kind && armed.id === id;
  const shelves = [...groups.map((g) => ({ key: g.key, label: g.short })), ...(locations.length ? [{ key: "tokens", label: "Tokens" }] : [])];
  const current = shelves.some((g) => g.key === shelf) ? shelf : (shelves[0]?.key ?? "");

  return (
    <aside className="palette">
      <div className="palette-filters">
        <select value={expansion} onChange={(e) => setExpansion(e.target.value)} title="Expansion">
          <option value="ALL">All expansions</option>
          {Object.entries(EXPANSIONS)
            .filter(([k]) => k !== "RANDOM")
            .map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
        </select>
        <input type="search" placeholder="Find a tile (F12, lava...)" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="palette-shelves" role="tablist" aria-label="Kind of tile">
        {shelves.map((g) => (
          <button
            type="button"
            role="tab"
            key={g.key}
            aria-selected={g.key === current}
            className={g.key === current ? "on" : ""}
            onClick={() => {
              setShelf(g.key);
              scrollRef.current?.scrollTo({ left: 0 });
            }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="palette-scroll" ref={scrollRef}>
        {groups.map((g) => (
          <div key={g.key} className={`palette-group ${g.key === current ? "current" : ""}`}>
            <h3>{g.label}</h3>
            <div className="palette-grid">
              {g.tiles.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`palette-tile ${isArmed("tile", t.id) ? "on" : ""}`}
                  title={`${tileName(t.id)} (${EXPANSIONS[t.expansion] ?? t.expansion})`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/x-tile", t.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onArm(isArmed("tile", t.id) ? null : { kind: "tile", id: t.id })}
                >
                  <img src={assetUrl(t.img)} alt={t.desc} loading="lazy" draggable={false} />
                  <span>{t.id}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {locations.length > 0 && (
          <div className={`palette-group ${current === "tokens" ? "current" : ""}`}>
            <h3>Location tokens (beside the tiles)</h3>
            <div className="palette-grid">
              {locations.map((k) => (
                <button
                  type="button"
                  key={k}
                  className={`palette-tile token ${k === GATE ? "wide" : ""} ${isArmed("token", k) ? "on" : ""}`}
                  title={
                    k === GATE
                      ? `${GATE_NAME}: one token over two empty Fields next to the tiles. On the tiles, pick its two halves on neighbouring Fields of two tiles instead.`
                      : `${boardTokenName(k)}: place it on an empty Field next to the tiles. To put it on a tile, pick the tile's Field instead.`
                  }
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/x-token", k);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onArm(isArmed("token", k) ? null : { kind: "token", id: k })}
                >
                  {k === GATE ? <GateArt /> : <img src={assetUrl(MAP_LOCATIONS[k].img)} alt={MAP_LOCATIONS[k].desc} loading="lazy" draggable={false} />}
                  <span>{boardTokenName(k)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
