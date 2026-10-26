import { Fragment, useEffect, useMemo, useState } from "react";
import { assetUrl, titleImageUrl } from "../../data/catalog.ts";
import type { Block, ListItem, ScenarioDoc } from "../../lib/document.ts";
import type { Inline } from "../../lib/markup.ts";
import { fitTitle, PAGE_W_PT, TITLE_W_PT } from "../../lib/titlefit.ts";
import { MapView } from "../map/MapLayers.tsx";
import { Glyph, NoteNumbers, Runs } from "../ui/Runs.tsx";

const TITLE_FONT = '700 100px "Liberation Serif"';
let titleCanvas: CanvasRenderingContext2D | null = null;

/** Title width in points, measured with the same font the PDF embeds and, like jsPDF, without kerning. */
function measureTitle(text: string, size: number): number {
  titleCanvas ??= document.createElement("canvas").getContext("2d");
  if (!titleCanvas) return text.length * size * 0.7;
  titleCanvas.font = TITLE_FONT;
  titleCanvas.fontKerning = "none";
  return (titleCanvas.measureText(text).width / 100) * size;
}

/** The title's size and line breaks as the PDF draws them; re-measured once the font has loaded. */
function useFittedTitle(title: string, lines: 1 | 2): { size: number; lines: string[] } {
  const [fontReady, setFontReady] = useState(() => document.fonts.check(TITLE_FONT));
  useEffect(() => {
    if (fontReady) return;
    let live = true;
    document.fonts.load(TITLE_FONT).then(() => live && setFontReady(true));
    return () => {
      live = false;
    };
  }, [fontReady]);
  return useMemo(() => fitTitle(title, lines, TITLE_W_PT, measureTitle), [title, lines, fontReady]);
}

/** The footnotes in blocks, in reading order. */
function notesIn(blocks: Block[]): (Inline & { t: "note" })[] {
  const found: (Inline & { t: "note" })[] = [];
  const visit = (runs: Inline[]): void =>
    runs.forEach((r) => {
      if (r.t === "note") found.push(r);
      else if (r.t === "red" || r.t === "link") visit(r.runs);
    });
  for (const block of blocks) {
    if (block.k === "list") block.items.forEach((item) => visit(item.runs));
    else if (block.k !== "heading" && block.k !== "subheading") visit(block.runs);
  }
  return found;
}

/**
 * Nested lists as LaTeX builds them: items of one kind at one depth share a
 * list, and an item's deeper items nest inside it.
 */
function ListView({ items, depth = 0 }: { items: ListItem[]; depth?: number }) {
  const groups: { numbered: boolean; entries: { item: ListItem; children: ListItem[] }[] }[] = [];
  for (const item of items) {
    const group = groups.at(-1);
    const entry = group?.entries.at(-1);
    if (item.depth > depth && entry) entry.children.push(item);
    else if (group && group.numbered === item.numbered) group.entries.push({ item, children: [] });
    else groups.push({ numbered: item.numbered, entries: [{ item, children: [] }] });
  }
  return (
    <>
      {groups.map((group, g) => {
        const List = group.numbered ? "ol" : "ul";
        return (
          <List key={g}>
            {group.entries.map(({ item, children }, i) => (
              <li key={i}>
                <Runs runs={item.runs} />
                {children.length > 0 && <ListView items={children} depth={depth + 1} />}
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}

function Notes({ notes, numbers }: { notes: (Inline & { t: "note" })[]; numbers: ReadonlyMap<Inline, number> }) {
  if (!notes.length) return null;
  return (
    <ol className="bk-notes">
      {notes.map((note, i) => (
        <li key={i} value={numbers.get(note)}>
          <Runs runs={note.runs} />
        </li>
      ))}
    </ol>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.k) {
    case "heading":
      return <h3 className="bk-h">{block.text}</h3>;
    case "subheading":
      return <h4 className="bk-h4">{block.text}</h4>;
    case "para":
      return (
        <p>
          <Runs runs={block.runs} />
        </p>
      );
    case "label":
      return (
        <p className="bk-label">
          <b>
            <Runs runs={block.runs} />
          </b>
        </p>
      );
    case "field":
      return (
        <p className="bk-field">
          <b>{block.label}:</b>{" "}
          {block.href ? (
            <a href={block.href} target="_blank" rel="noreferrer">
              <Runs runs={block.runs} />
            </a>
          ) : (
            <Runs runs={block.runs} />
          )}
        </p>
      );
    case "list":
      return <ListView items={block.items} />;
  }
}

/** The scenario as a mission book page. */
export function BookPage({ doc, showMaps = true }: { doc: ScenarioDoc; showMaps?: boolean }) {
  const icon =
    doc.image?.kind === "upload" ? doc.image.dataUrl : doc.image?.kind === "library" ? titleImageUrl(doc.image.name) : undefined;
  const title = useFittedTitle(doc.title, doc.titleLines === 2 ? 2 : 1);
  // Footnotes number on through the scenario, as \footnote does.
  const bodyNotes = notesIn(doc.body);
  const storyNotes = notesIn(doc.story);
  const numbers = new Map<Inline, number>([...bodyNotes, ...storyNotes].map((note, i) => [note, i + 1]));
  return (
    <NoteNumbers.Provider value={numbers}>
    <div className="book">
      <article className="book-page" style={{ backgroundImage: `url(${assetUrl("assets/layout/tausta.webp")})` }}>
        <header className={`bk-header lines-${doc.titleLines}`} style={{ backgroundImage: `url(${assetUrl("assets/layout/section_heading.webp")})` }}>
          <div className="bk-icon">{icon ? <img src={icon} alt="" /> : <span className="bk-icon-empty">?</span>}</div>
          <div className="bk-titles">
            <div className="bk-kind">{doc.kind}</div>
            <div className="bk-title" style={{ fontSize: `${(title.size * 100) / PAGE_W_PT}cqi` }}>
              <span>
                {title.lines.map((line, i) => (
                  <Fragment key={i}>
                    {i > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </span>
            </div>
          </div>
          {doc.rating && (
            <div className="bk-rating">
              <Glyph name={doc.rating} />
            </div>
          )}
        </header>
        <div className="bk-columns">
          {doc.body.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </div>
        {showMaps &&
          doc.maps.map((m) => (
            <figure key={m.layout.id} className="bk-figure">
              <MapView tiles={m.layout.tiles} tokens={m.layout.tokens} />
              <figcaption>{m.caption}</figcaption>
            </figure>
          ))}
        <Notes notes={bodyNotes} numbers={numbers} />
      </article>
      {doc.story.length > 0 && (
        <article className="book-page" style={{ backgroundImage: `url(${assetUrl("assets/layout/tausta.webp")})` }}>
          <div className="bk-columns">
            {doc.story.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </div>
          <Notes notes={storyNotes} numbers={numbers} />
        </article>
      )}
    </div>
    </NoteNumbers.Provider>
  );
}