import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { useLocalListParams } from '../../../shared/lists/list-params';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { DataTable } from '../../../shared/ui/data-table';
import { FilterBar } from '../../../shared/ui/filter-bar';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { type Delivery, ENGINE_KEY, listDeliveries, retryDelivery } from './engine-api';

const STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;
const CHANNELS = ['email', 'sms', 'push'] as const;
const TONE = { queued: 'info', sending: 'info', sent: 'success', failed: 'danger' } as const;

/**
 * The delivery log (spec 10 §3.3): every email, SMS and push, how it went, and retry for a
 * failed one. Module Power Users see their own modules' deliveries (P-48).
 */
export function DeliveryLog() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: access } = useMyAccess();
  const { params, update, apiQuery } = useLocalListParams();
  const [failure, setFailure] = useState<string | null>(null);
  const list = useQuery({
    queryKey: [...ENGINE_KEY, 'deliveries', apiQuery],
    queryFn: () => listDeliveries(apiQuery),
    placeholderData: keepPreviousData,
  });
  const retry = async (row: Delivery) => {
    setFailure(null);
    try {
      await retryDelivery(row.id);
      await queryClient.invalidateQueries({ queryKey: [...ENGINE_KEY, 'deliveries'] });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  };
  const set = (name: string, value: string | undefined) => {
    const rest = Object.fromEntries(Object.entries(params.filters).filter(([k]) => k !== name));
    update({ filters: value ? { ...rest, [name]: value } : rest });
  };

  return (
    <div className="space-y-4">
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        placeholder={t('engine.log.search')}
        activeCount={Object.keys(params.filters).length}
        onClear={() => update({ q: '', filters: {} })}
      >
        <FilterSelect
          label={t('engine.log.channel')}
          allLabel={t('ui.filter.all')}
          value={params.filters.channel}
          options={CHANNELS.map((c) => ({ value: c, label: t(`engine.channel.${c}`) }))}
          onChange={(v) => set('channel', v)}
        />
        <FilterSelect
          label={t('engine.log.status')}
          allLabel={t('ui.filter.all')}
          value={params.filters.status}
          options={STATUSES.map((s) => ({ value: s, label: t(`engine.log.state.${s}`) }))}
          onChange={(v) => set('status', v)}
        />
      </FilterBar>
      {list.isError && (
        <Banner tone="danger">
          {list.error instanceof Error ? list.error.message : t('masters.loadFailed')}
        </Banner>
      )}
      {failure && <Banner tone="danger">{failure}</Banner>}
      <DataTable
        caption={t('engine.log.title')}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(row) => row.id}
        params={params}
        onParamsChange={update}
        loading={list.isFetching}
        emptyTitle={t('engine.log.empty')}
        columns={[
          {
            id: 'queuedAt',
            header: t('engine.log.columns.queuedAt'),
            sortField: 'queuedAt',
            className: 'whitespace-nowrap',
            cell: (d) => formatGst(d.queuedAt),
          },
          {
            id: 'channel',
            header: t('engine.log.columns.channel'),
            cell: (d) => t(`engine.channel.${d.channel}`),
          },
          {
            id: 'recipient',
            header: t('engine.log.columns.recipient'),
            cell: (d) => (
              <div>
                <p className="text-sm text-ink">{d.recipient}</p>
                {d.recipient !== d.address && (
                  <p className="text-xs text-ink-secondary">{d.address}</p>
                )}
              </div>
            ),
          },
          {
            id: 'message',
            header: t('engine.log.columns.message'),
            className: 'max-w-80',
            cell: (d) => (
              <div>
                {d.subject && <p className="text-sm font-medium text-ink">{d.subject}</p>}
                <p className="line-clamp-2 text-xs text-ink-secondary">{d.text}</p>
              </div>
            ),
          },
          {
            id: 'status',
            header: t('engine.log.columns.status'),
            cell: (d) => (
              <div className="space-y-1">
                <StatusPill tone={TONE[d.status]}>{t(`engine.log.state.${d.status}`)}</StatusPill>
                <p className="text-xs text-ink-secondary">
                  {t('engine.log.attempts', { count: d.attempts })}
                </p>
              </div>
            ),
          },
          {
            id: 'rule',
            header: t('engine.log.columns.rule'),
            cell: (d) => d.rule?.name ?? t('engine.log.noRule'),
          },
          {
            id: 'outcome',
            header: t('engine.log.columns.outcome'),
            className: 'max-w-64',
            cell: (d) => (
              <span className="line-clamp-2 text-xs text-ink-secondary">
                {d.error ?? d.providerRef ?? ''}
              </span>
            ),
          },
          {
            id: 'actions',
            header: t('masters.actions'),
            align: 'right',
            cell: (d) =>
              d.retriable &&
              can(access, 'admin.notification-engine', 'edit') && (
                <Button
                  variant="secondary"
                  aria-label={t('engine.log.retryFor', { recipient: d.recipient })}
                  onClick={() => void retry(d)}
                >
                  {t('engine.log.retry')}
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}
