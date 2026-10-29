import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import type { MasterResource } from '../masters/master-resource';

export type Workflow = components['schemas']['ApprovalWorkflow'];
export type WorkflowDetail = components['schemas']['ApprovalWorkflowDetail'];
type VersionInput = components['schemas']['ApprovalWorkflowVersionInput'];

export const WORKFLOWS_KEY = ['approvals', 'workflows'] as const;
const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export const workflowsResource: MasterResource<Workflow> = {
  pageKey: 'admin.approval-engine',
  queryKey: WORKFLOWS_KEY,
  path: '/api/v1/approval-workflows',
  list: async (query) => unwrap(await api.GET('/api/v1/approval-workflows', { params: { query } })),
  deactivate: async (workflow, reason) =>
    unwrap(
      await api.POST('/api/v1/approval-workflows/{id}/deactivate', {
        params: { path: { id: workflow.id }, header: ifMatch(workflow.version) },
        body: { reason },
      }),
    ),
  reactivate: async (workflow, reason) =>
    unwrap(
      await api.POST('/api/v1/approval-workflows/{id}/reactivate', {
        params: { path: { id: workflow.id }, header: ifMatch(workflow.version) },
        body: { reason },
      }),
    ),
  remove: async (workflow, reason) => {
    unwrap(
      await api.DELETE('/api/v1/approval-workflows/{id}', {
        params: { path: { id: workflow.id }, header: ifMatch(workflow.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/approval-workflows/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

/** The processes, their condition fields, the approver rules and roles. They change with releases. */
export function useProcesses() {
  return useQuery({
    queryKey: [...WORKFLOWS_KEY, 'processes'],
    queryFn: async () => unwrap(await api.GET('/api/v1/approval-workflows/processes')),
    staleTime: 5 * 60_000,
  });
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: [...WORKFLOWS_KEY, 'detail', id],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/approval-workflows/{id}', { params: { path: { id: id ?? '' } } }),
      ),
    enabled: id !== null,
  });
}

export interface WorkflowChanges {
  readonly code: string;
  readonly name: string;
  readonly process: string;
  readonly chain: VersionInput;
  /** False when the conditions and stages are those of the active version. */
  readonly chainChanged: boolean;
}

/**
 * A new workflow with its first version; or, for an existing one, its new name and then, if the
 * chain changed, a new version (requests already started keep theirs).
 */
export async function saveWorkflow(
  current: WorkflowDetail | null,
  changes: WorkflowChanges,
): Promise<void> {
  if (!current) {
    unwrap(
      await api.POST('/api/v1/approval-workflows', {
        body: {
          code: changes.code,
          name: changes.name,
          process: changes.process,
          ...changes.chain,
        },
      }),
    );
    return;
  }
  let version = current.version;
  if (changes.name !== current.name) {
    version = unwrap(
      await api.PATCH('/api/v1/approval-workflows/{id}', {
        params: { path: { id: current.id }, header: ifMatch(version) },
        body: { name: changes.name },
      }),
    ).version;
  }
  if (changes.chainChanged) {
    unwrap(
      await api.POST('/api/v1/approval-workflows/{id}/versions', {
        params: { path: { id: current.id }, header: ifMatch(version) },
        body: changes.chain,
      }),
    );
  }
}
