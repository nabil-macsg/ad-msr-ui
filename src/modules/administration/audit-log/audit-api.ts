import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';

export type AuditQuery = {
  q?: string;
  module?: string;
  actionType?: string;
  actorUserId?: string;
  referenceId?: string;
  outcome?: 'success' | 'failure' | 'denied';
  from?: string;
  to?: string;
};

const KEY = ['audit-log'] as const;

/** 100 entries a page, newest first ("Showing 100 of N · Show more", spec 10 §4). */
export function useAuditLog(query: AuditQuery) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'list', query],
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/api/v1/audit-log', {
          params: { query: { ...query, limit: 100, ...(pageParam ? { cursor: pageParam } : {}) } },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

export function useAuditSummary(query: AuditQuery) {
  return useQuery({
    queryKey: [...KEY, 'summary', query],
    queryFn: async () => unwrap(await api.GET('/api/v1/audit-log/summary', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useAuditFacets() {
  return useQuery({
    queryKey: [...KEY, 'facets'],
    queryFn: async () => unwrap(await api.GET('/api/v1/audit-log/facets')),
    staleTime: 60_000,
  });
}

export function useAuditRetention() {
  return useQuery({
    queryKey: [...KEY, 'retention'],
    queryFn: async () => unwrap(await api.GET('/api/v1/audit-log/retention')),
    staleTime: 5 * 60_000,
  });
}
