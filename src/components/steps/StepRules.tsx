import { RULE_CHIPS } from "../../data/game.ts";
import { uid } from "../../lib/id.ts";
import { useScenario } from "../../model/store.ts";
import { Field, Panel, TextInput } from "../ui/Form.tsx";
import { ListEditor } from "../ui/ListEditor.tsx";
import { MarkupField } from "../ui/MarkupField.tsx";
import { TablesEditor } from "../ui/TablesEditor.tsx";
import { aiSetupRow } from "../../lib/tables.ts";

export function StepRules() {
  const [s, update] = useScenario();
  const aiRow = (columns: number) => aiSetupRow(s, columns);
  return (
    <>
      <Panel title="Additional Rules">
        <Field label="Introduction (optional)" hint="e.g. During this Scenario, the following rules apply:">
          <MarkupField multiline rows={2} value={s.rulesIntro} onChange={(v) => update((d) => void (d.rulesIntro = v), "rulesIntro")} />
        </Field>
        <ListEditor items={s.rules} onChange={(items) => update((d) => void (d.rules = items), "rules")} addLabel="Add a rule" chips={RULE_CHIPS} />
        <Field label="Tables" wide hint="Difficulty matrices, dice lookups and setups in the mission book's framed style.">
          <TablesEditor tables={s.rulesTables} bullets={s.rules} aiRow={aiRow} edit={(recipe, tag) => update((d) => recipe(d.rulesTables), tag && `rules-table-${tag}`)} />
        </Field>
      </Panel>
      <Panel
        title="Own sections"
        aside={
          <button
            type="button"
            className="btn small"
            onClick={() => update((d) => void d.customSections.push({ id: uid(), title: "", text: "", items: [], tables: [] }))}
          >
            + Add section
          </button>
        }
      >
        <p className="hint">
          Sections such as &ldquo;Enemy Spawning and Movement&rdquo; or &ldquo;Boss Army&rdquo; follow the Additional Rules, in this order.
        </p>
      </Panel>
      {s.customSections.map((section, index) => (
        <Panel
          key={section.id}
          title={section.title || "New section"}
          aside={
            <div className="row-tools">
              <button
                type="button"
                className="tool"
                disabled={index === 0}
                onClick={() =>
                  update((d) => {
                    const [x] = d.customSections.splice(index, 1);
                    d.customSections.splice(index - 1, 0, x);
                  })
                }
              >
                &#9650;
              </button>
              <button type="button" className="btn small danger" onClick={() => update((d) => void d.customSections.splice(index, 1))}>
                Remove
              </button>
            </div>
          }
        >
          <Field label="Title">
            <TextInput value={section.title} placeholder="e.g. Enemy Spawning and Movement" onChange={(v) => update((d) => void (d.customSections[index].title = v), `sec-title-${section.id}`)} />
          </Field>
          <Field label="Text">
            <MarkupField multiline rows={3} value={section.text} onChange={(v) => update((d) => void (d.customSections[index].text = v), `sec-text-${section.id}`)} />
          </Field>
          <Field label="Bullets" wide>
            <ListEditor items={section.items} onChange={(items) => update((d) => void (d.customSections[index].items = items), `sec-items-${section.id}`)} />
          </Field>
          <Field label="Tables" wide>
            <TablesEditor
              tables={section.tables}
              bullets={section.items}
              aiRow={aiRow}
              edit={(recipe, tag) => update((d) => recipe(d.customSections[index].tables), tag && `sec-table-${tag}`)}
            />
          </Field>
        </Panel>
      ))}
    </>
  );
}