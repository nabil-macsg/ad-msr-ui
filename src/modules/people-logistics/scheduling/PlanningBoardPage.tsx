import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { formatGst, formatGstLongDay, formatGstTime, gstDayKey } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { CalendarMonth, CalendarWeek } from '../../../shared/ui/calendar';
import { Drawer } from '../../../shared/ui/drawer';
import { Field } from '../../../shared/ui/field';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatusPill } from '../../../shared/ui/status-pill';
import { type BoardView, boardRange, canGiveTime, journeyEvent } from './planning-board';
import {
  assignDepartureTime,
  BOARD_PATH,
  type Journey,
  listJourneys,
  usePlanningBoard,
} from './scheduling-api';

const TAB_CLASS =
  'min-h-touch border-b-2 border-transparent px-4 text-sm font-semibold text-ink-secondary aria-pressed:border-primary aria-pressed:text-ink';
const JOURNEYS_PATH = '/api/v1/scheduling/journeys';
const UNTIMED_PAGE = 8;
const routeOf = (j: Journey) => j.route.stops.map((s) => s.code).join(' → ');

/**
 * Planning Board (spec 20 §2.1): the month and week calendar of planned journeys, with NCM
 * weather (SCH-R7), and departure times for the journeys planned without one (A.3.3-03).
 */
export default function PlanningBoardPage() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const canEdit = can(access, 'scheduling.board', 'edit');
  const queryClient = useQueryClient();
  const today = gstDayKey(new Date());
  const [view, setView] = useState<BoardView>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Journey | null>(null);
  const [untimedPage, setUntimedPage] = useState(1);

  const range = boardRange(view, anchor);
  const board = usePlanningBoard({ ...range, category });
  const untimedQuery = {
    'filter[from]': today,
    'filter[flag]': 'no-time',
    ...(category ? { 'filter[category]': category } : {}),
    page: untimedPage,
    pageSize: UNTIMED_PAGE,
  };
  const untimed = useQuery({
    queryKey: [JOURNEYS_PATH, 'untimed', untimedQuery],
    queryFn: () => listJourneys(untimedQuery),
    placeholderData: keepPreviousData,
  });

  const journeys = board.data?.journeys ?? [];
  const weatherLabel = (level: NonNullable<Journey['weather']>['level']) =>
    t(`scheduling.weather.level.${level}`);
  const events = journeys.map((j) => journeyEvent(j, weatherLabel));
  const open = (id: string) => setSelected(journeys.find((j) => j.id === id) ?? null);
  const saved = async (journey: Journey) => {
    setSelected(journey);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [BOARD_PATH] }),
      queryClient.invalidateQueries({ queryKey: [JOURNEYS_PATH] }),
      queryClient.invalidateQueries({ queryKey: ['/api/v1/scheduling/dashboard'] }),
    ]);
  };
  const showDay = (day: Date) => {
    setView('week');
    setAnchor(day);
  };
  const untimedTotal = untimed.data?.total ?? 0;

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader title={t('scheduling.board.title')} subtitle={t('scheduling.board.subtitle')} />
      {board.data && !board.data.weather.available && (
        <Banner tone="warning">{t('scheduling.weather.unavailable')}</Banner>
      )}
      {board.isError && (
        <Banner tone="danger">
          {board.error instanceof Error ? board.error.message : t('masters.loadFailed')}
        </Banner>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border">
        <div role="group" aria-label={t('scheduling.dashboard.modes')} className="flex gap-2">
          {/* All first, then every active category by name, as on the dashboard. */}
          {[
            { code: 'all', name: t('scheduling.dashboard.all') },
            ...(board.data?.categories ?? []),
          ].map((c) => (
            <button
              key={c.code}
              type="button"
              aria-pressed={(category ?? 'all') === c.code}
              className={TAB_CLASS}
              onClick={() => {
                setCategory(c.code === 'all' ? undefined : c.code);
                setUntimedPage(1);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t('scheduling.board.view')} className="flex gap-2">
          {(['month', 'week'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={TAB_CLASS}
              onClick={() => setView(v)}
            >
              {t(`scheduling.board.${v}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3" aria-busy={board.isFetching}>
          {view === 'month' ? (
            <CalendarMonth
              month={anchor}
              events={events}
              onMonthChange={setAnchor}
              onSelect={open}
              onMore={showDay}
            />
          ) : (
            <CalendarWeek week={anchor} events={events} onWeekChange={setAnchor} onSelect={open} />
          )}
          <ul className="flex flex-wrap gap-3 text-xs text-ink-secondary">
            <li>
              <StatusPill tone="info">{t('scheduling.board.legend.planned')}</StatusPill>
            </li>
            <li>
              <StatusPill tone="warning">{t('scheduling.board.legend.attention')}</StatusPill>
            </li>
            <li>
              <StatusPill tone="danger">{t('scheduling.board.legend.adverse')}</StatusPill>
            </li>
            <li>
              <StatusPill tone="neutral">{t('scheduling.board.legend.cancelled')}</StatusPill>
            </li>
          </ul>
          {board.data && (
            <p className="text-xs text-ink-secondary">
              {t('scheduling.weather.window', {
                from: formatGstLongDay(board.data.weather.from),
                to: formatGstLongDay(board.data.weather.to),
              })}
            </p>
          )}
        </div>

        <section
          aria-labelledby="untimed-title"
          className="h-fit rounded-lg bg-card p-4 shadow-card"
        >
          <h2 id="untimed-title" className="text-base font-semibold text-ink">
            {t('scheduling.board.untimed', { count: untimedTotal })}
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">{t('scheduling.board.untimedHint')}</p>
          {untimed.isError && (
            <Banner tone="danger" className="mt-3">
              {untimed.error instanceof Error ? untimed.error.message : t('masters.loadFailed')}
            </Banner>
          )}
          {untimed.data && untimed.data.items.length === 0 ? (
            <p className="mt-4 text-sm text-ink-secondary">{t('scheduling.board.untimedNone')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {untimed.data?.items.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-ink">{j.flightNumber}</p>
                    <p className="truncate text-xs text-ink-secondary">
                      {formatGstLongDay(j.serviceDate)} · {routeOf(j)}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setSelected(j)}>
                    {canEdit ? t('scheduling.board.giveTimeShort') : t('scheduling.board.details')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {untimedTotal > UNTIMED_PAGE && (
            <div className="mt-3 flex items-center justify-between text-sm text-ink-secondary">
              <Button
                variant="ghost"
                disabled={untimedPage === 1}
                onClick={() => setUntimedPage((p) => p - 1)}
              >
                {t('ui.calendar.previous')}
              </Button>
              <span>
                {t('scheduling.board.page', {
                  page: untimedPage,
                  pages: Math.ceil(untimedTotal / UNTIMED_PAGE),
                })}
              </span>
              <Button
                variant="ghost"
                disabled={untimedPage * UNTIMED_PAGE >= untimedTotal}
                onClick={() => setUntimedPage((p) => p + 1)}
              >
                {t('ui.calendar.next')}
              </Button>
            </div>
          )}
        </section>
      </div>

      {selected && (
        <JourneyDrawer
          journey={selected}
          editable={canEdit && canGiveTime(selected, today)}
          onClose={() => setSelected(null)}
          onSaved={(j) => void saved(j)}
        />
      )}
    </section>
  );
}

function JourneyDrawer({
  journey: j,
  editable,
  onClose,
  onSaved,
}: {
  journey: Journey;
  editable: boolean;
  onClose: () => void;
  onSaved: (journey: Journey) => void;
}) {
  const { t } = useTranslation();
  const timedBySchedule = j.departureAt !== null && !j.departureAssigned;
  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${j.flightNumber} · ${formatGstLongDay(j.serviceDate)}`}
      description={j.route.stops.map((s) => s.name).join(' → ')}
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-secondary">{t('scheduling.journeys.departure')}</dt>
          <dd className="text-ink">
            {j.departureAt ? formatGstTime(j.departureAt) : t('scheduling.recurring.noTime')}
            {j.departureAssigned && (
              <span className="block text-xs text-ink-secondary">
                {t('scheduling.board.givenHere')}
              </span>
            )}
          </dd>
          <dt className="text-ink-secondary">{t('scheduling.journeys.arrival')}</dt>
          <dd className="text-ink">{j.arrivalAt ? formatGstTime(j.arrivalAt) : '—'}</dd>
          <dt className="text-ink-secondary">{t('scheduling.columns.mode')}</dt>
          <dd className="text-ink">
            {t(`scheduling.mode.${j.mode}`)} · {j.resourceType.name}
            {j.fleet ? ` · ${j.fleet.registration}` : ` · ${t('scheduling.recurring.unassigned')}`}
          </dd>
          <dt className="text-ink-secondary">{t('scheduling.columns.operator')}</dt>
          <dd className="text-ink">{j.serviceProvider.name}</dd>
          <dt className="text-ink-secondary">{t('scheduling.board.source')}</dt>
          <dd className="font-mono text-ink">{j.source.ref}</dd>
          <dt className="text-ink-secondary">{t('scheduling.journeys.cutoff')}</dt>
          <dd className="text-ink">
            {j.cutoffAt ? formatGst(j.cutoffAt) : t('scheduling.journeys.noCutoff')}
          </dd>
          <dt className="text-ink-secondary">{t('masters.status')}</dt>
          <dd>
            <StatusPill tone={j.status === 'cancelled' ? 'danger' : 'info'}>
              {t(`scheduling.journeys.status.${j.status}`)}
            </StatusPill>
          </dd>
        </dl>

        {j.weather && (
          <Banner
            tone={j.weather.level === 'adverse' ? 'danger' : 'warning'}
            title={t('scheduling.weather.at', {
              level: t(`scheduling.weather.level.${j.weather.level}`),
              location: j.weather.location.name,
            })}
          >
            <p>{j.weather.summary}</p>
            {j.weather.recommendation && <p className="mt-1">{j.weather.recommendation}</p>}
            <p className="mt-1 text-xs">{t('scheduling.weather.advice')}</p>
          </Banner>
        )}
        {(j.flags.length > 0 || (j.compatibility && j.compatibility.outcome !== 'ok')) && (
          <div className="flex flex-wrap gap-2">
            {j.flags.map((flag) => (
              <StatusPill key={flag} tone="warning">
                {t(`scheduling.journeys.flag.${flag}`)}
              </StatusPill>
            ))}
            {j.compatibility && j.compatibility.outcome !== 'ok' && (
              <StatusPill tone="warning">{t('scheduling.journeys.helideckFlag')}</StatusPill>
            )}
          </div>
        )}

        {editable ? (
          <DepartureTimeForm journey={j} onSaved={onSaved} />
        ) : (
          timedBySchedule && (
            <p className="text-sm text-ink-secondary">
              {t('scheduling.board.timedBySchedule', { ref: j.source.ref })}{' '}
              {j.source.kind === 'recurring' && (
                <Link
                  to="/scheduling/recurring"
                  className="text-link underline-offset-4 hover:underline"
                >
                  {t('scheduling.recurring.title')}
                </Link>
              )}
            </p>
          )
        )}
      </div>
    </Drawer>
  );
}

const fromInstant = (iso: string | null) => (iso ? formatGstTime(iso) : '');

function DepartureTimeForm({
  journey,
  onSaved,
}: {
  journey: Journey;
  onSaved: (journey: Journey) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [departure, setDeparture] = useState(fromInstant(journey.departureAt));
  const [arrival, setArrival] = useState(fromInstant(journey.arrivalAt));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departure)) {
      setProblem(t('scheduling.board.departureRequired'));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      onSaved(
        await assignDepartureTime(journey, {
          departureTime: departure,
          arrivalTime: arrival || null,
        }),
      );
    } catch (error) {
      setProblem(error instanceof Error ? error.message : t('ui.confirm.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      id={id}
      onSubmit={(e) => void submit(e)}
      noValidate
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <h3 className="text-base font-semibold text-ink">
        {journey.departureAssigned
          ? t('scheduling.board.changeTime')
          : t('scheduling.board.giveTime')}
      </h3>
      {problem && <Banner tone="danger">{problem}</Banner>}
      <div className="grid grid-cols-2 gap-3">
        <Field
          type="time"
          label={t('scheduling.form.departure')}
          value={departure}
          required
          onChange={(e) => setDeparture(e.target.value)}
        />
        <Field
          type="time"
          label={t('scheduling.board.arrivalOptional')}
          value={arrival}
          onChange={(e) => setArrival(e.target.value)}
        />
      </div>
      <p className="text-xs text-ink-secondary">{t('scheduling.board.timeHint')}</p>
      <Button type="submit" disabled={busy}>
        {t('scheduling.board.save')}
      </Button>
    </form>
  );
}
