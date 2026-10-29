import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import type { PageKey } from '../../../app/access/registry';
import type { MasterResource } from './master-resource';

/** A code master record: code, name and its own fields by API key (ADR-0056, ADR-0057). */
export type CodeMaster = components['schemas']['Zone'] & { readonly [field: string]: unknown };
export type CodeMasterInput = Readonly<Record<string, unknown>>;
export type Ref = components['schemas']['FuelStation']['location'];

export type CodeMasterKind =
  | 'zones'
  | 'location-types'
  | 'installation-types'
  | 'resource-categories'
  | 'cargo-types'
  | 'fuel-stations';

export const CODE_PAGES: Readonly<Record<CodeMasterKind, PageKey>> = {
  zones: 'admin.zones',
  'location-types': 'admin.location-types',
  'installation-types': 'admin.installation-types',
  'resource-categories': 'admin.resource-categories',
  'cargo-types': 'admin.cargo-types',
  'fuel-stations': 'admin.fuel-stations',
};

const ifMatch = (version: number) => ({ 'If-Match': String(version) });

/** They share their API's shape, so one client serves them all, typed as zones. */
type SharedPath = '/api/v1/masters/zones';
const basePath = (kind: CodeMasterKind) => `/api/v1/masters/${kind}` as SharedPath;

export function codeMasterResource(
  kind: CodeMasterKind,
  deletable = true,
): MasterResource<CodeMaster> {
  const base = basePath(kind);
  const one = `${base}/{id}` as const;
  const resource: MasterResource<CodeMaster> = {
    pageKey: CODE_PAGES[kind],
    queryKey: ['masters', kind],
    path: base,
    list: async (query) => unwrap(await api.GET(base, { params: { query } })),
    deactivate: async (record, reason) =>
      unwrap(
        await api.POST(`${one}/deactivate`, {
          params: { path: { id: record.id }, header: ifMatch(record.version) },
          body: { reason },
        }),
      ),
    reactivate: async (record, reason) =>
      unwrap(
        await api.POST(`${one}/reactivate`, {
          params: { path: { id: record.id }, header: ifMatch(record.version) },
          body: { reason },
        }),
      ),
    history: async (id, cursor) =>
      unwrap(
        await api.GET(`${one}/history`, {
          params: { path: { id }, query: cursor ? { cursor } : {} },
        }),
      ),
  };
  if (!deletable) return resource;
  return {
    ...resource,
    remove: async (record, reason) => {
      unwrap(
        await api.DELETE(one, {
          params: { path: { id: record.id }, header: ifMatch(record.version) },
          body: { reason },
        }),
      );
    },
  };
}

export async function saveCodeMaster(
  kind: CodeMasterKind,
  record: CodeMaster | null,
  body: CodeMasterInput,
): Promise<CodeMaster> {
  const base = basePath(kind);
  if (record) {
    // The code is permanent.
    const changes: Record<string, unknown> = { ...body };
    delete changes.code;
    return unwrap(
      await api.PATCH(`${base}/{id}`, {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: changes,
      }),
    );
  }
  return unwrap(await api.POST(base, { body: body as { code: string; name: string } }));
}

/** The choices of a master's reference fields, by field. */
export function useCodeMasterOptions(kind: CodeMasterKind, enabled: boolean) {
  return useQuery({
    queryKey: ['masters', kind, 'options'],
    queryFn: async () =>
      unwrap(
        await api.GET(`/api/v1/masters/${kind}/options` as '/api/v1/masters/fuel-stations/options'),
      ) as Readonly<Record<string, readonly Ref[]>>,
    enabled,
    staleTime: 60_000,
  });
}
