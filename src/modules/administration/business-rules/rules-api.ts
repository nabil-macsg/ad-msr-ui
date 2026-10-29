import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import type { MasterResource } from '../masters/master-resource';

export type Rule = components['schemas']['BusinessRule'];
export type RuleDetail = components['schemas']['BusinessRuleDetail'];
export type RuleTypes = components['schemas']['BusinessRuleTypes'];
export type RuleType = RuleTypes['types'][number];
export type ParamField = components['schemas']['RuleParameterField'];
export type ColumnField = components['schemas']['RuleParameterColumn'];
type VersionInput = components['schemas']['BusinessRuleVersionInput'];

export const RULES_KEY = ['business-rules'] as const;
const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export const rulesResource: MasterResource<Rule> = {
  pageKey: 'admin.business-rules',
  queryKey: RULES_KEY,
  path: '/api/v1/business-rules',
  list: async (query) => unwrap(await api.GET('/api/v1/business-rules', { params: { query } })),
  // Ends the rule now; a high-impact rule's end waits for approval (P-46).
  deactivate: async (rule, reason) =>
    unwrap(
      await api.POST('/api/v1/business-rules/{id}/deactivate', {
        params: { path: { id: rule.id }, header: ifMatch(rule.version) },
        body: { reason },
      }),
    ),
  reactivate: async (rule, reason) =>
    unwrap(
      await api.POST('/api/v1/business-rules/{id}/reactivate', {
        params: { path: { id: rule.id }, header: ifMatch(rule.version) },
        body: { reason },
      }),
    ),
  remove: async (rule, reason) => {
    unwrap(
      await api.DELETE('/api/v1/business-rules/{id}', {
        params: { path: { id: rule.id }, header: ifMatch(rule.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/business-rules/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

/** The rule types; they change only with releases. */
export function useRuleTypes() {
  return useQuery({
    queryKey: [...RULES_KEY, 'types'],
    queryFn: async () => unwrap(await api.GET('/api/v1/business-rules/types')),
    staleTime: 5 * 60_000,
  });
}

export function useRule(id: string | null) {
  return useQuery({
    queryKey: [...RULES_KEY, 'detail', id],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/business-rules/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== null,
  });
}

export interface RuleChanges {
  readonly code: string;
  readonly name: string;
  readonly type: RuleType['key'];
  readonly version: VersionInput;
  /** False when nothing but the name changed. */
  readonly versionChanged: boolean;
}

/**
 * A new rule with its first version; or, for an existing one, its new name and then, if the
 * content changed, a new version (in effect from its start, or once approved if high impact).
 */
export async function saveRule(current: RuleDetail | null, changes: RuleChanges): Promise<void> {
  if (!current) {
    unwrap(
      await api.POST('/api/v1/business-rules', {
        body: { code: changes.code, name: changes.name, type: changes.type, ...changes.version },
      }),
    );
    return;
  }
  let version = current.version;
  if (changes.name !== current.name) {
    version = unwrap(
      await api.PATCH('/api/v1/business-rules/{id}', {
        params: { path: { id: current.id }, header: ifMatch(version) },
        body: { name: changes.name },
      }),
    ).version;
  }
  if (changes.versionChanged) {
    unwrap(
      await api.POST('/api/v1/business-rules/{id}/versions', {
        params: { path: { id: current.id }, header: ifMatch(version) },
        body: changes.version,
      }),
    );
  }
}

export async function withdrawVersion(rule: RuleDetail, versionNo: number, reason: string) {
  unwrap(
    await api.POST('/api/v1/business-rules/{id}/versions/{versionNo}/withdraw', {
      params: { path: { id: rule.id, versionNo }, header: ifMatch(rule.version) },
      body: { reason },
    }),
  );
}

type Task = NonNullable<RuleDetail['myTask']>;

/** Approve through the Approval Engine; the version takes effect once the engine's event lands. */
export async function approveTask(task: Task) {
  unwrap(
    await api.POST('/api/v1/approvals/tasks/{id}/approve', {
      params: { path: { id: task.id }, header: ifMatch(task.version) },
      body: {},
    }),
  );
}

export async function returnTask(task: Task, reasonCode: string, comment: string) {
  unwrap(
    await api.POST('/api/v1/approvals/tasks/{id}/reject', {
      params: { path: { id: task.id }, header: ifMatch(task.version) },
      body: { reasonCode, comment },
    }),
  );
}
