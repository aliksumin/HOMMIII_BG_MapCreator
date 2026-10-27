import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { create } from "zustand";
import type { ScenarioDoc } from "../../lib/document.ts";
import { clampZoom, COMPACT_QUERY, fitZoom, MAX_ZOOM, MIN_ZOOM, openScroll, PAGE_PX, pointAt, scrollToPoint, stepZoom, zoomLabel } from "../../lib/pageview.ts";
import { BookPage } from "./BookPage.tsx";

// Opening the view adds a history entry, so the phone's Back gesture closes it.
const HISTORY_MARK = "h3sc-page-view";

export const usePageView = create<{ open: boolean; show: () => void; hide: () => void }>((set, get) => ({
  open: false,
  show: () => {
    if (get().open) return;
    history.pushState({ [HISTORY_MARK]: true }, "");
    set({ open: true });
  },
  hide: () => {
    if (!get().open) return;
    if (history.state?.[HISTORY_MARK]) history.back();
    else set({ open: false });
  },
}));

window.addEventListener("popstate", () => usePageView.setState({ open: false }));

/** True on screens without the side preview. */
export function useCompact(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(COMPACT_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(COMPACT_QUERY).matches,
  );
}

/** The live page over the whole screen, for phones and tablets. */
export function PageViewer({ doc }: { doc: ScenarioDoc }) {
  const open = usePageView((s) => s.open);
  return open ? <PageView doc={doc} /> : null;
}

interface Pending {
  x: number;
  y: number;
  fx: number;
  fy: number;
}

function PageView({ doc }: { doc: ScenarioDoc }) {
  const hide = usePageView((s) => s.hide);
  const scroller = useRef<HTMLDivElement>(null);
  const pageBox = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(zoom);
  const pending = useRef<Pending | null>(null);
  // The page only re-renders when the scenario changes, not on every zoom step.
  const page = useMemo(() => <BookPage doc={doc} />, [doc]);

  /** Zooms so that the page point under the view position (fx, fy) ends up under (tx, ty). */
  const zoomAround = (next: number, fx: number, fy: number, tx = fx, ty = fy) => {
    const el = scroller.current;
    const box = pageBox.current;
    if (!el || !box) return;
    const z = zoomRef.current;
    next = clampZoom(next);
    pending.current = { x: pointAt(el.scrollLeft, fx, box.offsetLeft, z), y: pointAt(el.scrollTop, fy, box.offsetTop, z), fx: tx, fy: ty };
    if (next === z) applyPending();
    else {
      zoomRef.current = next;
      setZoomState(next);
    }
  };

  const applyPending = () => {
    const el = scroller.current;
    const box = pageBox.current;
    const p = pending.current;
    if (!el || !box || !p) return;
    pending.current = null;
    el.scrollLeft = scrollToPoint(p.x, p.fx, box.offsetLeft, zoomRef.current);
    el.scrollTop = scrollToPoint(p.y, p.fy, box.offsetTop, zoomRef.current);
  };

  useLayoutEffect(applyPending, [zoom]);

  /** Zoom buttons keep the middle of the view in place. */
  const zoomCentre = (next: number) => {
    const el = scroller.current;
    if (el) zoomAround(next, el.clientWidth / 2, el.clientHeight / 2);
  };

  const fitWidth = () => {
    const el = scroller.current;
    const box = pageBox.current;
    if (!el || !box) return;
    // The canvas padding is the same on all sides; the page's left edge goes to the view's.
    const pad = box.offsetTop;
    const next = fitZoom(el.clientWidth - 2 * pad);
    pending.current = { x: 0, y: pointAt(el.scrollTop, 0, pad, zoomRef.current), fx: pad, fy: 0 };
    zoomRef.current = next;
    setZoomState(next);
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    const box = pageBox.current;
    if (el && box) el.scrollLeft = openScroll(el.clientWidth, box.offsetLeft, zoomRef.current);
  }, []);

  // Focus moves into the view and back to where it was when the view closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  // The view is modal: keys stop here, so the editor's shortcuts (Delete on
  // the map, undo) do not act behind it. Browser defaults such as scrolling
  // with the arrow keys still work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") hide();
      else if (e.ctrlKey || e.metaKey || e.altKey) return;
      else if (e.key === "+" || e.key === "=") zoomCentre(stepZoom(zoomRef.current, 1));
      else if (e.key === "-") zoomCentre(stepZoom(zoomRef.current, -1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // Two-finger pinch zooms the page, not the whole app; ctrl+wheel (a trackpad pinch) does the same.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let pinch: { dist: number; zoom: number; x: number; y: number } | null = null;
    const local = (t: TouchList) => {
      const r = el.getBoundingClientRect();
      const [a, b] = [t[0], t[1]];
      return { x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top, dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const m = local(e.touches);
      const box = pageBox.current;
      if (!box) return;
      // The page point under the fingers when the pinch begins follows them.
      const z = zoomRef.current;
      pinch = { dist: Math.max(1, m.dist), zoom: z, x: pointAt(el.scrollLeft, m.x, box.offsetLeft, z), y: pointAt(el.scrollTop, m.y, box.offsetTop, z) };
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const m = local(e.touches);
      pending.current = { x: pinch.x, y: pinch.y, fx: m.x, fy: m.y };
      const next = clampZoom((pinch.zoom * m.dist) / pinch.dist);
      if (next === zoomRef.current) applyPending();
      else {
        zoomRef.current = next;
        setZoomState(next);
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAround(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    };
    // Safari's own pinch gesture would zoom the app around the view.
    const onGesture = (e: Event) => e.preventDefault();
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGesture);
    el.addEventListener("gesturechange", onGesture);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGesture);
      el.removeEventListener("gesturechange", onGesture);
    };
  }, []);

  return (
    <div className="page-view" role="dialog" aria-modal="true" aria-label="Mission book page">
      <header className="page-view-bar">
        <span className="page-view-title">Mission book page</span>
        <div className="page-view-tools">
          <button type="button" className="btn small" onClick={fitWidth}>
            Fit width
          </button>
          <button type="button" className="tool" onClick={() => zoomCentre(stepZoom(zoom, -1))} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out (-)">
            &minus;
          </button>
          <button type="button" className="page-view-zoom" onClick={() => zoomCentre(1)} title="Reading size (100%)">
            {zoomLabel(zoom)}
          </button>
          <button type="button" className="tool" onClick={() => zoomCentre(stepZoom(zoom, 1))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in (+)">
            +
          </button>
        </div>
        <button ref={closeButton} type="button" className="btn small page-view-close" onClick={hide}>
          Close &#10005;
        </button>
      </header>
      <div ref={scroller} className="page-view-scroll">
        <div className="page-view-canvas">
          <div ref={pageBox} className="page-view-page" style={{ width: PAGE_PX * zoom }}>
            {page}
          </div>
        </div>
      </div>
    </div>
  );
}
