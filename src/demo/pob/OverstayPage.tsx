import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type {
  OverstayPerson,
  OverstayStatus,
  OverstaySummary,
} from '../../mock/data/demo-pob-overstay';
import type { ListParams } from '../../shared/lists/list-params';
import { useListParams } from '../../shared/lists/list-params';
import { cn } from '../../shared/lib/cn';
import type { ListPage } from '../../modules/administration/masters/master-resource';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Drawer } from '../../shared/ui/drawer';
import { FilterBar } from '../../shared/ui/filter-bar';
import { FilterSelect } from '../../shared/ui/filter-select';
import { PageHeader } from '../../shared/ui/page-header';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import { TONE_TEXT, type Tone } from '../../shared/ui/tone';
import { usePobQuery } from './pob-api';

const STATUSES: readonly OverstayStatus[] = ['Over 90 days', 'Approaching 90 days', 'Within limit'];
const TONE: Record<OverstayStatus, Tone> = {
  'Over 90 days': 'danger',
  'Approaching 90 days': 'warning',
  'Within limit': 'success',
};

const dateText = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** The list address with one status filter, for the KPI cards. */
const statusLink = (status: OverstayStatus) =>
  `?${new URLSearchParams({ 'filter[status]': status, sort: 'days:desc' }).toString()}`;

const COLUMNS: Column<OverstayPerson>[] = [
  {
    id: 'person',
    header: 'Person',
    sortField: 'name',
    cell: (p) => (
      <div>
        <div className="font-medium text-ink">{p.name}</div>
        <div className="font-mono text-xs text-ink-muted">{p.optimaId}</div>
      </div>
    ),
  },
  {
    id: 'company',
    header: 'Company',
    sortField: 'company',
    cell: (p) => (
      <div>
        <div className="text-ink-secondary">{p.company}</div>
        <div className="text-xs text-ink-muted">
          {p.category} · {p.position}
        </div>
      </div>
    ),
  },
  { id: 'site', header: 'Currently at', sortField: 'site', cell: (p) => p.site },
  {
    id: 'offshoreSince',
    header: 'Offshore since',
    sortField: 'offshoreSince',
    cell: (p) => <span className="font-mono text-xs">{dateText(p.offshoreSince)}</span>,
  },
  {
    id: 'days',
    header: 'Days offshore',
    sortField: 'days',
    align: 'right',
    cell: (p) => (
      <div>
        <div className={cn('text-lg font-semibold tabular-nums', TONE_TEXT[TONE[p.status]])}>
          {p.days}
        </div>
        {p.daysAtSite !== null && (
          <div className="text-xs text-ink-muted">{p.daysAtSite} at this site</div>
        )}
      </div>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    sortField: 'status',
    cell: (p) => <StatusPill tone={TONE[p.status]}>{p.status}</StatusPill>,
  },
];

function setFilter(
  list: { params: ListParams; update: (patch: Partial<ListParams>) => void },
  name: string,
  value: string | undefined,
) {
  const filters = Object.fromEntries(
    Object.entries(list.params.filters).filter(([key]) => key !== name),
  );
  list.update({ filters: value === undefined ? filters : { ...filters, [name]: value } });
}

/** Overstay Tracker (original `pob-overstay`): continuous days offshore against the 90-day rule. */
export default function OverstayPage() {
  const list = useListParams({ sort: { field: 'days', dir: 'desc' } });
  const query = new URLSearchParams(
    Object.entries(list.apiQuery).map(([k, v]) => [k, String(v)]),
  ).toString();
  const rows = usePobQuery<ListPage<OverstayPerson>>(`/overstay?${query}`);
  const summary = usePobQuery<OverstaySummary>('/overstay/summary');
  const [viewing, setViewing] = useState<OverstayPerson | null>(null);
  const s = summary.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overstay Tracker"
        subtitle={`Continuous days offshore against the 90-day rule — as at ${s ? dateText(s.asAt) : '…'}`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Over 90 days"
          value={s?.over ?? '–'}
          subline="Past the limit — must be brought ashore"
          tone="danger"
          to={statusLink('Over 90 days')}
        />
        <StatCard
          title="Approaching"
          value={s?.approaching ?? '–'}
          subline="75 to 90 days — plan the rotation"
          tone="warning"
          to={statusLink('Approaching 90 days')}
        />
        <StatCard
          title="Within limit"
          value={s?.within ?? '–'}
          subline="No action needed"
          to={statusLink('Within limit')}
        />
        <StatCard
          title="Longest period"
          value={s ? `${String(s.longest)} days` : '–'}
          subline="The single longest continuous stay offshore"
        />
      </div>
      <FilterBar
        q={list.params.q}
        onQChange={(q) => list.update({ q })}
        placeholder="Name, Optima ID or company"
        activeCount={Object.keys(list.params.filters).length}
        onClear={() => list.update({ q: '', filters: {} })}
      >
        <FilterSelect
          label="Zone"
          allLabel="All zones"
          value={list.params.filters.zone}
          options={(s?.zones ?? []).map((z) => ({ value: z.code, label: z.name }))}
          onChange={(v) => setFilter(list, 'zone', v)}
        />
        <FilterSelect
          label="Site"
          allLabel="All sites"
          value={list.params.filters.site}
          options={(s?.sites ?? []).map((x) => ({ value: x.code, label: x.name }))}
          onChange={(v) => setFilter(list, 'site', v)}
        />
        <FilterSelect
          label="Status"
          allLabel="Everyone"
          value={list.params.filters.status}
          options={STATUSES.map((v) => ({ value: v, label: v }))}
          onChange={(v) => setFilter(list, 'status', v)}
        />
      </FilterBar>
      {rows.isError && <Banner tone="danger">{rows.error.message}</Banner>}
      <DataTable
        caption="Overstay Tracker"
        columns={COLUMNS}
        rows={rows.data?.items}
        total={rows.data?.total}
        rowKey={(p) => p.id}
        params={list.params}
        onParamsChange={list.update}
        loading={rows.isFetching}
        onRowClick={setViewing}
        emptyTitle="No people match these filters."
      />
      {viewing && <PersonDrawer person={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** A person's continuous period offshore: how the days accumulate, and the full record. */
function PersonDrawer({ person: p, onClose }: { person: OverstayPerson; onClose: () => void }) {
  const [full, setFull] = useState(false);
  const limitOn = new Date(Date.parse(`${p.offshoreSince}T00:00:00Z`) + 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const facts: [string, string][] = [
    ['Optima ID', p.optimaId],
    ['Company', p.company],
    ['Category', p.category],
    ['Position', p.position],
    ['Zone', p.zone],
    ['Currently at', p.site],
    ['Offshore since', dateText(p.offshoreSince)],
    ['Days offshore', String(p.days)],
    ['Days at this site', String(p.daysAtSite ?? p.days)],
    ['90-day limit reached on', dateText(limitOn)],
  ];
  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={p.name}
      description={`${p.optimaId} · ${p.company} · ${p.position}`}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <StatusPill tone={TONE[p.status]}>{p.status}</StatusPill>
          <span className="text-sm text-ink-secondary">
            {p.days} days offshore at {p.site}
          </span>
        </div>
        <section aria-labelledby="ovs-accumulate">
          <h2
            id="ovs-accumulate"
            className="mb-2 text-xs font-semibold tracking-wider text-ink-muted uppercase"
          >
            How the {p.days} days accumulate
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {p.stays.map((stay, i) => {
              const current = i === p.stays.length - 1;
              return (
                <span
                  key={`${stay.siteCode}-${stay.arrivedOn}`}
                  className="flex items-center gap-2"
                >
                  {i > 0 && <ChevronRight className="size-3.5 text-ink-muted" aria-hidden />}
                  <span
                    className={cn(
                      'rounded-lg border bg-card px-2.5 py-1 text-xs',
                      current
                        ? 'border-primary/30 font-medium text-primary'
                        : 'border-border text-ink-secondary',
                    )}
                  >
                    {stay.site}
                    <span className="ml-1.5 text-ink-muted">{stay.days}d</span>
                  </span>
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-secondary">
            {p.stays.length > 1
              ? 'Moved between sites without going ashore, so the count carried over rather than restarting.'
              : `One continuous stay at ${p.site} since ${dateText(p.offshoreSince)}.`}
          </p>
          <Button variant="link" className="mt-2 text-xs" onClick={() => setFull((v) => !v)}>
            {full ? 'Hide full record' : 'Full record'}
          </Button>
        </section>
        {full && (
          <section aria-labelledby="ovs-record" className="space-y-4 border-t border-border pt-4">
            <h2 id="ovs-record" className="text-base font-semibold text-ink">
              Full record
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-ink-secondary">{label}</dt>
                  <dd className="text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">Stays in this period offshore</caption>
                <thead className="bg-surface-muted text-left text-xs text-ink-secondary">
                  <tr>
                    <th className="px-3 py-2 font-medium">Site</th>
                    <th className="px-3 py-2 font-medium">Arrived</th>
                    <th className="px-3 py-2 font-medium">Left</th>
                    <th className="px-3 py-2 text-right font-medium">Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {p.stays.map((stay) => (
                    <tr key={`${stay.siteCode}-${stay.arrivedOn}`}>
                      <td className="px-3 py-2 text-ink">{stay.site}</td>
                      <td className="px-3 py-2 text-ink-secondary">{dateText(stay.arrivedOn)}</td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {stay.leftOn ? dateText(stay.leftOn) : 'On site now'}
                      </td>
                      <td className="px-3 py-2 text-right text-ink tabular-nums">{stay.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
}
