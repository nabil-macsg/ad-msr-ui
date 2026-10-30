import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Helicopter,
  Layers,
  type LucideIcon,
  Luggage,
  Monitor,
  Plane,
  Ship,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../app/access/registry';
import type { DemoRow } from '../mock/data/modules';
import { cn } from '../shared/lib/cn';
import { formatGstLongDay, gstDayKey } from '../shared/time/format';
import { Banner } from '../shared/ui/banner';
import { DonutChart } from '../shared/ui/donut-chart';
import { PageHeader } from '../shared/ui/page-header';
import { StatusPill } from '../shared/ui/status-pill';
import { TONE_PILL, type Tone } from '../shared/ui/tone';
import { RouteStops } from '../shared/ui/transport';
import { useDataset } from './demo-api';

const STATUS_TONE: Readonly<Record<string, Tone>> = {
  Scheduled: 'info',
  'Check-in open': 'info',
  Boarding: 'accent',
  Departed: 'success',
  Arrived: 'success',
  Delayed: 'danger',
};
const MODE_ICON: Readonly<Record<string, LucideIcon>> = {
  'Fixed Wing': Plane,
  'Rotary Wing': Helicopter,
  'Vessel / Boat': Ship,
};
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function Kpi({
  icon: Icon,
  tone,
  value,
  label,
  alert,
}: {
  icon: LucideIcon;
  tone: Tone;
  value: number;
  label: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5',
        alert ? 'border-warning-fg/50 ring-1 ring-warning-border' : 'border-border',
      )}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-xl border',
          TONE_PILL[tone],
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="type-kpi mt-4 text-ink">{value.toLocaleString('en')}</p>
      <p className="type-kpi-label mt-2 text-ink-secondary">{label}</p>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <h2 className="flex items-center gap-2 border-b border-border px-5 py-3.5 text-sm font-semibold text-ink">
        {Icon && <Icon className="size-4 text-primary" aria-hidden />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Bar({ value, tone }: { value: number; tone: 'success' | 'info' | 'danger' }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          tone === 'danger' ? 'bg-danger-fg' : tone === 'info' ? 'bg-info-fg' : 'bg-success-fg',
        )}
        style={{ width: `${String(Math.min(value, 100))}%` }}
      />
    </div>
  );
}

function Departure({ d }: { d: DemoRow }) {
  const Icon = MODE_ICON[str(d.mode)] ?? Plane;
  const limit = num(d.payloadLimit);
  const payload = num(d.payloadKg);
  const over = limit > 0 && payload > limit;
  return (
    <li>
      <Link
        to={routeOf('dispatch.flight')}
        className="block space-y-2.5 px-5 py-4 transition-colors hover:bg-table-row-hover"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="size-4 shrink-0 text-ink-secondary" aria-hidden />
          <span className="font-mono text-sm font-bold text-ink">{str(d.flightNumber)}</span>
          <RouteStops stops={str(d.route)} className="min-w-0 text-sm text-ink-secondary" />
          <span className="font-mono text-sm text-ink-muted">{str(d.departure)}</span>
          <span className="ms-auto">
            <StatusPill tone={STATUS_TONE[str(d.status)] ?? 'neutral'}>{str(d.status)}</StatusPill>
          </span>
          <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
        </div>
        <div className="flex items-center gap-4">
          <Bar value={pct(num(d.checkedIn), num(d.booked))} tone="success" />
          <span className="w-36 text-end text-xs text-ink-muted tabular-nums">
            {str(d.checkedIn)}/{str(d.booked)} checked in
          </span>
        </div>
        {limit > 0 && (
          <div className="flex items-center gap-4">
            <Bar value={pct(payload, limit)} tone={over ? 'danger' : 'info'} />
            <span
              className={cn(
                'inline-flex w-36 items-center justify-end gap-1 text-xs tabular-nums',
                over ? 'font-semibold text-danger-fg' : 'text-ink-muted',
              )}
            >
              <Luggage className="size-3.5" aria-hidden />
              {payload.toLocaleString('en')} / {limit.toLocaleString('en')} kg
            </span>
          </div>
        )}
      </Link>
    </li>
  );
}

const ACTIONS: readonly {
  key: Parameters<typeof routeOf>[0];
  icon: LucideIcon;
  title: string;
  sub: string;
}[] = [
  {
    key: 'dispatch.flight',
    icon: Plane,
    title: 'Flight Dispatch',
    sub: 'Manifest, payload & offload',
  },
  {
    key: 'dispatch.manifest',
    icon: CircleCheck,
    title: 'Manifest Confirmation',
    sub: 'Finalise and confirm to passengers',
  },
  {
    key: 'dispatch.cargo',
    icon: Layers,
    title: 'Cargo Transfer',
    sub: 'Assign freight to a departure',
  },
  {
    key: 'terminal.kiosk-portal',
    icon: Monitor,
    title: 'Terminal',
    sub: 'Kiosk, FIDS & boarding pass',
  },
];

/** Dispatch Dashboard: today's departures, check-in and payload progress, at a glance. */
export default function DispatchDashboardPage() {
  const departures =
    useDataset('departures', { page: 1, pageSize: 500, sort: 'departure:asc' }).data?.items ?? [];
  const booked = departures.reduce((s, d) => s + num(d.booked), 0);
  const checkedIn = departures.reduce((s, d) => s + num(d.checkedIn), 0);
  const delayed = departures.filter((d) => d.status === 'Delayed').length;
  const overPayload = departures.filter(
    (d) => num(d.payloadLimit) > 0 && num(d.payloadKg) > num(d.payloadLimit),
  ).length;
  const by = (...statuses: string[]) =>
    departures.filter((d) => statuses.includes(str(d.status))).length;
  const byMode = (mode: string) =>
    departures.filter((d) => d.mode === mode).reduce((s, d) => s + num(d.booked), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        subtitle={`Check-in, gate management and flight information — ${formatGstLongDay(gstDayKey(new Date()))}`}
      />
      {overPayload > 0 && (
        <Banner tone="warning">
          {overPayload} {overPayload === 1 ? 'departure' : 'departures'} over the resource payload
        </Banner>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Plane} tone="info" value={departures.length} label="Departures Today" />
        <Kpi icon={CircleCheck} tone="success" value={checkedIn} label="Passengers Checked In" />
        <Kpi
          icon={Clock}
          tone="warning"
          value={booked - checkedIn}
          label="Pending Check-in"
          alert={booked - checkedIn > 0}
        />
        <Kpi icon={CircleAlert} tone="danger" value={delayed} label="Delayed" alert={delayed > 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Check-In Progress">
          <ul className="max-h-[52rem] divide-y divide-border overflow-y-auto">
            {departures.map((d) => (
              <Departure key={d.id} d={d} />
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel title="Departures by Status">
            <div className="flex justify-center p-5">
              <DonutChart
                title="Departures"
                size={168}
                stacked
                slices={[
                  { label: 'Departed', value: by('Departed', 'Arrived'), tone: 'success' },
                  { label: 'Scheduled', value: by('Scheduled', 'Check-in open'), tone: 'info' },
                  { label: 'Boarding', value: by('Boarding'), tone: 'accent' },
                  { label: 'Delayed', value: by('Delayed'), tone: 'danger' },
                ]}
              />
            </div>
          </Panel>

          <Panel title="Quick Actions">
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {ACTIONS.map((a) => (
                <Link
                  key={a.key}
                  to={routeOf(a.key)}
                  className="group rounded-xl border border-border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary">
                    <a.icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-ink">{a.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{a.sub}</p>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Day Summary" icon={Layers}>
            <dl className="divide-y divide-border/60 px-5 text-sm">
              {[
                ["Passengers on today's manifests", booked.toLocaleString('en')],
                [
                  'Checked in',
                  `${checkedIn.toLocaleString('en')} (${String(pct(checkedIn, booked))}%)`,
                ],
                ['Yet to check in', (booked - checkedIn).toLocaleString('en')],
                ['Fixed wing', byMode('Fixed Wing').toLocaleString('en')],
                ['Rotary wing', byMode('Rotary Wing').toLocaleString('en')],
                ['Marine', byMode('Vessel / Boat').toLocaleString('en')],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-2.5">
                  <dt className="text-ink-secondary">{label}</dt>
                  <dd className="font-semibold text-ink tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
