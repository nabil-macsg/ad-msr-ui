import { useCallback, useState } from 'react';
import { type ListParams, toApiQuery } from '../../shared/lists/list-params';

/** List state kept in the component (for a second table on a page, or one inside a dialog). */
export function useLocalList(defaults: Partial<ListParams> = {}) {
  const [params, setParams] = useState<ListParams>({
    q: '',
    page: 1,
    pageSize: 20,
    sort: null,
    filters: {},
    includeDeactivated: false,
    ...defaults,
  });
  const update = useCallback(
    (patch: Partial<ListParams>) =>
      setParams((p) => ({ ...p, ...patch, page: patch.page ?? 1 })),
    [],
  );
  return { params, update, apiQuery: toApiQuery(params) };
}

/** Sets or clears one filter of a list. */
export function withFilter(
  filters: Readonly<Record<string, string>>,
  name: string,
  value: string | undefined,
): Record<string, string> {
  const rest = Object.fromEntries(Object.entries(filters).filter(([k]) => k !== name));
  return value ? { ...rest, [name]: value } : rest;
}
