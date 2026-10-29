/**
 * Stable demo ids: the same kind and code always give the same UUID-shaped id, so records can
 * point at each other across mock services (a route's locations, a schedule's fleet unit).
 */
function hash(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function idFor(kind: string, code: string): string {
  const key = `${kind}:${code}`;
  const hex =
    hash(key, 0x811c9dc5) + hash(key, 0x12345678) + hash(key, 0x9e3779b9) + hash(key, 0x7f4a7c15);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** A `{ id, code, name }` reference to another record. */
export const ref = (kind: string, code: string, name: string) => ({
  id: idFor(kind, code),
  code,
  name,
});

/** Today's date in GST, as `YYYY-MM-DD`; demo dates are relative to it so the screens stay current. */
export function gstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 4 * 3600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** A fixed past timestamp, for seeded `updatedAt` values. */
export const SEEDED_AT = '2026-10-20T06:00:00.000Z';
