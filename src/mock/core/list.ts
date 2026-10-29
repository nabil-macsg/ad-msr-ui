/**
 * The shared list query (PROMPT §2.16) over an in-memory collection:
 * `?q=&page=&pageSize=&sort=field:dir&filter[name]=value&includeDeactivated=true`.
 */
export interface ListSpec<T> {
  /** The text `q` searches, per row. */
  readonly search?: (row: T) => readonly (string | null | undefined)[];
  /** Filters by name; one not listed compares the row's field (dotted path) to the value. */
  readonly filters?: Readonly<Record<string, (row: T, value: string) => boolean>>;
  /** Sort keys by field name; one not listed sorts by the row's field (dotted path). */
  readonly sorts?: Readonly<Record<string, (row: T) => string | number | null | undefined>>;
  readonly defaultSort?: string;
  /** Rows without `isActive` (or with this false) are always listed. */
  readonly hasActive?: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function pathValue(row: unknown, path: string): unknown {
  let value: unknown = row;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/** A field as filter text: strings, numbers and booleans as written. */
const scalar = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string')
    return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
  return JSON.stringify(a).localeCompare(JSON.stringify(b), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

/** Filters, sorts and pages rows; without paging params it returns every match (exports). */
export function listRows<T>(
  rows: readonly T[],
  query: URLSearchParams,
  spec: ListSpec<T> = {},
): Page<T> {
  let out = [...rows];
  if (spec.hasActive !== false && query.get('includeDeactivated') !== 'true') {
    out = out.filter((r) => (r as { isActive?: boolean }).isActive !== false);
  }
  const q = query.get('q')?.trim().toLowerCase();
  if (q) {
    const text =
      spec.search ?? ((r: T) => [pathValue(r, 'code'), pathValue(r, 'name')] as string[]);
    out = out.filter((r) => text(r).some((v) => v?.toLowerCase().includes(q)));
  }
  for (const [key, value] of query) {
    const name = /^filter\[(.+)\]$/.exec(key)?.[1];
    if (!name || value === '') continue;
    const custom = spec.filters?.[name];
    out = out.filter((r) => (custom ? custom(r, value) : scalar(pathValue(r, name)) === value));
  }
  const [field, dir] = (query.get('sort') ?? spec.defaultSort ?? '').split(':');
  if (field) {
    const key = spec.sorts?.[field] ?? ((r: T) => pathValue(r, field) as string);
    const sign = dir === 'desc' ? -1 : 1;
    out.sort((a, b) => sign * compare(key(a), key(b)));
  }
  const total = out.length;
  const pageSize = Number(query.get('pageSize')) || total || 20;
  const page = Number(query.get('page')) || 1;
  return { items: out.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}
