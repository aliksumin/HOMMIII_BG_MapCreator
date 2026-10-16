import { FACTIONS } from "../../data/game.ts";
import { useScenario } from "../../model/store.ts";
import type { Scenario } from "../../model/types.ts";
import { Field, Panel, Toggle } from "../ui/Form.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";

const FIELDS: { key: Exclude<keyof Scenario["aiHero"], "enabled" | "faction">; label: string; placeholder: string }[] = [
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
        </>
      )}
    </Panel>
  );
}