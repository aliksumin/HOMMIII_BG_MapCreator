// Fits the heading title into the marble banner the way the PDF draws it, so
// the page preview and the PDF pick the same size and the same line breaks.

/** Width of an A4 page in points. */
export const PAGE_W_PT = 595.28;
/** The title area: 75.3% of the 524.7pt banner frame, as in the official book. */
export const TITLE_W_PT = (PAGE_W_PT - 2 * 35.3) * 0.753;
/** The book's title size; two-line titles start smaller. */
const START_SIZE = { 1: 31, 2: 26 } as const;
const MIN_SIZE = 12;

/** Width in points of `text` set in the title font at `size` points. */
export type Measure = (text: string, size: number) => number;

/** Breaks `text` at spaces into lines no wider than `width`; a word wider than that gets a line of its own. */
export function wrapTitle(text: string, size: number, width: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The largest size, from 31pt (26pt for two lines) down in 1pt steps to 12pt,
 * at which the upper-cased title fits in `maxLines` lines of `width` points.
 */
export function fitTitle(title: string, maxLines: 1 | 2, width: number, measure: Measure): { size: number; lines: string[] } {
  const text = title.toUpperCase();
  let size = START_SIZE[maxLines];
  let lines = wrapTitle(text, size, width, measure);
  const fits = () => lines.length <= maxLines && lines.every((l) => measure(l, size) <= width);
  while (size > MIN_SIZE && !fits()) {
    size -= 1;
    lines = wrapTitle(text, size, width, measure);
  }
  return { size, lines };
}
