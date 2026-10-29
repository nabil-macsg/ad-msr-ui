import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import type { MasterResource } from '../masters/master-resource';

export type ReasonCode = components['schemas']['ReasonCode'];
export type ReasonContext = components['schemas']['ReasonContext'];
export type ReasonRequest = components['schemas']['ReasonCodeRequest'];
type CodeInput = components['schemas']['ReasonCodeInput'];
export type ContextKey = ReasonContext['key'];

export const REASONS_KEY = ['reason-codes'] as const;
const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export const codesResource: MasterResource<ReasonCode> = {
  pageKey: 'admin.reason-codes',
  queryKey: [...REASONS_KEY, 'codes'],
  path: '/api/v1/reason-codes',
  list: async (query) => unwrap(await api.GET('/api/v1/reason-codes', { params: { query } })),
  deactivate: async (code, reason) =>
    unwrap(
      await api.POST('/api/v1/reason-codes/{id}/deactivate', {
        params: { path: { id: code.id }, header: ifMatch(code.version) },
        body: { reason },
      }),
    ),
  reactivate: async (code, reason) =>
    unwrap(
      await api.POST('/api/v1/reason-codes/{id}/reactivate', {
        params: { path: { id: code.id }, header: ifMatch(code.version) },
        body: { reason },
      }),
    ),
  remove: async (code, reason) => {
    unwrap(
      await api.DELETE('/api/v1/reason-codes/{id}', {
        params: { path: { id: code.id }, header: ifMatch(code.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/reason-codes/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

export async function saveCode(current: ReasonCode | null, body: CodeInput): Promise<void> {
  if (current) {
    // The context and code are permanent: an edit sends the rest.
    unwrap(
      await api.PUT('/api/v1/reason-codes/{id}', {
        params: { path: { id: current.id }, header: ifMatch(current.version) },
        body: {
          description: body.description,
          commentRequired: body.commentRequired,
          crewChange: body.crewChange,
          sortOrder: body.sortOrder,
        },
      }),
    );
    return;
  }
  unwrap(await api.POST('/api/v1/reason-codes', { body }));
}

export function useContexts() {
  return useQuery({
    queryKey: [...REASONS_KEY, 'contexts'],
    queryFn: async () => unwrap(await api.GET('/api/v1/reason-codes/contexts')),
  });
}

export async function setMandatory(context: ReasonContext, mandatory: boolean, reason: string) {
  return unwrap(
    await api.PATCH('/api/v1/reason-codes/contexts/{context}', {
      params: { path: { context: context.key }, header: ifMatch(context.version) },
      body: { mandatory, reason },
    }),
  );
}

/** A reason dropdown's options, for any page that asks for a reason (spec 10 §3.4). */
export function useReasonOptions(context: ContextKey, enabled = true) {
  return useQuery({
    queryKey: [...REASONS_KEY, 'options', context],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/reason-codes/options', { params: { query: { context } } })),
    enabled,
    staleTime: 60_000,
  });
}

export function useRequests(status: ReasonRequest['status'] | undefined) {
  return useQuery({
    queryKey: [...REASONS_KEY, 'requests', status],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/reason-codes/requests', {
          params: { query: { pageSize: 100, ...(status ? { status } : {}) } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export async function submitRequest(body: components['schemas']['ReasonCodeRequestInput']) {
  return unwrap(await api.POST('/api/v1/reason-codes/requests', { body }));
}

export async function acceptRequest(
  request: ReasonRequest,
  body: components['schemas']['ReasonCodeRequestAccept'],
) {
  return unwrap(
    await api.POST('/api/v1/reason-codes/requests/{id}/accept', {
      params: { path: { id: request.id }, header: ifMatch(request.version) },
      body,
    }),
  );
}

export async function declineRequest(request: ReasonRequest, note: string) {
  return unwrap(
    await api.POST('/api/v1/reason-codes/requests/{id}/decline', {
      params: { path: { id: request.id }, header: ifMatch(request.version) },
      body: { note },
    }),
  );
}
