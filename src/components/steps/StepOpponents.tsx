import { FACTIONS } from "../../data/game.ts";
import { useScenario } from "../../model/store.ts";
import type { Scenario } from "../../model/types.ts";
import { Field, Panel, Toggle } from "../ui/Form.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";
import { TablesEditor } from "../ui/TablesEditor.tsx";
import { aiSetupRow } from "../../lib/tables.ts";

const FIELDS: { key: Exclude<keyof Scenario["aiHero"], "enabled" | "faction" | "tables">; label: string; placeholder: string }[] = [
  { key: "army", label: "Enemy Army", placeholder: "e.g. 2 :bronze:, 2 :silver:, 1 :golden: Necropolis Units" },
  { key: "deck", label: "Enemy Deck", placeholder: "e.g. Might AI Deck, Normal" },
  { key: "spellDeck", label: "Enemy Spell Deck", placeholder: "e.g. none" },
  { key: "skills", label: "Enemy Skills", placeholder: "e.g. Offense, Armorer" },
  { key: "special", label: "Special", placeholder: "Anything the AI Hero does differently" },
];

export function StepOpponents() {
  const [s, update] = useScenario();
  return (
    <Panel title="AI Hero Setup">
      <Toggle
        checked={s.aiHero.enabled}
        onChange={(on) => update((d) => void (d.aiHero.enabled = on))}
        label="This Scenario has an AI-controlled Hero"
      />
      <p className="hint">Campaigns and some cooperative Scenarios pit the players against an AI Hero. Clash Scenarios usually skip this.</p>
      {s.aiHero.enabled && (
        <>
          <Field label="Faction">
            <select value={s.aiHero.faction} onChange={(e) => update((d) => void (d.aiHero.faction = e.target.value))}>
              <option value="">(none)</option>
              {FACTIONS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <MarkupField
                multiline
                rows={2}
                value={s.aiHero[f.key]}
                placeholder={f.placeholder}
                onChange={(v) => update((d) => void (d.aiHero[f.key] = v), `ai-${f.key}`)}
              />
            </Field>
          ))}
          <Field label="Tables" wide hint="An AI Hero setup table lists several enemy armies side by side, as campaigns do.">
            <TablesEditor tables={s.aiHero.tables} aiRow={(columns) => aiSetupRow(s, columns)} edit={(recipe, tag) => update((d) => recipe(d.aiHero.tables), tag && `ai-table-${tag}`)} />
          </Field>
        </>
      )}
    </Panel>
  );
}