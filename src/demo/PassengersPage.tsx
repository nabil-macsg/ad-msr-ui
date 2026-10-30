import { HardHat, type LucideIcon, Radar, ShieldAlert, Star, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DemoRow } from '../mock/data/modules';
import { setFilter } from '../modules/administration/masters/filters';
import { cn } from '../shared/lib/cn';
import { useListParams } from '../shared/lists/list-params';
import { type Column, DataTable } from '../shared/ui/data-table';
import { Drawer } from '../shared/ui/drawer';
import { FilterBar } from '../shared/ui/filter-bar';
import { FilterSelect } from '../shared/ui/filter-select';
import { PageHeader } from '../shared/ui/page-header';
import { StatusPill } from '../shared/ui/status-pill';
import { TONE_PILL, type Tone } from '../shared/ui/tone';
import { gstDayKey } from '../shared/time/format';
import { useDataset } from './demo-api';

const CATEGORY: Readonly<Record<string, { tone: Tone; icon: LucideIcon }>> = {
  'Direct Hire': { tone: 'info', icon: Users },
  Contractor: { tone: 'warning', icon: HardHat },
  'Radar/NGCPA': { tone: 'success', icon: Radar },
  Visitor: { tone: 'accent', icon: UserRound },
};
const BOOKING_TONE: Readonly<Record<string, Tone>> = {
  Confirmed: 'success',
  'Checked in': 'success',
  'Pending approval': 'warning',
  Waitlisted: 'accent',
  Cancelled: 'danger',
};
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const day = (v: unknown) =>
  str(v)
    ? new Date(`${str(v)}T00:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const initials = (name: unknown) =>
  str(name)
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .filter((_, i, all) => i === 0 || i === all.length - 1)
    .join('')
    .toUpperCase();
const daysTo = (iso: unknown) =>
  Math.round(
    (Date.parse(`${str(iso)}T00:00:00Z`) - Date.parse(`${gstDayKey(new Date())}T00:00:00Z`)) /
      86_400_000,
  );
/** Expired red, within 30 days amber, otherwise green. */
const expiryTone = (iso: unknown): Tone => {
  const d = daysTo(iso);
  return d < 0 ? 'danger' : d <= 30 ? 'warning' : 'success';
};

function CategoryPill({ category }: { category: unknown }) {
  const c = CATEGORY[str(category)] ?? { tone: 'neutral' as Tone, icon: UserRound };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_PILL[c.tone],
      )}
    >
      <c.icon className="size-3.5" aria-hidden />
      {str(category)}
    </span>
  );
}

function Avatar({ name, large }: { name: unknown; large?: boolean }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        large
          ? 'size-14 bg-primary text-lg text-on-primary'
          : 'size-9 bg-surface-muted text-xs text-ink-secondary',
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

const SECTION = 'text-xs font-semibold tracking-wider text-ink-muted uppercase';
const SOURCE =
  'rounded-md border border-border bg-surface-muted px-2 py-0.5 text-2xs font-semibold tracking-wider text-ink-secondary uppercase';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function Details({ person, onClose }: { person: DemoRow; onClose: () => void }) {
  const trips = useDataset('bookings', {
    'filter[passenger]': str(person.name),
    sort: 'serviceDate:desc',
  });
  const checks = [
    { label: 'HSE Passport', expiry: person.hseExpiry },
    { label: 'Security Clearance', expiry: person.securityExpiry },
    { label: `T-BOSIET (${str(person.bosiet)})`, expiry: person.bosietExpiry },
    { label: `T-HUET (${str(person.huet)})`, expiry: person.huetExpiry },
  ];
  return (
    <Drawer open onOpenChange={(open) => !open && onClose()} title={str(person.name)}>
      <div className="space-y-7">
        <div className="flex items-center gap-4">
          <Avatar name={person.name} large />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-lg font-semibold text-ink">
              {str(person.name)}
              {person.isVip === true && (
                <Star className="size-4 fill-warning-fg text-warning-fg" aria-label="VIP" />
              )}
            </p>
            <p className="text-sm text-ink-secondary">
              {str(person.optima)} · {str(person.employer)}
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h3 className={SECTION}>Identity</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Category">
              <CategoryPill category={person.category} />
            </Fact>
            <Fact label="Nationality">{str(person.nationality)}</Fact>
            <Fact label="Gender">{str(person.gender)}</Fact>
            <Fact label="Body Weight">{str(person.weight)} kg</Fact>
          </dl>
        </section>

        <section className="space-y-3">
          <h3 className="flex flex-wrap items-center gap-2">
            <span className={SECTION}>Compliance</span>
            <span className={SOURCE}>via HSE Passport</span>
            <span className={SOURCE}>via Optima</span>
          </h3>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li
                key={c.label}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium',
                  TONE_PILL[expiryTone(c.expiry)],
                )}
              >
                <span>{c.label}</span>
                <span className="tabular-nums">{str(c.expiry)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2">
            <span className={SECTION}>Employment & Rotation</span>
            <span className={SOURCE}>via SAP</span>
          </h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Employer">{str(person.employer)}</Fact>
            <Fact label="Department">{str(person.department)}</Fact>
            <Fact label="Designation">{str(person.designation)}</Fact>
            <Fact label="Rotation">{str(person.rotation)}</Fact>
            <Fact label="Cost Object">
              <span className="font-mono">{str(person.costObject)}</span>
            </Fact>
          </dl>
        </section>

        <section className="space-y-3">
          <h3 className={SECTION}>Travel History</h3>
          <ul className="space-y-2">
            {(trips.data?.items ?? []).map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-ink">{str(b.reference)}</p>
                  <p className="text-xs text-ink-muted">
                    {str(b.serviceDate)} · {str(b.route)}
                  </p>
                </div>
                <StatusPill tone={BOOKING_TONE[str(b.status)] ?? 'neutral'}>
                  {str(b.status) === 'Pending approval' ? 'Pending' : str(b.status)}
                </StatusPill>
              </li>
            ))}
            {trips.data?.items.length === 0 && (
              <li className="text-sm text-ink-muted">No trips booked yet.</li>
            )}
          </ul>
        </section>
      </div>
    </Drawer>
  );
}

/** Passengers: people who have travelled or are booked to travel, with their compliance. */
export default function PassengersPage() {
  const { t } = useTranslation();
  const list = useListParams({ sort: { field: 'name', dir: 'asc' } });
  const rows = useDataset('passengers', list.apiQuery);
  const blocked = useDataset('passengers', {
    page: 1,
    pageSize: 1,
    'filter[hseBlocked]': 'true',
    ...(list.params.filters.hasBookings
      ? { 'filter[hasBookings]': list.params.filters.hasBookings }
      : {}),
  });
  const [viewing, setViewing] = useState<DemoRow | null>(null);

  const columns: Column<DemoRow>[] = [
    {
      id: 'name',
      header: 'Person',
      sortField: 'name',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-ink">
              {str(r.name)}
              {r.isVip === true && (
                <Star className="size-3.5 fill-warning-fg text-warning-fg" aria-label="VIP" />
              )}
            </p>
            <p className="font-mono text-xs text-ink-muted">{str(r.optima)}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      sortField: 'category',
      cell: (r) => <CategoryPill category={r.category} />,
    },
    { id: 'employer', header: 'Employer', sortField: 'employer', cell: (r) => str(r.employer) },
    {
      id: 'designation',
      header: 'Designation / Department',
      sortField: 'designation',
      cell: (r) => (
        <div>
          <p className="text-ink">{str(r.designation)}</p>
          <p className="text-xs text-ink-muted">{str(r.department)}</p>
        </div>
      ),
    },
    {
      id: 'hse',
      header: 'HSE Passport',
      sortField: 'hseExpiry',
      cell: (r) => <StatusPill tone={expiryTone(r.hseExpiry)}>{day(r.hseExpiry)}</StatusPill>,
    },
    { id: 'trips', header: 'Trips', sortField: 'trips', align: 'right', cell: (r) => str(r.trips) },
    { id: 'last', header: 'Last Trip', sortField: 'lastTrip', cell: (r) => day(r.lastTrip) },
    { id: 'next', header: 'Next Trip', sortField: 'nextTrip', cell: (r) => day(r.nextTrip) },
  ];

  const blockedCount = blocked.data?.total ?? 0;
  return (
    <div className="space-y-5">
      <PageHeader title="Passengers" subtitle="People who have travelled or are booked to travel" />
      <FilterBar
        q={list.params.q}
        onQChange={(q) => list.update({ q })}
        placeholder="Search name, Optima ID, company, department, designation…"
        activeCount={Object.keys(list.params.filters).length}
        onClear={() => list.update({ q: '', filters: {} })}
      >
        <FilterSelect
          label="Bookings"
          allLabel="All passengers"
          value={list.params.filters.hasBookings}
          options={[
            { value: 'true', label: 'With bookings' },
            { value: 'false', label: 'No bookings yet' },
          ]}
          onChange={(v) => setFilter(list, 'hasBookings', v)}
        />
        <FilterSelect
          label="Category"
          allLabel={t('ui.filter.all')}
          value={list.params.filters.category}
          options={Object.keys(CATEGORY).map((c) => ({ value: c, label: c }))}
          onChange={(v) => setFilter(list, 'category', v)}
        />
      </FilterBar>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-ink-secondary">
          {(rows.data?.total ?? 0).toLocaleString('en')} people
        </span>
        {blockedCount > 0 && (
          <button
            type="button"
            onClick={() => setFilter(list, 'hseBlocked', 'true')}
            className="inline-flex items-center gap-1.5 font-medium text-danger-fg hover:underline"
          >
            <ShieldAlert className="size-4" aria-hidden />
            {blockedCount} blocked on HSE Passport
          </button>
        )}
      </div>
      <DataTable
        caption="Passengers"
        columns={columns}
        rows={rows.data?.items}
        total={rows.data?.total}
        rowKey={(r) => r.id}
        params={list.params}
        onParamsChange={list.update}
        loading={rows.isFetching}
        onRowClick={setViewing}
        emptyTitle="No passengers match these filters."
      />
      {viewing && <Details person={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
