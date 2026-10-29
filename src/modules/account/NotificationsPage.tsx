import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import type { paths } from '../../api/schema';
import {
  markAllRead,
  markRead,
  NOTIFICATIONS_KEY,
  type NotificationTab,
} from '../../app/shell/notification-queries';
import { formatGst } from '../../shared/time/format';
import { Button } from '../../shared/ui/button';
import { EmptyState } from '../../shared/ui/empty-state';
import { FilterSelect } from '../../shared/ui/filter-select';
import { PageHeader } from '../../shared/ui/page-header';
import { Spinner } from '../../shared/ui/spinner';
import { StatusPill } from '../../shared/ui/status-pill';
import { ACCOUNT_KEY, myPreferences } from './account-api';

const TAB_CLASS =
  'min-h-touch border-b-2 border-transparent px-4 text-sm font-semibold text-ink-secondary data-[state=active]:border-primary data-[state=active]:text-ink';
const SEVERITY = { info: 'info', warning: 'warning', critical: 'danger' } as const;
type Category = NonNullable<
  NonNullable<paths['/api/v1/notifications']['get']['parameters']['query']>['category']
>;

/** Notifications (spec 10 §1.2): alerts and the emails sent to me, filtered, with mark read. */
export default function NotificationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<NotificationTab>('alerts');
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const [unread, setUnread] = useState(false);
  const categories = useQuery({
    queryKey: [...ACCOUNT_KEY, 'preferences'],
    queryFn: myPreferences,
  });
  const labelOf = (key: string) =>
    categories.data?.categories.find((c) => c.key === key)?.label ?? key;
  const list = useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'page', tab, category, unread],
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/api/v1/notifications', {
          params: {
            query: {
              tab,
              limit: 20,
              ...(pageParam ? { cursor: pageParam } : {}),
              ...(category ? { category } : {}),
              ...(tab === 'alerts' && unread ? { unread: 'true' as const } : {}),
            },
          },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title={t('notificationsPage.title')}
        subtitle={t('notificationsPage.subtitle')}
        actions={
          tab === 'alerts' && (
            <Button variant="secondary" onClick={() => void markAllRead().then(refresh)}>
              {t('notificationsPage.markAll')}
            </Button>
          )
        }
      />
      <Tabs.Root
        value={tab}
        onValueChange={(v) => setTab(v as NotificationTab)}
        className="space-y-4"
      >
        <Tabs.List
          className="flex gap-2 border-b border-border"
          aria-label={t('notificationsPage.title')}
        >
          <Tabs.Trigger value="alerts" className={TAB_CLASS}>
            {t('notificationsPage.tabs.alerts')}
          </Tabs.Trigger>
          <Tabs.Trigger value="emails" className={TAB_CLASS}>
            {t('notificationsPage.tabs.emails')}
          </Tabs.Trigger>
        </Tabs.List>
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-card">
          <FilterSelect
            label={t('notificationsPage.category')}
            allLabel={t('ui.filter.all')}
            value={category}
            options={(categories.data?.categories ?? []).map((c) => ({
              value: c.key,
              label: c.label,
            }))}
            onChange={(value) => setCategory(value as Category | undefined)}
          />
          {tab === 'alerts' && (
            <label className="flex min-h-touch items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={unread}
                onChange={(e) => setUnread(e.target.checked)}
              />
              {t('notificationsPage.unreadOnly')}
            </label>
          )}
        </div>
        {(['alerts', 'emails'] as const).map((value) => (
          <Tabs.Content key={value} value={value}>
            {list.isPending && <Spinner label={t('loading')} />}
            {list.isSuccess && items.length === 0 && (
              <EmptyState title={t('notificationsPage.empty')} />
            )}
            <ul className="space-y-2">
              {items.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-card p-4 shadow-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      {!n.read && n.kind === 'alert' && (
                        <span
                          className="size-2 rounded-pill bg-primary"
                          aria-label={t('notificationsPage.unread')}
                        />
                      )}
                      {n.title}
                    </p>
                    <p className="text-xs text-ink-secondary">
                      {formatGst(n.createdAt)} GST · {labelOf(n.category)}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-line text-ink-secondary">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {n.severity !== 'info' && (
                      <StatusPill tone={SEVERITY[n.severity]}>{n.severity}</StatusPill>
                    )}
                    {n.link && (
                      <Link
                        to={n.link}
                        className="text-sm font-semibold text-link underline-offset-4 hover:underline"
                      >
                        {t('notificationsPage.open')}
                      </Link>
                    )}
                    {!n.read && n.kind === 'alert' && (
                      <Button
                        variant="ghost"
                        aria-label={t('notificationsPage.markRead', { title: n.title })}
                        onClick={() => void markRead(n.id).then(refresh)}
                      >
                        ✓
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {list.hasNextPage && (
              <Button
                variant="secondary"
                className="mt-4"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {t('notificationsPage.more')}
              </Button>
            )}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </section>
  );
}
