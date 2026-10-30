import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/errors';
import type {
  DashboardApproval,
  DashboardFlight,
  DashboardNotice,
  SupportContact,
  SupportGuide,
  SupportQuestionGroup,
} from '../../mock/data/demo-core';
import type { ListPage } from '../../modules/administration/masters/master-resource';

const BASE = '/api/v1/demo/core';

async function call<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body: unknown = await response.json();
  if (!response.ok) throw ApiError.from(response.status, body);
  return body as T;
}

export interface CoreDashboard {
  today: string;
  kpis: {
    approvals: number;
    departures: number;
    gone: number;
    toGo: number;
    boarding: number;
    waitlisted: number;
  };
  flights: DashboardFlight[];
  approvals: { total: number; items: (DashboardApproval & { date: string })[] };
  notices: DashboardNotice[];
}

export function useCoreDashboard() {
  return useQuery({
    queryKey: ['demo', 'core', 'dashboard'],
    queryFn: () => call<CoreDashboard>(`${BASE}/dashboard`),
    refetchInterval: 60_000,
  });
}

export interface CoreSupport {
  technical: { body: string; portalUrl: string | null; pending: string };
  questions: SupportQuestionGroup[];
  guides: SupportGuide[];
}

export function useCoreSupport() {
  return useQuery({
    queryKey: ['demo', 'core', 'support'],
    queryFn: () => call<CoreSupport>(`${BASE}/support`),
  });
}

export function useSupportContacts(query: { q: string; zone: string | undefined }) {
  const search = new URLSearchParams({ q: query.q });
  if (query.zone) search.set('filter[zone]', query.zone);
  return useQuery({
    queryKey: ['demo', 'core', 'support-contacts', search.toString()],
    queryFn: () => call<ListPage<SupportContact>>(`${BASE}/support/contacts?${search.toString()}`),
    placeholderData: keepPreviousData,
  });
}
