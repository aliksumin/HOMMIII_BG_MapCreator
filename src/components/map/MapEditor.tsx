import { useEffect, useState } from "react";
import { sameAgain, selectionName } from "../../lib/actionbar.ts";
import { countTiles, duplicateTiles, mapFiles } from "../../lib/document.ts";
import { canPlaceToken, connectedGroups, normalise } from "../../lib/hex.ts";
import { guid, uid } from "../../lib/id.ts";
import { download } from "../../lib/images.ts";
import { decodeMap, encodeMap, newTile } from "../../lib/mapfile.ts";
import { renderMapPng } from "../../lib/mapdraw.ts";
import { gateHalves, orientGates, tokenCells, tokenSpot } from "../../lib/tokens.ts";
import { newMapLayout } from "../../model/defaults.ts";
import { useScenario } from "../../model/store.ts";
import type { BoardToken, MapLayout, MapTile } from "../../model/types.ts";
import { Modal } from "../ui/Modal.tsx";
import { ActionBar, useTouch } from "./ActionBar.tsx";
import { type Armed, Board } from "./Board.tsx";
import { Inspector, TokenInspector } from "./Inspector.tsx";
import { Palette } from "./Palette.tsx";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function MapEditor() {
  const [s, update] = useScenario();
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [armed, setArmed] = useState<Armed | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [field, setField] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [busy, setBusy] = useState("");
  const [fitCount, setFitCount] = useState(0);
  const [adding, setAdding] = useState(false);
  const touch = useTouch();

  const index = Math.min(layoutIndex, s.maps.length - 1);
  const layout = s.maps[index];
  const tiles = layout.tiles;
  const tokens = layout.tokens ?? [];
  const picked = tiles.filter((t) => selected.includes(t.id));
  const pickedTokens = tokens.filter((t) => selected.includes(t.id));
  const tile = picked.length === 1 && !pickedTokens.length ? picked[0] : null;
  const token = pickedTokens.length === 1 && !picked.length ? pickedTokens[0] : null;
  const pickedCount = picked.length + pickedTokens.length;
  const again = sameAgain(picked, pickedTokens);
  const counts = countTiles(tiles);
  const dupes = duplicateTiles(tiles);
  const parts = tiles.length ? connectedGroups(tiles).length : 0;
  const gates = gateHalves(tiles);
  const linkedHalves = new Set(gates.pairs.flatMap((p) => [p.underground, p.surface]).map((h) => `${h.tile.id}:${h.field}`));
  const file = mapFiles(s).find((m) => m.layout.id === layout.id)?.file ?? "map";

  /** Changes the shown layout; Gate halves that end up on neighbouring Fields turn to face each other. */
  const editLayout = (recipe: (layout: MapLayout) => void, tag?: string) =>
    update((d) => {
      const target = d.maps[index];
      target.tokens ??= [];
      recipe(target);
      orientGates(target.tiles);
    }, tag);

  const setTiles = (recipe: (tiles: MapTile[]) => MapTile[] | void, tag?: string) =>
    editLayout((target) => {
      const result = recipe(target.tiles);
      if (result) target.tiles = result;
    }, tag);

  /** Applies a change to every selected tile. */
  const changeTile = (recipe: (tile: MapTile) => void) =>
    setTiles((list) => {
      for (const t of list) if (selected.includes(t.id)) recipe(t);
    }, `tile-${selected.join(",")}`);

  /** Applies a change to every selected token beside the tiles. */
  const changeToken = (recipe: (token: BoardToken) => void) =>
    editLayout((l) => {
      for (const t of l.tokens) if (selected.includes(t.id)) recipe(t);
    }, `token-${selected.join(",")}`);

  /** Turns every selected tile and token in place; a whole Gate skips the turns where its surface half has no room. */
  const rotateSelected = (step: number) =>
    editLayout((l) => {
      for (const t of l.tiles) if (selected.includes(t.id)) t.rotation = (t.rotation + step) % 6;
      for (const t of l.tokens) {
        if (!selected.includes(t.id)) continue;
        for (let k = 1; k < 6; k++) {
          const rotation = (t.rotation + step * k) % 6;
          if (canPlaceToken(l.tiles, l.tokens.map(tokenSpot), tokenCells({ ...t, rotation }), t.id)) {
            t.rotation = rotation;
            break;
          }
        }
      }
    }, `tile-${selected.join(",")}`);

  const removeSelected = () => {
    if (!pickedCount) return;
    editLayout((l) => {
      l.tiles = l.tiles.filter((t) => !selected.includes(t.id));
      l.tokens = l.tokens.filter((t) => !selected.includes(t.id));
    });
    setSelected([]);
    setField(null);
  };

  const unselect = () => {
    setArmed(null);
    setSelected([]);
    setField(null);
  };

  // "More" ends with the selection
  useEffect(() => {
    if (!pickedCount) setAdding(false);
  }, [pickedCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") {
        unselect();
      } else if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && armed?.kind === "token") {
        // turn the token before it is placed
        e.preventDefault();
        setArmed({ ...armed, turn: ((armed.turn ?? 0) + (e.shiftKey ? 5 : 1)) % 6 });
      } else if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && pickedCount) {
        e.preventDefault();
        rotateSelected(e.shiftKey ? 5 : 1);
      } else if ((e.key === "Delete" || e.key === "Backspace") && pickedCount) {
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
      editLayout((l) => {
        if (mode === "replace") {
          l.tiles = normalise(imported);
          l.tokens = [];
          return;
        }
        // append: shift the import below the current map, keeping row parity
        const maxRow = Math.max(0, ...l.tiles.map((t) => t.row), ...l.tokens.map((t) => t.row));
        const minRow = Math.min(...imported.map((t) => t.row));
        const shift = Math.ceil((maxRow + 4 - minRow) / 2) * 2;
        l.tiles = [...l.tiles, ...imported.map((t) => ({ ...t, id: guid(), row: t.row + shift }))];
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
      download(`${file}.png`, await renderMapPng(tiles, 2, tokens));
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
                setSelected([]);
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
              setSelected([]);
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
              setSelected([]);
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
            title={tokens.length ? "The .map file holds the tiles only; tokens beside the tiles are left out" : undefined}
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
              const what = [tiles.length && plural(tiles.length, "tile"), tokens.length && plural(tokens.length, "token")].filter(Boolean).join(" and ");
              if (what && !window.confirm(`Delete the layout "${layout.name}" and its ${what}?`)) return;
              update((d) => void d.maps.splice(index, 1));
              setLayoutIndex(Math.max(0, index - 1));
              setSelected([]);
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
            tokens={tokens}
            selectedIds={selected}
            selectedField={field}
            armed={armed}
            layoutKey={`${layout.id}-${fitCount}`}
            onPlace={(a, row, col) => {
              if (a.kind === "tile") {
                const t = newTile(a.id, row, col);
                setTiles((list) => void list.push(t));
                setSelected([t.id]);
              } else {
                const t: BoardToken = { id: guid(), location: a.id, row, col, rotation: a.turn ?? 0 };
                editLayout((l) => void l.tokens.push(t));
                setSelected([t.id]);
              }
              setField(null);
            }}
            onMove={(moves) =>
              editLayout((l) => {
                for (const m of moves) {
                  const t = l.tiles.find((x) => x.id === m.id) ?? l.tokens.find((x) => x.id === m.id);
                  if (t) {
                    t.row = m.row;
                    t.col = m.col;
                  }
                }
              })
            }
            onSelect={(ids, f) => {
              setSelected(ids);
              setField(f);
            }}
            adding={adding}
            actions={
              pickedCount > 0 && (
                <ActionBar
                  name={selectionName(picked.length, pickedTokens.length)}
                  onRotate={rotateSelected}
                  onAgain={
                    again
                      ? () => {
                          setAdding(false);
                          setArmed(again);
                        }
                      : undefined
                  }
                  adding={adding}
                  onAdding={(on) => {
                    // a tap can't both place and pick: More stops placing, Same again stops More
                    if (on) setArmed(null);
                    setAdding(on);
                  }}
                  onDelete={removeSelected}
                  onDone={unselect}
                />
              )
            }
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
            {tokens.length > 0 && (
              <span className={tiles.length ? "note" : "warn"}>
                {plural(tokens.length, "token")} beside the tiles:{" "}
                {tiles.length ? "in the PNG and PDF, not in the .map file" : "place tiles too, a layout without tiles is left out of the book and the PDF"}
              </span>
            )}
            {gates.unpaired.length > 0 && (
              <span className="warn" title="A Subterranean Gate is one token over two Fields: put its halves on neighbouring Fields.">
                {gates.unpaired.length === 1 ? "A Gate half has" : `${gates.unpaired.length} Gate halves have`} no other half next to{" "}
                {gates.unpaired.length === 1 ? "it" : "them"}
              </span>
            )}
            {touch ? (
              <span className="keys">Tap a tile to select it; use the bar to rotate or delete</span>
            ) : (
              <span className="keys">
                Click: place/select &middot; Shift+click: add to selection &middot; Ctrl+drag: select with a frame &middot; Drag: move or pan &middot;
                Wheel: zoom &middot; R: rotate &middot; Del: remove &middot; Esc: unselect
              </span>
            )}
          </div>
        </div>
        {tile ? (
          <Inspector
            tile={tile}
            copies={tiles.filter((t) => t.tileId === tile.tileId).length}
            gateLinked={linkedHalves.has(`${tile.id}:${field ?? 3}`)}
            field={field}
            onField={setField}
            onChange={changeTile}
            onDelete={removeSelected}
            onDuplicate={() => setArmed({ kind: "tile", id: tile.tileId })}
          />
        ) : token ? (
          <TokenInspector token={token} onChange={changeToken} onRotate={rotateSelected} onDelete={removeSelected} />
        ) : pickedCount > 1 ? (
          <aside className="inspector empty">
            <h4>{selectionName(picked.length, pickedTokens.length)} selected</h4>
            <p className="hint">Drag any of them to move them all together. R rotates each one in place, Del removes them.</p>
            <p className="hint">Shift+click a tile or token to add it or drop it from the selection. Esc or a click on the empty board clears it.</p>
            <button type="button" className="btn small danger" onClick={removeSelected}>
              Remove {pickedCount}
            </button>
          </aside>
        ) : (
          <aside className="inspector empty">
            <h4>No tile selected</h4>
            <p className="hint">
              Face-down tiles (I, II&ndash;III, IV&ndash;V, VI&ndash;VII) leave the draw to the players, like most mission book maps. Place
              printed tiles where the Scenario needs a specific one.
            </p>
            <p className="hint">Select a placed tile to rotate it, give a face-down Starting tile a faction border, or put cubes, Heroes, tokens and blocks on its Fields.</p>
            <p className="hint">To put a Location token next to the tiles instead, pick it from the bottom of the tile box and click an empty Field.</p>
            {(tiles.length > 0 || tokens.length > 0) && (
              <button
                type="button"
                className="btn small danger"
                onClick={() => {
                  const what = [tiles.length && plural(tiles.length, "tile"), tokens.length && plural(tokens.length, "token")].filter(Boolean).join(" and ");
                  if (window.confirm(`Remove all ${what} from "${layout.name}"?`))
                    editLayout((l) => {
                      l.tiles = [];
                      l.tokens = [];
                    });
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