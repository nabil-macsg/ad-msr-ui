import { Download } from 'lucide-react';
import { toExportQuery, useListParams } from '../../shared/lists/list-params';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { FilterBar } from '../../shared/ui/filter-bar';
import { FilterSelect } from '../../shared/ui/filter-select';
import { PageHeader } from '../../shared/ui/page-header';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import { usePobQuery } from './pob-api';
import {
  formatDate,
  formatNumber,
  searchOf,
  SITES,
  useReportExport,
  useReportList,
} from './reports-shared';

interface ResidenceRow {
  id: string;
  person: string;
  optima: string;
  company: string;
  site: string;
  arrived: string;
  departed: string | null;
  classification: 'Stay' | 'Day trip';
  days: number;
}

interface Summary {
  date: string;
  days: number;
  stays: number;
  dayTrips: number;
  people: number;
  bySite: { site: string; days: number }[];
}

const COLUMNS: Column<ResidenceRow>[] = [
  {
    id: 'person',
    header: 'Person',
    sortField: 'person',
    cell: (r) => (
      <span>
        <span className="font-medium text-ink">{r.person}</span>{' '}
        <span className="font-mono text-xs text-ink-muted">{r.optima}</span>
      </span>
    ),
  },
  { id: 'company', header: 'Company', sortField: 'company', cell: (r) => r.company },
  { id: 'site', header: 'Site', sortField: 'site', cell: (r) => r.site },
  { id: 'arrived', header: 'Arrived', sortField: 'arrived', cell: (r) => formatDate(r.arrived) },
  {
    id: 'departed',
    header: 'Departed',
    sortField: 'departed',
    cell: (r) =>
      r.departed ? formatDate(r.departed) : <span className="text-ink-muted">still there</span>,
  },
  {
    id: 'classification',
    header: 'Classification',
    sortField: 'classification',
    cell: (r) => (
      <StatusPill tone={r.classification === 'Stay' ? 'neutral' : 'info'}>
        {r.classification}
      </StatusPill>
    ),
  },
  { id: 'days', header: 'Days', sortField: 'days', align: 'right', cell: (r) => r.days },
];

/** Residence Duration: days on site per person per location. */
export default function ResidencePage() {
  const { params, update, apiQuery } = useListParams({ pageSize: 50 });
  const list = useReportList<ResidenceRow>('residence', apiQuery);
  const exportQuery = toExportQuery(params);
  const summary = usePobQuery<Summary>(`/reports/residence/summary?${searchOf(exportQuery)}`);
  const exporter = useReportExport();
  const s = summary.data;
  const max = Math.max(1, ...(s?.bySite.map((b) => b.days) ?? []));

  const setFilter = (name: string, value: string | undefined) => {
    const filters = { ...params.filters };
    if (value) filters[name] = value;
    else delete filters[name];
    update({ filters });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Residence Duration"
        subtitle={`Days on site per person per location, as at ${s ? formatDate(s.date) : '…'}`}
        actions={
          <Button variant="secondary" onClick={() => exporter.run('residence/export', exportQuery)}>
            <Download className="size-4" aria-hidden />
            Export
          </Button>
        }
      />
      {exporter.banner}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Chargeable days"
          value={formatNumber(s?.days)}
          subline="Across the rows shown"
        />
        <StatCard
          title="Stays"
          value={formatNumber(s?.stays)}
          subline="Counted toward days on site"
        />
        <StatCard
          title="Day trips"
          value={formatNumber(s?.dayTrips)}
          subline="Out and back the same day — count nothing"
        />
        <StatCard
          title="People"
          value={formatNumber(s?.people)}
          subline="With a stay in the rows shown"
        />
      </div>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-label font-semibold text-ink-secondary">Days by site</h2>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {s?.bySite.map((b) => (
            <li key={b.site} className="space-y-1">
              <div className="flex justify-between text-xs">
                <button
                  type="button"
                  className="text-ink-secondary hover:text-primary hover:underline"
                  onClick={() => setFilter('site', b.site)}
                >
                  {b.site}
                </button>
                <span className="text-ink tabular-nums">{formatNumber(b.days)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-muted">
                <div
                  className="h-1.5 rounded-full bg-chart-1"
                  style={{ width: `${String((b.days / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        placeholder="Name or Optima number"
        activeCount={Object.keys(params.filters).length}
        onClear={() => update({ q: '', filters: {} })}
      >
        <FilterSelect
          label="Site"
          allLabel="All sites"
          value={params.filters.site}
          options={[...SITES].sort().map((v) => ({ value: v, label: v }))}
          onChange={(v) => setFilter('site', v)}
        />
        <FilterSelect
          label="Classification"
          allLabel="Stays and day trips"
          value={params.filters.classification}
          options={[
            { value: 'stays', label: 'Stays only' },
            { value: 'trips', label: 'Day trips only' },
          ]}
          onChange={(v) => setFilter('classification', v)}
        />
      </FilterBar>
      <DataTable
        caption="Residence duration"
        columns={COLUMNS}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(r) => r.id}
        params={params}
        onParamsChange={update}
        loading={list.isLoading}
      />
    </div>
  );
}
