import assert from "node:assert/strict";
import { test } from "node:test";
import { clampZoom, fitZoom, MAX_ZOOM, MIN_ZOOM, openScroll, pageButton, PAGE_PX, pointAt, scrollToPoint, stepZoom, TEXT_MARGIN, ZOOM_STEPS, zoomLabel } from "../src/lib/pageview.ts";

test("zoom 1 puts the body text at a readable size", () => {
  // The body text is 1.85cqi of the page width.
  assert.ok(PAGE_PX * 0.0185 >= 14);
});

test("zoom stays within its limits", () => {
  assert.equal(clampZoom(0.01), MIN_ZOOM);
  assert.equal(clampZoom(99), MAX_ZOOM);
  assert.equal(clampZoom(1.3), 1.3);
});

test("fit width fills the view", () => {
  assert.equal(fitZoom(PAGE_PX), 1);
  assert.equal(fitZoom(351) * PAGE_PX, 351);
  assert.equal(fitZoom(10), MIN_ZOOM);
});

test("zoom buttons step through the stops", () => {
  assert.equal(stepZoom(1, 1), 1.1);
  assert.equal(stepZoom(1, -1), 0.9);
  // A fitted zoom between stops goes to the next stop in that direction.
  assert.equal(stepZoom(0.43, 1), 0.5);
  assert.equal(stepZoom(0.43, -1), 0.33);
  // At the ends the zoom stays put.
  assert.equal(stepZoom(MAX_ZOOM, 1), MAX_ZOOM);
  assert.equal(stepZoom(MIN_ZOOM, -1), MIN_ZOOM);
  // Every step is a real change.
  for (const z of ZOOM_STEPS.slice(0, -1)) assert.ok(stepZoom(z, 1) > z);
});

test("zooming keeps the page point under the focus in place", () => {
  const offset = 12;
  // At zoom 0.5 the view is scrolled to 100; the focus is 150 px into the view.
  const point = pointAt(100, 150, offset, 0.5);
  assert.equal(point, (100 + 150 - offset) / 0.5);
  const scroll = scrollToPoint(point, 150, offset, 2);
  // The same page point is under the focus at zoom 2.
  assert.equal(pointAt(scroll, 150, offset, 2), point);
  // A pinch that moves its fingers pans the page with them.
  const moved = scrollToPoint(point, 190, offset, 2);
  assert.equal(moved, scroll - 40);
});

test("the scroll never goes below the start of the page", () => {
  assert.equal(scrollToPoint(10, 300, 12, 1), 0);
});

test("on a phone the view opens with the first column in sight", () => {
  const scroll = openScroll(375, 12, 1);
  // The text starts 10 px into the view...
  assert.equal(12 + TEXT_MARGIN * PAGE_PX - scroll, 10);
  // ...and a column, half the text width less the 23pt gutter, ends inside it.
  const column = (PAGE_PX * (1 - 2 * TEXT_MARGIN) - PAGE_PX * (23 / 595.28)) / 2;
  assert.ok(10 + column <= 375);
  // A page that fits the view is not scrolled.
  assert.equal(openScroll(1100, 12, 1), 0);
});

test("zoom label", () => {
  assert.equal(zoomLabel(1), "100%");
  assert.equal(zoomLabel(0.4268), "43%");
});

test("the page button is never a dead control", () => {
  // Desktop: toggles the side preview, and wide steps have none.
  assert.deepEqual(pageButton(false, false, true), { label: "Hide page", action: "toggle" });
  assert.deepEqual(pageButton(false, false, false), { label: "Show page", action: "toggle" });
  assert.equal(pageButton(false, true, true), null);
  // Phones and tablets: opens the full-screen view on every step, whatever the hidden toggle says.
  for (const wide of [false, true]) for (const shown of [false, true]) assert.deepEqual(pageButton(true, wide, shown), { label: "Show page", action: "open" });
});
