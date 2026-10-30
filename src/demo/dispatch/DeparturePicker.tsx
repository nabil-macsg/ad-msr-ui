import { useQueryClient } from '@tanstack/react-query';
import {
  Anchor,
  Helicopter,
  type LucideIcon,
  Plane,
  Search,
  Ship,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import type { DemoRow, DemoValue } from '../../mock/data/modules';
import { cn } from '../../shared/lib/cn';
import { CONTROL as BASE } from '../../shared/ui/control-styles';
import { gstDayKey } from '../../shared/time/format';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { Drawer } from '../../shared/ui/drawer';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import type { Tone } from '../../shared/ui/tone';
import { RouteStops } from '../../shared/ui/transport';
import { datasetKey, updateRow, useDataset } from '../demo-api';

const CONTROL = `${BASE} min-h-touch w-full px-3`;

export const STATUS_TONE: Readonly<Record<string, Tone>> = {
  Scheduled: 'info',
  'Check-in open': 'info',
  Boarding: 'neutral',
  'Closed for Boarding': 'info',
  'Closed for Dispatch': 'neutral',
  Departed: 'success',
  Arrived: 'success',
  Delayed: 'warning',
  Cancelled: 'danger',
};
const MODE_ICON: Readonly<Record<string, LucideIcon>> = {
  'Fixed Wing': Plane,
  'Rotary Wing': Helicopter,
  'Vessel / Boat': Anchor,
};
const MODES = ['Fixed Wing', 'Rotary Wing', 'Vessel / Boat'];
export const str = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' ? String(v) : '';
export const num = (v: unknown) => (typeof v === 'number' ? v : 0);
/** Departures that have gone or will not go: nothing more can be loaded onto them. */
export const GONE = ['Departed', 'Arrived', 'Cancelled', 'Closed for Dispatch'];

export interface DepartureAction {
  readonly label: string;
  readonly patch: Readonly<Record<string, DemoValue>>;
  readonly variant?: 'primary' | 'secondary';
  readonly disabled?: boolean;
}

export interface DeparturePickerProps {
  readonly title: string;
  readonly subtitle: string;
  readonly hint: string;
  readonly note?: string;
  /** Which departures this page lists. */
  readonly include?: (d: DemoRow) => boolean;
  /** An amber tag beside the seat count, e.g. "3 waiting". */
  readonly badge?: (d: DemoRow) => ReactNode;
  /** "45/120" by default; HUB Arrivals shows "45 aboard". */
  readonly seats?: (d: DemoRow) => string;
  readonly actions: (d: DemoRow) => readonly DepartureAction[];
  /** Extra content in the departure's panel (Cargo Transfer's freight list). */
  readonly extra?: (d: DemoRow, refresh: () => Promise<void>) => ReactNode;
}

const FIELD = 'space-y-1.5 text-label font-medium text-ink-secondary';

export function waitingBadge(d: DemoRow): ReactNode {
  return num(d.waiting) > 0 ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2.5 py-0.5 text-xs font-medium text-warning-fg">
      <TriangleAlert className="size-3" aria-hidden />
      {num(d.waiting)} waiting
    </span>
  ) : null;
}

function Details({
  d,
  props,
  onClose,
}: {
  d: DemoRow;
  props: DeparturePickerProps;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [row, setRow] = useState(d);
  const refresh = () => queryClient.invalidateQueries({ queryKey: datasetKey('departures') });
  const run = async (a: DepartureAction) => {
    setBusy(true);
    try {
      setRow(await updateRow('departures', row.id, a.patch));
      await refresh();
      setDone(`${a.label} — saved.`);
    } finally {
      setBusy(false);
    }
  };
  const limit = num(row.payloadLimit);
  const facts: [string, ReactNode][] = [
    ['Route', `${str(row.from)} → ${str(row.to)}`],
    ['Departs', str(row.departure) || '—'],
    ['Mode', str(row.mode)],
    ['Resource', `${str(row.fleetType)} · ${str(row.fleet)}`],
    ['Booked', `${str(row.booked)} / ${str(row.capacity)}`],
    ['Checked in', str(row.checkedIn)],
    [
      'Payload',
      limit ? `${num(row.payloadKg).toLocaleString('en')} / ${limit.toLocaleString('en')} kg` : '—',
    ],
    [
      'Status',
      <StatusPill key="s" tone={STATUS_TONE[str(row.status)] ?? 'neutral'}>
        {str(row.status)}
      </StatusPill>,
    ],
  ];
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${str(row.flightNumber)} · ${str(row.to)}`}
    >
      <div className="space-y-6">
        {done && <Banner tone="success">{done}</Banner>}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {props.extra?.(row, async () => {
          const fresh = await updateRow('departures', row.id, {});
          setRow(fresh);
          await refresh();
        })}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {props.actions(row).map((a) => (
            <Button
              key={a.label}
              variant={a.variant ?? 'primary'}
              disabled={busy || a.disabled === true}
              onClick={() => void run(a)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

/** The dispatch pages' shared layout: filter the day's departures, pick one, work it. */
export function DeparturePicker(props: DeparturePickerProps) {
  const all =
    useDataset('departures', { page: 1, pageSize: 500, sort: 'departure:asc' }).data?.items ?? [];
  const [q, setQ] = useState('');
  const [date, setDate] = useState(gstDayKey(new Date()));
  const [mode, setMode] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState<DemoRow | null>(null);
  const places = (field: 'from' | 'to') => [...new Set(all.map((d) => str(d[field])))].sort();
  const text = q.trim().toLowerCase();
  // The demo's departures are today's, so another day shows an empty list.
  const rows = all.filter(
    (d) =>
      date === gstDayKey(new Date()) &&
      (props.include?.(d) ?? true) &&
      (!mode || d.mode === mode) &&
      (!from || d.from === from) &&
      (!to || d.to === to) &&
      (!text ||
        [d.flightNumber, d.route, d.fleetType, d.fleet].some((v) =>
          str(v).toLowerCase().includes(text),
        )),
  );

  return (
    <div className="space-y-5">
      <PageHeader title={props.title} subtitle={props.subtitle} />
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <label className={FIELD}>
            <span>Search</span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Voyage no, place or aircraft"
                className={cn(CONTROL, 'ps-9')}
              />
            </span>
          </label>
          <label className={FIELD}>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={CONTROL}
            />
          </label>
          <label className={FIELD}>
            <span>Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={CONTROL}>
              <option value="">All modes</option>
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          {(['from', 'to'] as const).map((field) => (
            <label key={field} className={FIELD}>
              <span>{field === 'from' ? 'From' : 'To'}</span>
              <select
                value={field === 'from' ? from : to}
                onChange={(e) => (field === 'from' ? setFrom : setTo)(e.target.value)}
                className={CONTROL}
              >
                <option value="">Anywhere</option>
                {places(field).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="mt-3 text-end text-xs text-ink-muted">
          {rows.length} {rows.length === 1 ? 'departure' : 'departures'}
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <p className="border-b border-border px-5 py-3 text-sm text-ink-secondary">{props.hint}</p>
        {props.note && (
          <p className="border-b border-border bg-surface-muted/60 px-5 py-2.5 text-xs text-ink-muted">
            {props.note}
          </p>
        )}
        <ul className="max-h-[44rem] divide-y divide-border overflow-y-auto">
          {rows.map((d) => {
            const Icon = MODE_ICON[str(d.mode)] ?? Ship;
            const full = num(d.booked) >= num(d.capacity);
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setOpen(d)}
                  className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3.5 text-start transition-colors hover:bg-table-row-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="w-20 font-mono text-sm font-bold text-ink">
                    {str(d.flightNumber)}
                  </span>
                  <span className="w-12 font-mono text-sm text-ink-muted">{str(d.departure)}</span>
                  <Icon className="size-4 shrink-0 text-ink-secondary" aria-hidden />
                  <RouteStops
                    stops={[str(d.from), str(d.to)]}
                    className="min-w-0 flex-1 text-sm text-ink"
                  />
                  <span className="text-xs text-ink-secondary">{str(d.fleetType)}</span>
                  <span
                    className={cn(
                      'inline-flex w-24 items-center justify-end gap-1 text-sm font-medium tabular-nums',
                      full ? 'text-danger-fg' : 'text-ink',
                    )}
                  >
                    <Users className="size-3.5" aria-hidden />
                    {props.seats ? props.seats(d) : `${str(d.booked)}/${str(d.capacity)}`}
                  </span>
                  <span className="flex w-64 justify-end gap-2">
                    {props.badge?.(d)}
                    <StatusPill tone={STATUS_TONE[str(d.status)] ?? 'neutral'}>
                      {str(d.status)}
                    </StatusPill>
                  </span>
                </button>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-ink-muted">No departures match.</li>
          )}
        </ul>
      </section>
      {open && <Details d={open} props={props} onClose={() => setOpen(null)} />}
    </div>
  );
}
