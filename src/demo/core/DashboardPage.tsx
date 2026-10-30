import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { useMe } from '../../app/session/queries';
import type { FlightStatus } from '../../mock/data/demo-core';
import { formatGstDate, formatGstLongDay, gstDayKey } from '../../shared/time/format';
import { firstName } from '../../shared/time/gst';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { Spinner } from '../../shared/ui/spinner';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import type { Tone } from '../../shared/ui/tone';
import { useCoreDashboard } from './core-api';

const STATUS_TONE: Readonly<Record<FlightStatus, Tone>> = {
  Arrived: 'success',
  'Closed for Dispatch': 'neutral',
  Cancelled: 'danger',
  Delayed: 'warning',
  Boarding: 'info',
  'Closed for Boarding': 'neutral',
};

const NOTICE_DOT: Readonly<Record<'danger' | 'warning' | 'info', string>> = {
  danger: 'bg-danger-fg',
  warning: 'bg-warning-fg',
  info: 'bg-info-fg',
};

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
    <section aria-labelledby={id} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold text-ink">
          {title} <span className="ms-1 text-sm font-normal text-ink-muted">{count}</span>
        </h2>
        {action && (
          <Button asChild variant="secondary">
            <Link to={action.to}>{action.label}</Link>
          </Button>
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
        <h1 id="page-title" className="text-title leading-tight font-semibold text-ink">
          {me ? `Hello, ${firstName(me.displayName)}` : 'Hello'}
        </h1>
        <p className="text-sm text-ink-muted">
          {formatGstLongDay(data?.today ?? gstDayKey(new Date()))} · what is happening today
          {role ? `, as ${role}` : ''}
        </p>
      </header>
      {dashboard.isError && <Banner tone="danger">The dashboard could not be loaded.</Banner>}
      {dashboard.isPending && <Spinner label="Loading" />}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Awaiting your approval"
              value={data.kpis.approvals}
              subline="Bookings on your desk"
              to={approvals}
            />
            <StatCard
              title="Today's departures"
              value={data.kpis.departures}
              subline={`${data.kpis.gone} gone · ${data.kpis.toGo} still to go`}
              to={dispatch}
            />
            <StatCard
              title="Boarding now"
              value={data.kpis.boarding}
              subline="Gates open"
              to={dispatch}
            />
            <StatCard
              title="Waitlisted today"
              value={data.kpis.waitlisted}
              subline="Waiting for a seat"
              {...(data.kpis.waitlisted > 0 ? { tone: 'warning' as const } : {})}
              to={routeOf('dispatch.quick-add')}
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
                <ul className="divide-y divide-border">
                  {data.flights.map((f) => (
                    <li key={f.id}>
                      <Link
                        to={dispatch}
                        className="flex items-center gap-3 rounded-sm py-2 hover:bg-surface-muted"
                      >
                        <span className="w-12 shrink-0 font-mono text-xs text-ink-muted">
                          {f.time}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {f.flightNumber} · {f.from} → {f.to}
                          </span>
                          <span className="block truncate text-xs text-ink-secondary">
                            {f.mode} · {f.resource}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted tabular-nums">
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
                        className="flex items-center gap-3 rounded-sm py-2 hover:bg-surface-muted"
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
                <ul className="divide-y divide-border">
                  {data.notices.map((n) => (
                    <li key={n.id}>
                      <Link
                        to={routeOf(n.page)}
                        className="flex items-start gap-3 rounded-sm py-2 text-sm text-ink hover:bg-surface-muted"
                      >
                        <span
                          aria-hidden
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${NOTICE_DOT[n.tone]}`}
                        />
                        {n.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
              <StatCard
                title="Departed"
                value={data.kpis.gone}
                subline={`of ${data.kpis.departures} today`}
                tone="success"
                to={dispatch}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
