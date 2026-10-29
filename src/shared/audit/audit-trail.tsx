import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { components } from '../../api/schema';
import { Banner } from '../ui/banner';
import { Button } from '../ui/button';
import { Drawer } from '../ui/drawer';
import { EmptyState } from '../ui/empty-state';
import { Spinner } from '../ui/spinner';
import { Timeline, type TimelineEntry } from '../ui/timeline';
import { changesOf } from './changes';

export type AuditPage = components['schemas']['AuditPage'];
export type AuditEvent = components['schemas']['AuditEvent'];

function toEntry(event: AuditEvent, onBehalfOf: (name: string) => string): TimelineEntry {
  const changes = changesOf(event.before, event.after).map(
    (c) => `${c.field}: ${c.from} → ${c.to}`,
  );
  const description = [event.reason, ...changes].filter(Boolean).join(' · ');
  const actor = event.actor.onBehalfOf?.label
    ? `${event.actor.label} (${onBehalfOf(event.actor.onBehalfOf.label)})`
    : event.actor.label;
  return {
    id: event.id,
    at: event.occurredAt,
    title: event.actionLabel,
    actor,
    tone: event.outcome === 'success' ? 'info' : 'danger',
    ...(description ? { description } : {}),
  };
}

/**
 * A record's audit trail (spec 10 §5): every change, newest first, with who, when, why and what
 * changed. `load` reads a page of the record's history endpoint.
 */
export function AuditTrail({
  queryKey,
  load,
  enabled = true,
}: {
  queryKey: readonly unknown[];
  load: (cursor: string | undefined) => Promise<AuditPage>;
  enabled?: boolean;
}) {
  const { t } = useTranslation();
  const history = useInfiniteQuery({
    queryKey: [...queryKey, 'history'],
    queryFn: ({ pageParam }) => load(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
  const events = history.data?.pages.flatMap((page) => page.items) ?? [];
  const onBehalfOf = (name: string) => t('ui.audit.onBehalfOf', { name });

  return (
    <div>
      {history.isPending && enabled && <Spinner label={t('ui.audit.loading')} />}
      {history.isError && <Banner tone="danger">{t('ui.audit.loadFailed')}</Banner>}
      {history.isSuccess && events.length === 0 && <EmptyState title={t('ui.audit.empty')} />}
      {events.length > 0 && (
        <Timeline
          title={t('ui.audit.changes')}
          entries={events.map((event) => toEntry(event, onBehalfOf))}
        />
      )}
      {history.hasNextPage && (
        <Button
          variant="secondary"
          className="mt-4"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {t('ui.audit.showMore')}
        </Button>
      )}
    </div>
  );
}

/** One record's audit trail in a drawer, for the master pages. */
export function AuditTrailDrawer({
  open,
  onOpenChange,
  title,
  queryKey,
  load,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  queryKey: readonly unknown[];
  load: (cursor: string | undefined) => Promise<AuditPage>;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={title}>
      <AuditTrail queryKey={queryKey} load={load} enabled={open} />
    </Drawer>
  );
}
