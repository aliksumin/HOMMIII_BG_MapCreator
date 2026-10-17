import { useEffect, useState } from "react";
import { countTiles, duplicateTiles, mapFiles } from "../../lib/document.ts";
import { connectedGroups, normalise } from "../../lib/hex.ts";
import { guid, uid } from "../../lib/id.ts";
import { download } from "../../lib/images.ts";
import { decodeMap, encodeMap, newTile } from "../../lib/mapfile.ts";
import { renderMapPng } from "../../lib/mapdraw.ts";
import { newMapLayout } from "../../model/defaults.ts";
import { useScenario } from "../../model/store.ts";
import type { MapTile } from "../../model/types.ts";
import { Modal } from "../ui/Modal.tsx";
import { Board } from "./Board.tsx";
import { Inspector } from "./Inspector.tsx";
import { Palette } from "./Palette.tsx";

export function MapEditor() {
  const [s, update] = useScenario();
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [armed, setArmed] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [field, setField] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [busy, setBusy] = useState("");
  const [fitCount, setFitCount] = useState(0);

  const index = Math.min(layoutIndex, s.maps.length - 1);
  const layout = s.maps[index];
  const tiles = layout.tiles;
  const tile = tiles.find((t) => t.id === selected) ?? null;
  const counts = countTiles(tiles);
  const dupes = duplicateTiles(tiles);
  const parts = tiles.length ? connectedGroups(tiles).length : 0;
  const file = mapFiles(s).find((m) => m.layout.id === layout.id)?.file ?? "map";

  const setTiles = (recipe: (tiles: MapTile[]) => MapTile[] | void, tag?: string) =>
    update((d) => {
      const target = d.maps[index];
      const result = recipe(target.tiles);
      if (result) target.tiles = result;
    }, tag);

  const changeTile = (recipe: (tile: MapTile) => void) =>
    setTiles((list) => {
      const t = list.find((x) => x.id === selected);
      if (t) recipe(t);
    }, `tile-${selected}`);

  const removeSelected = () => {
    if (!selected) return;
    setTiles((list) => list.filter((t) => t.id !== selected));
    setSelected(null);
    setField(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") {
        setArmed(null);
        setSelected(null);
        setField(null);
      } else if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && selected) {
        e.preventDefault();
        changeTile((t) => void (t.rotation = (t.rotation + (e.shiftKey ? 5 : 1)) % 6));
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const doImport = (text: string, mode: "replace" | "append") => {
    try {
      const imported = decodeMap(text);
      setTiles((list) => {
        if (mode === "replace") return normalise(imported);
        // append: shift the import below the current map, keeping row parity
        const maxRow = Math.max(0, ...list.map((t) => t.row));
        const minRow = Math.min(...imported.map((t) => t.row));
        const shift = Math.ceil((maxRow + 4 - minRow) / 2) * 2;
        return [...list, ...imported.map((t) => ({ ...t, id: guid(), row: t.row + shift }))];
      });
      setImportOpen(false);
      setFitCount((n) => n + 1);
      setImportText("");
      setImportError("");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const exportPng = async () => {
    setBusy("Rendering...");
    try {
      download(`${file}.png`, await renderMapPng(tiles));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="map-editor">
      <div className="map-toolbar">
        <div className="layout-tabs">
          {s.maps.map((m, i) => (
            <button
              type="button"
              key={m.id}
              className={i === index ? "on" : ""}
              onClick={() => {
                setLayoutIndex(i);
                setSelected(null);
              }}
            >
              {m.name || `Map ${i + 1}`}
              <small>{m.tiles.length}</small>
            </button>
          ))}
          <button
            type="button"
            className="add"
            title="Add another layout, e.g. for a different player count"
            onClick={() => {
              update((d) => void d.maps.push(newMapLayout(`Map ${d.maps.length + 1}`)));
              setLayoutIndex(s.maps.length);
              setSelected(null);
            }}
          >
            + Layout
          </button>
          <button
            type="button"
            className="add"
            title="Copy this layout"
            onClick={() => {
              update((d) => void d.maps.push({ ...structuredClone(layout), id: uid(), name: `${layout.name} (copy)` }));
              setLayoutIndex(s.maps.length);
              setSelected(null);
            }}
          >
            Duplicate
          </button>
        </div>
        <div className="map-actions">
          <button type="button" className="btn small" onClick={() => setImportOpen(true)}>
            Import .map
          </button>
          <button
            type="button"
            className="btn small"
            disabled={!tiles.length}
            onClick={() => download(`${file}.map`, encodeMap(tiles), "text/plain")}
          >
            Export .map
          </button>
          <button type="button" className="btn small" disabled={!tiles.length || !!busy} onClick={exportPng}>
            {busy || "Export PNG"}
          </button>
        </div>
      </div>

      <div className="layout-settings">
        <label>
          Name
          <input value={layout.name} onChange={(e) => update((d) => void (d.maps[index].name = e.target.value), `lname-${layout.id}`)} />
        </label>
        <div className="layout-counts">
          For players:
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              type="button"
              key={n}
              className={layout.playerCounts.includes(n) ? "on" : ""}
              onClick={() =>
                update((d) => {
                  const l = d.maps[index];
                  l.playerCounts = l.playerCounts.includes(n) ? l.playerCounts.filter((x) => x !== n) : [...l.playerCounts, n].sort();
                })
              }
            >
              {n}
            </button>
          ))}
        </div>
        <label>
          Caption
          <input
            value={layout.caption}
            placeholder={layout.playerCounts.length ? `${[...layout.playerCounts].sort().join("/")}-PLAYER SCENARIO` : "SCENARIO MAP LAYOUT"}
            onChange={(e) => update((d) => void (d.maps[index].caption = e.target.value), `lcap-${layout.id}`)}
          />
        </label>
        {s.maps.length > 1 && (
          <button
            type="button"
            className="btn small danger"
            onClick={() => {
              if (layout.tiles.length && !window.confirm(`Delete the layout "${layout.name}" and its ${layout.tiles.length} tiles?`)) return;
              update((d) => void d.maps.splice(index, 1));
              setLayoutIndex(Math.max(0, index - 1));
              setSelected(null);
            }}
          >
            Delete layout
          </button>
        )}
      </div>

      <div className="map-body">
        <Palette armed={armed} onArm={setArmed} />
        <div className="board-col">
          <Board
            tiles={tiles}
            selectedId={selected}
            selectedField={field}
            armed={armed}
            layoutKey={`${layout.id}-${fitCount}`}
            onPlace={(tileId, row, col) => {
              const t = newTile(tileId, row, col);
              setTiles((list) => void list.push(t));
              setSelected(t.id);
              setField(null);
            }}
            onMove={(id, row, col) =>
              setTiles((list) => {
                const t = list.find((x) => x.id === id);
                if (t) {
                  t.row = row;
                  t.col = col;
                }
              })
            }
            onSelect={(id, f) => {
              setSelected(id);
              setField(f);
            }}
          />
          <div className="map-status">
            <span>
              <b>{tiles.length}</b> tiles
            </span>
            {(["starting", "far", "near", "center", "water", "subterranean"] as const)
              .filter((k) => counts[k])
              .map((k) => (
                <span key={k} className={`tile-badge ${k}`}>
                  {counts[k]} {k}
                </span>
              ))}
            {parts > 1 && <span className="warn">Map falls apart into {parts} parts</span>}
            {dupes.size > 0 && (
              <span className="warn" title="The game has only one of each printed tile.">
                Placed more than once: {[...dupes].map(([id, n]) => `${id} ×${n}`).join(", ")}
              </span>
            )}
            <span className="keys">Click: place/select &middot; Drag: move or pan &middot; Wheel: zoom &middot; R: rotate &middot; Del: remove</span>
          </div>
        </div>
        {tile ? (
          <Inspector
            tile={tile}
            copies={tiles.filter((t) => t.tileId === tile.tileId).length}
            field={field}
            onField={setField}
            onChange={changeTile}
            onDelete={removeSelected}
            onDuplicate={() => setArmed(tile.tileId)}
          />
        ) : (
          <aside className="inspector empty">
            <h4>No tile selected</h4>
            <p className="hint">
              Face-down tiles (I, II&ndash;III, IV&ndash;V, VI&ndash;VII) leave the draw to the players, like most mission book maps. Place
              printed tiles where the Scenario needs a specific one.
            </p>
            <p className="hint">Select a placed tile to rotate it, give a face-down Starting tile a faction border, or put cubes, Heroes, tokens and blocks on its Fields.</p>
            {tiles.length > 0 && (
              <button
                type="button"
                className="btn small danger"
                onClick={() => {
                  if (window.confirm(`Remove all ${tiles.length} tiles from "${layout.name}"?`)) setTiles(() => []);
                }}
              >
                Clear this layout
              </button>
            )}
          </aside>
        )}
      </div>

      {importOpen && (
        <Modal title="Import a map" onClose={() => setImportOpen(false)}>
          <p className="hint">
            Paste the text from the map editor&rsquo;s Export box (zedero.github.io/homm3boardgame), or open a <code>.map</code> file from the mission
            book&rsquo;s <code>assets/map-files/</code>.
          </p>
          <input
            type="file"
            accept=".map,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setImportText(await f.text());
            }}
          />
          <textarea rows={6} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="eJy11L..." />
          {importError && <p className="error">{importError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn" disabled={!importText.trim()} onClick={() => doImport(importText, "replace")}>
              Replace this layout
            </button>
            <button type="button" className="btn" disabled={!importText.trim()} onClick={() => doImport(importText, "append")}>
              Add to this layout
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}