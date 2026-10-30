import { FileDown, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { RowActions } from '../../modules/administration/masters/master-page';
import { cn } from '../../shared/lib/cn';
import { useLocalListParams } from '../../shared/lists/list-params';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Drawer } from '../../shared/ui/drawer';
import { FilterBar } from '../../shared/ui/filter-bar';
import { FilterSelect } from '../../shared/ui/filter-select';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { usePobQuery } from './pob-api';
import {
  type PobPerson,
  type PobSiteDetail,
  daysBetween,
  longDate,
  useSites,
  utilisation,
} from './sites-api';
import type { ListPage } from '../../modules/administration/masters/master-resource';

/** The day the original demo's sample describes (see POB_TODAY in the mock). */
const TODAY = '2026-10-06';
const options = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));
const EVAC = ['T1 - Essential Ops', 'T2 - Non-Essential', 'T3 - Visitor / Temp', 'T4 - Medical'];

function PersonRecord({ person, siteName }: { person: PobPerson; siteName: string }) {
  const atSite = daysBetween(person.checkIn, TODAY);
  const offshore = daysBetween(person.offshoreSince, TODAY);
  const facts: [string, string][] = [
    ['Optima / HSE Passport', person.optima],
    ['Employer', person.company],
    ['Role', person.role],
    ['Category', person.category],
    ['Nationality', person.nationality],
    ['HSE Passport', longDate(person.hseExpiry)],
    ['Currently at', siteName],
    ['Aboard', person.aboard || '—'],
    ['At this site', `${String(atSite)} days`],
    ['Offshore since', longDate(person.offshoreSince)],
    ['Recorded by', person.recordedBy],
  ];
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-ink-muted">Days offshore</dt>
          <dd className="flex items-center gap-2 text-ink">
            {offshore}
            <StatusPill tone={offshore > 28 ? 'warning' : 'neutral'}>
              {offshore > 28 ? 'Over limit' : 'Within limit'}
            </StatusPill>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">HSE status</dt>
          <dd>
            <StatusPill
              tone={
                person.hseStatus === 'Expired'
                  ? 'danger'
                  : person.hseStatus === 'Expiring soon'
                    ? 'warning'
                    : 'success'
              }
            >
              {person.hseStatus}
            </StatusPill>
          </dd>
        </div>
      </dl>
      <section>
        <h3 className="mb-2 text-xs font-semibold text-ink-muted">Movement</h3>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2 text-ink">
            {siteName} <StatusPill tone="info">NOW</StatusPill>
            <span className="text-ink-muted">
              {longDate(person.checkIn)} onward · {atSite} days
            </span>
          </li>
          {person.previous && (
            <li className="text-ink">
              {person.previous.site}{' '}
              <span className="text-ink-muted">
                {longDate(person.previous.from)} – {longDate(person.previous.to)} ·{' '}
                {daysBetween(person.previous.from, person.previous.to) === 0
                  ? 'same day, counts no days'
                  : `${String(daysBetween(person.previous.from, person.previous.to))} days`}
              </span>
            </li>
          )}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold text-ink-muted">Recorded entries</h3>
        {person.recordedBy === 'Dispatch' ? (
          <p className="text-ink-muted">
            Nothing was entered by hand for this person — their presence came through the dispatch
            process.
          </p>
        ) : person.recordedBy === 'Vessel check-in' ? (
          <p className="text-ink">
            {longDate(person.checkIn)} · Boarded {person.aboard} at {siteName}
            <span className="block text-xs text-ink-muted">Marine Focal Point</span>
          </p>
        ) : (
          <p className="text-ink">
            {longDate(person.checkIn)} · Moved to {siteName} — arrived by a chartered vessel from
            Abu Dhabi
            <span className="block text-xs text-ink-muted">Site Focal Point</span>
          </p>
        )}
      </section>
      <p className="text-xs text-ink-muted">
        Musters at {person.musterPoint} on {siteName}.
      </p>
    </div>
  );
}

/** Asset Detail: everybody recorded on one site, chosen by `?location=<code>`. */
export default function AssetPage() {
  const [search, setSearch] = useSearchParams();
  const { data: sites } = useSites();
  const code = search.get('location') ?? sites?.[0]?.code ?? '';
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState<PobPerson | null>(null);
  const { params, update, apiQuery } = useLocalListParams({ pageSize: 20 });
  const { data: site } = usePobQuery<PobSiteDetail>(`/sites/${code}`, code !== '');
  const query = new URLSearchParams(
    Object.entries(apiQuery).map(([k, v]) => [k, String(v)] as [string, string]),
  );
  const { data: list, isFetching } = usePobQuery<ListPage<PobPerson>>(
    `/sites/${code}/people?${query.toString()}`,
    code !== '',
  );

  const choose = (next: string) => {
    setSearch({ location: next }, { replace: false });
    update({ q: '', filters: {} });
    setPicking(false);
  };
  const filter = (name: string) => (value: string | undefined) =>
    update({
      filters: Object.fromEntries(
        Object.entries({ ...params.filters, [name]: value ?? '' }).filter(([, v]) => v !== ''),
      ),
    });

  const offset = (params.page - 1) * params.pageSize;
  const columns: Column<PobPerson>[] = [
    { id: 'n', header: '#', cell: (p) => (list?.items.indexOf(p) ?? 0) + offset + 1 },
    { id: 'name', header: 'Name', cell: (p) => p.name, sortField: 'name' },
    { id: 'optima', header: 'Optima', cell: (p) => p.optima, sortField: 'optima' },
    { id: 'company', header: 'Company', cell: (p) => p.company, sortField: 'company' },
    {
      id: 'nationality',
      header: 'Nationality',
      cell: (p) => p.nationality,
      sortField: 'nationality',
    },
    { id: 'gender', header: 'Gender', cell: (p) => p.gender, sortField: 'gender' },
    { id: 'category', header: 'Category', cell: (p) => p.category, sortField: 'category' },
    {
      id: 'evac',
      header: 'Evac Cat',
      cell: (p) => p.evacCategory,
      sortField: 'evacCategory',
    },
    { id: 'checkIn', header: 'Check-in', cell: (p) => p.checkIn, sortField: 'checkIn' },
    { id: 'muster', header: 'Muster Pt', cell: (p) => p.musterPoint, sortField: 'musterPoint' },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <RowActions
          label={`Actions for ${p.name}`}
          items={[{ label: 'Full record', run: () => setOpen(p) }]}
        />
      ),
    },
  ];
  const activeFilters = Object.keys(params.filters).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Detail"
        subtitle={
          site
            ? `${site.name} (${site.type}) — everybody recorded on this site`
            : 'Everybody recorded on one site'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setPicking((v) => !v)}>
              <LayoutGrid className="size-4" aria-hidden />
              Choose a different site
            </Button>
            <select
              aria-label="Site"
              value={code}
              onChange={(e) => choose(e.target.value)}
              className="min-h-touch rounded-lg border border-border bg-card px-2.5 py-2 text-sm text-ink"
            >
              {(sites ?? []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} · {s.pob}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => window.print()}>
              <FileDown className="size-4" aria-hidden />
              Export PDF
            </Button>
          </>
        }
      />

      {picking && (
        <section aria-label="Sites" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(sites ?? []).map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => choose(s.code)}
              className={cn(
                'rounded-xl border bg-card p-4 text-start transition-all hover:border-primary/40 hover:shadow-raised',
                s.code === code ? 'border-primary' : 'border-border',
              )}
            >
              <span className="text-xs font-medium text-primary">{s.name}</span>
              <span className="mt-1 block type-kpi text-ink">{s.pob}</span>
              <span className="mt-1 block text-xs text-ink-muted">
                on board · {s.pob - s.aboardVessels} on site
                {s.aboardVessels > 0 && `, ${String(s.aboardVessels)} aboard vessels`}
              </span>
            </button>
          ))}
        </section>
      )}

      {site && (
        <>
          <h2 className="text-lg font-semibold text-ink">{site.name}</h2>
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ['Total POB', site.pob],
                ['POB Limit', `${String(site.limit)} (${String(utilisation(site))}%)`],
                ['Male / Female', `${String(site.male)} / ${String(site.female)}`],
                ['Residents', site.residents],
                ['Arrived Today', site.arrivedToday],
                ['Departed Today', site.departedToday],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="text-lg font-semibold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <FilterBar
            q={params.q}
            onQChange={(q) => update({ q })}
            placeholder="Search name or optima..."
            activeCount={activeFilters}
            onClear={() => update({ q: '', filters: {} })}
          >
            <FilterSelect
              label="Company"
              allLabel="All Companies"
              value={params.filters.company}
              options={options(site.companies)}
              onChange={filter('company')}
            />
            <FilterSelect
              label="Gender"
              allLabel="All Genders"
              value={params.filters.gender}
              options={options(['Male', 'Female'])}
              onChange={filter('gender')}
            />
            <FilterSelect
              label="Category"
              allLabel="All Categories"
              value={params.filters.category}
              options={options(['Resident', 'Contractor', 'Visitor'])}
              onChange={filter('category')}
            />
            <FilterSelect
              label="Evac"
              allLabel="All Evac Categories"
              value={params.filters.evacCategory}
              options={options(EVAC)}
              onChange={filter('evacCategory')}
            />
            <span className="text-xs text-ink-muted">{list?.total ?? 0} results</span>
          </FilterBar>

          <DataTable
            caption={`People on ${site.name}`}
            columns={columns}
            rows={list?.items}
            total={list?.total}
            rowKey={(p) => p.id}
            params={params}
            onParamsChange={update}
            loading={isFetching}
            onRowClick={setOpen}
          />
        </>
      )}

      <Drawer
        open={open !== null}
        onOpenChange={(o) => {
          if (!o) setOpen(null);
        }}
        title={open?.name ?? ''}
        description="Full record"
      >
        {open && site && <PersonRecord person={open} siteName={site.name} />}
      </Drawer>
    </div>
  );
}
