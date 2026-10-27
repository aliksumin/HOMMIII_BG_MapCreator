import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  columnCount,
  diceRows,
  insertMarkup,
  newTable,
  parseUnits,
  PRESETS,
  removeTableColumn,
  setTableCell,
  tableDoc,
  UNIT_TIERS,
  type UnitTier,
  unitString,
} from "../../lib/tables.ts";
import type { RulesTable } from "../../model/types.ts";
import { TableView } from "../preview/BookPage.tsx";
import { Segmented, Toggle } from "./Form.tsx";
import { GlyphPicker } from "./GlyphPicker.tsx";
import { MarkupField } from "./MarkupField.tsx";
import { PopHead } from "./Modal.tsx";
import { Glyph } from "./Runs.tsx";

/** Changes a section's tables in the scenario draft; `tag` merges typing into one undo step. */
export type EditTables = (recipe: (tables: RulesTable[]) => void, tag?: string) => void;

interface Props {
  tables: RulesTable[];
  edit: EditTables;
  /** the section's bullets, so a table can sit between them; left out where a section has none */
  bullets?: string[];
  /** a row for the AI Hero setup preset from the AI Opponent step, when it has anything */
  aiRow?: (columns: number) => string[];
}

/** The tables of one section, each with its preset helpers, a cell grid and a small preview. */
export function TablesEditor({ tables, edit, bullets, aiRow }: Props) {
  return (
    <div className="tables-editor">
      {tables.map((table, index) => (
        <TableCard
          key={table.id}
          table={table}
          index={index}
          count={tables.length}
          edit={(recipe, tag) => edit((all) => recipe(all[index]), tag && `${table.id}-${tag}`)}
          move={(d) =>
            edit((all) => {
              const [t] = all.splice(index, 1);
              all.splice(index + d, 0, t);
            })
          }
          remove={() => edit((all) => void all.splice(index, 1))}
          bullets={bullets}
          aiRow={aiRow}
        />
      ))}
      <div className="chips">
        <span className="chips-label">Add a table:</span>
        {PRESETS.map((p) => (
          <button key={p.key} type="button" className="chip" title={p.hint} onClick={() => edit((all) => void all.push(newTable(p.key)))}>
            + {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  table: RulesTable;
  index: number;
  count: number;
  edit: (recipe: (t: RulesTable) => void, tag?: string) => void;
  move: (d: number) => void;
  remove: () => void;
  bullets?: string[];
  aiRow?: (columns: number) => string[];
}

/** Which cell the toolbar writes into: row -1 is the column labels. */
type Active = { row: number; col: number };

function TableCard({ table, index, count, edit, move, remove, bullets, aiRow }: CardProps) {
  const preset = PRESETS.find((p) => p.key === table.preset);
  // Difficulty settings keep their four tiers in order and their two columns.
  const fixed = table.preset === "settings";
  const n = table.columns.length;
  const [active, setActive] = useState<Active | null>(null);
  const activeEl = useRef<HTMLTextAreaElement | null>(null);
  const doc = useMemo(() => tableDoc(table), [table]);

  const cellValue = (a: Active) => (a.row < 0 ? table.columns[a.col] : table.rows[a.row]?.[a.col]) ?? "";
  const setCell = (a: Active, value: string) => edit((t) => setTableCell(t, a.row, a.col, value), `cell-${a.row}-${a.col}`);

  /** Wraps the active cell's selection in markup, or puts markup in its place. */
  const insert = (before: string, after = "") => {
    const el = activeEl.current;
    if (!active || !el) return;
    const value = cellValue(active);
    const edited = insertMarkup(value, el.selectionStart ?? value.length, el.selectionEnd ?? value.length, before, after);
    setCell(active, edited.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(edited.selection[0], edited.selection[1]);
    });
  };

  const focus = (a: Active) => (el: HTMLTextAreaElement) => {
    activeEl.current = el;
    setActive(a);
  };

  const addRow = () => edit((t) => void t.rows.push(t.columns.map(() => "")));
  const addColumn = () =>
    edit((t) => {
      t.columns.push("");
      t.rows.forEach((r) => r.push(""));
    });
  // Cells are keyed by position, so after a removal or a move the focused box
  // holds another cell: the toolbar lets go of it until a cell is clicked again.
  const release = () => {
    activeEl.current?.blur();
    activeEl.current = null;
    setActive(null);
  };
  const removeColumn = (c: number) => {
    release();
    edit((t) => removeTableColumn(t, c));
  };
  const removeRow = (r: number) => {
    release();
    edit((t) => void t.rows.splice(r, 1));
  };
  const moveColumn = (c: number, d: number) => {
    release();
    edit((t) => {
      const swap = <T,>(list: T[]) => ([list[c], list[c + d]] = [list[c + d], list[c]]);
      swap(t.columns);
      t.rows.forEach(swap);
    });
  };
  const moveRow = (r: number, d: number) => {
    release();
    edit((t) => {
      [t.rows[r], t.rows[r + d]] = [t.rows[r + d], t.rows[r]];
    });
  };

  const aiFill = aiRow?.(n);
  // A table across the page floats below the columns, so only a column table has a place among the bullets.
  const placeOptions = bullets && bullets.length > 0 && table.width === "column";

  return (
    <div className="table-card">
      <div className="table-card-head">
        <span className="table-kind" title={preset?.hint}>
          {preset?.label ?? "Table"}
        </span>
        <MarkupField
          value={table.title}
          placeholder="Title (optional), e.g. Enemy Armies"
          plain
          className="table-title"
          onChange={(v) => edit((t) => void (t.title = v), "title")}
        />
        <div className="row-tools">
          <button type="button" className="tool" title="Move table up" disabled={index === 0} onClick={() => move(-1)}>
            &#9650;
          </button>
          <button type="button" className="tool" title="Move table down" disabled={index === count - 1} onClick={() => move(1)}>
            &#9660;
          </button>
          <button type="button" className="tool danger" title="Remove table" onClick={remove}>
            &#10005;
          </button>
        </div>
      </div>

      {/* the kind badge explains itself in a tooltip, which a touch screen never shows */}
      {preset && <span className="hint touch-only">{preset.hint}</span>}

      <div className="table-options">
        <Segmented
          value={table.width}
          onChange={(v) => edit((t) => void (t.width = v))}
          options={[
            { value: "column", label: "In the column", title: "\\hommtablemulticol, inside the text column" },
            { value: "page", label: "Across the page", title: "\\hommtable in a table* float, below the two columns" },
          ]}
        />
        <Segmented
          value={table.align}
          onChange={(v) => edit((t) => void (t.align = v))}
          options={[
            { value: "center", label: "Centred" },
            { value: "left", label: "Left-aligned", title: "For cells with lists, such as Units" },
          ]}
        />
        <Toggle checked={table.showHeader} onChange={(on) => edit((t) => void (t.showHeader = on))} label="Column labels as a header row" />
        <Toggle checked={table.banner} onChange={(on) => edit((t) => void (t.banner = on))} label="Title as a merged header row" />
        {placeOptions && (
          <label className="table-place">
            <span>Place</span>
            <select
              value={table.after === null ? "end" : String(Math.min(table.after, bullets.length))}
              onChange={(e) => edit((t) => void (t.after = e.target.value === "end" ? null : Number(e.target.value)))}
            >
              <option value="0">above the bullets</option>
              {bullets.slice(0, -1).map((_, i) => (
                <option key={i} value={i + 1}>
                  after bullet {i + 1}
                </option>
              ))}
              <option value="end">below the bullets</option>
            </select>
          </label>
        )}
      </div>

      <div className="table-tools">
        <button type="button" className="tool" title="Bold (**text**)" disabled={!active} onMouseDown={(e) => e.preventDefault()} onClick={() => insert("**", "**")}>
          <b>B</b>
        </button>
        <button type="button" className="tool" title="Italic (*text*)" disabled={!active} onMouseDown={(e) => e.preventDefault()} onClick={() => insert("*", "*")}>
          <i>I</i>
        </button>
        <GlyphPicker onPick={(name) => insert(`:${name}:`)} />
        <UnitPicker disabled={!active} value={active ? cellValue(active) : ""} onSet={(text) => active && setCell(active, text)} />
        {table.preset === "lookup" && (
          <button
            type="button"
            className="btn small"
            title="Nine rows keyed -1/-1 to +1/+1, for two Attack Dice rolled one after the other"
            onClick={() => {
              // the rows change places, so the toolbar lets go of its cell
              release();
              edit((t) => {
                t.rows = diceRows(t.rows, t.columns.length);
                t.columns[0] = "Roll";
              });
            }}
          >
            Two Attack Dice
          </button>
        )}
        {table.preset === "aiSetup" && aiFill?.some((c) => c.trim()) && (
          <button type="button" className="btn small" title="Faction, Units, AI Deck and abilities from the AI Opponent step" onClick={() => edit((t) => void t.rows.push(aiFill))}>
            Add a row from the AI Opponent step
          </button>
        )}
        <span className="hint">{active ? "Enter breaks the line inside a cell." : "Click a cell, then add icons, unit counts or bold text."}</span>
      </div>

      <div className="table-grid-wrap">
        <table className="table-grid">
          <thead>
            <tr>
              {table.columns.map((label, c) => (
                <th key={c}>
                  <CellInput value={label} placeholder={c === 0 ? "first column" : `column ${c + 1}`} onFocus={focus({ row: -1, col: c })} onChange={(v) => setCell({ row: -1, col: c }, v)} dark />
                  {!fixed && (
                    <div className="row-tools col-tools">
                      <button type="button" className="tool" title="Move column left" disabled={c === 0} onClick={() => moveColumn(c, -1)}>
                        &#9664;
                      </button>
                      <button type="button" className="tool" title="Move column right" disabled={c === n - 1} onClick={() => moveColumn(c, 1)}>
                        &#9654;
                      </button>
                      <button type="button" className="tool danger" title="Remove column" disabled={n <= 2} onClick={() => removeColumn(c)}>
                        &#10005;
                      </button>
                    </div>
                  )}
                </th>
              ))}
              <th className="row-tools-head" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    {fixed && c === 0 ? (
                      <span className="fixed-key">{cell}</span>
                    ) : (
                      <CellInput value={cell} onFocus={focus({ row: r, col: c })} onChange={(v) => setCell({ row: r, col: c }, v)} dark={c === 0} />
                    )}
                  </td>
                ))}
                <td className="row-tools-cell">
                  {!fixed && (
                    <div className="row-tools">
                      <button type="button" className="tool" title="Move row up" disabled={r === 0} onClick={() => moveRow(r, -1)}>
                        &#9650;
                      </button>
                      <button type="button" className="tool" title="Move row down" disabled={r === table.rows.length - 1} onClick={() => moveRow(r, 1)}>
                        &#9660;
                      </button>
                      <button type="button" className="tool danger" title="Remove row" onClick={() => removeRow(r)}>
                        &#10005;
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!fixed && (
        <div className="list-actions">
          <button type="button" className="btn small" onClick={addRow}>
            + Add row
          </button>
          <button type="button" className="btn small" onClick={addColumn}>
            + Add column
          </button>
        </div>
      )}

      <div className="table-preview" style={{ "--cols": columnCount(doc) } as React.CSSProperties}>
        <TableView table={doc} />
      </div>
    </div>
  );
}

/** A cell: a textarea that grows with its lines, where Enter breaks the line. */
function CellInput({ value, onChange, onFocus, placeholder, dark }: { value: string; onChange: (v: string) => void; onFocus: (el: HTMLTextAreaElement) => void; placeholder?: string; dark?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={dark ? "dark" : ""}
      value={value}
      placeholder={placeholder}
      onFocus={(e) => onFocus(e.currentTarget)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Sets a cell to unit counts per tier, e.g. 3 bronze and 2 silver, starting from what the cell holds. */
function UnitPicker({ value, onSet, disabled }: { value: string; onSet: (text: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<UnitTier, number>>({ bronze: 0, silver: 0, golden: 0, azure: 0 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const toggle = () => {
    if (!open) setCounts(parseUnits(value) ?? { bronze: 0, silver: 0, golden: 0, azure: 0 });
    setOpen(!open);
  };
  return (
    <div className="glyph-picker unit-picker" ref={ref}>
      <button type="button" className="tool" title="Set the cell to unit counts" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={toggle}>
        <Glyph name="bronze" /> Units
      </button>
      {open && (
        <div className="glyph-pop unit-pop">
          <PopHead title="Unit counts" onClose={() => setOpen(false)} />
          {UNIT_TIERS.map((tier) => (
            <div key={tier} className="unit-row">
              <Glyph name={tier} size={22} />
              <button type="button" className="tool" onClick={() => setCounts({ ...counts, [tier]: Math.max(0, counts[tier] - 1) })}>
                &minus;
              </button>
              <span className="unit-count">{counts[tier]}</span>
              <button type="button" className="tool" onClick={() => setCounts({ ...counts, [tier]: Math.min(20, counts[tier] + 1) })}>
                +
              </button>
            </div>
          ))}
          <div className="unit-actions">
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                onSet(unitString(counts));
                setOpen(false);
              }}
            >
              Set cell
            </button>
            <span className="hint">{unitString(counts) ? "" : "All at 0 empties the cell."}</span>
          </div>
        </div>
      )}
    </div>
  );
}
