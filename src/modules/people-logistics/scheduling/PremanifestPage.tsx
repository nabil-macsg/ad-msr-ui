import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { formatGst, formatGstLongDay, formatGstTime, gstDayKey } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { Field } from '../../../shared/ui/field';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import {
  adjustPremanifest,
  PREMANIFEST_PATH,
  type Premanifest,
  type PremanifestLine,
  publishPremanifest,
  refreshPremanifest,
  reservePremanifest,
  usePremanifest,
  usePremanifestDay,
} from './scheduling-api';

const DECISION_TONE: Readonly<Record<PremanifestLine['decision'], Tone>> = {
  manifest: 'success',
  waitlist: 'warning',
  'over-cap': 'danger',
  excluded: 'neutral',
};
const tomorrow = () => gstDayKey(new Date(Date.now() + 86_400_000));

/**
 * Pre-manifest (spec 20 §2.1, BRD A.3.3-13/14/18/19/24): per journey, who gets a seat in what
 * order, suggested at the lead time; the Aviation Team reviews, adjusts and publishes it.
 */
export default function PremanifestPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useSearchParams();
  const date = search.get('date') ?? tomorrow();
  const journeyId = search.get('journey');
  const day = usePremanifestDay(date);
  const pick = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSearch(next, { replace: true });
  };

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title={t('scheduling.premanifest.title')}
        subtitle={t('scheduling.premanifest.subtitle')}
      />
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <section
          aria-labelledby="journeys-title"
          className="h-fit space-y-3 rounded-lg bg-card p-4 shadow-card"
        >
          <h2 id="journeys-title" className="text-base font-semibold text-ink">
            {t('scheduling.premanifest.journeys')}
          </h2>
          <Field
            type="date"
            label={t('scheduling.dashboard.day')}
            value={date}
            onChange={(e) => pick({ date: e.target.value || tomorrow(), journey: null })}
          />
          {day.isError && (
            <Banner tone="danger">
              {day.error instanceof Error ? day.error.message : t('masters.loadFailed')}
            </Banner>
          )}
          {day.data && day.data.items.length === 0 && (
            <p className="text-sm text-ink-secondary">{t('scheduling.premanifest.none')}</p>
          )}
          <ul className="divide-y divide-border">
            {day.data?.items.map(({ journey: j, run, dueAt }) => (
              <li key={j.id}>
                <button
                  type="button"
                  aria-current={journeyId === j.id ? 'true' : undefined}
                  onClick={() => pick({ journey: j.id })}
                  className="w-full py-2 text-left aria-[current=true]:font-semibold"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-ink">{j.flightNumber}</span>
                    <StatusPill
                      tone={run ? (run.status === 'published' ? 'success' : 'info') : 'neutral'}
                    >
                      {run
                        ? t(`scheduling.premanifest.status.${run.status}`)
                        : t('scheduling.premanifest.status.none')}
                    </StatusPill>
                  </span>
                  <span className="block text-xs text-ink-secondary">
                    {j.departureAt ? formatGstTime(j.departureAt) : t('ui.calendar.noTime')} ·{' '}
                    {j.route.stops.map((s) => s.code).join(' → ')}
                  </span>
                  <span className="block text-xs text-ink-secondary">
                    {run
                      ? t('scheduling.premanifest.counts', {
                          manifest: run.counts.manifest,
                          capacity: run.capacity,
                          waitlist: run.counts.waitlist,
                        })
                      : t('scheduling.premanifest.dueAt', { at: formatGst(dueAt) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {journeyId ? (
          <JourneyPremanifest journeyId={journeyId} />
        ) : (
          <p className="text-sm text-ink-secondary">{t('scheduling.premanifest.choose')}</p>
        )}
      </div>
    </section>
  );
}

type Pending =
  { kind: 'refresh' } | { kind: 'publish' } | { kind: 'exclude'; line: PremanifestLine };

function JourneyPremanifest({ journeyId }: { journeyId: string }) {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const canSuggest = can(access, 'scheduling.premanifest', 'create');
  const canEdit = can(access, 'scheduling.premanifest', 'edit');
  const canReserve = (access?.capabilities ?? []).some((c) => c.key === 'booking.reserve-waitlist');
  const queryClient = useQueryClient();
  const premanifest = usePremanifest(journeyId);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reserve, setReserve] = useState<string | null>(null);

  const p = premanifest.data;
  const run = p?.run ?? null;
  const draft = run?.status === 'draft';
  const act = async (work: () => Promise<Premanifest>) => {
    setProblem(null);
    try {
      queryClient.setQueryData([PREMANIFEST_PATH, journeyId], await work());
      await queryClient.invalidateQueries({ queryKey: [PREMANIFEST_PATH, 'day'] });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  };
  const adjust = (body: Parameters<typeof adjustPremanifest>[2]) =>
    act(() => adjustPremanifest(journeyId, run?.version ?? 0, body));

  if (premanifest.isError) {
    return (
      <Banner tone="danger">
        {premanifest.error instanceof Error ? premanifest.error.message : t('masters.loadFailed')}
      </Banner>
    );
  }
  if (!p) return null;
  const j = p.journey;
  return (
    <section aria-labelledby="premanifest-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="premanifest-title" className="text-lg font-semibold text-ink">
            {j.flightNumber} · {formatGstLongDay(j.serviceDate)}
          </h2>
          <p className="text-sm text-ink-secondary">
            {j.route.stops.map((s) => s.name).join(' → ')} ·{' '}
            {j.departureAt ? formatGstTime(j.departureAt) : t('ui.calendar.noTime')} ·{' '}
            {j.fleet?.registration ?? j.resourceType.name}
          </p>
        </div>
        <div className="flex gap-2">
          {canSuggest && run?.status !== 'published' && (
            <Button
              variant="secondary"
              onClick={() =>
                run
                  ? setPending({ kind: 'refresh' })
                  : void act(() => refreshPremanifest(journeyId))
              }
            >
              {run ? t('scheduling.premanifest.refresh') : t('scheduling.premanifest.suggest')}
            </Button>
          )}
          {canEdit && draft && (
            <Button onClick={() => setPending({ kind: 'publish' })}>
              {t('scheduling.premanifest.publish')}
            </Button>
          )}
        </div>
      </div>

      {j.weather && (
        <Banner
          tone={j.weather.level === 'adverse' ? 'danger' : 'warning'}
          title={t('scheduling.weather.at', {
            level: t(`scheduling.weather.level.${j.weather.level}`),
            location: j.weather.location.name,
          })}
        >
          {j.weather.summary}
          {j.weather.recommendation ? ` ${j.weather.recommendation}` : ''}
        </Banner>
      )}
      {problem && <Banner tone="danger">{problem}</Banner>}
      {!run && (
        <Banner tone="info">
          {t('scheduling.premanifest.notYet', { at: formatGst(p.dueAt) })}
        </Banner>
      )}
      {run && (
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-card p-4 text-sm shadow-card md:grid-cols-5">
          {(
            [
              ['seats', run.capacity],
              ['seated', run.counts.manifest],
              ['waitlist', `${run.counts.waitlist} / ${run.waitlistCap}`],
              ['overCap', run.counts.overCap],
              ['reserve', run.reserveSeats],
            ] as const
          ).map(([key, value]) => (
            <div key={key}>
              <dt className="text-ink-secondary">{t(`scheduling.premanifest.summary.${key}`)}</dt>
              <dd className="text-lg font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {run && draft && canReserve && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act(() =>
              reservePremanifest(journeyId, run.version, Number(reserve ?? run.reserveSeats)),
            );
          }}
        >
          <Field
            type="number"
            min={0}
            max={run.capacity}
            label={t('scheduling.premanifest.reserveLabel')}
            value={reserve ?? String(run.reserveSeats)}
            onChange={(e) => setReserve(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            {t('scheduling.premanifest.reserveSave')}
          </Button>
        </form>
      )}
      {p.nonTimed && (
        <p className="text-sm text-ink-secondary">
          {t('scheduling.premanifest.nonTimed', {
            needing: p.nonTimed.needingService,
            here: p.nonTimed.allocatedHere,
          })}
        </p>
      )}

      {run && (
        <div className="overflow-x-auto rounded-lg bg-card shadow-card">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('scheduling.premanifest.table')}</caption>
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase text-ink-secondary">
                <th scope="col" className="px-3 py-2">
                  #
                </th>
                <th scope="col" className="px-3 py-2">
                  {t('scheduling.premanifest.passenger')}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t('scheduling.premanifest.category')}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t('scheduling.requests.asked')}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t('scheduling.premanifest.decision')}
                </th>
                {draft && canEdit && (
                  <th scope="col" className="px-3 py-2">
                    {t('scheduling.requests.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l, i) => (
                <tr key={l.id} className="border-b border-border align-top">
                  <td className="px-3 py-2 font-semibold text-ink">{l.rank}</td>
                  <td className="px-3 py-2">
                    <p className="text-ink">{l.person.name}</p>
                    <p className="font-mono text-xs text-ink-secondary">
                      {l.booking.ref} · {l.person.personnelNo}
                    </p>
                    {l.reassignment && (
                      <p className="text-xs text-ink-secondary">
                        {t('scheduling.premanifest.reassign', {
                          flight: l.reassignment.flightNumber,
                          kind: l.reassignment.category,
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <span>{l.category.name}</span>
                      {l.crewChange && (
                        <StatusPill tone="info">
                          {t('scheduling.premanifest.crewChange')}
                        </StatusPill>
                      )}
                      {l.vip && <StatusPill tone="accent">VIP</StatusPill>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {l.origin.code} → {l.destination.code}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill tone={DECISION_TONE[l.decision]}>
                      {t(`scheduling.premanifest.decisions.${l.decision}`)}
                    </StatusPill>
                    {l.reason && l.decision !== 'excluded' && (
                      <p className="text-xs text-ink-secondary">
                        {t(`scheduling.premanifest.reasons.${l.reason}`)}
                      </p>
                    )}
                    {l.note && <p className="text-xs text-ink-secondary">{l.note}</p>}
                  </td>
                  {draft && canEdit && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          aria-label={t('scheduling.premanifest.up', { name: l.person.name })}
                          disabled={i === 0}
                          onClick={() => void adjust({ action: 'up', lineId: l.id })}
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={t('scheduling.premanifest.down', { name: l.person.name })}
                          disabled={i === p.lines.length - 1}
                          onClick={() => void adjust({ action: 'down', lineId: l.id })}
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </Button>
                        {l.decision !== 'manifest' && (
                          <Button
                            variant="secondary"
                            onClick={() => void adjust({ action: 'manifest', lineId: l.id })}
                          >
                            {t('scheduling.premanifest.seat')}
                          </Button>
                        )}
                        {l.decision !== 'waitlist' && (
                          <Button
                            variant="secondary"
                            onClick={() => void adjust({ action: 'waitlist', lineId: l.id })}
                          >
                            {t('scheduling.premanifest.waitlist')}
                          </Button>
                        )}
                        {l.decision !== 'excluded' && (
                          <Button
                            variant="ghost"
                            onClick={() => setPending({ kind: 'exclude', line: l })}
                          >
                            {t('scheduling.premanifest.exclude')}
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {p.lines.length === 0 && (
            <p className="p-4 text-sm text-ink-secondary">{t('scheduling.premanifest.empty')}</p>
          )}
        </div>
      )}

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          tone={pending.kind === 'exclude' ? 'danger' : 'primary'}
          requireReason={pending.kind === 'exclude'}
          title={t(`scheduling.premanifest.confirm.${pending.kind}.title`, {
            name: pending.kind === 'exclude' ? pending.line.person.name : '',
          })}
          body={t(`scheduling.premanifest.confirm.${pending.kind}.body`)}
          confirmLabel={t(`scheduling.premanifest.confirm.${pending.kind}.button`)}
          onConfirm={async (reason) => {
            const p0 = pending;
            setPending(null);
            if (p0.kind === 'refresh') await act(() => refreshPremanifest(journeyId));
            else if (p0.kind === 'publish')
              await act(() => publishPremanifest(journeyId, run?.version ?? 0));
            else await adjust({ action: 'exclude', lineId: p0.line.id, reason });
          }}
        />
      )}
    </section>
  );
}
