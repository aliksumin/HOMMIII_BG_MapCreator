import type { Inline } from "../../lib/markup.ts";
import { ordinalSuffix } from "../../lib/markup.ts";
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

/** Renders markup runs as the book shows them. */
export function Runs({ runs }: { runs: Inline[] }) {
  return (
    <>
      {runs.map((run, i) => {
        if (run.t === "glyph") return <Glyph key={i} name={run.name} />;
        if (run.t === "ordinal")
          return (
            <span key={i}>
              {run.n}
              <sup>{ordinalSuffix(run.n)}</sup>
            </span>
          );
        if (run.t === "math") return <i key={i}>{run.s}</i>;
        if (run.t === "br") return <br key={i} />;
        let node = <>{run.s}</>;
        if (run.i) node = <i>{node}</i>;
        if (run.b) node = <b>{node}</b>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}