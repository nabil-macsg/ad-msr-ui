import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/errors';
import type { DemoRow } from '../mock/data/modules';
import type { DemoKpi } from '../mock/services/modules';
import type { ListPage } from '../modules/administration/masters/master-resource';

const BASE = '/api/v1/demo/datasets';

/** The demo screens' own calls: they go through `fetch`, which the mock layer answers. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body: unknown = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw ApiError.from(response.status, body);
  return body as T;
}

export const datasetKey = (name: string) => ['demo', name] as const;

export function useDataset(name: string, query: Record<string, string | number | boolean>) {
  const search = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  return useQuery({
    queryKey: [...datasetKey(name), 'list', search.toString()],
    queryFn: () => call<ListPage<DemoRow>>(`${BASE}/${name}?${search.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function useSummary(name: string) {
  return useQuery({
    queryKey: [...datasetKey(name), 'summary'],
    queryFn: () => call<DemoKpi[]>(`${BASE}/${name}/summary`),
  });
}

export const changeBookingStatus = (id: string, status: string) =>
  call<DemoRow>(`${BASE}/bookings/${id}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
