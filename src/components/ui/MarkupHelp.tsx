import { useEffect, useRef, useState } from "react";
import { parseInline } from "../../lib/markup.ts";
import { PopHead } from "./Modal.tsx";
import { Runs } from "./Runs.tsx";

/** What to type, and what the book prints for it. */
const SYNTAX: [string, string][] = [
  ["**bold**", "**bold**"],
  ["*italic*", "*italic*"],
  [":gold:", "3 :gold:"],
  ["!!red!!", "!!red!!"],
  ["+1 / -1", "+1 :movement:"],
  ["[text](https://...)", "[text](https://example.org)"],
  ["^[note]", "Rule^[A footnote.]"],
  ['"quotes" and --', '"quotes" and 1--3'],
  ["\\* \\! \\[ \\+ \\-", "\\*literal\\* \\!\\!"],
];

/** Buttons that wrap the selection: label, tooltip, what goes before and after. */
const INSERTS: [string, string, string, string][] = [
  ["Red", "Red emphasis (!!text!!)", "!!", "!!"],
  ["Link", "Link ([text](https://...))", "[", "](https://)"],
  ["Footnote", "Footnote (^[note])", "^[", "]"],
];

/** List items only; the last field names the device a row is for, as a class that hides it on the other. */
const ITEMS: [string, string, string?][] = [
  ["Tab / Shift+Tab", "nest the item one level deeper or back", "fine-only"],
  ["\u21e5 / \u21e4", "the row's buttons nest the item one level deeper or back", "touch-only"],
  ["  - text", "a nested bullet, typed"],
  ["1. text", "a numbered item; click the marker to switch", "fine-only"],
  ["1. text", "a numbered item; tap the marker to switch", "touch-only"],
];

/** The toolbar's buttons, whose tooltips a touch screen never shows. */
const BUTTONS: [string, string][] = [
  ["B / I", "bold / italic"],
  ["Icon", "a game icon"],
  ["\u21b5", "a line break, in fields where Enter starts a new paragraph"],
];

/** A button that opens the rarer markup (red, links, footnotes) and the cheat sheet of all of it. */
export function MarkupHelp({ onWrap }: { onWrap: (before: string, after?: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="markup-help" ref={ref}>
      <button type="button" className="tool" title="More markup: red, links, footnotes, and help" aria-expanded={open} onClick={() => setOpen(!open)}>
        {"\u22ef"}
      </button>
      {open && (
        <div className="markup-help-pop" role="dialog" aria-label="Markup help">
          <PopHead title="Markup" onClose={() => setOpen(false)} />
          <div className="markup-help-tools">
            {INSERTS.map(([label, title, before, after]) => (
              <button
                type="button"
                key={label}
                className={label === "Red" ? "tool mk-red" : "tool"}
                title={title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onWrap(before, after);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <table>
            <tbody>
              {SYNTAX.map(([typed, example]) => (
                <tr key={typed}>
                  <td>
                    <code>{typed}</code>
                  </td>
                  <td>
                    <Runs runs={parseInline(example)} />
                  </td>
                </tr>
              ))}
              <tr>
                <th colSpan={2}>In list items</th>
              </tr>
              {ITEMS.map(([typed, what, only]) => (
                <tr key={typed + what} className={only}>
                  <td>
                    <code>{typed}</code>
                  </td>
                  <td>{what}</td>
                </tr>
              ))}
              <tr className="touch-only">
                <th colSpan={2}>Buttons</th>
              </tr>
              {BUTTONS.map(([label, what]) => (
                <tr key={label} className="touch-only">
                  <td>
                    <code>{label}</code>
                  </td>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
