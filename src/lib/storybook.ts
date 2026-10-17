// The story book of a solo Scenario: numbered paragraphs that Story
// Locations, Special Tiles and other paragraphs point to with "§12".
// Paragraph numbers are positions, so moving or removing a paragraph
// renumbers every reference in the scenario.

import type { Scenario } from "../model/types.ts";

/** A paragraph reference in markup: §12. "§?" marks one whose paragraph was removed. */
const REF = /§(\d+)/g;
export const BROKEN_REF = "§?";

/** Applies `fn` to every string in a value, deeply. */
function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
    return out as T;
  }
  return value;
}

/** Every string the contributor wrote that can hold a reference (the maps and title image cannot). */
function texts(s: Scenario): string[] {
  const found: string[] = [];
  mapStrings({ ...s, maps: [], titleImage: null }, (t) => (found.push(t), t));
  return found;
}

/** The paragraph numbers referenced anywhere, with how often. */
export function paragraphRefs(s: Scenario): Map<number, number> {
  const refs = new Map<number, number>();
  for (const text of texts(s)) {
    for (const m of text.matchAll(REF)) refs.set(Number(m[1]), (refs.get(Number(m[1])) ?? 0) + 1);
  }
  return refs;
}

/** How many references point to a removed paragraph. */
export function brokenRefs(s: Scenario): number {
  return texts(s).reduce((n, text) => n + text.split(BROKEN_REF).length - 1, 0);
}

/** Rewrites every §n in the scenario; `renumber` returns the new number, or null for a removed paragraph. */
function renumberRefs(s: Scenario, renumber: (n: number) => number | null): void {
  const { maps, titleImage, ...rest } = s;
  const next = mapStrings(rest, (t) =>
    t.replace(REF, (_whole, n: string) => {
      const to = renumber(Number(n));
      return to === null ? BROKEN_REF : `§${to}`;
    }),
  );
  Object.assign(s, next, { maps, titleImage });
}

/** Moves paragraph `from` to `to` (both 0-based); every reference keeps pointing at the same text. */
export function moveParagraph(s: Scenario, from: number, to: number): void {
  const list = s.storyBook.paragraphs;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return;
  const order = list.map((_, i) => i);
  const [old] = order.splice(from, 1);
  order.splice(to, 0, old);
  const [p] = list.splice(from, 1);
  list.splice(to, 0, p);
  // old number -> new number
  const renumbered = new Map(order.map((was, i) => [was + 1, i + 1]));
  renumberRefs(s, (n) => renumbered.get(n) ?? n);
}

/** Removes paragraph `index` (0-based); references to it become §?, later ones move down by one. */
export function removeParagraph(s: Scenario, index: number): void {
  const count = s.storyBook.paragraphs.length;
  if (index < 0 || index >= count) return;
  s.storyBook.paragraphs.splice(index, 1);
  const removed = index + 1;
  renumberRefs(s, (n) => (n === removed ? null : n > removed && n <= count ? n - 1 : n));
}
