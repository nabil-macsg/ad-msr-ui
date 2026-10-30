import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CirclePlus,
  Clock,
  type LucideIcon,
  Plane,
  SquareCheckBig,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../app/access/registry';
import type { DemoRow } from '../mock/data/modules';
import { cn } from '../shared/lib/cn';
import { formatGstLongDay, gstDayKey } from '../shared/time/format';
import { buttonVariants } from '../shared/ui/button-variants';
import { DonutChart } from '../shared/ui/donut-chart';
import { PageHeader } from '../shared/ui/page-header';
import { StatusPill } from '../shared/ui/status-pill';
import { TONE_DOT, TONE_PILL, type Tone } from '../shared/ui/tone';
import { ModeLabel, RouteStops } from '../shared/ui/transport';
import { useDataset } from './demo-api';

const STATUS_TONE: Readonly<Record<string, Tone>> = {
  Confirmed: 'success',
  'Checked in': 'success',
  'Pending approval': 'warning',
  Waitlisted: 'accent',
  Cancelled: 'danger',
  Scheduled: 'info',
  'Check-in open': 'info',
  Boarding: 'info',
  Departed: 'neutral',
  Arrived: 'success',
  Delayed: 'warning',
};
const toneOf = (status: unknown): Tone => STATUS_TONE[String(status)] ?? 'neutral';
const ALL = { page: 1, pageSize: 500 };
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const shortDate = (iso: unknown) =>
  new Date(`${str(iso)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
/** "Das Island → Zirku Island" → "Zirku Island". */
const destination = (route: unknown) => str(route).split(' → ').at(-1) ?? '';

/** A small trend line for the first tile; a fixed shape, as in the reference. */
function Sparkline() {
  return (
    <svg viewBox="0 0 100 30" className="absolute end-3 bottom-3 h-8 w-24 text-primary" aria-hidden>
      <path
        d="M0 18 C8 4 14 4 20 16 S32 28 40 16 S52 2 60 14 S74 26 82 18 S94 10 100 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

function Kpi({
  icon: Icon,
  tone,
  value,
  label,
  sub,
  to,
  flag,
  children,
}: {
  icon: LucideIcon;
  tone: Tone;
  value: ReactNode;
  label: string;
  sub: string;
  to: string;
  flag?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'relative flex flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary',
        flag ? 'border-warning-fg/50 ring-1 ring-warning-border' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex size-11 items-center justify-center rounded-xl border',
            TONE_PILL[tone],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        {flag && <StatusPill tone="warning">{flag}</StatusPill>}
      </div>
      <p className="type-kpi mt-5 text-ink">{value}</p>
      <p className="type-kpi-label mt-2 text-ink-secondary">{label}</p>
      <p className="mt-1 text-xs text-ink-muted">{sub}</p>
      {children}
    </Link>
  );
}

function Card({
  title,
  icon: Icon,
  link,
  to,
  warning,
  className,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  link: string;
  to: string;
  warning?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-card',
        warning ? 'border-warning-border' : 'border-border',
        className,
      )}
    >
      <header
        className={cn(
          'flex items-center gap-2 border-b px-5 py-3.5',
          warning ? 'border-warning-border bg-warning-bg text-warning-fg' : 'border-border',
        )}
      >
        {Icon && <Icon className={cn('size-4', warning ? '' : 'text-primary')} aria-hidden />}
        <h2 className={cn('flex-1 text-sm font-semibold', !warning && 'text-ink')}>{title}</h2>
        <Link
          to={to}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
        >
          {link}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      {children}
    </section>
  );
}

function Status({ status }: { status: unknown }) {
  const tone = toneOf(status);
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('size-2 rounded-full', TONE_DOT[tone])} aria-hidden />
      <StatusPill tone={tone}>
        {str(status) === 'Pending approval' ? 'Pending' : str(status)}
      </StatusPill>
    </span>
  );
}

/** Booking Dashboard: today's movements, approvals, confirmed and waitlisted bookings at a glance. */
export default function BookingDashboardPage() {
  const bookings = useDataset('bookings', { ...ALL, sort: 'reference:desc' }).data?.items ?? [];
  const departures = useDataset('departures', { ...ALL, sort: 'departure:asc' }).data?.items ?? [];
  const today = gstDayKey(new Date());
  const by = (status: string) => bookings.filter((b) => b.status === status);
  const pending = by('Pending approval');
  const confirmed = [...by('Confirmed'), ...by('Checked in')];
  const waitlisted = by('Waitlisted');
  const cancelled = by('Cancelled');
  const seatsFree = departures.reduce((sum, d) => sum + num(d.capacity) - num(d.booked), 0);
  const soon = pending.filter((b) => str(b.serviceDate) <= gstDayKeyIn(2)).length;
  const bookingsRoute = routeOf('booking.bookings');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking"
        subtitle={`Aviation & Marine people transportation — booking overview for ${formatGstLongDay(today)}`}
        actions={
          <Link to={routeOf('booking.create')} className={buttonVariants({ variant: 'primary' })}>
            <CirclePlus className="size-4" aria-hidden />
            New Booking
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={Plane}
          tone="info"
          value={departures.length}
          label="Today's Movements"
          sub={`${seatsFree.toLocaleString('en')} seats free`}
          to={routeOf('dispatch.dashboard')}
        >
          <Sparkline />
        </Kpi>
        <Kpi
          icon={CircleAlert}
          tone="warning"
          value={pending.length}
          label="Pending Approvals"
          sub={`${String(soon)} travel within 48 hours`}
          to={routeOf('booking.approvals')}
          {...(pending.length > 0 ? { flag: 'Action needed' } : {})}
        />
        <Kpi
          icon={SquareCheckBig}
          tone="success"
          value={confirmed.length}
          label="Confirmed Bookings"
          sub={`${String(confirmed.filter((b) => b.serviceDate === today).length)} travel today`}
          to={bookingsRoute}
        />
        <Kpi
          icon={Clock}
          tone="accent"
          value={waitlisted.length}
          label="Waitlisted"
          sub="Awaiting a seat"
          to={bookingsRoute}
        />
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-5 sm:col-span-2 xl:col-span-1">
          <DonutChart
            title="Bookings"
            size={136}
            stacked
            slices={[
              { label: 'Confirmed', value: confirmed.length, tone: 'success' },
              { label: 'Pending', value: pending.length, tone: 'warning' },
              { label: 'Waitlisted', value: waitlisted.length, tone: 'accent' },
              { label: 'Cancelled', value: cancelled.length, tone: 'danger' },
            ]}
          />
        </div>
      </div>

      <Card title="Recently Raised" link="View all" to={bookingsRoute}>
        <ul className="divide-y divide-border">
          {bookings.slice(0, 5).map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 transition-colors hover:bg-table-row-hover"
            >
              <span className="w-32 shrink-0 font-mono text-sm font-semibold text-primary">
                {str(b.reference)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                <span className="font-medium">{str(b.passenger)}</span>
                <span className="text-ink-muted">
                  {' · '}
                  <RouteStops stops={str(b.route)} className="inline-flex" />
                </span>
              </span>
              <span className="hidden text-xs text-ink-muted md:inline">{str(b.requestedBy)}</span>
              <span className="text-xs text-ink-muted tabular-nums">{str(b.serviceDate)}</span>
              <Status status={b.status} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          title="Today's Departures from Abu Dhabi"
          icon={CalendarDays}
          link="View all"
          to={routeOf('dispatch.dashboard')}
          className="xl:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Today's departures</caption>
              <thead>
                <tr className="border-b border-border bg-table-head text-label text-on-table-head">
                  {['Flight', 'Mode', 'Destination', 'Departs', 'Seats', 'Status'].map((h) => (
                    <th key={h} scope="col" className="px-5 py-2.5 text-start font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departures.slice(0, 6).map((d) => {
                  const pct = Math.round((num(d.booked) / Math.max(1, num(d.capacity))) * 100);
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-border/60 last:border-0 hover:bg-table-row-hover"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-ink">
                        {str(d.flightNumber)}
                      </td>
                      <td className="px-5 py-3 text-ink-secondary">
                        <ModeLabel mode={str(d.mode)} />
                      </td>
                      <td className="px-5 py-3 text-ink">{destination(d.route)}</td>
                      <td className="px-5 py-3 text-ink tabular-nums">{str(d.departure) || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                pct >= 90
                                  ? 'bg-danger-fg'
                                  : pct >= 70
                                    ? 'bg-warning-fg'
                                    : 'bg-success-fg',
                              )}
                              style={{ width: `${String(Math.min(pct, 100))}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink-secondary tabular-nums">
                            {str(d.booked)}/{str(d.capacity)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill tone={toneOf(d.status)}>{str(d.status)}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Pending Approvals"
          icon={CircleAlert}
          link="Review all"
          to={routeOf('booking.approvals')}
          warning
        >
          <ul className="divide-y divide-border">
            {pending.slice(0, 4).map((b: DemoRow) => (
              <li key={b.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{str(b.passenger)}</p>
                  <p className="truncate text-xs text-ink-secondary">
                    ADNOC Offshore · {str(b.category)}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {str(b.route)} · {shortDate(b.serviceDate)}
                  </p>
                </div>
                <Status status={b.status} />
              </li>
            ))}
            {pending.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-ink-muted">
                Nothing waiting for approval.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/** The GST day key `days` from today. */
function gstDayKeyIn(days: number): string {
  return gstDayKey(new Date(Date.now() + days * 86_400_000));
}
