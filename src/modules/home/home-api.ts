import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import type { components } from '../../api/schema';

export type Home = components['schemas']['Home'];
export type HomeWidget = components['schemas']['HomeWidget'];
export type SearchResults = components['schemas']['SearchResults'];

export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: async () => unwrap(await api.GET('/api/v1/home')),
    refetchInterval: 60_000,
  });
}

/** Global search, from two characters (spec 10 §1.3). */
export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: async () => unwrap(await api.GET('/api/v1/search', { params: { query: { q } } })),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}
