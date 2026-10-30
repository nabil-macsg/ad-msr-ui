import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  CalendarRange,
  CalendarX2,
  Clock,
  Plane,
  Route,
  ShieldAlert,
  SquarePlus,
  Wrench,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../shared/lib/cn';
import { useListParams } from '../../../shared/lists/list-params';
import { formatGst, formatGstDate, formatGstTime, gstDayKey } from '../../../shared/time/format';
import { ModeIcon, ModeLabel, RouteStops } from '../../../shared/ui/transport';
import { type AttentionItem, AttentionPanel, KpiGroup } from '../../../shared/ui/attention-panel';
import { Banner } from '../../../shared/ui/banner';
import { type Column, DataTable } from '../../../shared/ui/data-table';
import { Field } from '../../../shared/ui/field';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { setFilter } from '../../administration/masters/filters';
import { type Journey, listJourneys, useSchedulingDashboard } from './scheduling-api';
import { TAB } from '../../../shared/ui/tab-styles';

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
/** A card only turns amber when there is something to look at. */
const warnIf = (count: number | undefined) =>
  (count ?? 0) > 0 ? { tone: 'warning' as const } : {};
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
  // The day's journeys in every category, for the counts on the mode tabs.
  const dayJourneys = useQuery({
    queryKey: ['/api/v1/scheduling/journeys', 'counts', date],
    queryFn: () =>
      listJourneys({ page: 1, pageSize: 100, 'filter[from]': date, 'filter[to]': date }),
  });
  const countOf = (code: string) =>
    code === 'all'
      ? (dayJourneys.data?.total ?? 0)
      : (dayJourneys.data?.items.filter((j) => j.category === code).length ?? 0);
  const k = dashboard.data?.kpis;
  const listParams = { params, update };
  const setDay = (value: string) =>
    update({ filters: { ...params.filters, from: value || today, to: value || today } });

  // The fleet conflicts (SCH-R8) that need a look.
  const conflicts = (dashboard.data?.conflicts ?? []).map((c): AttentionItem => ({
    key: `${c.kind}-${c.fleet.id}-${c.serviceDate}`,
    icon: c.kind === 'maintenance' ? Wrench : CalendarX2,
    tone: c.kind === 'maintenance' ? 'danger' : 'warning',
    text: t(`scheduling.dashboard.conflict.${c.kind}`, {
      fleet: c.fleet.registration,
      date: day(c.serviceDate),
      journeys: c.journeys.map((j) => j.flightNumber).join(', '),
    }),
    pill: t(`scheduling.dashboard.conflictKind.${c.kind}`),
  }));

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
          <RouteStops stops={j.route.stops.map((s) => s.code)} className="font-medium text-ink" />
          <p className="mt-0.5 text-xs text-ink-secondary">
            <ModeLabel mode={j.mode} label={t(`scheduling.mode.${j.mode}`)} />
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
          <p
            className={cn(
              'font-semibold',
              j.seats.capacity === null
                ? 'text-ink'
                : j.seats.booked >= j.seats.capacity
                  ? 'text-danger-fg'
                  : j.seats.booked >= j.seats.capacity * 0.85
                    ? 'text-warning-fg'
                    : 'text-success-fg',
            )}
          >
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
      <div className="space-y-5">
        <KpiGroup label={t('scheduling.dashboard.overview')} className="sm:grid-cols-3">
          <StatCard
            title={t('scheduling.dashboard.kpi.schedules')}
            value={k?.activeRecurringSchedules ?? '—'}
            icon={<CalendarRange className="size-4" aria-hidden />}
            to="/scheduling/recurring"
          />
          <StatCard
            title={t('scheduling.dashboard.kpi.adhoc')}
            value={k?.activeAdhocMovements ?? '—'}
            icon={<SquarePlus className="size-4" aria-hidden />}
          />
          <StatCard
            title={t('scheduling.dashboard.kpi.published')}
            value={k?.movementsPublished ?? '—'}
            subline={t('scheduling.dashboard.kpi.horizon')}
            icon={<CalendarCheck className="size-4" aria-hidden />}
          />
        </KpiGroup>
        <KpiGroup
          label={t('scheduling.dashboard.attention')}
          className="sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            title={t('scheduling.dashboard.kpi.unassignedFleet')}
            value={k?.unassignedFleetResources ?? '—'}
            subline={t('scheduling.dashboard.kpi.nextWeek')}
            icon={<Plane className="size-4" aria-hidden />}
            {...warnIf(k?.unassignedFleetResources)}
          />
          <StatCard
            title={t('scheduling.dashboard.kpi.withoutTime')}
            value={k?.journeysWithoutDepartureTime ?? '—'}
            icon={<Clock className="size-4" aria-hidden />}
            to="/scheduling/board"
            {...warnIf(k?.journeysWithoutDepartureTime)}
          />
          <StatCard
            title={t('scheduling.dashboard.kpi.needingRoute')}
            value={k?.requestsNeedingRoute ?? '—'}
            subline={t('scheduling.dashboard.kpi.needingRouteHint')}
            icon={<Route className="size-4" aria-hidden />}
            to="/scheduling/requests?filter[kind]=no-route"
            {...warnIf(k?.requestsNeedingRoute)}
          />
          <StatCard
            title={t('scheduling.dashboard.kpi.compatibility')}
            value={k?.compatibilityFlags ?? '—'}
            subline={t('scheduling.dashboard.kpi.compatibilityHint')}
            icon={<ShieldAlert className="size-4" aria-hidden />}
            {...warnIf(k?.compatibilityFlags)}
          />
        </KpiGroup>
      </div>
      <AttentionPanel title={t('scheduling.dashboard.conflicts')} items={conflicts} />
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border">
          <div role="group" aria-label={t('scheduling.dashboard.modes')} className="flex gap-1">
            {/* All first, then every active category by name, with journeys today or not. */}
            {[
              { code: 'all', name: t('scheduling.dashboard.all'), baseMode: null },
              ...(dashboard.data?.categories ?? []),
            ].map((c) => {
              const active = (params.filters.category ?? 'all') === c.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={active}
                  className={TAB}
                  onClick={() =>
                    setFilter(listParams, 'category', c.code === 'all' ? undefined : c.code)
                  }
                >
                  {c.baseMode && <ModeIcon mode={c.baseMode} className="size-4" />}
                  {c.name}
                  <span
                    className={cn(
                      'min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold tabular-nums',
                      active ? 'bg-primary text-on-primary' : 'bg-surface-muted text-ink-muted',
                    )}
                    aria-hidden
                  >
                    {countOf(c.code)}
                  </span>
                </button>
              );
            })}
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
