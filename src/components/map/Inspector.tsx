import { assetUrl, CREATURE_BANKS, EXPANSIONS, isRandomTile, MAP_LOCATIONS, PORTRAITS, TILES, tileName } from "../../data/catalog.ts";
import { CUBE_COLORS, FACTION_BORDER } from "../../data/game.ts";
import { hexPoints } from "../../lib/mapdraw.ts";
import { boardTokenName, GATE, isGateHalf } from "../../lib/tokens.ts";
import type { BoardToken, MapTile } from "../../model/types.ts";
import { Toggle } from "../ui/Form.tsx";
import { GateArt } from "./GateArt.tsx";

const MINI: readonly [number, number][] = [
  [-21.5, -37],
  [21.5, -37],
  [-43, 0],
  [0, 0],
  [43, 0],
  [-21.5, 37],
  [21.5, 37],
];

interface Props {
  tile: MapTile;
  /** how many tiles of this kind the layout holds, this one included */
  copies: number;
  /** the picked Field holds a Gate half with its other half next to it */
  gateLinked?: boolean;
  field: number | null;
  onField: (field: number) => void;
  onChange: (recipe: (tile: MapTile) => void) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

/** Edits the selected tile and one of its seven Fields. */
export function Inspector({ tile, copies, gateLinked = false, field, onField, onChange, onDelete, onDuplicate }: Props) {
  const info = TILES[tile.tileId];
  const f = field ?? 3;
  return (
    <aside className="inspector">
      <div className="inspector-head">
        {info && <img src={assetUrl(info.img)} alt="" style={{ transform: `rotate(${tile.rotation * 60}deg)` }} />}
        <div>
          <b>{tileName(tile.tileId)}</b>
          <span className="hint">
            {tile.tileId}
            {info ? ` \u00b7 ${EXPANSIONS[info.expansion] ?? info.expansion}` : ""}
          </span>
        </div>
      </div>
      {copies > 1 && !isRandomTile(tile.tileId) && (
        <p className="inspector-warn">
          {tileName(tile.tileId)} is placed {copies} times on this layout, but the game has only one. Use a face-down tile or another printed one.
        </p>
      )}
      <div className="inspector-actions">
        <button type="button" className="btn small" title="Rotate left (Shift+R)" onClick={() => onChange((t) => void (t.rotation = (t.rotation + 5) % 6))}>
          &#x21BA; Rotate
        </button>
        <button type="button" className="btn small" title="Rotate right (R)" onClick={() => onChange((t) => void (t.rotation = (t.rotation + 1) % 6))}>
          Rotate &#x21BB;
        </button>
        <button type="button" className="btn small" onClick={onDuplicate} title="Arm another tile of this kind">
          Same again
        </button>
        <button type="button" className="btn small danger" title="Delete (Del)" onClick={onDelete}>
          Delete
        </button>
      </div>
      {isRandomTile(tile.tileId) && (
        <label className="field">
          <span className="field-label">Faction border</span>
          <select value={tile.faction} onChange={(e) => onChange((t) => void (t.faction = e.target.value))}>
            <option value="">None</option>
            {Object.keys(FACTION_BORDER).map((k) => (
              <option key={k} value={k}>
                {k.charAt(0) + k.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      )}
      <Toggle
        checked={tile.suggestedPlacement}
        onChange={(on) => onChange((t) => void (t.suggestedPlacement = on))}
        label="Suggested placement (drawn faded)"
      />

      <h4>Fields</h4>
      <svg className="mini-flower" viewBox="-70 -62 140 124" role="img" aria-label="Pick a Field">
        <title>Pick a Field</title>
        {MINI.map(([x, y], i) => {
          const cube = CUBE_COLORS.find((c) => c.id === tile.cubes[i]);
          const marked = tile.hero[i] || tile.mapLocations[i] || tile.creaturebanks[i] || tile.blockedHex[i];
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the selects below are the keyboard path
            <g key={i} onClick={() => onField(i)} className={`mini-field ${f === i ? "on" : ""}`}>
              <polygon points={hexPoints(x, y, 0.5)} />
              {cube && <rect x={x - 5} y={y - 14} width={10} height={10} fill={cube.color} stroke="#000" strokeWidth={0.8} />}
              {marked && <circle cx={x} cy={y + 6} r={4} className="mark" />}
              <text x={x} y={y + 4}>
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="hint">Field {f + 1} of the tile as printed (rotation not applied). Click a Field on the map to pick it too.</p>

      <div className="field">
        <span className="field-label">Cube</span>
        <div className="cube-row">
          <button type="button" className={tile.cubes[f] === 0 ? "on" : ""} onClick={() => onChange((t) => void (t.cubes[f] = 0))} title="No cube">
            &#x2205;
          </button>
          {CUBE_COLORS.map((c) => (
            <button
              type="button"
              key={c.id}
              title={c.label}
              className={tile.cubes[f] === c.id ? "on" : ""}
              style={{ background: c.color }}
              onClick={() => onChange((t) => void (t.cubes[f] = c.id))}
            />
          ))}
        </div>
      </div>
      <label className="field">
        <span className="field-label">Hero</span>
        <select value={tile.hero[f]} onChange={(e) => onChange((t) => void (t.hero[f] = e.target.value))}>
          <option value="">None</option>
          {Object.entries(PORTRAITS)
            .sort((a, b) => a[1].faction.localeCompare(b[1].faction) || a[1].desc.localeCompare(b[1].desc))
            .map(([k, p]) => (
              <option key={k} value={k}>
                {p.desc} ({p.faction.charAt(0) + p.faction.slice(1).toLowerCase()})
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Location token</span>
        <select value={tile.mapLocations[f]} onChange={(e) => onChange((t) => void (t.mapLocations[f] = e.target.value))}>
          <option value="">None</option>
          {Object.entries(MAP_LOCATIONS).map(([k, l]) => (
            <option key={k} value={k}>
              {l.desc}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Creature Bank</span>
        <select value={tile.creaturebanks[f]} onChange={(e) => onChange((t) => void (t.creaturebanks[f] = e.target.value))}>
          <option value="">None</option>
          {Object.entries(CREATURE_BANKS).map(([k, b]) => (
            <option key={k} value={k}>
              {b.desc}
            </option>
          ))}
        </select>
      </label>
      {isGateHalf(tile.mapLocations[f]) && (
        <p className="hint">
          {gateLinked
            ? "This half faces its other half on the neighbouring Field, so the two show as one Gate."
            : "A Subterranean Gate is one token over two Fields: put the other half on a neighbouring Field of the next tile and the halves turn to face each other. Until then this Field is outlined in red."}
        </p>
      )}
      {(tile.mapLocations[f] || tile.creaturebanks[f]) && !(gateLinked && isGateHalf(tile.mapLocations[f]) && !tile.creaturebanks[f]) && (
        <button
          type="button"
          className="btn small"
          onClick={() => onChange((t) => void (t.fieldReplacementRotations[f] = ((t.fieldReplacementRotations[f] ?? 0) + 1) % 6))}
        >
          Rotate token &#x21BB;
        </button>
      )}
      <Toggle checked={tile.blockedHex[f]} onChange={(on) => onChange((t) => void (t.blockedHex[f] = on))} label="Blocked Field" />
    </aside>
  );
}

/** Edits a Location token that sits on an empty Field beside the tiles. */
export function TokenInspector({
  token,
  onChange,
  onRotate,
  onDelete,
}: {
  token: BoardToken;
  onChange: (recipe: (token: BoardToken) => void) => void;
  onRotate: (step: number) => void;
  onDelete: () => void;
}) {
  const gate = token.location === GATE;
  const info = MAP_LOCATIONS[token.location];
  return (
    <aside className="inspector">
      <div className="inspector-head">
        {gate ? (
          <GateArt />
        ) : (
          info && <img src={assetUrl(info.img)} alt="" style={{ transform: `rotate(${token.rotation * 60}deg)` }} />
        )}
        <div>
          <b>{boardTokenName(token.location)}</b>
          <span className="hint">{gate ? "Whole Gate over two Fields beside the tiles" : "Location token beside the tiles"}</span>
        </div>
      </div>
      <div className="inspector-actions">
        <button type="button" className="btn small" title="Rotate left (Shift+R)" onClick={() => onRotate(5)}>
          &#x21BA; Rotate
        </button>
        <button type="button" className="btn small" title="Rotate right (R)" onClick={() => onRotate(1)}>
          Rotate &#x21BB;
        </button>
        <button type="button" className="btn small danger" title="Delete (Del)" onClick={onDelete}>
          Delete
        </button>
      </div>
      {gate ? (
        <p className="hint">
          The underground half sits on the Field you placed it on and the surface half next to it; rotating swings the surface half around
          it, skipping the sides where it has no room.
        </p>
      ) : (
        <label className="field">
          <span className="field-label">Location token</span>
          <select value={token.location} onChange={(e) => onChange((t) => void (t.location = e.target.value))}>
            {Object.entries(MAP_LOCATIONS)
              .filter(([k]) => !isGateHalf(k))
              .map(([k, l]) => (
                <option key={k} value={k}>
                  {l.desc}
                </option>
              ))}
          </select>
        </label>
      )}
      <p className="hint">
        It sits on {gate ? "empty Fields" : "an empty Field"}, so it shows in the editor, the map PNG and the PDF, but the .map file (the
        community map editor&rsquo;s format) has no place for it.
      </p>
    </aside>
  );
}
