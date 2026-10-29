import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import type { MasterResource } from '../masters/master-resource';

export type Role = components['schemas']['Role'];
export type RoleInput = components['schemas']['RoleInput'];

export const ROLE_TYPES = ['system', 'module', 'end_user'] as const;
export const SCOPE_LEVELS = [
  'platform',
  'module',
  'zone',
  'site',
  'provider',
  'department',
  'self',
] as const;

const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export const rolesResource: MasterResource<Role> = {
  pageKey: 'admin.roles',
  queryKey: ['access', 'roles'],
  path: '/api/v1/access/roles',
  list: async (query) => unwrap(await api.GET('/api/v1/access/roles', { params: { query } })),
  deactivate: async (role, reason) =>
    unwrap(
      await api.POST('/api/v1/access/roles/{id}/deactivate', {
        params: { path: { id: role.id }, header: ifMatch(role.version) },
        body: { reason },
      }),
    ),
  reactivate: async (role, reason) =>
    unwrap(
      await api.POST('/api/v1/access/roles/{id}/reactivate', {
        params: { path: { id: role.id }, header: ifMatch(role.version) },
        body: { reason },
      }),
    ),
  remove: async (role, reason) => {
    unwrap(
      await api.DELETE('/api/v1/access/roles/{id}', {
        params: { path: { id: role.id }, header: ifMatch(role.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/access/roles/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

export async function saveRole(role: Role | null, body: RoleInput): Promise<Role> {
  if (role) {
    // The code is permanent: an edit sends everything else.
    return unwrap(
      await api.PATCH('/api/v1/access/roles/{id}', {
        params: { path: { id: role.id }, header: ifMatch(role.version) },
        body: {
          name: body.name,
          description: body.description,
          type: body.type,
          scopeLevel: body.scopeLevel,
          maxHolders: body.maxHolders ?? null,
          isLocked: body.isLocked,
          isExternal: body.isExternal,
          channels: body.channels,
        },
      }),
    );
  }
  return unwrap(await api.POST('/api/v1/access/roles', { body }));
}
