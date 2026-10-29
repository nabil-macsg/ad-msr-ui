import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setFilter } from '../modules/administration/masters/filters';
import { useListParams } from '../shared/lists/list-params';
import { Banner } from '../shared/ui/banner';
import { Button } from '../shared/ui/button';
import { type Column, DataTable } from '../shared/ui/data-table';
import { Drawer } from '../shared/ui/drawer';
import { FilterBar } from '../shared/ui/filter-bar';
import { FilterSelect } from '../shared/ui/filter-select';
import { PageHeader } from '../shared/ui/page-header';
import { StatCard } from '../shared/ui/stat-card';
import { StatusPill } from '../shared/ui/status-pill';
import type { Tone } from '../shared/ui/tone';
import { BOOKING_MOVES, type DemoRow, type DemoValue } from '../mock/data/modules';
import { changeBookingStatus, datasetKey, useDataset, useSummary } from './demo-api';

export interface DemoColumn {
  readonly field: string;
  readonly header: string;
  readonly kind?: 'text' | 'mono' | 'number' | 'percent' | 'date' | 'status';
  readonly sortable?: boolean;
}

export interface DemoScreen {
  readonly dataset: string;
  readonly title: string;
  readonly subtitle: string;
  readonly noun: string;
  readonly search: string;
  readonly columns: readonly DemoColumn[];
  readonly filters: readonly { field: string; label: string; options: readonly string[] }[];
  /** The row's name in the drawer and the table's row label. */
  readonly label: (row: DemoRow) => string;
  readonly defaultSort?: { field: string; dir: 'asc' | 'desc' };
  /** Bookings can change status from the drawer. */
  readonly statusActions?: boolean;
}

const TONE: Readonly<Record<string, Tone>> = {
  Confirmed: 'success',
  'Checked in': 'success',
  Valid: 'success',
  Normal: 'success',
  Arrived: 'success',
  Departed: 'info',
  Scheduled: 'info',
  'Check-in open': 'info',
  Boarding: 'info',
  'Pending approval': 'warning',
  'Due within 30 days': 'warning',
  'Near limit': 'warning',
  Delayed: 'warning',
  Waitlisted: 'neutral',
  'With limitations': 'accent',
  Cancelled: 'danger',
  Overdue: 'danger',
  'Over limit': 'danger',
};

function show(value: DemoValue, kind: DemoColumn['kind'] = 'text') {
  if (value === null || value === '') return '—';
  if (kind === 'status')
    return <StatusPill tone={TONE[String(value)] ?? 'neutral'}>{String(value)}</StatusPill>;
  if (kind === 'percent') return `${String(value)}%`;
  if (kind === 'number' && typeof value === 'number') return value.toLocaleString('en');
  if (kind === 'date') {
    return new Date(`${String(value)}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  if (kind === 'mono') return <span className="font-mono text-sm">{String(value)}</span>;
  return String(value);
}

/**
 * A representative screen for a module MASAR hasn't built yet: KPI cards, a searchable,
 * filterable, sortable and paged list from the demo's mock service, and a details drawer.
 */
export function DemoModulePage({ screen }: { screen: DemoScreen }) {
  const { t } = useTranslation();
  const list = useListParams(screen.defaultSort ? { sort: screen.defaultSort } : {});
  const rows = useDataset(screen.dataset, list.apiQuery);
  const summary = useSummary(screen.dataset);
  const [viewing, setViewing] = useState<DemoRow | null>(null);

  const columns: Column<DemoRow>[] = screen.columns.map((c) => ({
    id: c.field,
    header: c.header,
    cell: (row) => show(row[c.field] ?? null, c.kind),
    ...(c.sortable === false ? {} : { sortField: c.field }),
    ...(c.kind === 'number' || c.kind === 'percent' ? { align: 'right' as const } : {}),
  }));

  return (
    <div className="space-y-5">
      <PageHeader title={screen.title} subtitle={screen.subtitle} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(summary.data ?? []).map((k) => (
          <StatCard
            key={k.label}
            title={k.label}
            value={k.value}
            {...(k.subline ? { subline: k.subline } : {})}
          />
        ))}
      </div>
      <FilterBar
        q={list.params.q}
        onQChange={(q) => list.update({ q })}
        placeholder={screen.search}
        activeCount={Object.keys(list.params.filters).length}
        onClear={() => list.update({ q: '', filters: {} })}
      >
        {screen.filters.map((f) => (
          <FilterSelect
            key={f.field}
            label={f.label}
            allLabel={t('ui.filter.all')}
            value={list.params.filters[f.field]}
            options={f.options.map((o) => ({ value: o, label: o }))}
            onChange={(v) => setFilter(list, f.field, v)}
          />
        ))}
      </FilterBar>
      {rows.isError && <Banner tone="danger">{rows.error.message}</Banner>}
      <DataTable
        caption={screen.title}
        columns={columns}
        rows={rows.data?.items}
        total={rows.data?.total}
        rowKey={(row) => row.id}
        params={list.params}
        onParamsChange={list.update}
        loading={rows.isFetching}
        onRowClick={setViewing}
        emptyTitle={`No ${screen.noun} match these filters.`}
      />
      {viewing && (
        <Details
          screen={screen}
          row={viewing}
          onClose={() => setViewing(null)}
          onChanged={setViewing}
        />
      )}
    </div>
  );
}

function Details({
  screen,
  row,
  onClose,
  onChanged,
}: {
  screen: DemoScreen;
  row: DemoRow;
  onClose: () => void;
  onChanged: (row: DemoRow) => void;
}) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const moves = screen.statusActions ? (BOOKING_MOVES[String(row.status)] ?? []) : [];

  const move = async (status: string) => {
    setBusy(true);
    setFailure(null);
    try {
      onChanged(await changeBookingStatus(row.id, status));
      await queryClient.invalidateQueries({ queryKey: datasetKey(screen.dataset) });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The change failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()} title={screen.label(row)}>
      <div className="space-y-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          {screen.columns.map((c) => (
            <div key={c.field}>
              <dt className="text-xs text-ink-secondary">{c.header}</dt>
              <dd className="text-sm text-ink">{show(row[c.field] ?? null, c.kind)}</dd>
            </div>
          ))}
        </dl>
        {failure && <Banner tone="danger">{failure}</Banner>}
        {moves.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {moves.map((status) => (
              <Button
                key={status}
                variant={status === 'Cancelled' ? 'secondary' : 'primary'}
                disabled={busy}
                onClick={() => void move(status)}
              >
                {status === 'Cancelled' ? 'Cancel booking' : `Mark ${status.toLowerCase()}`}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
