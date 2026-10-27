import { useEffect, useMemo, useRef, useState } from "react";
import { MapEditor } from "./components/map/MapEditor.tsx";
import { BookPage } from "./components/preview/BookPage.tsx";
import { StepBasics } from "./components/steps/StepBasics.tsx";
import { StepConditions } from "./components/steps/StepConditions.tsx";
import { StepEvents } from "./components/steps/StepEvents.tsx";
import { StepMapSetup } from "./components/steps/StepMapSetup.tsx";
import { StepOpponents } from "./components/steps/StepOpponents.tsx";
import { StepReview } from "./components/steps/StepReview.tsx";
import { StepRules } from "./components/steps/StepRules.tsx";
import { StepSetup } from "./components/steps/StepSetup.tsx";
import { StepStory } from "./components/steps/StepStory.tsx";
import { Welcome } from "./components/Welcome.tsx";
import { assetUrl } from "./data/catalog.ts";
import { PROJECT_EXTENSION, projectJson } from "./lib/bundle.ts";
import { buildDocument, slugify } from "./lib/document.ts";
import { download } from "./lib/images.ts";
import { lintScenario } from "./lib/lint.ts";
import { STEPS, type StepId, useStore } from "./model/store.ts";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const VIEWS: Record<StepId, () => React.JSX.Element> = {
  basics: StepBasics,
  story: StepStory,
  setup: StepSetup,
  map: MapEditor,
  mapsetup: StepMapSetup,
  opponents: StepOpponents,
  conditions: StepConditions,
  events: StepEvents,
  rules: StepRules,
  review: StepReview,
};

function useUndoKeys() {
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
}

/**
 * Keeps the current step in view where the step bar is a row that scrolls
 * sideways (narrow screens). Only the bar scrolls, never the page.
 */
function useActiveStepInView(step: StepId) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = ref.current;
    const on = bar?.querySelector<HTMLElement>(".step.on");
    if (!bar || !on || bar.scrollWidth <= bar.clientWidth) return;
    const left = on.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft;
    bar.scrollTo({ left: left - (bar.clientWidth - on.offsetWidth) / 2, behavior: "smooth" });
  }, [step]);
  return ref;
}

function Editor() {
  const scenario = useStore((s) => s.scenario);
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const home = useStore((s) => s.home);
  const saveFailed = useStore((s) => s.saveFailed);
  const [showPreview, setShowPreview] = useState(true);
  const doc = useMemo(() => buildDocument(scenario), [scenario]);
  const findings = useMemo(() => lintScenario(scenario), [scenario]);
  useUndoKeys();
  const stepBar = useActiveStepInView(step);

  const index = STEPS.findIndex((s) => s.id === step);
  const View = VIEWS[step];
  const wide = step === "map" || step === "review";
  const problems = (id: StepId) => findings.filter((f) => f.step === id && f.level === "error").length;

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={home} title="Back to the start screen">
          <img src={assetUrl("assets/glyphs/map-yellow.svg")} alt="" />
          <span>
            Scenario Creator
            <small>Heroes III Board Game</small>
          </span>
        </button>
        <div className="topbar-title">
          <span className="kind">{doc.kind}</span>
          <span className="title">{doc.title}</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="tool" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            &#x21B6;
          </button>
          <button type="button" className="tool" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            &#x21B7;
          </button>
          <span className={`save-state ${saveFailed ? "bad" : ""}`} title="Autosaved in this browser">
            {saveFailed ? "Not saved (storage full)" : "Saved in browser"}
          </span>
          <button
            type="button"
            className="btn small"
            onClick={() => download(`${slugify(scenario.name)}${PROJECT_EXTENSION}`, projectJson(scenario), "application/json")}
          >
            Save file
          </button>
          {!wide && (
            <button type="button" className="btn small preview-toggle" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? "Hide page" : "Show page"}
            </button>
          )}
        </div>
      </header>

      <div className={`workspace ${wide ? "wide" : ""} ${showPreview && !wide ? "with-preview" : ""}`}>
        <nav className="steps" aria-label="Steps" ref={stepBar}>
          {STEPS.map((s, i) => (
            <button type="button" key={s.id} className={`step ${s.id === step ? "on" : ""} ${i < index ? "past" : ""}`} onClick={() => setStep(s.id)}>
              <span className="step-num">{ROMAN[i]}</span>
              <span className="step-text">
                <span className="step-label">{s.label}</span>
                <span className="step-hint">{s.hint}</span>
              </span>
              {problems(s.id) > 0 && <span className="step-flag" title="Needs attention">!</span>}
            </button>
          ))}
        </nav>

        <main className="content">
          <div className="step-head">
            <span className="step-head-num">{ROMAN[index]}</span>
            <div>
              <h1>{STEPS[index].label}</h1>
              <p>{STEPS[index].hint}</p>
            </div>
          </div>
          <View />
          <div className="step-nav">
            <button type="button" className="btn" disabled={index === 0} onClick={() => setStep(STEPS[index - 1].id)}>
              &larr; {index > 0 ? STEPS[index - 1].label : ""}
            </button>
            {index < STEPS.length - 1 && (
              <button type="button" className="btn primary" onClick={() => setStep(STEPS[index + 1].id)}>
                {STEPS[index + 1].label} &rarr;
              </button>
            )}
          </div>
        </main>

        {showPreview && !wide && (
          <aside className="preview">
            <div className="preview-label">Mission book page &middot; live</div>
            <BookPage doc={doc} />
          </aside>
        )}
      </div>
    </div>
  );
}

export function App() {
  const started = useStore((s) => s.started);
  return started ? <Editor /> : <Welcome />;
}