import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';

type Schemas = components['schemas'];
export type MusterPoint = Schemas['MusterPoint'];
export type MusterPointOptions = Schemas['MusterPointOptions'];
export type Lifeboat = Schemas['Lifeboat'];
export type LifeboatOptions = Schemas['LifeboatOptions'];
export type LifeboatCapacity = Schemas['LifeboatCapacity'];
export type EssentialPosition = Schemas['EssentialPosition'];
export type EssentialOptions = Schemas['EssentialPositionOptions'];
export type EssentialTimeline = Schemas['EssentialTimeline'];
export type Unmapped = Schemas['UnmappedDesignations'];
export type PendingChange = Schemas['PendingMasterChange'];
export type PobMaster = PendingChange['master'];
export type Proposed = Schemas['PendingMasterChanges'];

export const POB_MASTERS = [
  'muster-points',
  'lifeboats',
  'essential-positions',
] as const satisfies readonly PobMaster[];
export const CHANGE_STATUSES = [
  'pending',
  'approved',
  'returned',
  'withdrawn',
  'failed',
] as const satisfies readonly PendingChange['status'][];

const ifMatch = (version: number) => ({ 'If-Match': String(version) });
export const PENDING_KEY = ['masters', 'pending-changes'] as const;

/** Changes to these masters wait for a second person; a proposal returns its pending changes. */
type Base = '/api/v1/masters/muster-points';
type One = '/api/v1/masters/muster-points/{id}';

export async function propose(
  slug: PobMaster,
  record: { id: string; version: number } | null,
  body: object,
): Promise<Proposed> {
  if (record) {
    return unwrap(
      await api.PATCH(`/api/v1/masters/${slug}/{id}` as One, {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body,
      }),
    );
  }
  return unwrap(
    await api.POST(`/api/v1/masters/${slug}` as Base, {
      body: body as Schemas['MusterPointInput'],
    }),
  );
}

/** Out of use at once (P-57). */
export async function makeUnavailable(point: MusterPoint, reasonCode: string, reason: string) {
  return unwrap(
    await api.POST('/api/v1/masters/muster-points/{id}/unavailable', {
      params: { path: { id: point.id }, header: ifMatch(point.version) },
      body: reasonCode ? { reasonCode, reason } : { reason },
    }),
  );
}

export async function takeOutOfService(boat: Lifeboat, reason: string) {
  return unwrap(
    await api.POST('/api/v1/masters/lifeboats/{id}/out-of-service', {
      params: { path: { id: boat.id }, header: ifMatch(boat.version) },
      body: { reason },
    }),
  );
}

/** Back into use: a proposal, approved by a second person (P-57). */
export async function proposeReturnToUse(
  slug: 'muster-points' | 'lifeboats',
  record: { id: string; version: number },
  reason: string,
): Promise<Proposed> {
  return unwrap(
    await api.POST(
      `/api/v1/masters/${slug}/{id}/return-to-use` as '/api/v1/masters/lifeboats/{id}/return-to-use',
      {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      },
    ),
  );
}

export function useLifeboatCapacity() {
  return useQuery({
    queryKey: ['masters', 'lifeboats', 'capacity'],
    queryFn: async () => unwrap(await api.GET('/api/v1/masters/lifeboats/capacity')),
  });
}

export function useTimeline(id: string | null) {
  return useQuery({
    queryKey: ['masters', 'essential-positions', 'timeline', id],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/masters/essential-positions/{id}/timeline', {
          params: { path: { id: id ?? '' } },
        }),
      ),
    enabled: id !== null,
  });
}

export function useUnmapped(location: string | undefined) {
  return useQuery({
    queryKey: ['masters', 'essential-positions', 'unmapped', location],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/masters/essential-positions/unmapped', {
          params: { query: { location: location ?? '' } },
        }),
      ),
    enabled: location !== undefined,
  });
}

// ── Pending changes ─────────────────────────────────────────────────────────

export type PendingQuery = Readonly<Record<string, string | number | boolean>>;

export async function listPending(query: PendingQuery) {
  return unwrap(await api.GET('/api/v1/masters/pending-changes', { params: { query } }));
}

/** How many of a master's changes wait for approval, for the master's notice. */
export function usePendingCount(master: PobMaster, enabled: boolean) {
  return useQuery({
    queryKey: ['masters', master, 'pending-count'],
    queryFn: async () =>
      (
        await listPending({
          'filter[master]': master,
          'filter[status]': 'pending',
          pageSize: 1,
        })
      ).total,
    enabled,
  });
}

export function usePendingChange(id: string | null) {
  return useQuery({
    queryKey: [...PENDING_KEY, 'one', id],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/masters/pending-changes/{id}', {
          params: { path: { id: id ?? '' } },
        }),
      ),
    enabled: id !== null,
  });
}

export async function pendingHistory(id: string, cursor: string | undefined) {
  return unwrap(
    await api.GET('/api/v1/masters/pending-changes/{id}/history', {
      params: { path: { id }, query: cursor ? { cursor } : {} },
    }),
  );
}

export async function withdrawChange(change: PendingChange, reason: string) {
  return unwrap(
    await api.POST('/api/v1/masters/pending-changes/{id}/withdraw', {
      params: { path: { id: change.id }, header: ifMatch(change.version) },
      body: { reason },
    }),
  );
}

type Task = NonNullable<PendingChange['myTask']>;

/** Approve through the Approval Engine; the change applies once the engine's event lands. */
export async function approveChange(task: Task) {
  unwrap(
    await api.POST('/api/v1/approvals/tasks/{id}/approve', {
      params: { path: { id: task.id }, header: ifMatch(task.version) },
      body: {},
    }),
  );
}

export async function returnChange(task: Task, reasonCode: string, comment: string) {
  unwrap(
    await api.POST('/api/v1/approvals/tasks/{id}/reject', {
      params: { path: { id: task.id }, header: ifMatch(task.version) },
      body: { reasonCode, comment },
    }),
  );
}
