import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type UserSummary = components['schemas']['UserSummary'];
export type UserDetail = components['schemas']['UserDetail'];
export type RoleAssignment = components['schemas']['RoleAssignment'];
export type UserKpis = components['schemas']['UserKpis'];
export type UserAnalytics = components['schemas']['UserAnalytics'];
export type RoleOption = components['schemas']['RoleOptions']['items'][number];
export type ScopeOptions = components['schemas']['ScopeOptions'];
export type ScopeSummary = components['schemas']['ScopeSummary'];
export type AssignRole = components['schemas']['AssignRole'];
export type UpdateAssignment = components['schemas']['UpdateAssignment'];
export type AccessChange = components['schemas']['AccessChange'];
export type SyncRun = components['schemas']['SyncRun'];
export type RoleScope = AssignRole['scope'];

export const USERS_KEY = ['access', 'users'] as const;

const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export function useUsers(query: Readonly<Record<string, string | number | boolean>>) {
  return useQuery({
    queryKey: [...USERS_KEY, 'list', query],
    queryFn: async () => unwrap(await api.GET('/api/v1/access/users', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useUserKpis() {
  return useQuery({
    queryKey: [...USERS_KEY, 'kpis'],
    queryFn: async () => unwrap(await api.GET('/api/v1/access/users/summary')),
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: [...USERS_KEY, 'detail', id],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/access/users/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== null,
  });
}

export function useUserAnalytics(enabled: boolean) {
  return useQuery({
    queryKey: [...USERS_KEY, 'analytics'],
    queryFn: async () => unwrap(await api.GET('/api/v1/access/users/analytics')),
    enabled,
  });
}

export function useRoleOptions() {
  return useQuery({
    queryKey: [...USERS_KEY, 'role-options'],
    queryFn: async () => unwrap(await api.GET('/api/v1/access/users/role-options')).items,
    staleTime: 60_000,
  });
}

export function useScopeOptions() {
  return useQuery({
    queryKey: [...USERS_KEY, 'scope-options'],
    queryFn: async () => unwrap(await api.GET('/api/v1/access/users/scope-options')),
    staleTime: 5 * 60_000,
  });
}

export async function userHistory(id: string, cursor: string | undefined) {
  return unwrap(
    await api.GET('/api/v1/access/users/{id}/history', {
      params: { path: { id }, query: cursor ? { cursor } : {} },
    }),
  );
}

/** The latest run of each source system, for the sync panel (P1-01). */
export function useLatestSyncRuns() {
  return useQuery({
    queryKey: ['integration', 'sync-runs', 'latest'],
    queryFn: async () => unwrap(await api.GET('/api/v1/integration/sync-runs/latest')).items,
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === 'running') ? 5_000 : false,
  });
}

/** Every change refreshes the users list, the figures and the user's own detail. */
export function useUserMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: USERS_KEY });
  const after = { onSettled: refresh };
  return {
    assign: useMutation({
      mutationFn: async (input: { userId: string; body: AssignRole }) =>
        unwrap(
          await api.POST('/api/v1/access/users/{id}/assignments', {
            params: { path: { id: input.userId } },
            body: input.body,
          }),
        ),
      ...after,
    }),
    updateAssignment: useMutation({
      mutationFn: async (input: { assignment: RoleAssignment; body: UpdateAssignment }) =>
        unwrap(
          await api.PATCH('/api/v1/access/assignments/{id}', {
            params: {
              path: { id: input.assignment.id },
              header: ifMatch(input.assignment.version),
            },
            body: input.body,
          }),
        ),
      ...after,
    }),
    revoke: useMutation({
      mutationFn: async (input: { assignment: RoleAssignment; body: AccessChange }) =>
        unwrap(
          await api.POST('/api/v1/access/assignments/{id}/revoke', {
            params: {
              path: { id: input.assignment.id },
              header: ifMatch(input.assignment.version),
            },
            body: input.body,
          }),
        ),
      ...after,
    }),
    deactivate: useMutation({
      mutationFn: async (input: { user: UserDetail; body: AccessChange }) =>
        unwrap(
          await api.POST('/api/v1/access/users/{id}/deactivate', {
            params: { path: { id: input.user.id }, header: ifMatch(input.user.version) },
            body: input.body,
          }),
        ),
      ...after,
    }),
    reactivate: useMutation({
      mutationFn: async (input: { user: UserDetail; body: AccessChange }) =>
        unwrap(
          await api.POST('/api/v1/access/users/{id}/reactivate', {
            params: { path: { id: input.user.id }, header: ifMatch(input.user.version) },
            body: input.body,
          }),
        ),
      ...after,
    }),
    invite: useMutation({
      mutationFn: async (input: { user: UserDetail; referenceId: string }) =>
        unwrap(
          await api.POST('/api/v1/access/users/{id}/invitation', {
            params: { path: { id: input.user.id } },
            body: { referenceId: input.referenceId },
          }),
        ),
      ...after,
    }),
    setApprovalTier: useMutation({
      mutationFn: async (input: {
        user: UserDetail;
        approvalTier: number | null;
        referenceId: string;
      }) =>
        unwrap(
          await api.PATCH('/api/v1/access/users/{id}', {
            params: { path: { id: input.user.id }, header: ifMatch(input.user.version) },
            body: { approvalTier: input.approvalTier, referenceId: input.referenceId },
          }),
        ),
      ...after,
    }),
    sync: useMutation({
      mutationFn: async (adapter: SyncRun['adapter']) =>
        unwrap(await api.POST('/api/v1/integration/sync-runs', { body: { adapter } })),
      onSettled: () => queryClient.invalidateQueries({ queryKey: ['integration', 'sync-runs'] }),
    }),
  };
}
