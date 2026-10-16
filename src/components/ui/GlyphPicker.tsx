import { useEffect, useRef, useState } from "react";
import { GLYPHS } from "../../data/catalog.ts";
import { COMMON_GLYPHS } from "../../data/game.ts";
import { Glyph } from "./Runs.tsx";

/** A button that opens a grid of game icons; picking one calls onPick with its name. */
export function GlyphPicker({ onPick }: { onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const names = all ? GLYPHS : COMMON_GLYPHS.filter((g) => GLYPHS.includes(g));
  return (
    <div className="glyph-picker" ref={ref}>
      <button type="button" className="tool" title="Insert a game icon" onClick={() => setOpen(!open)}>
        <Glyph name="gold" /> Icon
      </button>
      {open && (
        <div className="glyph-pop">
          <div className="glyph-grid">
            {names.map((name) => (
              <button
                type="button"
                key={name}
                title={name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(name);
                  setOpen(false);
                }}
              >
                <Glyph name={name} size={22} />
              </button>
            ))}
          </div>
          <button type="button" className="link" onClick={() => setAll(!all)}>
            {all ? "Show common icons" : `Show all ${GLYPHS.length} icons`}
          </button>
        </div>
      )}
    </div>
  );
}