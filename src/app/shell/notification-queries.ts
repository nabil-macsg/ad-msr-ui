import { queryOptions } from '@tanstack/react-query';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';

export const NOTIFICATIONS_KEY = ['notifications'] as const;
export type NotificationTab = 'alerts' | 'emails';

/** The bell's lists; polled every 30 s as a fallback to the live socket event. */
export const notificationsQuery = (tab: NotificationTab) =>
  queryOptions({
    queryKey: [...NOTIFICATIONS_KEY, tab],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/notifications', { params: { query: { tab, limit: 10 } } })),
    refetchInterval: 30_000,
  });

export async function markRead(id: string): Promise<void> {
  unwrap(
    await api.PATCH('/api/v1/notifications/{id}', {
      params: { path: { id } },
      body: { read: true },
    }),
  );
}

export async function markAllRead(): Promise<void> {
  unwrap(await api.POST('/api/v1/notifications/read-all'));
}
