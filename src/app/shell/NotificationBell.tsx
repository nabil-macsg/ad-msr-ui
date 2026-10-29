import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Popover, Tabs } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { cn } from '../../shared/lib/cn';
import { Button } from '../../shared/ui/button';
import {
  markAllRead,
  markRead,
  NOTIFICATIONS_KEY,
  type NotificationTab,
  notificationsQuery,
} from './notification-queries';

/** The live bell: Alerts and Emails (spec 10 §1.2). */
export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>('alerts');
  const alerts = useQuery(notificationsQuery('alerts'));
  const list = useQuery({ ...notificationsQuery(tab), enabled: open });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const unread = alerts.data?.unreadCount ?? 0;
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

  const openItem = async (id: string, link: string | null, read: boolean) => {
    if (!read && tab === 'alerts') await markRead(id);
    await refresh();
    setOpen(false);
    if (link?.startsWith('/')) void navigate(link);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative inline-flex size-touch items-center justify-center rounded-lg text-on-header-muted transition-colors hover:text-on-header focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={
            unread > 0 ? `${t('shell.notifications')} (${unread})` : t('shell.notifications')
          }
        >
          <Bell className="size-[18px]" aria-hidden />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-4 rounded-pill bg-danger px-1 text-center text-[9px] leading-4 font-bold text-on-primary">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-96 overflow-hidden rounded-xl border border-border bg-card shadow-overlay"
        >
          <Tabs.Root value={tab} onValueChange={(v) => setTab(v as NotificationTab)}>
            <div className="flex items-center justify-between border-b border-border px-3">
              <Tabs.List aria-label={t('shell.notifications')} className="flex">
                {(['alerts', 'emails'] as const).map((value) => (
                  <Tabs.Trigger
                    key={value}
                    value={value}
                    className="-mb-px border-b-2 border-transparent px-3 py-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink-secondary data-[state=active]:border-primary data-[state=active]:text-primary"
                  >
                    {t(`shell.${value}`)}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {tab === 'alerts' && unread > 0 && (
                <Button
                  variant="link"
                  className="text-xs"
                  onClick={async () => {
                    await markAllRead();
                    await refresh();
                  }}
                >
                  {t('shell.markAllRead')}
                </Button>
              )}
            </div>
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {list.data?.items.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-ink-muted">
                  {t(tab === 'alerts' ? 'shell.noAlerts' : 'shell.noEmails')}
                </li>
              )}
              {list.data?.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n.id, n.link, n.read)}
                    className={cn(
                      'block w-full px-4 py-3 text-left hover:bg-surface-muted',
                      !n.read && 'bg-info-bg/40',
                    )}
                  >
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-ink-secondary">{n.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Tabs.Root>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
