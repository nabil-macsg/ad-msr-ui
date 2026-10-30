import {
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  type LucideIcon,
  MapPin,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';
import { routeOf } from '../app/access/registry';
import type { DemoRow } from '../mock/data/modules';
import { cn } from '../shared/lib/cn';
import { gstDayKey } from '../shared/time/format';
import { buttonVariants } from '../shared/ui/button-variants';
import { DonutChart } from '../shared/ui/donut-chart';
import { LiveTicker, type TickerItem } from '../shared/ui/live-ticker';
import { PageHeader } from '../shared/ui/page-header';
import { StatusPill } from '../shared/ui/status-pill';
import { TONE_PILL, type Tone } from '../shared/ui/tone';
import { useDataset } from './demo-api';

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const ACCEPTANCE_TONE: Readonly<Record<string, Tone>> = {
  Accepted: 'success',
  'Expiring Soon': 'warning',
  'Awaiting Acceptance': 'info',
  Expired: 'danger',
  'None on record': 'neutral',
};
const short = (iso: unknown) =>
  str(iso)
    ? new Date(`${str(iso)}T00:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      })
    : '—';
const daysTo = (iso: unknown) =>
  Math.round(
    (Date.parse(`${str(iso)}T00:00:00Z`) - Date.parse(`${gstDayKey(new Date())}T00:00:00Z`)) /
      86_400_000,
  );
/** A date's colour: red when past, amber within 60 days. */
const dateTone = (iso: unknown) => {
  if (!str(iso)) return 'text-ink';
  const d = daysTo(iso);
  return d < 0 ? 'text-danger-fg' : d <= 60 ? 'text-warning-fg' : 'text-ink';
};
/** Ops surveys run yearly: red after two years, amber after one. */
const surveyTone = (iso: unknown) => {
  if (!str(iso)) return 'text-ink';
  const d = -daysTo(iso);
  return d > 730 ? 'text-danger-fg' : d > 365 ? 'text-warning-fg' : 'text-ink';
};

function Kpi({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone: Tone;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl border',
          TONE_PILL[tone],
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="type-kpi text-ink">{value}</p>
        <p className="type-kpi-label mt-1.5 text-ink-secondary">{label}</p>
      </div>
    </div>
  );
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card px-5 py-3 text-sm">
      <span className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</span>
      <span className="h-4 w-px bg-border" aria-hidden />
      {children}
    </div>
  );
}

function DeckCard({ h }: { h: DemoRow }) {
  const checks = str(h.checks).split(',');
  return (
    <Link
      to={routeOf('helideck.hll')}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 font-semibold text-ink">
            <span className="truncate">{str(h.installation)}</span>
            <ChevronRight
              className="size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </p>
          <p className="mt-0.5 truncate text-2xs tracking-wider text-ink-muted uppercase">
            {str(h.deckClass) || '—'} · {str(h.material)} · {str(h.location)}
          </p>
        </div>
        <StatusPill tone={ACCEPTANCE_TONE[str(h.acceptance)] ?? 'neutral'}>
          {str(h.acceptance)}
        </StatusPill>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {(
          [
            ['T-Value', `${str(h.tValue)} T`, 'text-ink'],
            ['D-Value', `${str(h.dValue)} m`, 'text-ink'],
            ['Ops Survey', short(h.lastSurvey), surveyTone(h.lastSurvey)],
            [
              'Acceptance',
              h.acceptance === 'None on record' ? '—' : short(h.acceptanceUntil),
              dateTone(h.acceptance === 'None on record' ? '' : h.acceptanceUntil),
            ],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-ink-secondary">{label}</dt>
            <dd className={cn('font-medium tabular-nums', tone)}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        {checks.map((c, i) => (
          <span
            key={i}
            title={['Friction test', 'Lighting', 'Fire-fighting', 'Net'][i]}
            className={cn(
              'flex size-8 items-center justify-center rounded-md border',
              c === 'warn' ? TONE_PILL.warning : TONE_PILL.success,
            )}
          >
            {c === 'warn' ? (
              <TriangleAlert className="size-3.5" aria-label="Needs a look" />
            ) : (
              <Check className="size-3.5" aria-label="Passed" />
            )}
          </span>
        ))}
        {h.documents === true && (
          <span
            title="Documents on file"
            className={cn(
              'ms-auto flex size-7 items-center justify-center rounded-md border text-xs font-semibold',
              TONE_PILL.warning,
            )}
          >
            D
          </span>
        )}
      </div>
    </Link>
  );
}

/** Helideck Dashboard: certification across every installation, grouped by field. */
export default function HelideckDashboardPage() {
  const decks =
    useDataset('helidecks', { page: 1, pageSize: 500, sort: 'installation:asc' }).data?.items ?? [];
  const by = (status: string) => decks.filter((h) => h.acceptance === status).length;
  const sum = (field: string) => decks.reduce((s, h) => s + num(h[field]), 0);
  const thisMonth = gstDayKey(new Date()).slice(0, 7);
  const fields = [...new Set(decks.map((h) => str(h.field)))].sort();
  const ticker = decks
    .filter(
      (h) =>
        h.frictionFailed === true || h.acceptance === 'Expired' || num(h.findingsPastTarget) > 0,
    )
    .map((h): TickerItem => ({
      id: h.id,
      tone: h.acceptance === 'Expired' || h.frictionFailed === true ? 'danger' : 'warning',
      text:
        h.frictionFailed === true
          ? `${str(h.installation)} — friction test failed or expired, limitation code I applies`
          : h.acceptance === 'Expired'
            ? `${str(h.installation)} — acceptance letter expired ${short(h.acceptanceUntil)}`
            : `${str(h.installation)} — a finding is past its target date`,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Helideck Inspection"
        subtitle="Safety certification lifecycle across every installation on the register"
        actions={
          <>
            <Link to={routeOf('helideck.hll')} className={buttonVariants({ variant: 'secondary' })}>
              <Gauge className="size-4" aria-hidden />
              HLL Central View
            </Link>
            <Link to={routeOf('helideck.map')} className={buttonVariants({ variant: 'secondary' })}>
              <MapPin className="size-4" aria-hidden />
              Map View
            </Link>
            <Link
              to={routeOf('helideck.calendar')}
              className={buttonVariants({ variant: 'primary' })}
            >
              <CalendarDays className="size-4" aria-hidden />
              Calendar
            </Link>
          </>
        }
      />
      <LiveTicker items={ticker} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_minmax(15rem,0.9fr)]">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
          <Kpi
            icon={ShieldCheck}
            tone="success"
            value={by('Accepted') + by('Expiring Soon')}
            label="Acceptance Current"
          />
          <Kpi
            icon={ShieldX}
            tone="danger"
            value={by('Expired') + by('None on record')}
            label="Expired or Not Accepted"
          />
          <Kpi
            icon={CalendarDays}
            tone="info"
            value={decks.filter((h) => str(h.nextInspection).startsWith(thisMonth)).length}
            label="Scheduled This Month"
          />
          <Kpi
            icon={ClipboardCheck}
            tone="warning"
            value={by('Awaiting Acceptance')}
            label="Awaiting Acceptance"
          />
          <Kpi
            icon={TriangleAlert}
            tone="warning"
            value={sum('findingsHigh') + sum('findingsMedium')}
            label="Open Findings"
          />
          <Kpi
            icon={Users}
            tone="accent"
            value={decks.filter((h) => h.assessmentPending === true).length}
            label="Crew Assessments Pending"
          />
        </div>
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-5">
          <DonutChart
            title="Decks"
            size={150}
            stacked
            slices={[
              {
                label: 'Current',
                value: by('Accepted') + by('Awaiting Acceptance'),
                tone: 'success',
              },
              { label: 'Expiring Soon', value: by('Expiring Soon'), tone: 'warning' },
              { label: 'Expired', value: by('Expired'), tone: 'danger' },
              { label: 'None on record', value: by('None on record'), tone: 'neutral' },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Chip label="Open findings">
          <span className="text-ink">{sum('findingsHigh')} High</span>
          <span className="text-ink">{sum('findingsMedium')} Medium</span>
          <span className="text-ink">0 Low</span>
          {sum('findingsPastTarget') > 0 && (
            <span className="font-medium text-danger-fg">
              {sum('findingsPastTarget')} past target
            </span>
          )}
        </Chip>
        <Chip label="Assignment">
          <span className="text-ink">
            {decks.filter((h) => h.inspector === null).length} with no inspector
          </span>
        </Chip>
        <Chip label="Limitation I">
          <span className="text-ink">
            {decks.filter((h) => h.frictionFailed === true).length} friction test failed / expired
          </span>
        </Chip>
      </div>

      {fields.map((field) => {
        const list = decks.filter((h) => h.field === field);
        return (
          <section key={field} className="space-y-3">
            <h2 className="flex items-baseline justify-between">
              <span className="text-sm font-semibold tracking-wider text-ink-secondary uppercase">
                {field}
              </span>
              <span className="text-xs text-ink-muted">
                {list.length} {list.length === 1 ? 'installation' : 'installations'}
              </span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((h) => (
                <DeckCard key={h.id} h={h} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
