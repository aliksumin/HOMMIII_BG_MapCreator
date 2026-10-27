import { useLayoutEffect, useRef } from "react";
import { GlyphPicker } from "./GlyphPicker.tsx";
import { MarkupHelp } from "./MarkupHelp.tsx";

interface Props {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  /**
   * What Enter does in a multi-line field. "paragraph" (the default) starts a
   * new paragraph, a blank line in the text. "line" breaks the line, for list
   * items, whose box grows with its text. Shift+Enter always breaks the line.
   */
  breaks?: "paragraph" | "line";
  rows?: number;
  placeholder?: string;
  /** hide the formatting toolbar */
  plain?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** how many story book paragraphs there are; when set, a § menu inserts a reference to one */
  paragraphs?: number;
  /** extra keys for a multi-line field, such as Tab in a list item */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * A text input that accepts the editor markup (**bold**, *italic*, :glyph:),
 * with a small toolbar that inserts it for the contributor.
 */
export function MarkupField({ value, onChange, multiline, breaks = "paragraph", rows = 3, placeholder, plain, autoFocus, className, paragraphs, onKeyDown }: Props) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const lineBreaks = multiline && breaks === "line";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!lineBreaks || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [lineBreaks, value]);

  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return onChange(value + before + after);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  };

  const insert = (text: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const pad = start > 0 && !/\s/.test(value[start - 1]) ? " " : "";
    const next = value.slice(0, start) + pad + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const at = start + pad.length + text.length;
      el.setSelectionRange(at, at);
    });
  };

  // Enter starts a paragraph: a blank line, or one more newline after a line
  // break. Shift+Enter keeps the textarea's own single newline. The input
  // event lets React see the edit as typing, so its record of the value stays
  // true and a Backspace that undoes the edit still counts as a change.
  const newParagraph = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const el = e.currentTarget;
    const before = el.value.slice(0, el.selectionStart);
    el.setRangeText(!before.trim() || before.endsWith("\n") ? "\n" : "\n\n", el.selectionStart, el.selectionEnd, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const common = {
    ref,
    value,
    placeholder,
    autoFocus,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };

  return (
    <div className={`markup ${multiline && !lineBreaks ? "multi" : "single"} ${lineBreaks ? "lines" : ""} ${className ?? ""}`}>
      {!multiline ? (
        <input type="text" {...common} />
      ) : lineBreaks ? (
        <textarea rows={1} title="Enter or Shift+Enter breaks the line" onKeyDown={onKeyDown} {...common} />
      ) : (
        <textarea rows={rows} onKeyDown={newParagraph} {...common} />
      )}
      {!plain && (
        <div className="markup-tools">
          <button type="button" className="tool" title="Bold (**text**)" onClick={() => wrap("**")}>
            <b>B</b>
          </button>
          <button type="button" className="tool" title="Italic (*text*)" onClick={() => wrap("*")}>
            <i>I</i>
          </button>
          <GlyphPicker onPick={(name) => insert(`:${name}:`)} />
          <MarkupHelp onWrap={wrap} />
          {!!paragraphs && (
            <select
              className="ref-picker"
              title="Insert a reference to a paragraph"
              value=""
              onChange={(e) => e.target.value && insert(`read §${e.target.value}.`)}
            >
              <option value="">§ Read…</option>
              {Array.from({ length: paragraphs }, (_, i) => (
                <option key={i} value={i + 1}>
                  read §{i + 1}
                </option>
              ))}
            </select>
          )}
          {multiline && !lineBreaks && (
            <span className="markup-keys">
              <kbd>Enter</kbd> new paragraph · <kbd>Shift</kbd>+<kbd>Enter</kbd> line break
            </span>
          )}
        </div>
      )}
    </div>
  );
}
