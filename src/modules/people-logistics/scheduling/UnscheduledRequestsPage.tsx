import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { useListParams } from '../../../shared/lists/list-params';
import { formatGstDate, gstDayKey } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { type Column, DataTable } from '../../../shared/ui/data-table';
import { Field } from '../../../shared/ui/field';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { setFilter } from '../../administration/masters/filters';
import { listUnscheduled, type UnscheduledRequest, UNSCHEDULED_PATH } from './scheduling-api';

const TAB_CLASS =
  'min-h-touch border-b-2 border-transparent px-4 text-sm font-semibold text-ink-secondary aria-pressed:border-primary aria-pressed:text-ink';
const KINDS = ['no-route', 'no-movement'] as const;
const CRITICALITY_TONE: Readonly<Record<UnscheduledRequest['criticality'], Tone>> = {
  normal: 'neutral',
  urgent: 'warning',
  vital: 'danger',
};
const day = (iso: string) => formatGstDate(`${iso}T12:00:00+04:00`);
const linkClass = 'text-sm font-semibold text-link underline-offset-4 hover:underline';

/**
 * Unscheduled requests (spec 20 §2.1, A.2.3.2-10, A.3.3-05): requests for a route or a day with
 * no movement, for the Aviation Team to set up a schedule or an ad hoc movement.
 */
export default function UnscheduledRequestsPage() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const canSchedule = can(access, 'scheduling.recurring', 'create');
  const canAdhoc = can(access, 'scheduling.adhoc', 'create');
  const today = gstDayKey(new Date());
  const { params, update, apiQuery } = useListParams({ filters: { from: today } });
  const list = useQuery({
    queryKey: [UNSCHEDULED_PATH, apiQuery],
    queryFn: () => listUnscheduled(apiQuery),
    placeholderData: keepPreviousData,
  });
  const listParams = { params, update };
  // Requests chosen to share one ad hoc movement (spec 20 §2.1 consolidation).
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const toggle = (id: string) =>
    setChosen((now) => (now.includes(id) ? now.filter((c) => c !== id) : [...now, id]));

  const columns: readonly Column<UnscheduledRequest>[] = [
    ...(canAdhoc
      ? [
          {
            id: 'choose',
            header: t('scheduling.requests.choose'),
            cell: (r: UnscheduledRequest) => (
              <input
                type="checkbox"
                aria-label={t('scheduling.requests.chooseOne', { ref: r.ref })}
                checked={chosen.includes(r.id)}
                onChange={() => toggle(r.id)}
              />
            ),
          },
        ]
      : []),
    {
      id: 'travelDate',
      header: t('scheduling.requests.travelDate'),
      sortField: 'travelDate',
      cell: (r) => (
        <div>
          <p className="font-semibold text-ink">{day(r.travelDate)}</p>
          {r.requestedTime && (
            <p className="text-xs text-ink-secondary">
              {t('scheduling.requests.at', { time: r.requestedTime })}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'request',
      header: t('scheduling.requests.request'),
      cell: (r) => (
        <div>
          <p className="text-ink">{r.person.name}</p>
          <p className="font-mono text-xs text-ink-secondary">
            {r.ref} · {r.person.personnelNo}
          </p>
          <p className="text-xs text-ink-secondary">
            {r.category.name} · {r.reason.description}
          </p>
        </div>
      ),
    },
    {
      id: 'route',
      header: t('scheduling.requests.asked'),
      cell: (r) => (
        <div>
          <p className="text-ink">
            {r.origin.code} → {r.destination.code}
          </p>
          <p className="text-xs text-ink-secondary">
            {r.origin.name} → {r.destination.name}
          </p>
        </div>
      ),
    },
    {
      id: 'criticality',
      header: t('scheduling.requests.criticality'),
      cell: (r) => (
        <StatusPill tone={CRITICALITY_TONE[r.criticality]}>
          {t(`scheduling.requests.critical.${r.criticality}`)}
        </StatusPill>
      ),
    },
    {
      id: 'missing',
      header: t('scheduling.requests.missing'),
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill tone={r.kind === 'no-route' ? 'danger' : 'warning'}>
            {t(`scheduling.requests.kind.${r.kind}`)}
          </StatusPill>
          {r.route && <span className="font-mono text-xs text-ink-secondary">{r.route.code}</span>}
        </div>
      ),
    },
    {
      id: 'actions',
      header: t('scheduling.requests.actions'),
      cell: (r) =>
        r.route ? (
          <div className="flex flex-col items-start gap-1">
            {canAdhoc && (
              <Link className={linkClass} to={`/scheduling/adhoc?requests=${r.id}`}>
                {t('scheduling.requests.createAdhoc')}
              </Link>
            )}
            {canSchedule && (
              <Link
                className={linkClass}
                to={`/scheduling/recurring?new=1&route=${r.route.id}&from=${r.travelDate}`}
              >
                {t('scheduling.requests.setUpSchedule')}
              </Link>
            )}
          </div>
        ) : (
          <span className="text-xs text-ink-secondary">{t('scheduling.requests.needsRoute')}</span>
        ),
    },
  ];

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title={t('scheduling.requests.title')}
        subtitle={t('scheduling.requests.subtitle')}
      />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border">
        <div role="group" aria-label={t('scheduling.requests.missing')} className="flex gap-2">
          {(['all', ...KINDS] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={(params.filters.kind ?? 'all') === k}
              className={TAB_CLASS}
              onClick={() => setFilter(listParams, 'kind', k === 'all' ? undefined : k)}
            >
              {k === 'all' ? t('scheduling.dashboard.all') : t(`scheduling.requests.kind.${k}`)}
            </button>
          ))}
        </div>
        <div className="pb-2">
          <Field
            type="date"
            label={t('scheduling.requests.from')}
            value={params.filters.from ?? today}
            onChange={(e) => setFilter(listParams, 'from', e.target.value || today)}
          />
        </div>
      </div>
      {list.isError && (
        <Banner tone="danger">
          {list.error instanceof Error ? list.error.message : t('masters.loadFailed')}
        </Banner>
      )}
      <DataTable
        caption={t('scheduling.requests.table')}
        columns={columns}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(r) => r.id}
        params={params}
        onParamsChange={update}
        loading={list.isFetching}
        emptyTitle={t('scheduling.requests.empty')}
        {...(canAdhoc
          ? {
              toolbar:
                chosen.length > 0 ? (
                  <Link className={linkClass} to={`/scheduling/adhoc?requests=${chosen.join(',')}`}>
                    {t('scheduling.requests.createFromChosen', { count: chosen.length })}
                  </Link>
                ) : (
                  <span className="text-sm text-ink-secondary">
                    {t('scheduling.requests.chooseHint')}
                  </span>
                ),
            }
          : {})}
      />
    </section>
  );
}
