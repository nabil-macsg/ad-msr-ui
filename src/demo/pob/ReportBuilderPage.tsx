import { useQueryClient } from '@tanstack/react-query';
import { Download, Play, Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { RowActions } from '../../modules/administration/masters/master-page';
import { useListParams, useLocalListParams } from '../../shared/lists/list-params';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Field, SelectField } from '../../shared/ui/field';
import { FilterBar } from '../../shared/ui/filter-bar';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { pobSend, usePobQuery } from './pob-api';
import {
  CREW_TYPES,
  EVAC_CATEGORIES,
  formatNumber,
  REPORT_FORMATS,
  type ReportDefinitionRow,
  searchOf,
  SITES,
  useReportExport,
  useReportList,
  ZONES,
} from './reports-shared';

type Draft = Pick<
  ReportDefinitionRow,
  'name' | 'zone' | 'asset' | 'crewType' | 'category' | 'gender' | 'format'
>;
const EMPTY: Draft = {
  name: '',
  zone: '',
  asset: '',
  crewType: '',
  category: '',
  gender: '',
  format: 'Excel',
};

interface Person {
  id: string;
  name: string;
  optima: string;
  company: string;
  site: string;
  crewType: string;
  category: string;
  gender: string;
}

const PERSON_COLUMNS: Column<Person>[] = [
  {
    id: 'name',
    header: 'Person',
    sortField: 'name',
    cell: (r) => (
      <span>
        <span className="font-medium text-ink">{r.name}</span>{' '}
        <span className="font-mono text-xs text-ink-muted">{r.optima}</span>
      </span>
    ),
  },
  { id: 'company', header: 'Company', sortField: 'company', cell: (r) => r.company },
  { id: 'site', header: 'Site', sortField: 'site', cell: (r) => r.site },
  { id: 'crewType', header: 'Crew type', sortField: 'crewType', cell: (r) => r.crewType },
  {
    id: 'category',
    header: 'Evacuation category',
    sortField: 'category',
    cell: (r) => r.category,
  },
  { id: 'gender', header: 'Gender', sortField: 'gender', cell: (r) => r.gender },
];

/** Report Builder: saved POB report definitions — what to include, and in what format. */
export default function ReportBuilderPage() {
  const queryClient = useQueryClient();
  const { params, update, apiQuery } = useListParams({ pageSize: 20 });
  const list = useReportList<ReportDefinitionRow>('definitions', apiQuery);
  const [editing, setEditing] = useState<ReportDefinitionRow | 'new' | null>(null);
  const [running, setRunning] = useState<ReportDefinitionRow | null>(null);
  const [deactivating, setDeactivating] = useState<ReportDefinitionRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['demo-pob'] });
  const reactivate = async (row: ReportDefinitionRow) => {
    await pobSend('POST', `/reports/definitions/${row.id}/reactivate`);
    setNotice(`${row.name} reactivated.`);
    await refresh();
  };

  const columns: Column<ReportDefinitionRow>[] = [
    {
      id: 'name',
      header: 'Report',
      sortField: 'name',
      cell: (r) => <span className="font-medium text-ink">{r.name}</span>,
    },
    { id: 'includes', header: 'Includes', cell: (r) => r.includes },
    {
      id: 'rowsToday',
      header: 'Rows today',
      sortField: 'rowsToday',
      align: 'right',
      cell: (r) => formatNumber(r.rowsToday),
    },
    { id: 'format', header: 'Format', sortField: 'format', cell: (r) => r.format },
    {
      id: 'run',
      header: '',
      cell: (r) => (
        <Button variant="secondary" onClick={() => setRunning(r)} aria-label={`Run ${r.name}`}>
          <Play className="size-3.5" aria-hidden />
          Run
        </Button>
      ),
    },
    {
      id: 'scheduled',
      header: 'Scheduled',
      cell: (r) =>
        r.scheduled ? (
          <StatusPill tone="neutral">{r.scheduled}</StatusPill>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortField: 'isActive',
      cell: (r) => (
        <StatusPill tone={r.isActive ? 'success' : 'neutral'}>
          {r.isActive ? 'Active' : 'Deactivated'}
        </StatusPill>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <RowActions
          label={`Actions for ${r.name}`}
          items={[
            { label: 'Edit', run: () => setEditing(r) },
            r.isActive
              ? { label: 'Deactivate', run: () => setDeactivating(r) }
              : { label: 'Reactivate', run: () => void reactivate(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Builder"
        subtitle="Saved POB report definitions — what to include, and in what format"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            New report
          </Button>
        }
      />
      <Banner tone="info">
        The filter set is the five dimensions named so far. Your POB reporting requirements template
        is still outstanding, so treat this as provisional until it arrives.
      </Banner>
      {notice && <Banner tone="success">{notice}</Banner>}
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        placeholder="Search reports..."
        onClear={() => update({ q: '' })}
      />
      <DataTable
        caption="Saved reports"
        columns={columns}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(r) => r.id}
        params={params}
        onParamsChange={update}
        loading={list.isLoading}
        deactivatedToggle
      />
      {editing && (
        <DefinitionModal
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(name, created) => {
            setNotice(created ? `${name} created.` : `${name} updated.`);
            setEditing(null);
            void refresh();
          }}
        />
      )}
      {running && <RunModal row={running} onClose={() => setRunning(null)} />}
      {deactivating && (
        <Modal
          open
          onOpenChange={(open) => !open && setDeactivating(null)}
          title="Deactivate report"
          size="sm"
        >
          <div className="space-y-4 text-sm text-ink-body">
            <p>
              This will mark {deactivating.name} as deactivated. It stays visible in historical
              records but won&apos;t be offered for new ones.
            </p>
            {deactivating.scheduleCount > 0 ? (
              <Banner tone="warning" title="Still referenced by:">
                <p>
                  • {deactivating.scheduleCount} schedule
                  {deactivating.scheduleCount === 1 ? '' : 's'} sending it
                </p>
                <p>Those records keep pointing at it and will read as stale rather than break.</p>
              </Banner>
            ) : (
              <p className="text-xs text-ink-muted">Nothing else references this report.</p>
            )}
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const row = deactivating;
                void pobSend('POST', `/reports/definitions/${row.id}/deactivate`).then(() => {
                  setNotice(`${row.name} deactivated.`);
                  setDeactivating(null);
                  return refresh();
                });
              }}
            >
              Confirm
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

function DefinitionModal({
  row,
  onClose,
  onSaved,
}: {
  row: ReportDefinitionRow | null;
  onClose: () => void;
  onSaved: (name: string, created: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(row ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { name: _name, format: _format, ...include } = draft;
  const count = usePobQuery<{ rows: number }>(`/reports/definitions/count?${searchOf(include)}`);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError('Enter a report name.');
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      if (row) await pobSend('PUT', `/reports/definitions/${row.id}`, draft);
      else await pobSend('POST', '/reports/definitions', draft);
      onSaved(draft.name.trim(), !row);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The report could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const select = (
    label: string,
    key: keyof Omit<Draft, 'name'>,
    all: string | null,
    options: readonly string[],
  ) => (
    <SelectField label={label} value={draft[key]} onChange={(e) => set({ [key]: e.target.value })}>
      {all !== null && <option value="">{all}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </SelectField>
  );

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={row ? 'Edit report' : 'New report'}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        <Field
          label="Report name"
          required
          placeholder="e.g. Daily POB — Das complex"
          value={draft.name}
          error={error ?? undefined}
          onChange={(e) => {
            set({ name: e.target.value });
            setError(null);
          }}
        />
        <fieldset className="space-y-3">
          <legend className="text-label font-semibold text-ink-secondary">Include</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {select('Zone', 'zone', 'All zones', ZONES)}
            {select('Asset', 'asset', 'All assets', SITES)}
            {select('Crew type', 'crewType', 'All crew types', CREW_TYPES)}
            {select('Evacuation category', 'category', 'All categories', EVAC_CATEGORIES)}
            {select('Gender', 'gender', 'All', ['Male', 'Female'])}
            {select('Output format', 'format', null, REPORT_FORMATS)}
          </div>
        </fieldset>
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-secondary">
          Rows this would return today{' '}
          <span className="font-semibold text-ink tabular-nums">
            {formatNumber(count.data?.rows)}
          </span>
        </p>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function RunModal({ row, onClose }: { row: ReportDefinitionRow; onClose: () => void }) {
  const { params, update, apiQuery } = useLocalListParams({ pageSize: 20 });
  const list = useReportList<Person>(`definitions/${row.id}/rows`, apiQuery);
  const exporter = useReportExport();
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={row.name} size="lg">
      <div className="space-y-4 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            {row.includes} · {formatNumber(list.data?.total ?? row.rowsToday)} people on board now
          </p>
          <Button variant="secondary" onClick={() => exporter.run(`definitions/${row.id}/export`)}>
            <Download className="size-4" aria-hidden />
            Export as {row.format}
          </Button>
        </div>
        {exporter.banner}
        <DataTable
          caption={`${row.name} rows`}
          columns={PERSON_COLUMNS}
          rows={list.data?.items}
          total={list.data?.total}
          rowKey={(r) => r.id}
          params={params}
          onParamsChange={update}
          loading={list.isLoading}
        />
        <p className="text-xs text-ink-muted">The export carries every row of the report.</p>
      </div>
    </Modal>
  );
}
