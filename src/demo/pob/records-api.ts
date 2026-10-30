import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/errors';
import type { ListPage } from '../../modules/administration/masters/master-resource';
import { pobCall, pobSend, usePobQuery } from './pob-api';

/** The records screens' calls (vessel / barge check-in, crew entry, location override). */
export const RECORDS = '/records';
const KEY = ['demo-pob', 'records'] as const;

export interface Site {
  code: string;
  name: string;
}
export interface Vessel {
  id: string;
  name: string;
  type: 'Vessel' | 'Barge';
  locationCode: string;
  locationName: string;
  aboard: number;
}
export interface AboardRow {
  id: string;
  kind: 'boarding' | 'crew';
  name: string;
  optima: string;
  company: string;
  role: string;
  boardedAt: string;
  recordedBy: string;
}
export interface Person {
  optima: string;
  name: string;
  detail: string;
}
export interface CrewMember {
  optima: string;
  name: string;
  role: string;
  employer: string;
}
export interface CrewRecord {
  id: string;
  optima: string;
  name: string;
  role: string;
  employer: string;
  category: string;
  nationality: string;
  hsePassportExpiry: string;
  locationCode: string;
  locationName: string;
  vessel: string;
  onBoardAt: string;
  until: string;
  recordedBy: string;
  daysOffshore: number;
  overLimit: boolean;
  overdue: boolean;
}
export interface Override {
  id: string;
  name: string;
  optima: string;
  locationCode: string;
  locationName: string;
  date: string;
  comment: string;
  recordedBy: string;
}
export interface OverridePerson {
  optima: string;
  name: string;
  locationName: string;
}

export const useSites = () => usePobQuery<Site[]>(`${RECORDS}/sites`);
export const useRecordsToday = () => usePobQuery<{ today: string }>(`${RECORDS}/today`);

/** A list endpoint read with the shared list query (search, sort, paging). */
export function useRecordsList<T>(
  path: string,
  query: Record<string, string | number | boolean>,
  enabled = true,
) {
  const search = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  return useQuery({
    queryKey: [...KEY, path, search.toString()],
    queryFn: () => pobCall<ListPage<T>>(`${RECORDS}${path}?${search.toString()}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Refreshes every records query after a change (counts on other screens move too). */
export function useRecordsRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['demo-pob'] });
}

export const recordsSend = <T>(method: string, path: string, body?: unknown) =>
  pobSend<T>(method, `${RECORDS}${path}`, body);

/** The field messages of a 422 answer, or one general message. */
export function fieldErrors(error: unknown): { fields: Record<string, string>; message: string } {
  if (error instanceof ApiError) {
    const details = error.details as { fields?: Record<string, string> } | undefined;
    return { fields: details?.fields ?? {}, message: error.message };
  }
  return { fields: {}, message: error instanceof Error ? error.message : 'Something went wrong.' };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "6 Oct 2026" or "6 Oct 2026 07:00" from "2026-10-06" or "2026-10-06T07:00". */
export function formatDay(iso: string): string {
  const [date = '', time] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const day = `${String(d)} ${MONTHS[m - 1] ?? ''} ${String(y)}`;
  return time ? `${day} ${time.slice(0, 5)}` : day;
}
