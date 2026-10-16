import { useScenario } from "../../model/store.ts";
import { Field, Panel } from "../ui/Form.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";

export function StepStory() {
  const [s, update] = useScenario();
  return (
    <>
      <Panel title="Flavor text">
        <Field label="One or two paragraphs that set the story" hint="Printed in italics right under the Author line.">
          <MarkupField
            multiline
            rows={6}
            value={s.lore}
            placeholder="There is a world beyond ours, filled with beasts and monsters..."
            onChange={(v) => update((d) => void (d.lore = v), "lore")}
          />
        </Field>
      </Panel>
      <Panel title="The Story">
        <Field
          label="Long story (optional)"
          hint="Campaigns often tell a longer story on its own page after the map. Separate paragraphs with a blank line."
        >
          <MarkupField multiline rows={10} value={s.story} onChange={(v) => update((d) => void (d.story = v), "story")} />
        </Field>
      </Panel>
    </>
  );
}