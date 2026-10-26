import { DEFEAT_CHIPS, VICTORY_CHIPS } from "../../data/game.ts";
import { useScenario } from "../../model/store.ts";
import { Field, Panel } from "../ui/Form.tsx";
import { Chips } from "../ui/ListEditor.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";

const append = (text: string, chip: string) => (text.trim() ? `${text.trim()}\n\n${chip}` : chip);

export function StepConditions() {
  const [s, update] = useScenario();
  return (
    <>
      <Panel title="Victory Conditions">
        <Field label="How a player (or the team) wins">
          <MarkupField multiline rows={5} value={s.victory} onChange={(v) => update((d) => void (d.victory = v), "victory")} />
        </Field>
        <Chips chips={VICTORY_CHIPS} onPick={(chip) => update((d) => void (d.victory = append(d.victory, chip)))} />
      </Panel>
      <Panel title="Defeat Conditions">
        <Field label="How the Scenario is lost">
          <MarkupField multiline rows={5} value={s.defeat} onChange={(v) => update((d) => void (d.defeat = v), "defeat")} />
        </Field>
        <Chips chips={DEFEAT_CHIPS} onPick={(chip) => update((d) => void (d.defeat = append(d.defeat, chip)))} />
      </Panel>
    </>
  );
}