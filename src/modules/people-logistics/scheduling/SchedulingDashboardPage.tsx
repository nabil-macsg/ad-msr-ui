import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useListParams } from '../../../shared/lists/list-params';
import { formatGst, formatGstDate, formatGstTime, gstDayKey } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { type Column, DataTable } from '../../../shared/ui/data-table';
import { Field } from '../../../shared/ui/field';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { setFilter } from '../../administration/masters/filters';
import { type Journey, listJourneys, useSchedulingDashboard } from './scheduling-api';

const TAB_CLASS =
  'min-h-touch border-b-2 border-transparent px-4 text-sm font-semibold text-ink-secondary aria-pressed:border-primary aria-pressed:text-ink';
const STATUS_TONE: Partial<Record<Journey['status'], Tone>> = {
  scheduled: 'info',
  delayed: 'warning',
  cancelled: 'danger',
  departed: 'info',
  arrived: 'success',
  closed: 'neutral',
};
const FLAG_TONE: Readonly<Record<Journey['flags'][number], Tone>> = {
  'no-time': 'warning',
  'no-resource': 'warning',
  'resource-maintenance': 'danger',
  'resource-overlap': 'danger',
};
const day = (iso: string) => formatGstDate(`${iso}T12:00:00+04:00`);

/**
 * Scheduling Dashboard (spec 20 §2.1): what is published for Booking, by day and mode, departure
 * first, with the fleet conflicts that need a look (SCH-R8).
 */
export default function SchedulingDashboardPage() {
  const { t } = useTranslation();
  const dashboard = useSchedulingDashboard();
  const today = gstDayKey(new Date());
  const { params, update, apiQuery } = useListParams({
    filters: { from: today, to: today },
  });
  const date = params.filters.from ?? today;
  const list = useQuery({
    queryKey: ['/api/v1/scheduling/journeys', apiQuery],
    queryFn: () => listJourneys(apiQuery),
    placeholderData: keepPreviousData,
  });
  const k = dashboard.data?.kpis;
  const listParams = { params, update };
  const setDay = (value: string) =>
    update({ filters: { ...params.filters, from: value || today, to: value || today } });

  const columns: readonly Column<Journey>[] = [
    {
      id: 'departure',
      header: t('scheduling.journeys.departure'),
      sortField: 'departure',
      cell: (j) =>
        j.departureAt ? (
          <span className="font-semibold text-ink">{formatGstTime(j.departureAt)}</span>
        ) : (
          <span className="text-ink-secondary">—</span>
        ),
    },
    {
      id: 'flight',
      header: t('scheduling.columns.flight'),
      sortField: 'flightNumber',
      cell: (j) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-mono text-sm font-semibold text-ink">{j.flightNumber}</span>
          <span className="font-mono text-xs text-ink-secondary">{j.source.ref}</span>
          {j.flags.map((flag) => (
            <StatusPill key={flag} tone={FLAG_TONE[flag]}>
              {t(`scheduling.journeys.flag.${flag}`)}
            </StatusPill>
          ))}
          {j.weather && (
            <>
              <StatusPill tone={j.weather.level === 'adverse' ? 'danger' : 'warning'}>
                {t('scheduling.weather.at', {
                  level: t(`scheduling.weather.level.${j.weather.level}`),
                  location: j.weather.location.code,
                })}
              </StatusPill>
              <span className="text-xs text-ink-secondary">{j.weather.summary}</span>
            </>
          )}
          {j.compatibility && j.compatibility.outcome !== 'ok' && (
            <>
              <StatusPill tone={j.compatibility.outcome === 'block' ? 'danger' : 'warning'}>
                {t('scheduling.journeys.helideckFlag')}
              </StatusPill>
              <ul className="text-xs text-ink-secondary">
                {j.compatibility.reasons.map((r) => (
                  <li key={`${r.location.id}-${r.code}`}>{r.message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ),
    },
    {
      id: 'route',
      header: t('scheduling.columns.route'),
      cell: (j) => (
        <div>
          <p className="text-ink">{j.route.stops.map((s) => s.code).join(' → ')}</p>
          <p className="text-xs text-ink-secondary">
            {t(`scheduling.mode.${j.mode}`)}
            {j.fleet ? ` · ${j.fleet.registration}` : ''}
          </p>
        </div>
      ),
    },
    {
      id: 'arrival',
      header: t('scheduling.journeys.arrival'),
      cell: (j) => (j.arrivalAt ? formatGstTime(j.arrivalAt) : '—'),
    },
    {
      id: 'seats',
      header: t('scheduling.journeys.seats'),
      align: 'right',
      cell: (j) => (
        <div>
          <p>
            {j.seats.booked} / {j.seats.capacity ?? '—'}
          </p>
          {(j.seats.pending > 0 || j.seats.waitlisted > 0) && (
            <p className="text-xs text-ink-secondary">
              {t('scheduling.journeys.demand', {
                pending: j.seats.pending,
                waitlisted: j.seats.waitlisted,
              })}
            </p>
          )}
          {j.seats.quota !== null && (
            <p className="text-xs text-ink-secondary">
              {t('scheduling.journeys.quota', { count: j.seats.quota })}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'cutoff',
      header: t('scheduling.journeys.cutoff'),
      cell: (j) => (j.cutoffAt ? formatGst(j.cutoffAt) : t('scheduling.journeys.noCutoff')),
    },
    {
      id: 'status',
      header: t('masters.status'),
      cell: (j) => (
        <StatusPill tone={STATUS_TONE[j.status] ?? 'neutral'}>
          {t(`scheduling.journeys.status.${j.status}`)}
        </StatusPill>
      ),
    },
    { id: 'gate', header: t('scheduling.journeys.gate'), cell: (j) => j.gate ?? '—' },
  ];

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title={t('scheduling.dashboard.title')}
        subtitle={t('scheduling.dashboard.subtitle')}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title={t('scheduling.dashboard.kpi.schedules')}
          value={k?.activeRecurringSchedules ?? '—'}
          to="/scheduling/recurring"
        />
        <StatCard
          title={t('scheduling.dashboard.kpi.adhoc')}
          value={k?.activeAdhocMovements ?? '—'}
        />
        <StatCard
          title={t('scheduling.dashboard.kpi.unassignedFleet')}
          value={k?.unassignedFleetResources ?? '—'}
          subline={t('scheduling.dashboard.kpi.nextWeek')}
        />
        <StatCard
          title={t('scheduling.dashboard.kpi.published')}
          value={k?.movementsPublished ?? '—'}
          subline={t('scheduling.dashboard.kpi.horizon')}
        />
        <StatCard
          title={t('scheduling.dashboard.kpi.withoutTime')}
          value={k?.journeysWithoutDepartureTime ?? '—'}
          to="/scheduling/board"
          {...((k?.journeysWithoutDepartureTime ?? 0) > 0 ? { tone: 'warning' as const } : {})}
        />
        <StatCard
          title={t('scheduling.dashboard.kpi.needingRoute')}
          value={k?.requestsNeedingRoute ?? '—'}
          subline={t('scheduling.dashboard.kpi.needingRouteHint')}
          to="/scheduling/requests?filter[kind]=no-route"
          {...((k?.requestsNeedingRoute ?? 0) > 0 ? { tone: 'warning' as const } : {})}
        />
        <StatCard
          title={t('scheduling.dashboard.kpi.compatibility')}
          value={k?.compatibilityFlags ?? '—'}
          subline={t('scheduling.dashboard.kpi.compatibilityHint')}
          {...((k?.compatibilityFlags ?? 0) > 0 ? { tone: 'warning' as const } : {})}
        />
      </div>
      {(dashboard.data?.conflicts.length ?? 0) > 0 && (
        <Banner tone="warning" title={t('scheduling.dashboard.conflicts')}>
          <ul className="list-disc space-y-1 pl-5">
            {dashboard.data?.conflicts.slice(0, 8).map((c) => (
              <li key={`${c.kind}-${c.fleet.id}-${c.serviceDate}`}>
                {t(`scheduling.dashboard.conflict.${c.kind}`, {
                  fleet: c.fleet.registration,
                  date: day(c.serviceDate),
                  journeys: c.journeys.map((j) => j.flightNumber).join(', '),
                })}
              </li>
            ))}
          </ul>
        </Banner>
      )}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border">
          <div role="group" aria-label={t('scheduling.dashboard.modes')} className="flex gap-2">
            {/* All first, then every active category by name, with journeys today or not. */}
            {[
              { code: 'all', name: t('scheduling.dashboard.all') },
              ...(dashboard.data?.categories ?? []),
            ].map((c) => (
              <button
                key={c.code}
                type="button"
                aria-pressed={(params.filters.category ?? 'all') === c.code}
                className={TAB_CLASS}
                onClick={() =>
                  setFilter(listParams, 'category', c.code === 'all' ? undefined : c.code)
                }
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="pb-2">
            <Field
              type="date"
              label={t('scheduling.dashboard.day')}
              value={date}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
        </div>
        {list.isError && (
          <Banner tone="danger">
            {list.error instanceof Error ? list.error.message : t('masters.loadFailed')}
          </Banner>
        )}
        <DataTable
          caption={t('scheduling.dashboard.table', { date: day(date) })}
          columns={columns}
          rows={list.data?.items}
          total={list.data?.total}
          rowKey={(j) => j.id}
          params={params}
          onParamsChange={update}
          loading={list.isFetching}
          emptyTitle={t('scheduling.dashboard.empty')}
        />
      </div>
    </section>
  );
}
