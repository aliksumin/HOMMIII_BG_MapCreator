import { assetUrl, titleImageUrl } from "../../data/catalog.ts";
import type { Block, ScenarioDoc } from "../../lib/document.ts";
import { MapView } from "../map/MapLayers.tsx";
import { Glyph, Runs } from "../ui/Runs.tsx";

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
  return (
    <div className="book">
      <article className="book-page" style={{ backgroundImage: `url(${assetUrl("assets/layout/tausta.webp")})` }}>
        <header className={`bk-header lines-${doc.titleLines}`} style={{ backgroundImage: `url(${assetUrl("assets/layout/section_heading.webp")})` }}>
          <div className="bk-icon">{icon ? <img src={icon} alt="" /> : <span className="bk-icon-empty">?</span>}</div>
          <div className="bk-titles">
            <div className="bk-kind">{doc.kind}</div>
            <div className="bk-title">{doc.title}</div>
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
              <MapView tiles={m.layout.tiles} />
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