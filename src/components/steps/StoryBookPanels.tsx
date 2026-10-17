import { useMemo } from "react";
import { uid } from "../../lib/id.ts";
import { moveParagraph, paragraphRefs, removeParagraph } from "../../lib/storybook.ts";
import { useScenario } from "../../model/store.ts";
import { Field, Panel, TextInput } from "../ui/Form.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";

/** Story Locations or Special Tiles: a name and what happens there. */
function Entries({
  list,
  titleLabel,
  titlePlaceholder,
  textPlaceholder,
  paragraphs,
}: {
  list: "locations" | "specialTiles";
  titleLabel: string;
  titlePlaceholder: string;
  textPlaceholder: string;
  paragraphs: number;
}) {
  const [s, update] = useScenario();
  const entries = s.storyBook[list];
  const move = (i: number, j: number) =>
    update((d) => {
      const items = d.storyBook[list];
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
    });
  return (
    <div className="story-entries">
      {entries.map((entry, i) => (
        <div className="story-entry" key={entry.id}>
          <div className="story-entry-fields">
            <Field label={titleLabel}>
              <TextInput
                value={entry.title}
                placeholder={titlePlaceholder}
                onChange={(v) => update((d) => void (d.storyBook[list][i].title = v), `${list}-title-${entry.id}`)}
              />
            </Field>
            <Field label="What happens">
              <MarkupField
                multiline
                rows={3}
                value={entry.text}
                placeholder={textPlaceholder}
                paragraphs={paragraphs}
                onChange={(v) => update((d) => void (d.storyBook[list][i].text = v), `${list}-text-${entry.id}`)}
              />
            </Field>
          </div>
          <div className="row-tools">
            <button type="button" className="tool" title="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
              &#9650;
            </button>
            <button type="button" className="tool" title="Move down" disabled={i === entries.length - 1} onClick={() => move(i, i + 1)}>
              &#9660;
            </button>
            <button type="button" className="tool danger" title="Remove" onClick={() => update((d) => void d.storyBook[list].splice(i, 1))}>
              &#10005;
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Story Locations, Special Tiles and numbered Paragraphs: the story book part of the Story step. */
export function StoryBookPanels() {
  const [s, update] = useScenario();
  const book = s.storyBook;
  const count = book.paragraphs.length;
  const refs = useMemo(() => paragraphRefs(s), [s]);

  return (
    <>
      <Panel
        title="Story Locations"
        aside={
          <button
            type="button"
            className="btn small"
            onClick={() => update((d) => void d.storyBook.locations.push({ id: uid(), title: "", text: "" }))}
          >
            + Add location
          </button>
        }
      >
        <Entries
          list="locations"
          titleLabel="Location"
          titlePlaceholder="e.g. Witch Hut"
          textPlaceholder="When you visit a Witch Hut for the first time, do not resolve the effect of this Field. Instead, read §2."
          paragraphs={count}
        />
        <Field label="Note after the locations (optional)">
          <MarkupField
            multiline
            rows={2}
            value={book.locationsNote}
            placeholder="**Note:** Whenever you visit one of the locations above, after reading the relevant paragraph, place a Black Cube on the visited location."
            onChange={(v) => update((d) => void (d.storyBook.locationsNote = v), "locationsNote")}
          />
        </Field>
      </Panel>

      <Panel
        title="Special Tiles"
        aside={
          <button
            type="button"
            className="btn small"
            onClick={() => update((d) => void d.storyBook.specialTiles.push({ id: uid(), title: "", text: "" }))}
          >
            + Add special tile
          </button>
        }
      >
        <p className="hint">A Field of the map with an effect of its own, named by its place on the map.</p>
        <Entries
          list="specialTiles"
          titleLabel="Field"
          titlePlaceholder="e.g. F5 Mystical Garden"
          textPlaceholder="On your first visit to this location do not resolve the effect of this Field. Instead, read §4."
          paragraphs={count}
        />
      </Panel>

      <Panel
        title="Paragraphs"
        aside={
          <button type="button" className="btn small" onClick={() => update((d) => void d.storyBook.paragraphs.push({ id: uid(), text: "" }))}>
            + Add paragraph §{count + 1}
          </button>
        }
      >
        {count === 0 && <p className="hint">No paragraphs yet. Add the first one, then point a Story Location to it.</p>}
        <div className="story-paragraphs">
          {book.paragraphs.map((p, i) => {
            const links = refs.get(i + 1) ?? 0;
            const plural = links === 1 ? "" : "s";
            return (
              <div className="story-paragraph" key={p.id}>
                <div className="story-number">
                  <span>§{i + 1}</span>
                  <small className={links ? "" : "unlinked"}>{links ? `${links} link${plural}` : "no links"}</small>
                </div>
                <MarkupField
                  multiline
                  rows={4}
                  value={p.text}
                  paragraphs={count}
                  placeholder="You arrive at a water wheel... If you help the peasants, pay 2 :building_materials: and read §14. Otherwise, read §27."
                  onChange={(v) => update((d) => void (d.storyBook.paragraphs[i].text = v), `paragraph-${p.id}`)}
                />
                <div className="row-tools">
                  <button type="button" className="tool" title="Move up" disabled={i === 0} onClick={() => update((d) => moveParagraph(d, i, i - 1))}>
                    &#9650;
                  </button>
                  <button
                    type="button"
                    className="tool"
                    title="Move down"
                    disabled={i === count - 1}
                    onClick={() => update((d) => moveParagraph(d, i, i + 1))}
                  >
                    &#9660;
                  </button>
                  <button
                    type="button"
                    className="tool danger"
                    title="Remove"
                    onClick={() => {
                      const ask = `${links} reference${plural} lead to §${i + 1}. Remove it anyway? They become §? until you fix them.`;
                      if (links && !window.confirm(ask)) return;
                      update((d) => removeParagraph(d, i));
                    }}
                  >
                    &#10005;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
