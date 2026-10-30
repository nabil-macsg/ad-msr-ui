import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { routeOf } from '../../app/access/registry';
import type { DemoFreight } from '../../mock/data/demo-booking-create';
import { RowActions } from '../../modules/administration/masters/master-page';
import { useListParams } from '../../shared/lists/list-params';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Drawer } from '../../shared/ui/drawer';
import { FilterBar } from '../../shared/ui/filter-bar';
import { FilterSelect } from '../../shared/ui/filter-select';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { useFreight } from './api';
import { withFilter } from './local-list';
import { Info, PRIORITY_TONE, longDate } from './shared';

const PRIORITY_OPTIONS = ['Normal', 'Urgent', 'Critical'].map((p) => ({ value: p, label: p }));

/** Freight Requests: cargo bookings raised across all sites, with their details. */
export default function FreightRequestsPage() {
  const list = useListParams({ sort: { field: 'reference', dir: 'desc' } });
  const rows = useFreight(list.apiQuery);
  const [viewing, setViewing] = useState<DemoFreight | null>(null);
  const created = (useLocation().state as { created?: string } | null)?.created;

  const columns: Column<DemoFreight>[] = [
    {
      id: 'reference',
      header: 'Reference',
      sortField: 'reference',
      cell: (f) => <span className="font-mono text-sm font-medium">{f.reference}</span>,
    },
    {
      id: 'cargoType',
      header: 'Cargo',
      sortField: 'cargoType',
      cell: (f) => (
        <span className="inline-flex items-center gap-1.5">
          {f.cargoType}
          {f.hazmat && <StatusPill tone="danger">HAZMAT</StatusPill>}
        </span>
      ),
    },
    {
      id: 'route',
      header: 'Route',
      sortField: 'route',
      cell: (f) => `${f.origin} → ${f.destination}`,
    },
    {
      id: 'requestedDate',
      header: 'Requested Date',
      sortField: 'requestedDate',
      cell: (f) => longDate(f.requestedDate),
    },
    {
      id: 'weightKg',
      header: 'Weight',
      sortField: 'weightKg',
      align: 'right',
      cell: (f) => `${f.weightKg} kg`,
    },
    {
      id: 'priority',
      header: 'Priority',
      sortField: 'priority',
      cell: (f) => <StatusPill tone={PRIORITY_TONE[f.priority] ?? 'neutral'}>{f.priority}</StatusPill>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (f) => (
        <RowActions
          label={`Actions for ${f.reference}`}
          items={[{ label: 'View details', run: () => setViewing(f) }]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Freight Requests"
        subtitle="Cargo and freight booking requests raised across all sites"
        actions={
          <Button asChild>
            <Link to={routeOf('freight.create')}>
              <Plus className="size-4" aria-hidden /> Create Freight Booking
            </Link>
          </Button>
        }
      />
      {created && (
        <Banner tone="success" title="Freight booking submitted">
          {created} has been added to the requests below.
        </Banner>
      )}
      <FilterBar
        q={list.params.q}
        onQChange={(q) => list.update({ q })}
        placeholder="Search reference, cargo type, destination…"
        activeCount={Object.keys(list.params.filters).length}
        onClear={() => list.update({ q: '', filters: {} })}
      >
        <FilterSelect
          label="Priority"
          allLabel="All Priorities"
          value={list.params.filters.priority}
          options={PRIORITY_OPTIONS}
          onChange={(v) => list.update({ filters: withFilter(list.params.filters, 'priority', v) })}
        />
      </FilterBar>
      {rows.isError && <Banner tone="danger">{rows.error.message}</Banner>}
      <DataTable
        caption="Freight requests"
        columns={columns}
        rows={rows.data?.items}
        total={rows.data?.total}
        rowKey={(f) => f.id}
        params={list.params}
        onParamsChange={list.update}
        loading={rows.isFetching}
        onRowClick={setViewing}
        emptyTitle="No freight requests match these filters."
      />
      {viewing && (
        <Drawer
          open
          onOpenChange={(open) => !open && setViewing(null)}
          title={viewing.reference}
          description={`${viewing.cargoType} · ${viewing.origin} → ${viewing.destination}`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="Cargo">
              {viewing.cargoType}
              {viewing.hazmat && ' (HAZMAT)'}
            </Info>
            <Info label="Priority">
              <StatusPill tone={PRIORITY_TONE[viewing.priority] ?? 'neutral'}>
                {viewing.priority}
              </StatusPill>
            </Info>
            <Info label="Route">
              {viewing.origin} → {viewing.destination}
            </Info>
            <Info label="Requested Date">{longDate(viewing.requestedDate)}</Info>
            <Info label="Weight">{viewing.weightKg} kg</Info>
            <Info label="Transport Mode">{viewing.transportMode}</Info>
            <Info label="Dimensions (L × W × H)">
              {viewing.dimensions ? `${viewing.dimensions.join(' × ')} cm` : 'Not given'}
            </Info>
            <Info label="Charge / Cost Code">
              {viewing.chargeCode} {viewing.chargeSite}
            </Info>
            <Info label="Recorded Against">{viewing.recordedAgainst}</Info>
            <Info label="Requested By">{viewing.requestedBy}</Info>
            <Info label="UN Number / Class">{viewing.unNumber ?? 'Not hazardous'}</Info>
            {viewing.notes && (
              <div className="sm:col-span-2">
                <Info label="Notes">{viewing.notes}</Info>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}
