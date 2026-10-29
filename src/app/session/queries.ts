import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import type { Me, MyAccess } from '../access/registry';

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me> => unwrap(await api.GET('/api/v1/me')),
  staleTime: 60_000,
});

/** Effective access; refetched on focus, since a matrix change applies at once (PROMPT §2.7). */
export const myAccessQuery = queryOptions({
  queryKey: ['me', 'access'],
  queryFn: async (): Promise<MyAccess> => unwrap(await api.GET('/api/v1/me/access')),
  staleTime: 30_000,
});

export const useMe = () => useQuery(meQuery);
export const useMyAccess = () => useQuery(myAccessQuery);
