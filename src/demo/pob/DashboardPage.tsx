import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileWarning,
  Gauge,
  LifeBuoy,
  Map as MapIcon,
  ShieldAlert,
  ShieldX,
  UserCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { cn } from '../../shared/lib/cn';
import { CONTROL } from '../../shared/ui/control-styles';
import { type AttentionItem, AttentionPanel, KpiGroup } from '../../shared/ui/attention-panel';
import { buttonVariants } from '../../shared/ui/button-variants';
import { DonutChart } from '../../shared/ui/donut-chart';
import { PageHeader } from '../../shared/ui/page-header';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import { TONE_DOT } from '../../shared/ui/tone';
import { usePobQuery } from './pob-api';
import {
  type PobDashboard,
  type PobSiteStats,
  capacityTone,
  statusTone,
  useSites,
  utilisation,
} from './sites-api';

const ZONES = [
  { value: 'DAS', label: 'Das' },
  { value: 'ZAKUM', label: 'Zakum' },
  { value: 'UMM-SHAIF', label: 'Umm Shaif' },
  { value: 'BUHASER', label: 'Buhaser' },
  { value: 'GHASHA', label: 'Ghasha' },
  { value: 'OTHER', label: 'Other' },
];
const CREW = [
  { value: '', label: 'All' },
  { value: 'Resident', label: 'Residents' },
  { value: 'Contractor', label: 'Contractors' },
  { value: 'Visitor', label: 'Visitors' },
];
const GENDER = [
  { value: '', label: 'All' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];
const EVAC = ['T1 - Essential Ops', 'T2 - Non-Essential', 'T3 - Visitor / Temp', 'T4 - Medical'];
const HSE = [
  { value: 'Valid', label: 'HSE Passport valid' },
  { value: 'Expiring soon', label: 'HSE Passport expiring soon' },
  { value: 'Expired', label: 'HSE Passport expired' },
];
const ESSENTIAL = [
  { value: 'essential', label: 'Essential positions only' },
  { value: 'non-essential', label: 'Non-essential only' },
];

type Filters = Record<
  'zone' | 'site' | 'crew' | 'gender' | 'nationality' | 'evac' | 'hse' | 'essential',
  string
>;
const NO_FILTERS: Filters = {
  zone: '',
  site: '',
  crew: '',
  gender: '',
  nationality: '',
  evac: '',
  hse: '',
  essential: '',
};

const SELECT = `${CONTROL} min-h-touch px-2.5`;

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <span className="text-xs text-ink-secondary">{label}</span>
      <div className="flex rounded-lg border border-border bg-surface-muted p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              value === o.value
                ? 'bg-primary text-on-primary'
                : 'text-ink-secondary hover:bg-card hover:text-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SiteCard({ site, filtered }: { site: PobSiteStats; filtered: boolean }) {
  const pct = utilisation(site);
  const onSite = site.pob - site.aboardVessels;
  return (
    <Link
      to={`${routeOf('pob.asset')}?location=${encodeURIComponent(site.code)}`}
      className="block space-y-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{site.name}</p>
          <p className="text-xs text-ink-muted">
            {site.type} · {site.zoneName}
          </p>
        </div>
        <StatusPill tone={statusTone(site.status)}>{site.status}</StatusPill>
      </div>
      <div>
        <p className="type-kpi text-ink tabular-nums">{filtered ? site.matching : site.pob}</p>
        {filtered && <p className="mt-1 text-xs text-ink-muted">Total: {site.pob}</p>}
        {site.aboardVessels > 0 && (
          <p className="mt-1 text-xs text-ink-muted">
            {onSite} on site · {site.aboardVessels} aboard vessels
          </p>
        )}
      </div>
      <div>
        <div className="flex justify-between text-xs">
          <span className="text-ink">
            {site.pob} / {site.limit}
          </span>
          <span className="text-ink-muted">POB Limit: {pct}% utilization</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className={cn('h-full rounded-full', TONE_DOT[capacityTone(pct)])}
            style={{ width: `${String(Math.min(pct, 100))}%` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-secondary">
        <div>
          Male <span className="font-semibold text-ink">{site.male}</span>
        </div>
        <div>
          Female <span className="font-semibold text-ink">{site.female}</span>
        </div>
        <div>
          Residents <span className="font-semibold text-ink">{site.residents}</span>
        </div>
        <div>
          Visitors <span className="font-semibold text-ink">{site.visitors}</span>
        </div>
        <div>
          ↓ Arrived <span className="font-semibold text-ink">{site.arrivedToday}</span>
        </div>
        <div>
          ↑ Departed <span className="font-semibold text-ink">{site.departedToday}</span>
        </div>
      </dl>
      <div className="space-y-2 border-t border-border pt-3 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-ink-muted">Lifeboat Capacity</span>
          <span className="text-ink">
            {site.lifeboat === null
              ? `${String(site.pob)} not recorded`
              : `${String(site.pob)} / ${String(site.lifeboat)}`}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink-muted">Focal point</span>
          <span className="text-end text-ink">
            {site.focalPoint}
            <span className="block text-ink-muted">{site.focalEmail}</span>
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink-muted">Conditions</span>
          <span className="text-end text-ink">{site.conditions}</span>
        </div>
      </div>
    </Link>
  );
}

/** A site at 80% or more of its POB limit, not Normal, or with more people than lifeboat seats. */
function siteAttention(site: PobSiteStats): AttentionItem | null {
  const pct = utilisation(site);
  const lifeboatShort = site.lifeboat !== null && site.pob > site.lifeboat;
  if (pct < 80 && site.status === 'Normal' && !lifeboatShort) return null;
  const reasons = [
    `${String(pct)}% of POB limit`,
    ...(site.status === 'Normal' ? [] : [`Status ${site.status}`]),
    ...(lifeboatShort ? [`Lifeboat seats for ${String(site.lifeboat)} only`] : []),
  ];
  const danger = pct >= 90 || site.status === 'Critical' || lifeboatShort;
  return {
    key: site.code,
    icon: lifeboatShort ? LifeBuoy : Gauge,
    tone: danger ? 'danger' : 'warning',
    text: `${site.name} — ${String(site.pob)} / ${String(site.limit)} POB`,
    detail: `${site.zoneName} · ${reasons.join(' · ')}`,
    pill:
      pct > 100
        ? 'Over limit'
        : lifeboatShort
          ? 'Lifeboat'
          : site.status === 'Normal'
            ? 'Near limit'
            : site.status,
    to: `${routeOf('pob.asset')}?location=${encodeURIComponent(site.code)}`,
  };
}

/** POB Dashboard: everybody on board across the offshore sites, filterable, per zone. */
export default function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = (name: keyof Filters) => (value: string) =>
    setFilters((f) => ({ ...f, [name]: value }));
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ''));
  const { data } = usePobQuery<PobDashboard>(`/dashboard?${query.toString()}`);
  const { data: sites } = useSites();
  const personFiltered = ['crew', 'gender', 'nationality', 'evac', 'hse', 'essential'].some(
    (k) => filters[k as keyof Filters] !== '',
  );
  const n = (v: number | undefined) => (v ?? 0).toLocaleString('en');
  const attention = (data?.zones ?? [])
    .flatMap((z) => z.sites)
    // Fullest first, so the sites closest to their limit lead the list.
    .sort((a, b) => utilisation(b) - utilisation(a))
    .flatMap((site) => siteAttention(site) ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="POB Dashboard"
        subtitle="Personnel On Board — Centralized view across all offshore locations"
        actions={
          <>
            <Link to={routeOf('pob.map')} className={buttonVariants({ variant: 'secondary' })}>
              <MapIcon className="size-4" aria-hidden />
              Map View
            </Link>
            <Link
              to={routeOf('reports.evacuation')}
              className={buttonVariants({ variant: 'secondary' })}
            >
              <FileWarning className="size-4" aria-hidden />
              Evacuation Report
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total POB — All Sites"
            value={n(data?.total)}
            icon={<Users className="size-4" aria-hidden />}
          />
          <StatCard
            title="Arrivals Today"
            value={n(data?.arrivedToday)}
            icon={<ArrowDownToLine className="size-4" aria-hidden />}
          />
          <StatCard
            title="Departures Today"
            value={n(data?.departedToday)}
            icon={<ArrowUpFromLine className="size-4" aria-hidden />}
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <DonutChart
            title="Crew type"
            size={150}
            slices={[
              { label: 'Residents', value: data?.mix.residents ?? 0, tone: 'info' },
              { label: 'Contractors', value: data?.mix.contractors ?? 0, tone: 'accent' },
              { label: 'Visitors', value: data?.mix.visitors ?? 0, tone: 'warning' },
            ]}
          />
        </div>
      </div>

      <AttentionPanel title="Sites needing attention" items={attention} />

      <section
        aria-label="Filter"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
      >
        <span className="text-xs font-semibold text-ink-muted">Filter:</span>
        <label className="flex items-center gap-2 text-xs text-ink-secondary">
          Zone
          <select
            className={SELECT}
            value={filters.zone}
            onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value, site: '' }))}
          >
            <option value="">All</option>
            {ZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-secondary">
          Asset
          <select
            className={SELECT}
            value={filters.site}
            onChange={(e) => set('site')(e.target.value)}
          >
            <option value="">All assets</option>
            {(sites ?? [])
              .filter((s) => !filters.zone || s.zone === filters.zone)
              .map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <Segmented label="Crew Type" options={CREW} value={filters.crew} onChange={set('crew')} />
        <Segmented
          label="Gender"
          options={GENDER}
          value={filters.gender}
          onChange={set('gender')}
        />
        <select
          aria-label="Nationality"
          className={SELECT}
          value={filters.nationality}
          onChange={(e) => set('nationality')(e.target.value)}
        >
          <option value="">All nationalities</option>
          {(data?.nationalities ?? []).map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Evacuation category"
          className={SELECT}
          value={filters.evac}
          onChange={(e) => set('evac')(e.target.value)}
        >
          <option value="">All evacuation categories</option>
          {EVAC.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="HSE status"
          className={SELECT}
          value={filters.hse}
          onChange={(e) => set('hse')(e.target.value)}
        >
          <option value="">Any HSE status</option>
          {HSE.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Essential positions"
          className={SELECT}
          value={filters.essential}
          onChange={(e) => set('essential')(e.target.value)}
        >
          <option value="">Essential and non-essential</option>
          {ESSENTIAL.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <span className="ms-auto text-xs text-ink-muted" aria-live="polite">
          {n(data?.matching)} of {n(data?.total)} people
        </span>
      </section>

      <KpiGroup label="Compliance & readiness" className="md:grid-cols-3">
        <StatCard
          title="HSE Passport expired"
          value={data?.hseExpired ?? 0}
          tone="danger"
          subline="Offshore now with a certificate that has run out"
          icon={<ShieldX className="size-4" aria-hidden />}
        />
        <StatCard
          title="HSE Passport expiring"
          value={data?.hseExpiring ?? 0}
          tone="warning"
          subline="Due to expire within 30 days"
          icon={<ShieldAlert className="size-4" aria-hidden />}
        />
        <StatCard
          title="Would stay on site if it were downmanned"
          value={`${n(data?.essential)} of ${n(data?.matching)}`}
          icon={<UserCheck className="size-4" aria-hidden />}
        />
      </KpiGroup>

      {data?.zones.map((zone) => (
        <section key={zone.code} aria-label={`${zone.name} Zone`} className="space-y-3">
          <h2 className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink-secondary">{zone.name} Zone</span>
            <span className="text-xs text-ink-muted">{zone.pob} POB</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {zone.sites.map((site) => (
              <SiteCard key={site.code} site={site} filtered={personFiltered} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
