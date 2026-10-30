import { Download, Printer } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '../../shared/lib/cn';
import { toExportQuery, useListParams } from '../../shared/lists/list-params';
import { Button } from '../../shared/ui/button';
import { CONTROL } from '../../shared/ui/control-styles';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { FilterSelect } from '../../shared/ui/filter-select';
import { PageHeader } from '../../shared/ui/page-header';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import { usePobQuery } from './pob-api';
import {
  formatDate,
  formatNumber,
  searchOf,
  useReportExport,
  useReportList,
  ZONES,
} from './reports-shared';

interface SiteRow {
  id: string;
  site: string;
  zone: string;
  pob: number;
  onSite: number;
  afloat: number;
  male: number;
  female: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  resident: number;
  contractor: number;
  visitor: number;
  status: 'Normal' | 'Emergency';
}

interface Summary {
  date: string;
  sites: number;
  pob: number;
  male: number;
  female: number;
  emergency: number;
}

type View = 'category' | 'crew';
const num = (field: keyof SiteRow, header: string): Column<SiteRow> => ({
  id: field,
  header,
  sortField: field,
  align: 'right',
  cell: (r) => formatNumber(r[field] as number),
});
const percent = (part: number, whole: number) =>
  whole ? `${String(Math.round((part / whole) * 100))}% of POB` : '—';

const BASE_COLUMNS: Column<SiteRow>[] = [
  { id: 'site', header: 'Site', sortField: 'site', cell: (r) => r.site },
  { id: 'zone', header: 'Zone', sortField: 'zone', cell: (r) => r.zone },
  num('pob', 'POB'),
  num('onSite', 'On site'),
  {
    id: 'afloat',
    header: 'Afloat',
    sortField: 'afloat',
    align: 'right',
    cell: (r) => (r.afloat ? formatNumber(r.afloat) : '—'),
  },
  {
    id: 'mf',
    header: 'M / F',
    align: 'right',
    cell: (r) => `${formatNumber(r.male)} / ${formatNumber(r.female)}`,
  },
];
const STATUS_COLUMN: Column<SiteRow> = {
  id: 'status',
  header: 'Status',
  cell: (r) => (
    <StatusPill tone={r.status === 'Emergency' ? 'danger' : 'neutral'}>{r.status}</StatusPill>
  ),
};
const COLUMNS: Record<View, Column<SiteRow>[]> = {
  category: [
    ...BASE_COLUMNS,
    num('t1', 'T1'),
    num('t2', 'T2'),
    num('t3', 'T3'),
    num('t4', 'T4'),
    STATUS_COLUMN,
  ],
  crew: [
    ...BASE_COLUMNS,
    num('resident', 'Resident'),
    num('contractor', 'Contractor'),
    num('visitor', 'Visitor'),
    STATUS_COLUMN,
  ],
};

/** Normal / Emergency POB Report: headcount by site, category and gender. */
export default function ReportPage() {
  const viewId = useId();
  const [view, setView] = useState<View>('category');
  const { params, update, apiQuery } = useListParams({ pageSize: 20 });
  const list = useReportList<SiteRow>('pob', apiQuery);
  const exportQuery = toExportQuery(params);
  const summary = usePobQuery<Summary>(`/reports/pob/summary?${searchOf(exportQuery)}`);
  const exporter = useReportExport();
  const s = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Normal / Emergency POB Report"
        subtitle={`Headcount by site, category and gender — ${s ? formatDate(s.date) : '…'}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Print
            </Button>
            <Button variant="secondary" onClick={() => exporter.run('pob/export', exportQuery)}>
              <Download className="size-4" aria-hidden />
              Export
            </Button>
          </>
        }
      />
      {exporter.banner}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total POB"
          value={formatNumber(s?.pob)}
          subline={`${String(s?.sites ?? 0)} sites reporting`}
        />
        <StatCard
          title="Male"
          value={formatNumber(s?.male)}
          subline={percent(s?.male ?? 0, s?.pob ?? 0)}
        />
        <StatCard
          title="Female"
          value={formatNumber(s?.female)}
          subline={percent(s?.female ?? 0, s?.pob ?? 0)}
        />
        <StatCard
          title="Sites in emergency"
          value={formatNumber(s?.emergency)}
          subline="With a declared muster"
          {...(s?.emergency ? { tone: 'danger' as const } : {})}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <label htmlFor={viewId} className="text-xs text-ink-secondary">
            Break down
          </label>
          <select
            id={viewId}
            value={view}
            onChange={(e) => setView(e.target.value as View)}
            className={cn('min-h-touch px-2.5 py-2', CONTROL)}
          >
            <option value="category">By evacuation category</option>
            <option value="crew">By crew type</option>
          </select>
        </div>
        <FilterSelect
          label="Zone"
          allLabel="All zones"
          value={params.filters.zone}
          options={ZONES.map((z) => ({ value: z, label: z }))}
          onChange={(zone) => {
            const filters = { ...params.filters };
            if (zone) filters.zone = zone;
            else delete filters.zone;
            update({ filters });
          }}
        />
      </div>
      <DataTable
        caption="POB by site"
        columns={COLUMNS[view]}
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
