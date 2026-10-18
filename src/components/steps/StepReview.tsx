import { useMemo, useState } from "react";
import { categoryInfo } from "../../data/game.ts";
import { buildBundle, PROJECT_EXTENSION, projectJson, submitGuide, texPath } from "../../lib/bundle.ts";
import { buildDocument, mapFiles, slugify } from "../../lib/document.ts";
import { download } from "../../lib/images.ts";
import { registrationLines, scenarioToLatex } from "../../lib/latex.ts";
import { lintScenario } from "../../lib/lint.ts";
import { encodeMap } from "../../lib/mapfile.ts";
import { renderMapPng } from "../../lib/mapdraw.ts";
import { scenarioToPdf } from "../../lib/pdf.ts";
import { STEPS, useScenario, useStore } from "../../model/store.ts";
import { BookPage } from "../preview/BookPage.tsx";
import { Panel } from "../ui/Form.tsx";

/** Lets long paths and file names wrap after "/" and "_" instead of spilling out of their button. */
function breakable(text: string) {
  return text.split(/(?<=[/_])/).flatMap((part, i) => (i ? [<wbr key={i} />, part] : [part]));
}

export function StepReview() {
  const [s] = useScenario();
  const setStep = useStore((st) => st.setStep);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"page" | "tex" | "guide">("page");
  const findings = useMemo(() => lintScenario(s), [s]);
  const tex = useMemo(() => scenarioToLatex(s), [s]);
  const doc = useMemo(() => buildDocument(s), [s]);
  const slug = slugify(s.name);
  const errors = findings.filter((f) => f.level === "error");

  const run = async (label: string, job: (progress: (what: string) => void) => Promise<void>) => {
    setError("");
    setBusy(label);
    try {
      await job((what) => setBusy(what));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <Panel title="Checklist" aside={<span className={`badge ${errors.length ? "bad" : "good"}`}>{errors.length ? `${errors.length} to fix` : "Ready"}</span>}>
        {findings.length === 0 && <p className="good-note">Everything the mission book checks looks right.</p>}
        <ul className="findings">
          {findings.map((f, i) => (
            <li key={i} className={f.level}>
              <span className="finding-level">{f.level === "error" ? "Fix" : "Check"}</span>
              <span className="finding-text">{f.message}</span>
              {f.step !== "review" && (
                <button type="button" className="link" onClick={() => setStep(f.step as (typeof STEPS)[number]["id"])}>
                  Go to {STEPS.find((st) => st.id === f.step)?.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Export">
        <div className="export-grid">
          <button
            type="button"
            className="btn primary big"
            disabled={!!busy}
            onClick={() => run("Building the bundle...", async (p) => download(`${slug}.zip`, await buildBundle(s, p), "application/zip"))}
          >
            <span>Mission Book bundle (.zip)</span>
            <small>.tex, map PNGs, .map files, PDF, project file and submit guide</small>
          </button>
          <button
            type="button"
            className="btn big"
            disabled={!!busy}
            onClick={() => run("Building the PDF...", async (p) => download(`${slug}.pdf`, await scenarioToPdf(s, p)))}
          >
            <span>PDF</span>
            <small>Book-style pages to print or share</small>
          </button>
          <button type="button" className="btn big" onClick={() => download(`${slug}.tex`, tex, "text/x-tex")}>
            <span>LaTeX (.tex)</span>
            <small>{breakable(texPath(s))}</small>
          </button>
          <button type="button" className="btn big" onClick={() => download(`${slug}${PROJECT_EXTENSION}`, projectJson(s), "application/json")}>
            <span>Project file</span>
            <small>Reopen and keep editing later</small>
          </button>
          {mapFiles(s).map((m) => (
            <div key={m.file} className="export-map">
              <b>{m.layout.name}</b>
              <button type="button" className="btn small" onClick={() => download(`${m.file}.map`, `${encodeMap(m.layout.tiles)}\n`, "text/plain")}>
                {breakable(`${m.file}.map`)}
              </button>
              <button
                type="button"
                className="btn small"
                disabled={!!busy}
                onClick={() => run("Rendering...", async () => download(`${m.file}.png`, await renderMapPng(m.layout.tiles, 2, m.layout.tokens)))}
              >
                {breakable(`${m.file}.png`)}
              </button>
            </div>
          ))}
        </div>
        {busy && <p className="busy">{busy}</p>}
        {error && <p className="error">{error}</p>}
        {errors.length > 0 && <p className="hint">You can export at any time; fix the items above before you submit to the mission book.</p>}
      </Panel>

      <Panel
        title="Preview"
        aside={
          <div className="segmented">
            <button type="button" className={tab === "page" ? "on" : ""} onClick={() => setTab("page")}>
              Page
            </button>
            <button type="button" className={tab === "tex" ? "on" : ""} onClick={() => setTab("tex")}>
              LaTeX
            </button>
            <button type="button" className={tab === "guide" ? "on" : ""} onClick={() => setTab("guide")}>
              How to submit
            </button>
          </div>
        }
      >
        {tab === "page" && <BookPage doc={doc} />}
        {tab === "tex" && (
          <>
            <div className="code-actions">
              <button type="button" className="btn small" onClick={() => navigator.clipboard?.writeText(tex)}>
                Copy
              </button>
              <span className="hint">
                Register it in <code>draft-scenarios/{s.category}/main.tex</code>: <code>{registrationLines(s, categoryInfo(s.category).pathMacro).trim().replace(/\n+/g, " ")}</code>
              </span>
            </div>
            <pre className="code">{tex}</pre>
          </>
        )}
        {tab === "guide" && <pre className="code guide">{submitGuide(s)}</pre>}
      </Panel>
    </>
  );
}