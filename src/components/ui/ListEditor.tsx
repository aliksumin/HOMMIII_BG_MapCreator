import { MarkupField } from "./MarkupField.tsx";
import { Runs } from "./Runs.tsx";
import { itemDepths, itemPrefix, nestedDepth, parseInline, parseItem } from "../../lib/markup.ts";

interface Props {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: string;
  placeholder?: string;
  /** one-click suggestions */
  chips?: readonly string[];
}

/**
 * An editable bullet list: each item one markup paragraph, where Enter breaks
 * the line. Tab and Shift+Tab nest an item one level deeper or shallower (the
 * item stores it as a leading "  - "), and its marker switches between a
 * bullet and a number. On touch screens, which have no Tab key, buttons
 * on each row do the nesting.
 */
export function ListEditor({ items, onChange, addLabel = "Add item", placeholder, chips }: Props) {
  const set = (i: number, value: string) => onChange(items.map((item, k) => (k === i ? value : item)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const levels = itemDepths(items);
  return (
    <div className="list-editor">
      {items.map((item, i) => {
        const line = parseItem(item);
        const depth = levels[i];
        const text = item.slice(line.prefix.length);
        const store = (d: number, numbered: boolean, value = text) => set(i, itemPrefix(d, numbered) + value);
        const deeper = nestedDepth(levels, i, 1);
        const shallower = nestedDepth(levels, i, -1);
        const indent = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.metaKey) return;
          const to = e.shiftKey ? shallower : deeper;
          // At either end Tab keeps moving the focus, so the keyboard never gets stuck in a list.
          if (to === null) return;
          e.preventDefault();
          store(to, line.numbered);
        };
        return (
          <div className={`list-row depth-${depth}`} key={i}>
            <button
              type="button"
              className={`item-marker ${line.numbered ? "numbered" : depth ? "sub" : "bullet"}`}
              title={line.numbered ? "Numbered item: click for a bullet" : "Bullet: click to number the item. Tab / Shift+Tab nest it."}
              onClick={() => store(depth, !line.numbered)}
            >
              {line.numbered ? "1." : ""}
            </button>
            <MarkupField
              value={text}
              onChange={(v) => store(depth, line.numbered, v)}
              onKeyDown={indent}
              placeholder={placeholder}
              multiline
              breaks="line"
            />
            <div className="row-tools">
              <button
                type="button"
                className="tool touch-only"
                aria-label="Nest one level back"
                disabled={shallower === null}
                onClick={() => shallower !== null && store(shallower, line.numbered)}
              >
                &#8676;
              </button>
              <button
                type="button"
                className="tool touch-only"
                aria-label="Nest one level deeper"
                disabled={deeper === null}
                onClick={() => deeper !== null && store(deeper, line.numbered)}
              >
                &#8677;
              </button>
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
        );
      })}
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
