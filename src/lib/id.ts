/** An id for a scenario part. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** A GUID in the shape the community map editor writes, e.g. "6E933B5C-272D-1075-3CD1-831970838EF5". */
export function guid(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16))
      .join("")
      .toUpperCase();
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
}
