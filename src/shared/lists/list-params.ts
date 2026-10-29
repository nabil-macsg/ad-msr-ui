import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

export type SortDir = 'asc' | 'desc';

/** A list's state, kept in the address so it survives reloads and can be shared. */
export interface ListParams {
  readonly q: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: { readonly field: string; readonly dir: SortDir } | null;
  readonly filters: Readonly<Record<string, string>>;
  readonly includeDeactivated: boolean;
}

export const PAGE_SIZES = [20, 50, 100] as const;
const FILTER = /^filter\[([A-Za-z0-9_.-]+)\]$/;

export function parseListParams(
  search: URLSearchParams,
  defaults: Partial<ListParams> = {},
): ListParams {
  const positive = (value: string | null, fallback: number) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  const [field, dir] = (search.get('sort') ?? '').split(':');
  const filters: Record<string, string> = { ...defaults.filters };
  for (const [key, value] of search) {
    const name = FILTER.exec(key)?.[1];
    if (name && value) filters[name] = value;
  }
  return {
    q: search.get('q') ?? defaults.q ?? '',
    page: positive(search.get('page'), 1),
    pageSize: Math.min(positive(search.get('pageSize'), defaults.pageSize ?? PAGE_SIZES[0]), 100),
    sort: field && (dir === 'asc' || dir === 'desc') ? { field, dir } : (defaults.sort ?? null),
    filters,
    includeDeactivated: search.get('includeDeactivated') === 'true',
  };
}

/** The API's list query (PROMPT §2.16): `?q=&page=&pageSize=&sort=field:asc&filter[...]=`. */
export function toApiQuery(params: ListParams): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {
    page: params.page,
    pageSize: params.pageSize,
  };
  if (params.q) query.q = params.q;
  if (params.sort) query.sort = `${params.sort.field}:${params.sort.dir}`;
  for (const [name, value] of Object.entries(params.filters)) query[`filter[${name}]`] = value;
  if (params.includeDeactivated) query.includeDeactivated = true;
  return query;
}

/** The same list for `GET …/export`: every page, so no paging (PROMPT §2.16). */
export function toExportQuery(params: ListParams): Record<string, string | number | boolean> {
  const query = toApiQuery(params);
  delete query.page;
  delete query.pageSize;
  return query;
}

/** List state in the URL. Any change other than the page goes back to page 1. */
export function useListParams(defaults: Partial<ListParams> = {}) {
  const [search, setSearch] = useSearchParams();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are a literal per page
  const params = useMemo(() => parseListParams(search, defaults), [search]);
  const update = useCallback(
    (patch: Partial<ListParams>) => {
      const next = { ...params, ...patch, page: patch.page ?? 1 };
      const query = toApiQuery(next);
      setSearch(Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])), {
        replace: true,
      });
    },
    [params, setSearch],
  );
  return { params, update, apiQuery: toApiQuery(params) };
}

/** The same list state held by the component: for a second list on a page (e.g. in a tab). */
export function useLocalListParams(defaults: Partial<ListParams> = {}) {
  const [params, setParams] = useState<ListParams>(() =>
    parseListParams(new URLSearchParams(), defaults),
  );
  const update = useCallback(
    (patch: Partial<ListParams>) =>
      setParams((current) => ({ ...current, ...patch, page: patch.page ?? 1 })),
    [],
  );
  return { params, update, apiQuery: toApiQuery(params) };
}
