import { useRef } from "react";
import { GlyphPicker } from "./GlyphPicker.tsx";

interface Props {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  /** hide the formatting toolbar */
  plain?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * A text input that accepts the editor markup (**bold**, *italic*, :glyph:),
 * with a small toolbar that inserts it for the contributor.
 */
export function MarkupField({ value, onChange, multiline, rows = 3, placeholder, plain, autoFocus, className }: Props) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

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

  const common = {
    ref,
    value,
    placeholder,
    autoFocus,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };

  return (
    <div className={`markup ${multiline ? "multi" : "single"} ${className ?? ""}`}>
      {multiline ? <textarea rows={rows} {...common} /> : <input type="text" {...common} />}
      {!plain && (
        <div className="markup-tools">
          <button type="button" className="tool" title="Bold (**text**)" onClick={() => wrap("**")}>
            <b>B</b>
          </button>
          <button type="button" className="tool" title="Italic (*text*)" onClick={() => wrap("*")}>
            <i>I</i>
          </button>
          <GlyphPicker onPick={(name) => insert(`:${name}:`)} />
        </div>
      )}
    </div>
  );
}