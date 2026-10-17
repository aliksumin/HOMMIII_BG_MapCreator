import { Fragment, useEffect, useMemo, useState } from "react";
import { assetUrl, titleImageUrl } from "../../data/catalog.ts";
import type { Block, ScenarioDoc } from "../../lib/document.ts";
import { fitTitle, PAGE_W_PT, TITLE_W_PT } from "../../lib/titlefit.ts";
import { MapView } from "../map/MapLayers.tsx";
import { Glyph, Runs } from "../ui/Runs.tsx";

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

function BlockView({ block }: { block: Block }) {
  switch (block.k) {
    case "heading":
      return <h3 className="bk-h">{block.text}</h3>;
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
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>
              <Runs runs={item} />
            </li>
          ))}
        </ul>
      );
  }
}

/** The scenario as a mission book page. */
export function BookPage({ doc, showMaps = true }: { doc: ScenarioDoc; showMaps?: boolean }) {
  const icon =
    doc.image?.kind === "upload" ? doc.image.dataUrl : doc.image?.kind === "library" ? titleImageUrl(doc.image.name) : undefined;
  const title = useFittedTitle(doc.title, doc.titleLines === 2 ? 2 : 1);
  return (
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
      </article>
      {doc.story.length > 0 && (
        <article className="book-page" style={{ backgroundImage: `url(${assetUrl("assets/layout/tausta.webp")})` }}>
          <div className="bk-columns">
            {doc.story.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </div>
        </article>
      )}
    </div>
  );
}