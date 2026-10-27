// Zoom math for the full-screen page view on phones and tablets. A zoom of 1
// lays the page out 820 px wide, as the desktop side preview does at most,
// which puts the body text at about 15 px.

/** Page width in px at zoom 1. */
export const PAGE_PX = 820;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
/** The stops the zoom buttons step through. */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4] as const;

/** Screens up to this width have no side preview; "Show page" opens the full-screen view there. */
export const COMPACT_QUERY = "(max-width: 1200px)";

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The zoom at which the page fills `width` px of the view. */
export function fitZoom(width: number): number {
  return clampZoom(width / PAGE_PX);
}

/** The next zoom stop above (dir 1) or below (dir -1) `zoom`; a zoom between stops goes to the nearer stop in that direction. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const eps = 0.005;
  const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + eps) : ZOOM_STEPS.findLast((z) => z < zoom - eps);
  return next ?? (dir > 0 ? MAX_ZOOM : MIN_ZOOM);
}

/**
 * The point of the unzoomed page under `focus`, a position in the view
 * measured from its top-left corner, along one axis. `offset` is where the
 * page starts in the scrolled content.
 */
export function pointAt(scroll: number, focus: number, offset: number, zoom: number): number {
  return (scroll + focus - offset) / zoom;
}

/** The scroll offset that puts `point` of the unzoomed page under `focus` at `zoom`. */
export function scrollToPoint(point: number, focus: number, offset: number, zoom: number): number {
  return Math.max(0, point * zoom + offset - focus);
}

/** The page's side margin as a share of its width (5.93cqi in theme.css). */
export const TEXT_MARGIN = 0.0593;

/**
 * Where the view starts across: when the page is wider than the view, the
 * text's left edge sits `gap` px from the view's edge, so at zoom 1 the
 * first column fits a phone screen.
 */
export function openScroll(viewWidth: number, offset: number, zoom: number, gap = 10): number {
  if (PAGE_PX * zoom + 2 * offset <= viewWidth) return 0;
  return Math.max(0, offset + TEXT_MARGIN * PAGE_PX * zoom - gap);
}

/** Zoom as the label shows it. */
export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** What the topbar's page button does: toggle the side preview on desktop, open the full-screen view on smaller screens. */
export function pageButton(compact: boolean, wide: boolean, showPreview: boolean): { label: string; action: "toggle" | "open" } | null {
  if (compact) return { label: "Show page", action: "open" };
  if (wide) return null;
  return { label: showPreview ? "Hide page" : "Show page", action: "toggle" };
}
