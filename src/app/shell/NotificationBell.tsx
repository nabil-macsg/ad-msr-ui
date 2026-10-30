import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bell, CircleAlert, Info, Mail, TriangleAlert, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { components } from '../../api/schema';
import { cn } from '../../shared/lib/cn';
import { Button } from '../../shared/ui/button';
import { routeOf } from '../access/registry';
import {
  markAllRead,
  markRead,
  NOTIFICATIONS_KEY,
  type NotificationTab,
  notificationsQuery,
} from './notification-queries';

type Severity = components['schemas']['NotificationItem']['severity'];

/** Each severity's card: critical red, warning amber, info blue (the status colours). */
const SEVERITY: Record<Severity, { card: string; dot: string; icon: typeof Info }> = {
  critical: {
    card: 'border-danger-border bg-danger-bg/60',
    dot: 'bg-danger-fg',
    icon: TriangleAlert,
  },
  warning: {
    card: 'border-warning-border bg-warning-bg/60',
    dot: 'bg-warning-fg',
    icon: CircleAlert,
  },
  info: { card: 'border-info-border bg-info-bg/60', dot: 'bg-info-fg', icon: Info },
};
const ICON_TONE: Record<Severity, string> = {
  critical: 'text-danger-fg',
  warning: 'text-warning-fg',
  info: 'text-info-fg',
};

/** "2 min ago", "1 hr ago", in the page's language. */
function useAgo() {
  const { i18n } = useTranslation();
  const format = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto', style: 'short' });
  return (iso: string) => {
    const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
    if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return format.format(hours, 'hour');
    return format.format(Math.round(hours / 24), 'day');
  };
}

/** The live bell: a side panel of Alerts and Emails, as severity-coloured cards (spec 10 §1.2). */
export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>('alerts');
  const alerts = useQuery(notificationsQuery('alerts'));
  const emails = useQuery({ ...notificationsQuery('emails'), enabled: open });
  const list = tab === 'alerts' ? alerts : emails;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const ago = useAgo();
  const unread = alerts.data?.unreadCount ?? 0;
  const counts: Record<NotificationTab, number> = {
    alerts: unread,
    emails: emails.data?.unreadCount ?? 0,
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

  const openItem = async (id: string, link: string | null, read: boolean) => {
    if (!read && tab === 'alerts') await markRead(id);
    await refresh();
    setOpen(false);
    if (link?.startsWith('/')) void navigate(link);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="relative inline-flex size-touch items-center justify-center rounded-lg text-on-header-muted transition-colors hover:text-on-header focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={
            unread > 0 ? `${t('shell.notifications')} (${unread})` : t('shell.notifications')
          }
        >
          <Bell className="size-[18px]" aria-hidden />
          {unread > 0 && (
            <span className="absolute end-1 top-1 min-w-4 rounded-pill bg-danger px-1 text-center text-[9px] leading-4 font-bold text-on-primary">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 end-0 z-50 flex w-[min(28rem,94vw)] flex-col border-s border-border bg-card shadow-modal"
        >
          <header className="space-y-4 border-b border-border px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold text-ink">
                {t('shell.panelTitle')}
              </Dialog.Title>
              <Dialog.Close
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={t('ui.close')}
              >
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div role="tablist" aria-label={t('shell.notifications')} className="flex gap-1.5">
                {(['alerts', 'emails'] as const).map((value) => {
                  const Icon = value === 'alerts' ? Bell : Mail;
                  const active = tab === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(value)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                        active
                          ? 'bg-primary text-on-primary shadow-raised'
                          : 'text-ink-secondary hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {t(`shell.${value}`)}
                      {counts[value] > 0 && (
                        <span
                          className={cn(
                            'min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold tabular-nums',
                            active
                              ? 'bg-on-primary/20 text-on-primary'
                              : 'bg-danger-bg text-danger-fg',
                          )}
                        >
                          {counts[value]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
          </header>

          <ul className="flex-1 space-y-3 overflow-y-auto p-5" role="tabpanel">
            {list.data?.items.length === 0 && (
              <li className="py-16 text-center text-sm text-ink-muted">
                {t(tab === 'alerts' ? 'shell.noAlerts' : 'shell.noEmails')}
              </li>
            )}
            {list.data?.items.map((n) => {
              const s = SEVERITY[n.severity];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(n.id, n.link, n.read)}
                    className={cn(
                      'flex w-full gap-3 rounded-xl border p-4 text-start transition-all hover:-translate-y-px hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary',
                      s.card,
                      n.read && 'opacity-70',
                    )}
                  >
                    <s.icon
                      className={cn('mt-0.5 size-5 shrink-0', ICON_TONE[n.severity])}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                        {!n.read && <span className={cn('size-2 shrink-0 rounded-full', s.dot)} />}
                        {n.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink-secondary">
                        {n.body}
                      </span>
                      <span className="mt-2 block text-xs text-ink-muted">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <footer className="border-t border-border px-5 py-4">
            <Link
              to={routeOf('notifications')}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {t('shell.viewAll')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
