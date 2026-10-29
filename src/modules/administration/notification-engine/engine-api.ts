import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import type { MasterResource } from '../masters/master-resource';

export type NotificationRule = components['schemas']['NotificationRule'];
export type RuleDetail = components['schemas']['NotificationRuleDetail'];
export type Triggers = components['schemas']['NotificationTriggers'];
export type Trigger = Triggers['triggers'][number];
export type Delivery = components['schemas']['NotificationDelivery'];
export type Templates = components['schemas']['NotificationTemplates'];
export type RuleUpdate = components['schemas']['NotificationRuleUpdate'];
export type Channel = RuleUpdate['channels'][number];
export type TriggerKey = Trigger['key'];

export const ENGINE_KEY = ['notification-engine'] as const;
const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export const rulesResource: MasterResource<NotificationRule> = {
  pageKey: 'admin.notification-engine',
  queryKey: [...ENGINE_KEY, 'rules'],
  path: '/api/v1/notification-rules',
  list: async (query) => unwrap(await api.GET('/api/v1/notification-rules', { params: { query } })),
  deactivate: async (rule, reason) =>
    unwrap(
      await api.POST('/api/v1/notification-rules/{id}/deactivate', {
        params: { path: { id: rule.id }, header: ifMatch(rule.version) },
        body: { reason },
      }),
    ),
  reactivate: async (rule, reason) =>
    unwrap(
      await api.POST('/api/v1/notification-rules/{id}/reactivate', {
        params: { path: { id: rule.id }, header: ifMatch(rule.version) },
        body: { reason },
      }),
    ),
  remove: async (rule, reason) => {
    unwrap(
      await api.DELETE('/api/v1/notification-rules/{id}', {
        params: { path: { id: rule.id }, header: ifMatch(rule.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/notification-rules/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

/** The triggers and the roles a rule can name; they change only with releases. */
export function useTriggers() {
  return useQuery({
    queryKey: [...ENGINE_KEY, 'triggers'],
    queryFn: async () => unwrap(await api.GET('/api/v1/notification-rules/triggers')),
    staleTime: 5 * 60_000,
  });
}

export function useRule(id: string | null) {
  return useQuery({
    queryKey: [...ENGINE_KEY, 'rule', id],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/notification-rules/{id}', { params: { path: { id: id ?? '' } } }),
      ),
    enabled: id !== null,
  });
}

/** A new rule, or the whole rule changed (with its version). */
export async function saveRule(
  current: RuleDetail | null,
  rule: RuleUpdate & { code: string; trigger: TriggerKey },
): Promise<void> {
  const { code, trigger, ...update } = rule;
  if (current) {
    unwrap(
      await api.PUT('/api/v1/notification-rules/{id}', {
        params: { path: { id: current.id }, header: ifMatch(current.version) },
        body: update,
      }),
    );
    return;
  }
  unwrap(await api.POST('/api/v1/notification-rules', { body: { ...update, code, trigger } }));
}

export async function preview(
  trigger: TriggerKey,
  channels: readonly Channel[],
  templates: Templates,
) {
  return unwrap(
    await api.POST('/api/v1/notification-rules/preview', {
      body: { trigger, channels: [...channels], templates },
    }),
  );
}

export async function listDeliveries(query: Readonly<Record<string, string | number | boolean>>) {
  return unwrap(await api.GET('/api/v1/notification-deliveries', { params: { query } }));
}

export async function retryDelivery(id: string): Promise<Delivery> {
  return unwrap(
    await api.POST('/api/v1/notification-deliveries/{id}/retry', { params: { path: { id } } }),
  );
}
