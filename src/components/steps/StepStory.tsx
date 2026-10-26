import { useScenario } from "../../model/store.ts";
import { Field, Panel } from "../ui/Form.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";
import { StoryBookPanels } from "./StoryBookPanels.tsx";

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
        <p className="hint">
          Everything from here on prints on its own page after the map, and all of it is optional: the long story first, then the Story
          Locations, Special Tiles and numbered Paragraphs. Campaign and Solo Scenarios, like the one in the Naval Battles mission book, tell
          their story this way. A location or tile sends the reader to a paragraph, and a paragraph ends with choices that send them on. Write{" "}
          <code>§12</code>, or pick from the <b>§ Read</b> menu, to point to paragraph 12. Moving or removing a paragraph renumbers every
          reference.
        </p>
        <Field label="Long story">
          <MarkupField
            multiline
            rows={10}
            value={s.story}
            paragraphs={s.storyBook.paragraphs.length}
            onChange={(v) => update((d) => void (d.story = v), "story")}
          />
        </Field>
      </Panel>
      <StoryBookPanels />
    </>
  );
}
