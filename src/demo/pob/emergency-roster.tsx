import { useState } from 'react';
import { RowActions } from '../../modules/administration/masters/master-page';
import { type ListParams, parseListParams } from '../../shared/lists/list-params';
import { Banner } from '../../shared/ui/banner';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { FilterBar } from '../../shared/ui/filter-bar';
import { FilterSelect } from '../../shared/ui/filter-select';
import { StatusPill } from '../../shared/ui/status-pill';
import {
  formatDateTime,
  messageOf,
  type MusterSummary,
  ROSTER_TONE,
  type RosterRow,
  tickPerson,
  useRefreshEmergency,
  useRoster,
} from './emergency-api';

const EMPTY = new URLSearchParams();
const without = (filters: Readonly<Record<string, string>>, name: string) =>
  Object.fromEntries(Object.entries(filters).filter(([key]) => key !== name));

/**
 * The frozen muster list. On Emergency Muster every row's menu accounts the person at any muster
 * point; on the Muster Console (`point` set) a tick box accounts them at that point.
 */
export function MusterRoster({ muster, point }: { muster: MusterSummary; point?: string }) {
  const [params, setParams] = useState<ListParams>(() =>
    parseListParams(EMPTY, {
      sort: { field: 'name', dir: 'asc' },
      filters: point ? { point } : {},
    }),
  );
  const update = (patch: Partial<ListParams>) =>
    setParams((p) => ({ ...p, ...patch, page: patch.page ?? 1 }));
  const [shownPoint, setShownPoint] = useState(point);
  if (point !== shownPoint) {
    setShownPoint(point);
    setParams((p) => {
      const rest = without(p.filters, 'point');
      return { ...p, page: 1, filters: point ? { ...rest, point } : rest };
    });
  }
  const roster = useRoster(muster.id, params);
  const refresh = useRefreshEmergency();
  const [error, setError] = useState<string | null>(null);
  const live = muster.status === 'Active';

  const tick = async (row: RosterRow, at: string | null) => {
    setError(null);
    try {
      await tickPerson(muster.id, row.id, at);
      await refresh();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const pointName = muster.points.find((p) => p.code === point)?.name;
  const columns: Column<RosterRow>[] = [
    ...(point
      ? [
          {
            id: 'present',
            header: 'Present',
            cell: (r: RosterRow) => (
              <input
                type="checkbox"
                className="size-4 accent-primary"
                aria-label={`${r.name} is at ${pointName ?? 'this point'}`}
                checked={r.accountedPoint === point}
                disabled={!live || (r.status === 'Accounted' && r.accountedPoint !== point)}
                onChange={(e) => void tick(r, e.target.checked ? point : null)}
              />
            ),
          },
        ]
      : []),
    {
      id: 'name',
      header: 'Name',
      sortField: 'name',
      cell: (r) => <span className="font-medium text-ink">{r.name}</span>,
    },
    {
      id: 'personnelNo',
      header: 'Personnel no.',
      sortField: 'personnelNo',
      cell: (r) => <span className="font-mono text-xs">{r.personnelNo}</span>,
    },
    { id: 'company', header: 'Company', sortField: 'company', cell: (r) => r.company },
    { id: 'group', header: 'Type', sortField: 'group', cell: (r) => r.group },
    {
      id: 'homePoint',
      header: 'Assigned muster point',
      sortField: 'homePointName',
      cell: (r) => r.homePointName,
    },
    {
      id: 'status',
      header: 'Status',
      sortField: 'status',
      cell: (r) => <StatusPill tone={ROSTER_TONE[r.status]}>{r.status}</StatusPill>,
    },
    {
      id: 'accounted',
      header: 'Accounted at',
      sortField: 'accountedAt',
      cell: (r) =>
        r.accountedAt ? (
          <span>
            {r.accountedPointName}
            <span className="block text-xs text-ink-muted">{formatDateTime(r.accountedAt)}</span>
          </span>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    ...(!point && live
      ? [
          {
            id: 'actions',
            header: '',
            align: 'right' as const,
            cell: (r: RosterRow) => (
              <RowActions
                label={`Actions for ${r.name}`}
                items={[
                  ...muster.points
                    .filter((p) => p.code !== r.accountedPoint)
                    .map((p) => ({
                      label: `Account at ${p.name}`,
                      run: () => void tick(r, p.code),
                    })),
                  r.status === 'Accounted' && {
                    label: 'Mark unaccounted',
                    run: () => void tick(r, null),
                  },
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  const setFilter = (name: string, value: string | undefined) => {
    const rest = without(params.filters, name);
    update({ filters: value ? { ...rest, [name]: value } : rest });
  };

  return (
    <section className="space-y-3" aria-labelledby="roster-title">
      <h2 id="roster-title" className="text-base font-semibold text-ink">
        {point ? `Roster — ${pointName ?? ''}` : 'Frozen muster list'}
      </h2>
      {error && <Banner tone="danger">{error}</Banner>}
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        placeholder="Search by name, personnel number or company"
        activeCount={Object.keys(params.filters).filter((k) => k !== 'point' || !point).length}
        onClear={() => update({ q: '', filters: point ? { point } : {} })}
      >
        <FilterSelect
          label="Status"
          value={params.filters.status}
          allLabel="All"
          options={[
            { value: 'Unaccounted', label: 'Unaccounted' },
            { value: 'Accounted', label: 'Accounted' },
          ]}
          onChange={(v) => setFilter('status', v)}
        />
        <FilterSelect
          label={point ? 'Show' : 'Muster point'}
          value={params.filters.point}
          allLabel={point ? 'Everybody on the list' : 'All muster points'}
          options={muster.points.map((p) => ({
            value: p.code,
            label: point && p.code === point ? 'Assigned or accounted here' : p.name,
          }))}
          onChange={(v) => setFilter('point', v)}
        />
      </FilterBar>
      <DataTable
        caption={point ? `Roster at ${pointName ?? ''}` : 'Frozen muster list'}
        columns={columns}
        rows={roster.data?.items}
        total={roster.data?.total}
        rowKey={(r) => r.id}
        params={params}
        onParamsChange={update}
        loading={roster.isFetching}
        emptyTitle="Nobody matches these filters"
      />
    </section>
  );
}
