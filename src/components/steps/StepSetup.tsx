import { BONUS_CHIPS, BUILDINGS, FACTIONS, INCOME_TRACK, RESOURCES, UNIT_CHIPS } from "../../data/game.ts";
import { formatPlayerCount } from "../../lib/document.ts";
import { useScenario } from "../../model/store.ts";
import { Field, Panel, Segmented, Stepper, Toggle } from "../ui/Form.tsx";
import { ListEditor } from "../ui/ListEditor.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";
import { Glyph } from "../ui/Runs.tsx";

export function StepSetup() {
  const [s, update] = useScenario();
  const campaign = s.category === "campaigns";
  return (
    <>
      <Panel title="Scenario Length & Players">
        <div className="grid2">
          <Field label="Rounds" hint="Most scenarios last 8 to 16 Rounds.">
            <Stepper value={s.rounds} min={1} max={30} allowEmpty onChange={(v) => update((d) => void (d.rounds = v))} />
          </Field>
          <Field label="Note after the Round count" hint="Optional, e.g. (16 Rounds once the Grail is found)">
            <MarkupField value={s.roundsNote} onChange={(v) => update((d) => void (d.roundsNote = v), "roundsNote")} />
          </Field>
        </div>
        <Field label="Player Count" hint={s.playerCounts.length ? <>Prints as &ldquo;{formatPlayerCount(s.playerCounts)}&rdquo;</> : "Pick every count the Scenario supports."}>
          <div className="count-picker">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                type="button"
                key={n}
                className={s.playerCounts.includes(n) ? "on" : ""}
                onClick={() =>
                  update((d) => {
                    d.playerCounts = d.playerCounts.includes(n) ? d.playerCounts.filter((x) => x !== n) : [...d.playerCounts, n].sort();
                  })
                }
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
        {(campaign || s.faction || s.factionHero) && (
          <div className="grid2">
            <Field label="Faction">
              <select value={s.faction} onChange={(e) => update((d) => void (d.faction = e.target.value))}>
                <option value="">(none)</option>
                {FACTIONS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Faction Hero">
              <MarkupField value={s.factionHero} placeholder="e.g. Catherine" onChange={(v) => update((d) => void (d.factionHero = v), "hero")} />
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="Resources">
        <div className="resource-table">
          <span />
          <span className="th">Starting Resources</span>
          <span className="th">Starting Income</span>
          {RESOURCES.map((r) => (
            <div className="resource-row" key={r.key}>
              <span className="resource-name">
                <Glyph name={r.key} size={26} /> {r.label}
              </span>
              <Stepper
                value={s.resources[r.key]}
                min={0}
                max={99}
                allowEmpty
                onChange={(v) => update((d) => void (d.resources[r.key] = v))}
              />
              <select
                value={s.income[r.key] ?? ""}
                onChange={(e) => update((d) => void (d.income[r.key] = e.target.value === "" ? null : Number(e.target.value)))}
              >
                <option value="">(track minimum)</option>
                {INCOME_TRACK[r.key].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <p className="hint">Starting Resources leave out zeros; Starting Income prints every track position.</p>
      </Panel>

      <Panel title="Starting Units">
        <ListEditor
          items={s.startingUnits}
          onChange={(items) => update((d) => void (d.startingUnits = items), "units")}
          addLabel="Add a Unit line"
          placeholder='e.g. A "Pack" of the cheapest :bronze: Units'
          chips={UNIT_CHIPS}
        />
      </Panel>

      <Panel title="Town Buildings">
        <div className="building-grid">
          {BUILDINGS.map((b) => (
            <Toggle
              key={b.key}
              checked={s.buildings.includes(b.key)}
              onChange={(on) =>
                update((d) => {
                  d.buildings = on ? [...d.buildings, b.key] : d.buildings.filter((k) => k !== b.key);
                })
              }
              label={
                <>
                  <Glyph name={b.glyph} size={22} /> {b.label}
                </>
              }
            />
          ))}
        </div>
      </Panel>

      <Panel title="Map Tile Pool">
        <Toggle
          checked={s.tilePool.enabled}
          onChange={(on) => update((d) => void (d.tilePool.enabled = on))}
          label="Each player takes random tiles to place while exploring"
        />
        {s.tilePool.enabled && (
          <div className="grid3">
            <Field label="Far (II-III) per player">
              <Stepper value={s.tilePool.far} min={0} max={6} onChange={(v) => update((d) => void (d.tilePool.far = v ?? 0))} />
            </Field>
            <Field label="Near (IV-V) per player">
              <Stepper value={s.tilePool.near} min={0} max={6} onChange={(v) => update((d) => void (d.tilePool.near = v ?? 0))} />
            </Field>
            <Field label="Extra sentence">
              <MarkupField value={s.tilePool.note} placeholder="These Tiles should not contain any Obelisks." onChange={(v) => update((d) => void (d.tilePool.note = v), "poolNote")} />
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="Bonus">
        <Field label="Line label">
          <Segmented
            options={[
              { value: "Additional Bonus", label: "Additional Bonus" },
              { value: "Bonus", label: "Bonus" },
            ]}
            value={s.bonus.label === "Bonus" ? "Bonus" : "Additional Bonus"}
            onChange={(v) => update((d) => void (d.bonus.label = v))}
          />
        </Field>
        <p className="hint">One option prints on the line itself; several print as &ldquo;Choose one of the following options&rdquo;.</p>
        <ListEditor
          items={s.bonus.options}
          onChange={(items) => update((d) => void (d.bonus.options = items), "bonus")}
          addLabel="Add an option"
          chips={BONUS_CHIPS}
        />
      </Panel>
    </>
  );
}