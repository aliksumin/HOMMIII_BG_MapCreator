import { MarkupField } from "./MarkupField.tsx";
import { Runs } from "./Runs.tsx";
import { parseInline } from "../../lib/markup.ts";

interface Props {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: string;
  placeholder?: string;
  /** one-click suggestions */
  chips?: readonly string[];
  multiline?: boolean;
}

/** An editable bullet list: each item one markup line. */
export function ListEditor({ items, onChange, addLabel = "Add item", placeholder, chips, multiline }: Props) {
  const set = (i: number, value: string) => onChange(items.map((item, k) => (k === i ? value : item)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="list-editor">
      {items.map((item, i) => (
        <div className="list-row" key={i}>
          <span className="bullet" aria-hidden />
          <MarkupField value={item} onChange={(v) => set(i, v)} placeholder={placeholder} multiline={multiline} rows={2} />
          <div className="row-tools">
            <button type="button" className="tool" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              &#9650;
            </button>
            <button type="button" className="tool" title="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              &#9660;
            </button>
            <button type="button" className="tool danger" title="Remove" onClick={() => onChange(items.filter((_, k) => k !== i))}>
              &#10005;
            </button>
          </div>
        </div>
      ))}
      <div className="list-actions">
        <button type="button" className="btn small" onClick={() => onChange([...items, ""])}>
          + {addLabel}
        </button>
      </div>
      {chips && chips.length > 0 && <Chips chips={chips} onPick={(chip) => onChange([...items.filter((x) => x.trim()), chip])} />}
    </div>
  );
}

/** Suggestion chips that render their markup. */
export function Chips({ chips, onPick, label = "Suggestions" }: { chips: readonly string[]; onPick: (chip: string) => void; label?: string }) {
  return (
    <div className="chips">
      <span className="chips-label">{label}:</span>
      {chips.map((chip) => (
        <button type="button" key={chip} className="chip" onClick={() => onPick(chip)}>
          <Runs runs={parseInline(chip)} />
        </button>
      ))}
    </div>
  );
}