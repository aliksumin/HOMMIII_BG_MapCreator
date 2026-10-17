import { useState } from "react";
import { assetUrl } from "../data/catalog.ts";
import { CATEGORIES } from "../data/game.ts";
import { parseProject } from "../lib/bundle.ts";
import { decodeMap } from "../lib/mapfile.ts";
import { normalise } from "../lib/hex.ts";
import { copyScenario, newScenario } from "../model/defaults.ts";
import { deleteProject, listProjects, loadProject, useStore } from "../model/store.ts";

export function Welcome() {
  const start = useStore((s) => s.start);
  const open = useStore((s) => s.open);
  const [projects, setProjects] = useState(listProjects);
  const [error, setError] = useState("");

  // The template scenario (examples/template-scenario/) is loaded on demand, so it stays out of the first download.
  const openTemplate = async () => {
    setError("");
    try {
      const { default: text } = await import("../../examples/template-scenario/lanterns_over_the_mistfall_marches.scenario.json?raw");
      open(copyScenario(parseProject(text)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const openFile = async (file: File) => {
    setError("");
    const text = await file.text();
    try {
      if (file.name.endsWith(".map")) {
        const s = newScenario("clash");
        s.name = file.name.replace(/\.map$/, "").replace(/[-_]+/g, " ");
        s.maps[0].tiles = normalise(decodeMap(text));
        open(s);
        useStore.getState().setStep("map");
      } else {
        open(parseProject(text));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="welcome" style={{ backgroundImage: `url(${assetUrl("assets/layout/cover.webp")})` }}>
      <div className="welcome-inner">
        <header className="welcome-banner" style={{ backgroundImage: `url(${assetUrl("assets/layout/section_heading.webp")})` }}>
          <div className="welcome-kind">Heroes of Might &amp; Magic III &middot; The Board Game</div>
          <h1>Scenario Creator</h1>
        </header>
        <p className="welcome-lead">
          Write a Scenario step by step, lay out its map tile by tile, and export the files the fan-made Mission Book takes &mdash; the{" "}
          <code>.tex</code> page, the map image and <code>.map</code> file &mdash; plus a PDF to print.
        </p>

        <section className="welcome-card">
          <h2>Start a new Scenario</h2>
          <div className="category-cards">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.key}
                className="category-card"
                style={{ backgroundImage: `url(${assetUrl(c.art)})` }}
                onClick={() => start(c.key)}
              >
                <span className="category-name">{c.label}</span>
                <span className="category-blurb">{c.blurb}</span>
              </button>
            ))}
          </div>
          <p className="hint">
            New here? Open the <b>template scenario</b>, a finished Campaign Scenario that uses every feature of the editor.{" "}
            <button type="button" className="btn small" onClick={() => void openTemplate()}>
              Open the template
            </button>
          </p>
        </section>

        <section className="welcome-card">
          <h2>Continue</h2>
          {projects.length === 0 && <p className="hint">Scenarios you work on are kept in this browser and listed here.</p>}
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="project-open"
                  onClick={() => {
                    const s = loadProject(p.id);
                    if (s) open(s);
                  }}
                >
                  <b>{p.name}</b>
                  <span>
                    {CATEGORIES.find((c) => c.key === p.category)?.label} &middot; {new Date(p.updatedAt).toLocaleString()}
                  </span>
                </button>
                <button
                  type="button"
                  className="tool danger"
                  title="Delete from this browser"
                  onClick={() => {
                    if (!window.confirm(`Delete "${p.name}" from this browser? Download its project file first if you want to keep it.`)) return;
                    deleteProject(p.id);
                    setProjects(listProjects());
                  }}
                >
                  &#10005;
                </button>
              </li>
            ))}
          </ul>
          <label className="btn">
            Open a project (.scenario.json) or a map (.map)
            <input
              type="file"
              accept=".json,.map,.txt"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void openFile(f);
              }}
            />
          </label>
          {error && <p className="error">{error}</p>}
        </section>

        <footer className="welcome-credits">
          Map tiles from the <a href="https://github.com/zedero/homm3boardgame">community map editor</a> by zedero; icons, fonts and page art from the{" "}
          <a href="https://github.com/qwrtln/Homm3BG-mission-book">Fan-Made Mission Book</a> and the{" "}
          <a href="https://github.com/Heegu-sama/Homm3BG">Rewritten Rule Book</a>. Unofficial fan project; Heroes of Might &amp; Magic is a
          trademark of Ubisoft, the board game is by Archon Studio.
        </footer>
      </div>
    </div>
  );
}