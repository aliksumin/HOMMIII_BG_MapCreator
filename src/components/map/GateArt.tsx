import { assetUrl, MAP_LOCATIONS } from "../../data/catalog.ts";
import { CELL_W } from "../../lib/hex.ts";
import { TOKEN_SIZE } from "../../lib/mapdraw.ts";
import { GATE_NAME, GATE_SURFACE, GATE_UNDERGROUND } from "../../lib/tokens.ts";

/** The whole Subterranean Gate as it lies unturned: the underground half on the left, the surface half on the right. */
export function GateArt({ className = "gate-art" }: { className?: string }) {
  const half = TOKEN_SIZE / 2;
  return (
    <svg className={className} viewBox={`${-half} ${-half} ${CELL_W + TOKEN_SIZE} ${TOKEN_SIZE}`} role="img" aria-label={GATE_NAME}>
      <title>{GATE_NAME}</title>
      <image href={assetUrl(MAP_LOCATIONS[GATE_UNDERGROUND].img)} x={-half} y={-half} width={TOKEN_SIZE} height={TOKEN_SIZE} />
      <image href={assetUrl(MAP_LOCATIONS[GATE_SURFACE].img)} x={CELL_W - half} y={-half} width={TOKEN_SIZE} height={TOKEN_SIZE} />
    </svg>
  );
}
