import { Printer } from 'lucide-react';
import { useState } from 'react';
import { type ListParams, parseListParams } from '../../shared/lists/list-params';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { PageHeader } from '../../shared/ui/page-header';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import { TONE_PILL, type Tone } from '../../shared/ui/tone';
import { cn } from '../../shared/lib/cn';
import { messageOf } from './emergency-api';
import { usePobQuery } from './pob-api';

interface ReportRow {
  code: string;
  name: string;
  type: string;
  pob: number;
  residents: number;
  contractors: number;
  visitors: number;
  male: number;
  female: number;
  lifeboatCapacity: number | null;
  surplus: number | null;
  status: 'Normal' | 'Alert' | 'Emergency';
}

interface Report {
  generatedAt: string;
  totalPob: number;
  lifeboatCapacity: number;
  sufficient: boolean;
  assetsReporting: number;
  onAlert: number;
  categories: { code: string; label: string; count: number; tone: Tone }[];
  regions: { region: string; pob: number; lifeboatCapacity: number; rows: ReportRow[] }[];
}

const STATUS_TONE: Record<ReportRow['status'], Tone> = {
  Normal: 'success',
  Alert: 'warning',
  Emergency: 'danger',
};

const generated = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

const COLUMNS: Column<ReportRow>[] = [
  {
    id: 'name',
    header: 'Asset',
    sortField: 'name',
    cell: (r) => <span className="font-medium text-ink">{r.name}</span>,
  },
  { id: 'type', header: 'Type', sortField: 'type', cell: (r) => r.type },
  { id: 'pob', header: 'POB', sortField: 'pob', align: 'right', cell: (r) => r.pob },
  {
    id: 'residents',
    header: 'Residents',
    sortField: 'residents',
    align: 'right',
    cell: (r) => r.residents,
  },
  {
    id: 'contractors',
    header: 'Contractors',
    sortField: 'contractors',
    align: 'right',
    cell: (r) => r.contractors,
  },
  {
    id: 'visitors',
    header: 'Visitors',
    sortField: 'visitors',
    align: 'right',
    cell: (r) => r.visitors,
  },
  { id: 'gender', header: 'Male / Female', cell: (r) => `${String(r.male)} / ${String(r.female)}` },
  {
    id: 'lifeboat',
    header: 'Lifeboat Cap',
    sortField: 'lifeboatCapacity',
    align: 'right',
    cell: (r) => r.lifeboatCapacity ?? <span className="text-ink-muted">Not recorded</span>,
  },
  {
    id: 'surplus',
    header: 'Surplus',
    sortField: 'surplus',
    align: 'right',
    cell: (r) =>
      r.surplus === null ? (
        '—'
      ) : (
        <span className={r.surplus < 0 ? 'text-danger-fg' : 'text-success-fg'}>
          {r.surplus >= 0 ? '+' : ''}
          {r.surplus}
        </span>
      ),
  },
  {
    id: 'status',
    header: 'Status',
    sortField: 'status',
    cell: (r) => <StatusPill tone={STATUS_TONE[r.status]}>{r.status}</StatusPill>,
  },
];

export default function EvacuationReportPage() {
  const report = usePobQuery<Report>('/emergency/evacuation-report');
  const data = report.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Evacuation Report"
        subtitle={data ? `Generated: ${generated(data.generatedAt)}` : 'Generating…'}
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Print / Export
          </Button>
        }
      />
      {report.error && <Banner tone="danger">{messageOf(report.error)}</Banner>}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Fleet POB" value={data.totalPob.toLocaleString('en')} />
            <StatCard
              title="Total Lifeboat Cap"
              value={data.lifeboatCapacity.toLocaleString('en')}
              tone={data.sufficient ? 'success' : 'danger'}
              subline={data.sufficient ? '✓ Sufficient' : 'Not enough at one or more assets'}
            />
            <StatCard title="Assets Reporting" value={data.assetsReporting} />
            <StatCard
              title="On Alert / Emergency"
              value={data.onAlert}
              {...(data.onAlert > 0 ? { tone: 'warning' as const } : {})}
            />
          </div>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-ink">
              Fleet-wide Evacuation Category Breakdown
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.categories.map((c) => (
                <div key={c.code} className={cn('rounded-xl border px-4 py-3', TONE_PILL[c.tone])}>
                  <p className="text-xs font-semibold">{c.label}</p>
                  <p className="text-2xl font-bold tabular-nums">{c.count}</p>
                  <p className="text-xs opacity-80">sampled personnel</p>
                </div>
              ))}
            </div>
          </section>

          {data.regions.map((r) => (
            <RegionTable key={r.region} region={r} />
          ))}

          <p className="text-xs text-ink-muted">
            ADNOC Offshore LMS · Evacuation Report · {generated(data.generatedAt)} · FOR OFFICIAL
            USE ONLY
          </p>
        </>
      )}
    </div>
  );
}

const EMPTY = new URLSearchParams();

/** One region's assets; a short list, sorted here and shown on one page. */
function RegionTable({ region }: { region: Report['regions'][number] }) {
  const [params, setParams] = useState<ListParams>(() => parseListParams(EMPTY, { pageSize: 100 }));
  const rows = [...region.rows];
  const sort = params.sort;
  if (sort) {
    rows.sort((a, b) => {
      const x = a[sort.field as keyof ReportRow] ?? -Infinity;
      const y = b[sort.field as keyof ReportRow] ?? -Infinity;
      const c =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'asc' ? c : -c;
    });
  }
  return (
    <section className="space-y-2">
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold text-ink">{region.region}</span>
        <span className="text-xs text-ink-muted">
          {region.pob} POB · {region.lifeboatCapacity} lifeboat cap
        </span>
      </p>
      <DataTable
        caption={`${region.region} assets`}
        columns={COLUMNS}
        rows={rows}
        total={rows.length}
        rowKey={(r) => r.code}
        params={params}
        onParamsChange={(patch) => setParams((p) => ({ ...p, ...patch }))}
      />
    </section>
  );
}
