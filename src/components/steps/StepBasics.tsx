import { useState } from "react";
import { assetUrl, TITLE_IMAGES, titleImageUrl } from "../../data/catalog.ts";
import { CATEGORIES, categoryInfo, FACTIONS } from "../../data/game.ts";
import { scenarioKind, scenarioTitle, slugify } from "../../lib/document.ts";
import { readImageFile } from "../../lib/images.ts";
import { useScenario } from "../../model/store.ts";
import type { Rating } from "../../model/types.ts";
import { Field, Panel, Segmented, Stepper, TextInput } from "../ui/Form.tsx";
import { Glyph } from "../ui/Runs.tsx";

export function StepBasics() {
  const [s, update] = useScenario();
  const [filter, setFilter] = useState("");
  const [uploadError, setUploadError] = useState("");
  const campaign = s.category === "campaigns";
  const images = TITLE_IMAGES.filter((name) => name.includes(filter.toLowerCase()));

  return (
    <>
      <Panel title="Scenario">
        <Field label="Scenario name" hint={<>File name: <code>{slugify(s.name)}.tex</code></>}>
          <TextInput value={s.name} placeholder="e.g. Dances with Dwarves" onChange={(v) => update((d) => void (d.name = v), "name")} />
        </Field>
        <div className="category-cards">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`category-card ${s.category === c.key ? "on" : ""}`}
              style={{ backgroundImage: `url(${assetUrl(c.art)})` }}
              onClick={() =>
                update((d) => {
                  d.category = c.key;
                  if (c.key === "campaigns") d.aiHero.enabled = true;
                  if (c.key === "solo") d.playerCounts = [1];
                })
              }
            >
              <span className="category-name">{c.label}</span>
              <span className="category-blurb">{c.blurb}</span>
            </button>
          ))}
        </div>
        {campaign && (
          <div className="grid3">
            <Field label="Campaign name">
              <TextInput value={s.campaignName} placeholder="e.g. The Queen's Gambit" onChange={(v) => update((d) => void (d.campaignName = v), "campaignName")} />
            </Field>
            <Field label="Scenario number" hint="The first one adds the campaign to the table of contents.">
              <Stepper value={s.campaignIndex} min={1} max={20} onChange={(v) => update((d) => void (d.campaignIndex = v ?? 1))} />
            </Field>
            <Field label="Faction">
              <select value={s.faction} onChange={(e) => update((d) => void (d.faction = e.target.value))}>
                <option value="">(none)</option>
                {FACTIONS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="grid2">
          <Field label="Heading line" hint={<>Leave empty for &ldquo;{campaign ? scenarioKind({ ...s, kindOverride: "" }) : categoryInfo(s.category).kind}&rdquo;. E.g. &ldquo;Clash/Alliance Scenario&rdquo;.</>}>
            <TextInput value={s.kindOverride} placeholder={scenarioKind({ ...s, kindOverride: "" })} onChange={(v) => update((d) => void (d.kindOverride = v), "kind")} />
          </Field>
          <Field label="Title lines" hint="Use 2 for a long title.">
            <Segmented
              options={[
                { value: 1, label: "1 line" },
                { value: 2, label: "2 lines" },
              ]}
              value={s.titleLines}
              onChange={(v) => update((d) => void (d.titleLines = v))}
            />
          </Field>
        </div>
        <Field label="Difficulty rating" hint="Optional badge in the heading corner.">
          <Segmented<Rating>
            options={[
              { value: "", label: "None" },
              ...(["bronze", "silver", "golden", "azure"] as const).map((r) => ({ value: r, label: <Glyph name={r} />, title: r })),
            ]}
            value={s.rating}
            onChange={(v) => update((d) => void (d.rating = v))}
          />
        </Field>
        <p className="heading-preview">
          Heading: <b>{scenarioKind(s)}</b> &mdash; <b>{scenarioTitle(s)}</b>
        </p>
      </Panel>

      <Panel title="Author">
        <div className="grid3">
          <Field label="Author">
            <TextInput value={s.author} placeholder="Your name or nickname" onChange={(v) => update((d) => void (d.author = v), "author")} />
          </Field>
          <Field label="Source label" hint="Optional, e.g. Archon Studio Discord">
            <TextInput value={s.sourceLabel} onChange={(v) => update((d) => void (d.sourceLabel = v), "sourceLabel")} />
          </Field>
          <Field label="Source link">
            <TextInput value={s.sourceUrl} placeholder="https://" onChange={(v) => update((d) => void (d.sourceUrl = v), "sourceUrl")} />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Title icon"
        aside={
          <label className="btn small">
            Upload PNG
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const dataUrl = await readImageFile(file, 512);
                  setUploadError("");
                  update((d) => void (d.titleImage = { kind: "upload", name: file.name, dataUrl }));
                } catch (err) {
                  setUploadError(err instanceof Error ? err.message : String(err));
                }
              }}
            />
          </label>
        }
      >
        <p className="hint">
          The round image left of the heading. Pick one the mission book already has, or upload your own (it is exported as{" "}
          <code>assets/images/{slugify(s.name)}.png</code>).
        </p>
        {uploadError && <p className="error">{uploadError}</p>}
        {s.titleImage?.kind === "upload" && s.titleImage.dataUrl && (
          <div className="upload-current">
            <img src={s.titleImage.dataUrl} alt="uploaded title icon" />
            <span>{s.titleImage.name}</span>
            <button type="button" className="btn small" onClick={() => update((d) => void (d.titleImage = null))}>
              Remove
            </button>
          </div>
        )}
        <input className="filter" type="search" placeholder="Filter icons..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="icon-grid">
          {images.map((name) => (
            <button
              type="button"
              key={name}
              title={name}
              className={s.titleImage?.kind === "library" && s.titleImage.name === name ? "on" : ""}
              onClick={() => update((d) => void (d.titleImage = { kind: "library", name }))}
            >
              <img src={titleImageUrl(name)} alt={name} loading="lazy" />
              <span>{name.replace(/[_-]/g, " ")}</span>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}