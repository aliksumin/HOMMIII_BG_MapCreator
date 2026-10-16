import { TILE_GROUPS } from "../../data/game.ts";
import { countTiles } from "../../lib/document.ts";
import { useScenario } from "../../model/store.ts";
import { Field, Panel, Stepper, Toggle } from "../ui/Form.tsx";
import { ListEditor } from "../ui/ListEditor.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";

const KEYS = ["starting", "far", "near", "center"] as const;

export function StepMapSetup() {
  const [s, update] = useScenario();
  const firstMap = s.maps.find((m) => m.tiles.length);
  const counts = firstMap ? countTiles(firstMap.tiles) : null;
  return (
    <>
      <Panel title="Map Setup">
        <Toggle
          checked={s.mapSetup.auto}
          onChange={(on) =>
            update((d) => {
              d.mapSetup.auto = on;
              if (!on && counts) for (const k of KEYS) d.mapSetup.counts[k] = { n: counts[k], perPlayer: false };
            })
          }
          label={<>Count the tiles from the map{firstMap ? <> &ldquo;{firstMap.name}&rdquo;</> : ""}</>}
        />
        <p className="hint">
          Turn this off to type the counts yourself, for example when the count grows with the number of players
          (&ldquo;<i>2P</i> &times; Far (II&ndash;III) Map Tiles&rdquo;).
        </p>
        <div className="tile-count-table">
          {TILE_GROUPS.filter((g) => (KEYS as readonly string[]).includes(g.key)).map((g) => {
            const key = g.key as (typeof KEYS)[number];
            const count = s.mapSetup.counts[key];
            return (
              <div className="tile-count-row" key={key}>
                <span className={`tile-badge ${key}`}>{g.roman}</span>
                <span className="tile-count-name">{g.label}</span>
                {s.mapSetup.auto ? (
                  <span className="tile-count-auto">{counts ? counts[key] : 0}</span>
                ) : (
                  <>
                    <Stepper value={count.n} min={0} max={36} onChange={(v) => update((d) => void (d.mapSetup.counts[key].n = v ?? 0))} />
                    <Toggle
                      checked={count.perPlayer}
                      onChange={(on) => update((d) => void (d.mapSetup.counts[key].perPlayer = on))}
                      label="per player"
                    />
                  </>
                )}
                <MarkupField
                  value={s.mapSetup.notes[key]}
                  placeholder="note, e.g. with the Obelisk Field"
                  onChange={(v) => update((d) => void (d.mapSetup.notes[key] = v), `note-${key}`)}
                />
              </div>
            );
          })}
        </div>
        {counts && (counts.water > 0 || counts.subterranean > 0) && (
          <p className="hint">
            The map also uses {counts.water} Water and {counts.subterranean} Subterranean tiles; with automatic counting they are listed too.
          </p>
        )}
        <Field label="More Map Setup lines" wide>
          <ListEditor items={s.mapSetup.extra} onChange={(items) => update((d) => void (d.mapSetup.extra = items), "mapExtra")} addLabel="Add a line" />
        </Field>
      </Panel>
      <Panel title="Heroes Placement">
        <Field label="Where Heroes start (optional)" hint="Campaigns usually say where your Hero and the AI Heroes are placed.">
          <MarkupField multiline rows={4} value={s.heroesPlacement} onChange={(v) => update((d) => void (d.heroesPlacement = v), "placement")} />
        </Field>
      </Panel>
    </>
  );
}