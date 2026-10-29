import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type RoleMatrix = components['schemas']['RoleMatrix'];
export type MatrixRight = RoleMatrix['modules'][number]['pages'][number]['granted'][number];
export type SaveMatrix = components['schemas']['SaveRoleMatrix'];
export type MatrixChanges = components['schemas']['MatrixChanges'];

export const MATRIX_KEY = ['access', 'access-rights'] as const;

export function useMatrixOptions() {
  return useQuery({
    queryKey: [...MATRIX_KEY, 'options'],
    queryFn: async () => unwrap(await api.GET('/api/v1/access/access-rights/options')),
    staleTime: 60_000,
  });
}

export function useRoleMatrix(roleId: string | null) {
  return useQuery({
    queryKey: [...MATRIX_KEY, 'role', roleId],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/access/access-rights/{roleId}', {
          params: { path: { roleId: roleId ?? '' } },
        }),
      ),
    enabled: roleId !== null,
    placeholderData: keepPreviousData,
  });
}

export async function saveMatrix(roleId: string, version: number, body: SaveMatrix) {
  return unwrap(
    await api.PUT('/api/v1/access/access-rights/{roleId}', {
      params: { path: { roleId }, header: { 'If-Match': String(version) } },
      body,
    }),
  );
}

export function useMatrixVersions(roleId: string | null) {
  return useQuery({
    queryKey: [...MATRIX_KEY, 'versions', roleId],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/access/access-rights/versions', {
          params: { query: roleId ? { 'filter[role]': roleId, pageSize: 50 } : { pageSize: 50 } },
        }),
      ),
    enabled: roleId !== null,
  });
}

export async function versionChanges(versionNo: number, roleId: string) {
  return unwrap(
    await api.GET('/api/v1/access/access-rights/versions/{versionNo}/changes', {
      params: { path: { versionNo }, query: { role: roleId } },
    }),
  );
}
