import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { AuditTrailDrawer } from '../../../shared/audit/audit-trail';
import { useListParams } from '../../../shared/lists/list-params';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { type Column, DataTable } from '../../../shared/ui/data-table';
import { Drawer } from '../../../shared/ui/drawer';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterBar } from '../../../shared/ui/filter-bar';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { useReasonOptions } from '../reason-codes/reason-codes-api';
import { setFilter } from '../masters/filters';
import {
  approveChange,
  CHANGE_STATUSES,
  listPending,
  PENDING_KEY,
  type PendingChange,
  pendingHistory,
  POB_MASTERS,
  returnChange,
  usePendingChange,
  withdrawChange,
} from './pob-api';

const STATUS_TONE: Readonly<Record<PendingChange['status'], Tone>> = {
  pending: 'warning',
  approved: 'success',
  returned: 'danger',
  withdrawn: 'neutral',
  failed: 'danger',
};
const FIELDS = [
  'code',
  'name',
  'designation',
  'installationId',
  'role',
  'capacity',
  'evacuationModes',
  'craftType',
  'station',
  'ratedCapacity',
  'certificateExpiresOn',
  'classification',
  'minCount',
  'criticality',
  'notes',
  'effectiveFrom',
  'isActive',
  'isInService',
  'isOperational',
  'outOfServiceReason',
  'unavailableReason',
] as const;
type FieldKey = (typeof FIELDS)[number];
const isField = (key: string): key is FieldKey => (FIELDS as readonly string[]).includes(key);

/**
 * Pending changes (spec 10 §5.3): the POB master changes waiting for a second person, and those
 * decided. The second person approves or returns a change here; its maker may withdraw it.
 */
export default function PendingChangesPage() {
  const { t } = useTranslation();
  const { params, update, apiQuery } = useListParams({
    sort: { field: 'requestedAt', dir: 'desc' },
  });
  const list = useQuery({
    queryKey: [...PENDING_KEY, 'list', apiQuery],
    queryFn: () => listPending(apiQuery),
    placeholderData: keepPreviousData,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const filterList = { params, update };

  const columns: readonly Column<PendingChange>[] = [
    {
      id: 'ref',
      header: t('pob.changes.columns.ref'),
      sortField: 'ref',
      cell: (c) => <span className="font-mono text-sm font-medium text-ink">{c.ref}</span>,
    },
    {
      id: 'change',
      header: t('pob.changes.columns.change'),
      cell: (c) => (
        <div>
          <p className="text-ink">{c.summary}</p>
          <p className="text-xs text-ink-secondary">
            {t(`pob.master.${c.master}`)} · {t(`pob.action.${c.action}`)}
          </p>
        </div>
      ),
    },
    {
      id: 'location',
      header: t('pob.columns.location'),
      cell: (c) => c.location.name,
    },
    {
      id: 'requested',
      header: t('pob.changes.columns.requested'),
      sortField: 'requestedAt',
      cell: (c) => (
        <div>
          <p>{c.requestedBy.name}</p>
          <p className="text-xs text-ink-secondary">{formatGst(c.requestedAt)}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: t('masters.status'),
      sortField: 'status',
      cell: (c) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill tone={STATUS_TONE[c.status]}>
            {t(`pob.changes.status.${c.status}`)}
          </StatusPill>
          {c.myTask && <StatusPill tone="info">{t('pob.changes.yourTurn')}</StatusPill>}
        </div>
      ),
    },
  ];

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader title={t('pob.changes.title')} subtitle={t('pob.changes.subtitle')} />
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        placeholder={t('pob.changes.search')}
        activeCount={Object.keys(params.filters).length}
        onClear={() => update({ q: '', filters: {} })}
      >
        <FilterSelect
          label={t('masters.status')}
          allLabel={t('ui.filter.all')}
          value={params.filters.status}
          options={CHANGE_STATUSES.map((s) => ({ value: s, label: t(`pob.changes.status.${s}`) }))}
          onChange={(v) => setFilter(filterList, 'status', v)}
        />
        <FilterSelect
          label={t('pob.changes.filters.master')}
          allLabel={t('ui.filter.all')}
          value={params.filters.master}
          options={POB_MASTERS.map((m) => ({ value: m, label: t(`pob.master.${m}`) }))}
          onChange={(v) => setFilter(filterList, 'master', v)}
        />
        <FilterSelect
          label={t('pob.changes.filters.who')}
          allLabel={t('pob.changes.filters.anyone')}
          value={params.filters.mine}
          options={[{ value: 'true', label: t('pob.changes.filters.mine') }]}
          onChange={(v) => setFilter(filterList, 'mine', v)}
        />
      </FilterBar>
      {list.isError && (
        <Banner tone="danger">
          {list.error instanceof Error ? list.error.message : t('masters.loadFailed')}
        </Banner>
      )}
      <DataTable
        caption={t('pob.changes.title')}
        columns={columns}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(c) => c.id}
        params={params}
        onParamsChange={update}
        loading={list.isFetching}
        emptyTitle={t('pob.changes.empty')}
        onRowClick={(c) => setOpenId(c.id)}
      />
      {openId && <ChangeDrawer id={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function ChangeDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const change = usePendingChange(id);
  const [history, setHistory] = useState(false);
  const c = change.data;
  return (
    <>
      <Drawer
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={c ? `${c.ref} · ${c.summary}` : t('loading')}
      >
        {c && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={STATUS_TONE[c.status]}>
                {t(`pob.changes.status.${c.status}`)}
              </StatusPill>
              <StatusPill tone="neutral">{t(`pob.master.${c.master}`)}</StatusPill>
            </div>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-secondary">{t('pob.columns.location')}</dt>
              <dd>{c.location.name}</dd>
              <dt className="text-ink-secondary">{t('pob.changes.columns.requested')}</dt>
              <dd>
                {c.requestedBy.name} · {formatGst(c.requestedAt)}
              </dd>
              {c.reason && (
                <>
                  <dt className="text-ink-secondary">{t('pob.changes.reason')}</dt>
                  <dd>{c.reason}</dd>
                </>
              )}
              {c.decidedAt && (
                <>
                  <dt className="text-ink-secondary">{t('pob.changes.decided')}</dt>
                  <dd>{formatGst(c.decidedAt)}</dd>
                </>
              )}
              {c.decisionNote && (
                <>
                  <dt className="text-ink-secondary">{t('pob.changes.note')}</dt>
                  <dd>{c.decisionNote}</dd>
                </>
              )}
            </dl>
            <Changes change={c} />
            <Decision change={c} />
            <Button variant="ghost" onClick={() => setHistory(true)}>
              {t('masters.history')}
            </Button>
          </div>
        )}
      </Drawer>
      {history && c && (
        <AuditTrailDrawer
          open
          onOpenChange={(open) => {
            if (!open) setHistory(false);
          }}
          title={t('masters.historyOf', { record: c.ref })}
          queryKey={[...PENDING_KEY, 'history', c.id]}
          load={(cursor) => pendingHistory(c.id, cursor)}
        />
      )}
    </>
  );
}

/** The record as it was and as proposed, field by field. */
function Changes({ change }: { change: PendingChange }) {
  const { t } = useTranslation();
  const keys = [...new Set([...Object.keys(change.before ?? {}), ...Object.keys(change.after)])];
  const show = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ');
    if (typeof value === 'boolean') return value ? t('pob.changes.yes') : t('pob.changes.no');
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return JSON.stringify(value);
  };
  if (keys.length === 0) return null;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t('pob.changes.values')}</caption>
      <thead>
        <tr className="text-left text-ink-secondary">
          <th scope="col" className="py-1 font-medium">
            {t('pob.changes.field')}
          </th>
          {change.before && (
            <th scope="col" className="py-1 font-medium">
              {t('pob.changes.before')}
            </th>
          )}
          <th scope="col" className="py-1 font-medium">
            {t('pob.changes.after')}
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key} className="border-t border-border">
            <th scope="row" className="py-1 pr-2 text-left font-normal text-ink-secondary">
              {isField(key) ? t(`pob.fields.${key}`) : key}
            </th>
            {change.before && <td className="py-1 pr-2">{show(change.before[key])}</td>}
            <td className="py-1 font-medium text-ink">{show(change.after[key])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Approve or return (the second person), or withdraw (its maker). */
function Decision({ change }: { change: PendingChange }) {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'return' | 'withdraw'>('idle');
  const reasons = useReasonOptions('approver-rejection', mode === 'return');
  const [reasonCode, setReasonCode] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const task = change.myTask;
  const canWithdraw = change.canWithdraw && can(access, 'admin.pending-changes', 'edit');
  // Decided here: say so, also while the change is still being applied.
  if (done) return <Banner tone="success">{done}</Banner>;
  if (change.status !== 'pending' || (!task && !canWithdraw)) {
    return change.status === 'pending' ? (
      <p className="text-sm text-ink-secondary">{t('pob.changes.waiting')}</p>
    ) : null;
  }
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setDone(message);
      setMode('idle');
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ui.confirm.failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-labelledby="change-decision"
      className="space-y-2 rounded-md border border-border p-3"
    >
      <h3 id="change-decision" className="text-sm font-semibold text-ink">
        {task ? t('pob.changes.yourDecision') : t('pob.changes.yourChange')}
      </h3>
      {error && <Banner tone="danger">{error}</Banner>}
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {task && (
            <>
              <Button
                disabled={busy}
                onClick={() => void run(() => approveChange(task), t('pob.changes.approved'))}
              >
                {t('pob.changes.approve')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setMode('return')}>
                {t('pob.changes.return')}
              </Button>
            </>
          )}
          {canWithdraw && (
            <Button variant="secondary" disabled={busy} onClick={() => setMode('withdraw')}>
              {t('pob.changes.withdraw')}
            </Button>
          )}
        </div>
      )}
      {mode === 'return' && task && (
        <div className="space-y-2">
          <SelectField
            label={t('pob.changes.reasonCode')}
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
          >
            <option value="">{t('pob.muster.chooseReason')}</option>
            {(reasons.data?.options ?? []).map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} · {o.description}
              </option>
            ))}
          </SelectField>
          <Field
            label={t('pob.changes.comment')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              disabled={busy || reasonCode.length < 2 || text.trim().length < 3}
              onClick={() =>
                void run(
                  () => returnChange(task, reasonCode, text.trim()),
                  t('pob.changes.returned'),
                )
              }
            >
              {t('pob.changes.confirmReturn')}
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              {t('ui.cancel')}
            </Button>
          </div>
        </div>
      )}
      {mode === 'withdraw' && (
        <div className="space-y-2">
          <Field
            label={t('pob.changes.reason')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              disabled={busy || text.trim().length < 3}
              onClick={() =>
                void run(() => withdrawChange(change, text.trim()), t('pob.changes.withdrawn'))
              }
            >
              {t('pob.changes.confirmWithdraw')}
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              {t('ui.cancel')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
