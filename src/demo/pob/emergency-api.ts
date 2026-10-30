import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { RosterRow } from '../../mock/data/demo-pob-emergency';
import type { ListPage } from '../../modules/administration/masters/master-resource';
import { type ListParams, toApiQuery } from '../../shared/lists/list-params';
import type { Tone } from '../../shared/ui/tone';
import { pobSend, usePobQuery } from './pob-api';

export type { RosterRow };

export interface SiteOption {
  code: string;
  name: string;
}

export interface MusterPoint {
  code: string;
  name: string;
  capacity: number | null;
}

export interface MusterSummary {
  id: string;
  location: string;
  declaredAt: string;
  status: 'Active' | 'Stood down';
  frozen: number;
  accounted: number;
  unaccounted: number;
  points: (MusterPoint & {
    assigned: number;
    accounted: number;
    headcount: { count: number; recordedAt: string } | null;
  })[];
}

export interface SiteStatus {
  code: string;
  name: string;
  onSite: number;
  aboardVessels: number;
  pob: number;
  lifeboats: { capacity: number; boats: number; heldBack: number; enough: boolean } | null;
  musterPoints: MusterPoint[];
  muster: MusterSummary | null;
}

export const useSites = () => usePobQuery<SiteOption[]>('/emergency/sites');
export const useSite = (code: string) =>
  usePobQuery<SiteStatus>(`/emergency/sites/${encodeURIComponent(code)}`, code !== '');

export function useRoster(musterId: string | undefined, params: ListParams) {
  const search = new URLSearchParams(
    Object.entries(toApiQuery(params)).map(([k, v]) => [k, String(v)]),
  );
  return usePobQuery<ListPage<RosterRow>>(
    `/emergency/musters/${musterId ?? ''}/roster?${search.toString()}`,
    Boolean(musterId),
  );
}

export const declareMuster = (code: string, date: string, time: string) =>
  pobSend<MusterSummary>('POST', `/emergency/sites/${encodeURIComponent(code)}/musters`, {
    date,
    time,
  });
export const tickPerson = (musterId: string, personId: string, point: string | null) =>
  pobSend<RosterRow>('POST', `/emergency/musters/${musterId}/roster/${personId}`, { point });
export const recordHeadcount = (musterId: string, point: string, count: string) =>
  pobSend<MusterSummary>('POST', `/emergency/musters/${musterId}/headcounts`, { point, count });
export const standDown = (musterId: string, reason: string) =>
  pobSend<MusterSummary>('POST', `/emergency/musters/${musterId}/stand-down`, { reason });

/** Refreshes every emergency query after a change. */
export function useRefreshEmergency() {
  const client = useQueryClient();
  return useCallback(
    () =>
      client.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'demo-pob' && String(q.queryKey[1]).startsWith('/emergency'),
      }),
    [client],
  );
}

/** The chosen location, kept in `?location=` so the two screens can link to each other. */
export function useLocationParam(sites: readonly SiteOption[] | undefined) {
  const [search, setSearch] = useSearchParams();
  const requested = search.get('location') ?? '';
  const code = sites?.some((s) => s.code === requested) ? requested : (sites?.[0]?.code ?? '');
  const setCode = useCallback(
    (next: string) => setSearch({ location: next }, { replace: true }),
    [setSearch],
  );
  return [code, setCode] as const;
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const ROSTER_TONE: Record<RosterRow['status'], Tone> = {
  Accounted: 'success',
  Unaccounted: 'danger',
};

/** An error's message, for a banner or a field. */
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

/** The API's per-field messages (422 VALIDATION_FAILED), if any. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  const details = (error as { details?: { fields?: Record<string, string> } } | null)?.details;
  return details?.fields ?? {};
}
