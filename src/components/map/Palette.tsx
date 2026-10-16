import { useMemo, useState } from "react";
import { assetUrl, EXPANSIONS, TILES, type TileInfo, tileGroup, tileName } from "../../data/catalog.ts";
import { TILE_GROUPS } from "../../data/game.ts";

const RANDOM_ORDER = ["S0", "F0", "N0", "C0", "NW0", "CW0", "NU0", "CU0"];

function tileNumber(id: string): number {
  return Number(id.replace(/\D+/g, "")) || 0;
}

/** The tile box: face-down random tiles first, then every tile by kind. */
export function Palette({ armed, onArm }: { armed: string | null; onArm: (tileId: string | null) => void }) {
  const [expansion, setExpansion] = useState("ALL");
  const [query, setQuery] = useState("");

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
      { key: "random", label: "Face-down (random)", tiles: random },
      ...TILE_GROUPS.map((g) => ({
        key: g.key,
        label: `${g.label}${g.roman ? ` (${g.roman})` : ""}`,
        tiles: shown
          .filter((t) => tileGroup(t.id) === g.key)
          .sort((a, b) => Number(a.id.startsWith("#")) - Number(b.id.startsWith("#")) || tileNumber(a.id) - tileNumber(b.id)),
      })),
    ].filter((g) => g.tiles.length);
  }, [expansion, query]);

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
      {armed && (
        <div className="armed-note">
          Placing <b>{tileName(armed)}</b>. Click the board.{" "}
          <button type="button" className="link" onClick={() => onArm(null)}>
            Stop (Esc)
          </button>
        </div>
      )}
      <div className="palette-scroll">
        {groups.map((g) => (
          <div key={g.key} className="palette-group">
            <h3>{g.label}</h3>
            <div className="palette-grid">
              {g.tiles.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`palette-tile ${armed === t.id ? "on" : ""}`}
                  title={`${tileName(t.id)} (${EXPANSIONS[t.expansion] ?? t.expansion})`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/x-tile", t.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onArm(armed === t.id ? null : t.id)}
                >
                  <img src={assetUrl(t.img)} alt={t.desc} loading="lazy" draggable={false} />
                  <span>{t.id}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}