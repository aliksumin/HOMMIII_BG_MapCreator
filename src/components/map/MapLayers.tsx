import { boardBounds, cellCenter, TILE_H, TILE_W } from "../../lib/hex.ts";
import { borderColor, cubeFaces, flowerPath, hexPoints, shade, tileImageUrl, tileOverlays } from "../../lib/mapdraw.ts";
import type { MapTile } from "../../model/types.ts";

/** Tile art, faction borders and Field overlays, in board coordinates. */
export function MapLayers({ tiles, fadedId, clipId }: { tiles: MapTile[]; fadedId?: string; clipId: string }) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <circle cx="0" cy="0" r="26" />
        </clipPath>
      </defs>
      {tiles.map((t) => {
        const c = cellCenter(t.row, t.col);
        const url = tileImageUrl(t.tileId);
        const border = borderColor(t);
        return (
          <g key={t.id} data-tile={t.id} className="tile" opacity={t.suggestedPlacement ? 0.5 : t.id === fadedId ? 0.75 : 1}>
            {url ? (
              <image
                href={url}
                x={c.x - TILE_W / 2}
                y={c.y - TILE_H / 2}
                width={TILE_W}
                height={TILE_H}
                transform={`rotate(${t.rotation * 60} ${c.x} ${c.y})`}
              />
            ) : (
              <path d={flowerPath(c.x, c.y)} className="tile-missing" />
            )}
            {border && <path d={flowerPath(c.x, c.y)} stroke={border} strokeWidth={8} fill="none" strokeLinecap="round" />}
          </g>
        );
      })}
      <g className="overlays">
        {tiles.flatMap((t) =>
          tileOverlays(t).map((o, i) => {
            const key = `${t.id}-${i}`;
            if (o.kind === "token")
              return (
                <image key={key} href={o.url} x={o.x - 43} y={o.y - 50} width={86} height={100} transform={`rotate(${o.rotation} ${o.x} ${o.y})`}>
                  <title>{o.label}</title>
                </image>
              );
            if (o.kind === "blocked")
              return (
                <g key={key} className="blocked">
                  <polygon points={hexPoints(o.x, o.y, 0.92)} />
                  <path d={`M${o.x - 18} ${o.y - 18}L${o.x + 18} ${o.y + 18}M${o.x + 18} ${o.y - 18}L${o.x - 18} ${o.y + 18}`} />
                </g>
              );
            if (o.kind === "cube") {
              const fills = [shade(o.color, 0.18), o.color, shade(o.color, -0.18)];
              return (
                <g key={key} className="cube">
                  {cubeFaces(o.x, o.y).map((f, k) => (
                    <polygon key={k} points={f} fill={fills[k]} />
                  ))}
                </g>
              );
            }
            return (
              <g key={key} transform={`translate(${o.x} ${o.y})`} className="hero">
                <image href={o.url} x={-26} y={-26} width={52} height={52} clipPath={`url(#${clipId})`}>
                  <title>{o.label}</title>
                </image>
                <circle r={26} />
              </g>
            );
          }),
        )}
      </g>
    </>
  );
}

/** A static picture of a layout, cropped to its tiles. */
export function MapView({ tiles, className }: { tiles: MapTile[]; className?: string }) {
  const box = boardBounds(tiles);
  if (!box) return null;
  const pad = 6;
  return (
    <svg
      className={className}
      viewBox={`${box.minX - pad} ${box.minY - pad} ${box.maxX - box.minX + pad * 2} ${box.maxY - box.minY + pad * 2}`}
      role="img"
      aria-label="Scenario map"
    >
      <title>Scenario map</title>
      <MapLayers tiles={tiles} clipId={`clip-${tiles[0]?.id ?? "x"}`} />
    </svg>
  );
}