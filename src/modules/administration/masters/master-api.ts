import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { PageKey } from '../../../app/access/registry';
import type { ListPage, MasterRecord, MasterResource } from './master-resource';

/**
 * Every master shares its endpoints' shapes (ADR-0057: the shared master controller), so one
 * client serves them, typed through zones' paths; each page states its record type.
 */
type Base = '/api/v1/masters/zones';
type One = '/api/v1/masters/zones/{id}';
const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export function masterResource<T extends MasterRecord>(
  slug: string,
  pageKey: PageKey,
  options: {
    deletable?: boolean;
    /** The list's API path when it isn't under `/api/v1/masters` (e.g. scheduling). */
    path?: string;
  } = {},
): MasterResource<T> {
  const base = (options.path ?? `/api/v1/masters/${slug}`) as Base;
  const one = `${base}/{id}` as One;
  const resource: MasterResource<T> = {
    pageKey,
    queryKey: options.path ? [options.path] : ['masters', slug],
    path: base,
    list: async (query) =>
      unwrap(await api.GET(base, { params: { query } })) as unknown as ListPage<T>,
    deactivate: async (record, reason) =>
      unwrap(
        await api.POST(`${one}/deactivate`, {
          params: { path: { id: record.id }, header: ifMatch(record.version) },
          body: { reason },
        }),
      ) as unknown as T,
    reactivate: async (record, reason) =>
      unwrap(
        await api.POST(`${one}/reactivate`, {
          params: { path: { id: record.id }, header: ifMatch(record.version) },
          body: { reason },
        }),
      ) as unknown as T,
    history: async (id, cursor) =>
      unwrap(
        await api.GET(`${one}/history`, {
          params: { path: { id }, query: cursor ? { cursor } : {} },
        }),
      ),
  };
  if (options.deletable === false) return resource;
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

/** Creates (no record) or edits (with If-Match) a master record. */
export async function saveMaster<T>(
  slug: string,
  record: MasterRecord | null,
  body: object,
): Promise<T> {
  if (record) {
    return unwrap(
      await api.PATCH(`/api/v1/masters/${slug}/{id}` as One, {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body,
      }),
    ) as unknown as T;
  }
  return unwrap(
    await api.POST(`/api/v1/masters/${slug}` as Base, {
      body: body as { code: string; name: string },
    }),
  ) as unknown as T;
}

/** A master form's choices (`GET masters/<slug>/options`). */
export function useMasterOptions<T>(slug: string, enabled = true) {
  return useQuery({
    queryKey: ['masters', slug, 'options'],
    queryFn: async () =>
      unwrap(
        await api.GET(`/api/v1/masters/${slug}/options` as '/api/v1/masters/fleet/options'),
      ) as unknown as T,
    enabled,
    staleTime: 60_000,
  });
}
