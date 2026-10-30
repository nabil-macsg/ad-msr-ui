import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { RowActions } from '../../modules/administration/masters/master-page';
import { useListParams } from '../../shared/lists/list-params';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { SelectField } from '../../shared/ui/field';
import { FilterBar } from '../../shared/ui/filter-bar';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { pobSend } from './pob-api';
import {
  FREQUENCIES,
  FREQUENCY_TEXT,
  RECIPIENTS,
  REPORT_FORMATS,
  type ReportDefinitionRow,
  type ReportScheduleRow,
  useReportList,
} from './reports-shared';

type Draft = Pick<ReportScheduleRow, 'reportId' | 'frequency' | 'format' | 'recipients'>;
const EMPTY: Draft = { reportId: '', frequency: 'Daily', format: 'Excel', recipients: [] };

/** Report Scheduler: when each saved report goes out, and to whom. */
export default function ReportSchedulerPage() {
  const queryClient = useQueryClient();
  const { params, update, apiQuery } = useListParams({ pageSize: 20 });
  const list = useReportList<ReportScheduleRow>('schedules', apiQuery);
  const [editing, setEditing] = useState<ReportScheduleRow | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<ReportScheduleRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['demo-pob'] });

  const setActive = async (row: ReportScheduleRow, active: boolean) => {
    await pobSend('POST', `/reports/schedules/${row.id}/${active ? 'reactivate' : 'deactivate'}`);
    setNotice(`Schedule for ${row.report} ${active ? 'reactivated' : 'deactivated'}.`);
    await refresh();
  };

  const columns: Column<ReportScheduleRow>[] = [
    {
      id: 'report',
      header: 'Report',
      sortField: 'report',
      cell: (r) => <span className="font-medium text-ink">{r.report}</span>,
    },
    {
      id: 'frequency',
      header: 'Frequency',
      sortField: 'frequency',
      cell: (r) => `${r.frequency} · ${FREQUENCY_TEXT[r.frequency]}`,
    },
    {
      id: 'recipients',
      header: 'Recipients',
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.recipients.map((name) => (
            <StatusPill key={name} tone="neutral">
              {name}
            </StatusPill>
          ))}
        </span>
      ),
    },
    { id: 'format', header: 'Format', sortField: 'format', cell: (r) => r.format },
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
          label={`Actions for ${r.report}`}
          items={[
            { label: 'Edit', run: () => setEditing(r) },
            r.isActive
              ? { label: 'Deactivate', run: () => setDeactivating(r) }
              : { label: 'Reactivate', run: () => void setActive(r, true) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Scheduler"
        subtitle="When each saved report goes out, and to whom"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            New schedule
          </Button>
        }
      />
      <Banner tone="info">
        This configures distribution. Nothing is sent from the demo — no report leaves the browser.
      </Banner>
      {notice && <Banner tone="success">{notice}</Banner>}
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        placeholder="Search schedules..."
        onClear={() => update({ q: '' })}
      />
      <DataTable
        caption="Report schedules"
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
        <ScheduleModal
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setNotice(created ? 'Schedule created.' : 'Schedule updated.');
            setEditing(null);
            void refresh();
          }}
        />
      )}
      {deactivating && (
        <Modal
          open
          onOpenChange={(open) => !open && setDeactivating(null)}
          title="Deactivate schedule"
          size="sm"
        >
          <div className="space-y-3 text-sm text-ink-body">
            <p>
              This will mark the {deactivating.frequency.toLowerCase()} schedule for{' '}
              {deactivating.report} as deactivated. It stays visible in historical records but
              won&apos;t be offered for new ones.
            </p>
            <p className="text-xs text-ink-muted">Nothing else references this schedule.</p>
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const row = deactivating;
                setDeactivating(null);
                void setActive(row, false);
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

function ScheduleModal({
  row,
  onClose,
  onSaved,
}: {
  row: ReportScheduleRow | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const reports = useReportList<ReportDefinitionRow>('definitions', { sort: 'name:asc' });
  const [draft, setDraft] = useState<Draft>(row ?? EMPTY);
  const [errors, setErrors] = useState<
    Partial<Record<'reportId' | 'recipients', string | undefined>>
  >({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!draft.reportId) next.reportId = 'Select a saved report.';
    if (draft.recipients.length === 0) next.recipients = 'Choose at least one recipient.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFailure(null);
    try {
      if (row) await pobSend('PUT', `/reports/schedules/${row.id}`, draft);
      else await pobSend('POST', '/reports/schedules', draft);
      onSaved(!row);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The schedule could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={row ? 'Edit schedule' : 'New schedule'}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        <div className="space-y-1.5">
          <SelectField
            label="Report"
            required
            value={draft.reportId}
            error={errors.reportId}
            onChange={(e) => {
              set({ reportId: e.target.value });
              setErrors((x) => ({ ...x, reportId: undefined }));
            }}
          >
            <option value="">— Select a saved report —</option>
            {reports.data?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
          {row && (
            <p className="text-xs text-ink-muted">
              Defined in the Report Builder. Editing it there changes what this schedule sends.
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Frequency"
            required
            value={draft.frequency}
            onChange={(e) => set({ frequency: e.target.value as Draft['frequency'] })}
          >
            {FREQUENCIES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </SelectField>
          <SelectField
            label="Output format"
            value={draft.format}
            onChange={(e) => set({ format: e.target.value as Draft['format'] })}
          >
            {REPORT_FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </SelectField>
        </div>
        <fieldset
          className="space-y-2"
          aria-invalid={errors.recipients ? true : undefined}
          aria-describedby="schedule-recipients-hint"
        >
          <legend className="text-label text-ink-secondary after:ms-0.5 after:text-danger-fg after:content-['*']">
            Recipients
          </legend>
          <div className="flex flex-wrap gap-4">
            {RECIPIENTS.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  className="size-4 rounded-sm accent-primary"
                  checked={draft.recipients.includes(name)}
                  onChange={(e) => {
                    set({
                      recipients: e.target.checked
                        ? [...draft.recipients, name]
                        : draft.recipients.filter((r) => r !== name),
                    });
                    setErrors((x) => ({ ...x, recipients: undefined }));
                  }}
                />
                {name}
              </label>
            ))}
          </div>
          {errors.recipients && (
            <p role="alert" className="text-xs text-danger-fg">
              {errors.recipients}
            </p>
          )}
          <p id="schedule-recipients-hint" className="text-xs text-ink-muted">
            Sent as an email attachment {FREQUENCY_TEXT[draft.frequency]}.
          </p>
        </fieldset>
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
