import { createContext, useContext } from "react";
import type { Inline } from "../../lib/markup.ts";
import { ordinalSuffix, plain } from "../../lib/markup.ts";
import { glyphUrl } from "../../data/catalog.ts";

export function Glyph({ name, size }: { name: string; size?: number }) {
  return (
    <img
      className="glyph"
      src={glyphUrl(name)}
      alt={name}
      title={name}
      style={size ? { height: size, width: "auto" } : undefined}
      draggable={false}
    />
  );
}

/** The number of each footnote on the page; outside a page a note shows as *. */
export const NoteNumbers = createContext<ReadonlyMap<Inline, number>>(new Map());

/** Renders markup runs as the book shows them. */
export function Runs({ runs }: { runs: Inline[] }) {
  const notes = useContext(NoteNumbers);
  return (
    <>
      {runs.map((run, i) => {
        switch (run.t) {
          case "glyph":
            return <Glyph key={i} name={run.name} />;
          case "ordinal":
            return (
              <span key={i}>
                {run.n}
                <sup>{ordinalSuffix(run.n)}</sup>
              </span>
            );
          case "math":
            return <i key={i}>{run.s}</i>;
          case "signed":
            return (
              <span key={i} className="mk-num">
                {run.s.replace("-", "\u2212")}
              </span>
            );
          case "br":
            return <br key={i} />;
          case "red":
            return (
              <span key={i} className="mk-red">
                <Runs runs={run.runs} />
              </span>
            );
          case "link":
            return (
              <a key={i} className="mk-link" href={run.href} target="_blank" rel="noreferrer">
                <Runs runs={run.runs} />
              </a>
            );
          case "note":
            return (
              <sup key={i} className="mk-note" title={plain(run.runs)}>
                {notes.get(run) ?? "*"}
              </sup>
            );
          case "text": {
            let node = <>{run.s}</>;
            if (run.i) node = <i>{node}</i>;
            if (run.b) node = <b>{node}</b>;
            return <span key={i}>{node}</span>;
          }
        }
      })}
    </>
  );
}
