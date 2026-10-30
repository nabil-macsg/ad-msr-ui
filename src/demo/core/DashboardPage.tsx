import {
  ArrowRight,
  CircleAlert,
  Clock,
  Hourglass,
  Info,
  Plane,
  SquareCheckBig,
} from 'lucide-react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { useMe } from '../../app/session/queries';
import type { FlightStatus } from '../../mock/data/demo-core';
import { formatGstDate, formatGstLongDay, gstDayKey } from '../../shared/time/format';
import { firstName } from '../../shared/time/gst';
import { cn } from '../../shared/lib/cn';
import { Banner } from '../../shared/ui/banner';
import { Spinner } from '../../shared/ui/spinner';
import { StatusPill } from '../../shared/ui/status-pill';
import type { Tone } from '../../shared/ui/tone';
import { ModeLabel, RouteStops } from '../../shared/ui/transport';
import { useCoreDashboard } from './core-api';

const STATUS_TONE: Readonly<Record<FlightStatus, Tone>> = {
  Arrived: 'success',
  'Closed for Dispatch': 'neutral',
  Cancelled: 'danger',
  Delayed: 'warning',
  Boarding: 'info',
  'Closed for Boarding': 'neutral',
};

const NOTICE: Readonly<
  Record<'danger' | 'warning' | 'info', { card: string; icon: typeof CircleAlert }>
> = {
  danger: { card: 'border-danger-border bg-danger-bg/70 text-danger-fg', icon: CircleAlert },
  warning: { card: 'border-warning-border bg-warning-bg/70 text-warning-fg', icon: Clock },
  info: { card: 'border-info-border bg-info-bg/70 text-info-fg', icon: Info },
};

/** A KPI tile as in the reference: small capitals, an icon in the corner, a large figure. */
function Tile({
  title,
  value,
  sub,
  icon: Icon,
  to,
  warn,
}: {
  title: string;
  value: number;
  sub: string;
  icon: typeof Clock;
  to: string;
  warn?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative block rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon
        className="absolute end-5 top-5 size-5 text-ink-muted transition-colors group-hover:text-primary"
        aria-hidden
      />
      <p className="pe-8 text-xs font-semibold tracking-wider text-ink-muted uppercase">{title}</p>
      <p className={cn('type-kpi mt-3', warn ? 'text-warning-fg' : 'text-brand-dark-blue')}>
        {value}
      </p>
      <p className="type-kpi-label mt-2 text-ink-secondary">{sub}</p>
    </Link>
  );
}

function Card({
  id,
  title,
  count,
  action,
  children,
}: {
  id: string;
  title: string;
  count: string;
  action?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id={id} className="text-base font-semibold text-ink">
          {title} <span className="ms-1.5 text-sm font-normal text-ink-muted">{count}</span>
        </h2>
        {action && (
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            {action.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Dashboard (original "Hello, Admin"): today's KPIs, the day's flights and voyages, the
 * bookings waiting for approval and the notifications, each leading to the page behind it.
 */
export default function DashboardPage() {
  const { data: me } = useMe();
  const dashboard = useCoreDashboard();
  const data = dashboard.data;
  const role = me?.roles[0]?.name;
  const dispatch = routeOf('dispatch.flight');
  const approvals = routeOf('booking.approvals');

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="page-title" className="type-page-title text-brand-dark-blue">
          {me ? `Hello, ${firstName(me.displayName)}` : 'Hello'}
        </h1>
        <p className="type-intro text-ink-secondary">
          {formatGstLongDay(data?.today ?? gstDayKey(new Date()))} · what is happening today
          {role ? `, as ${role}` : ''}
        </p>
      </header>
      {dashboard.isError && <Banner tone="danger">The dashboard could not be loaded.</Banner>}
      {dashboard.isPending && <Spinner label="Loading" />}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              title="Awaiting your approval"
              value={data.kpis.approvals}
              sub="Bookings on your desk"
              icon={SquareCheckBig}
              to={approvals}
              warn={data.kpis.approvals > 0}
            />
            <Tile
              title="Today's departures"
              value={data.kpis.departures}
              sub={`${data.kpis.gone} gone · ${data.kpis.toGo} still to go`}
              icon={Plane}
              to={dispatch}
            />
            <Tile
              title="Boarding now"
              value={data.kpis.boarding}
              sub="Gates open"
              icon={Clock}
              to={dispatch}
            />
            <Tile
              title="Waitlisted today"
              value={data.kpis.waitlisted}
              sub="Waiting for a seat"
              icon={Hourglass}
              to={routeOf('dispatch.quick-add')}
              warn={data.kpis.waitlisted > 0}
            />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card
                id="dash-flights"
                title="Today's flights and voyages"
                count={`${data.flights.length} published`}
                action={{ label: 'Dispatch', to: dispatch }}
              >
                <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto">
                  {data.flights.map((f) => (
                    <li key={f.id}>
                      <Link
                        to={dispatch}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-table-row-hover"
                      >
                        <span className="w-12 shrink-0 font-mono text-sm text-ink-muted">
                          {f.time}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-ink">
                            {f.flightNumber} ·
                            <RouteStops stops={[f.from, f.to]} />
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-secondary">
                            <ModeLabel mode={f.mode} /> · {f.resource}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm text-ink-secondary tabular-nums">
                          {f.booked}/{f.capacity}
                        </span>
                        <StatusPill tone={STATUS_TONE[f.status]}>{f.status}</StatusPill>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card
                id="dash-approvals"
                title="Pending approvals"
                count={`${data.approvals.total} waiting`}
                action={{ label: 'Approvals', to: approvals }}
              >
                <ul className="divide-y divide-border">
                  {data.approvals.items.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={approvals}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-table-row-hover"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {a.passenger}
                          </span>
                          <span className="block truncate text-xs text-ink-secondary">
                            <span className="font-mono">{a.reference}</span> · {a.from} → {a.to} ·{' '}
                            {formatGstDate(`${a.date}T12:00:00+04:00`)}
                          </span>
                        </span>
                        {a.overQuota && <StatusPill tone="warning">Over quota</StatusPill>}
                        <StatusPill tone="info">{a.stage}</StatusPill>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="space-y-6">
              <Card id="dash-notices" title="Notifications" count={String(data.notices.length)}>
                <ul className="space-y-2.5 p-4">
                  {data.notices.map((n) => {
                    const notice = NOTICE[n.tone];
                    return (
                      <li key={n.id}>
                        <Link
                          to={routeOf(n.page)}
                          className={cn(
                            'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm transition-all hover:-translate-y-px hover:shadow-raised',
                            notice.card,
                          )}
                        >
                          <notice.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {n.text}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
              <Card id="dash-to-go" title="Still to go today" count={String(data.kpis.toGo)}>
                <Link
                  to={dispatch}
                  className="grid grid-cols-2 divide-x divide-border py-5 text-center transition-colors hover:bg-table-row-hover rtl:divide-x-reverse"
                >
                  <span>
                    <span className="type-kpi block text-brand-dark-blue">{data.kpis.gone}</span>
                    <span className="mt-1.5 block text-xs font-semibold tracking-wider text-ink-muted uppercase">
                      Departed
                    </span>
                  </span>
                  <span>
                    <span className="type-kpi block text-brand-dark-blue">{data.kpis.toGo}</span>
                    <span className="mt-1.5 block text-xs font-semibold tracking-wider text-ink-muted uppercase">
                      Yet to leave
                    </span>
                  </span>
                </Link>
              </Card>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
