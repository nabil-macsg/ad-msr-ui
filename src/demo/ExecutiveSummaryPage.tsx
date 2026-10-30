import { Users } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '../shared/lib/cn';
import { gstDayKey } from '../shared/time/format';
import { CONTROL, LABEL } from '../shared/ui/control-styles';
import { PageHeader } from '../shared/ui/page-header';
import { useDataset } from './demo-api';
import { usePobQuery } from './pob/pob-api';
import type { PobDashboard } from './pob/sites-api';

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const n = (v: number) => v.toLocaleString('en');
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const plusDays = (days: number) => gstDayKey(new Date(Date.now() + days * 86_400_000));
const TH = 'px-5 py-3 text-start text-label font-bold text-on-table-head';

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'warning' | 'danger' | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-raised">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p
        className={cn(
          'type-kpi mt-2',
          tone === 'danger'
            ? 'text-danger-fg'
            : tone === 'warning'
              ? 'text-warning-fg'
              : 'text-primary',
        )}
      >
        {value}
      </p>
      <p className="type-kpi-label mt-1.5 text-ink-muted">{sub}</p>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold tracking-wider text-ink-secondary uppercase">
          {title}
        </span>
        {note && <span className="text-xs font-normal text-ink-muted">{note}</span>}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

/** Executive Summary: demand, movement and people on board, for a date range and zone. */
export default function ExecutiveSummaryPage() {
  const [from, setFrom] = useState(gstDayKey(new Date()));
  const [to, setTo] = useState(plusDays(6));
  const [zone, setZone] = useState('');
  const all = { page: 1, pageSize: 500 };
  const bookings = useDataset('bookings', all).data?.items ?? [];
  const departures = useDataset('departures', all).data?.items ?? [];
  const hems = useDataset('hems', all).data?.items ?? [];
  const pob = usePobQuery<PobDashboard>('/dashboard').data;

  const zones = pob?.zones ?? [];
  const sites = zones
    .filter((z) => !zone || z.code === zone)
    .flatMap((z) => z.sites.map((s) => ({ ...s, zone: z.name })));
  // A booking is in the zone when its destination is one of the zone's sites.
  const zoneSites = new Set(sites.map((s) => s.name));
  const inRange = bookings.filter((b) => {
    const day = str(b.serviceDate);
    const dest = str(b.route).split(' → ').at(-1) ?? '';
    return day >= from && day <= to && (!zone || zoneSites.has(dest));
  });
  const count = (...statuses: string[]) =>
    inRange.filter((b) => statuses.includes(str(b.status))).length;
  const confirmed = count('Confirmed', 'Checked in');
  const today = gstDayKey(new Date());
  const noShows = inRange.filter(
    (b) => b.status === 'Confirmed' && str(b.serviceDate) < today,
  ).length;
  const completed = departures.filter(
    (d) => d.status === 'Departed' || d.status === 'Arrived',
  ).length;
  const total = sites.reduce((s, x) => s + x.pob, 0);
  const male = sites.reduce((s, x) => s + x.male, 0);
  const female = sites.reduce((s, x) => s + x.female, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Summary"
        subtitle="Demand, movement and people on board across the offshore operation"
      />
      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-5">
        <label className="space-y-1.5">
          <span className={LABEL}>From</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className={cn(CONTROL, 'min-h-touch px-3')}
          />
        </label>
        <label className="space-y-1.5">
          <span className={LABEL}>To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className={cn(CONTROL, 'min-h-touch px-3')}
          />
        </label>
        <label className="min-w-48 space-y-1.5">
          <span className={LABEL}>Zone</span>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className={cn(CONTROL, 'min-h-touch w-full px-3')}
          >
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z.code} value={z.code}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <Group title="Demand">
        <Tile label="Total bookings" value={n(inRange.length)} sub="Raised for travel in range" />
        <Tile
          label="Confirmed"
          value={n(confirmed)}
          sub={`${String(pct(confirmed, inRange.length))}% of bookings`}
        />
        <Tile label="Waitlisted" value={n(count('Waitlisted'))} sub="Waiting for a seat" />
        <Tile
          label="Cancelled"
          value={n(count('Cancelled', 'Rejected'))}
          sub="Withdrawn or not approved"
        />
      </Group>

      <Group title="Movement">
        <Tile
          label="Trips completed"
          value={n(completed)}
          sub={`of ${n(departures.length)} published today`}
        />
        <Tile
          label="No-shows"
          value={n(noShows)}
          sub="Held a seat, did not board"
          tone={noShows > 0 ? 'warning' : undefined}
        />
        <Tile
          label="VIP movements"
          value={n(inRange.filter((b) => b.category === 'VIP').length)}
          sub="Bookings carrying VIP status"
        />
        <Tile
          label="Evacuation / emergency"
          value={n(hems.length)}
          sub="HEMS flights raised"
          tone={hems.length > 0 ? 'danger' : undefined}
        />
      </Group>

      <Group title="People on board" note="Live — not affected by the date range">
        <Tile label="Total POB" value={n(total)} sub={`${String(sites.length)} sites`} />
        <Tile label="Male" value={n(male)} sub={`${String(pct(male, total))}% of POB`} />
        <Tile label="Female" value={n(female)} sub={`${String(pct(female, total))}% of POB`} />
        <Tile
          label="Gender ratio"
          value={female > 0 ? `${(male / female).toFixed(1)} : 1` : '—'}
          sub="Male to female"
        />
      </Group>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <h2 className="flex items-center gap-2 border-b border-border px-5 py-3.5 text-sm font-semibold text-ink">
          <Users className="size-4 text-primary" aria-hidden />
          POB per location
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">POB per location</caption>
            <thead>
              <tr className="border-b border-border bg-table-head">
                {['Location', 'Zone', 'POB', 'Male', 'Female', 'Female share'].map((h, i) => (
                  <th key={h} scope="col" className={cn(TH, i >= 2 && 'text-end')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...sites]
                .sort((a, b) => b.pob - a.pob)
                .map((s) => (
                  <tr
                    key={s.code}
                    className="border-b border-border/60 last:border-0 hover:bg-table-row-hover"
                  >
                    <td className="px-5 py-3 font-medium text-ink">{s.name}</td>
                    <td className="px-5 py-3 text-ink-secondary">{s.zone}</td>
                    <td className="px-5 py-3 text-end font-bold text-ink">{n(s.pob)}</td>
                    <td className="px-5 py-3 text-end text-ink">{n(s.male)}</td>
                    <td className="px-5 py-3 text-end text-ink">{n(s.female)}</td>
                    <td className="px-5 py-3 text-end text-ink-secondary">
                      {pct(s.female, s.pob)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
