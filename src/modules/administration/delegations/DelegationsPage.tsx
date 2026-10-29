import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import { can, type Right } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { AuditTrailDrawer } from '../../../shared/audit/audit-trail';
import { downloadFile } from '../../../shared/lists/download';
import { toExportQuery, useListParams } from '../../../shared/lists/list-params';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { type Column, DataTable, type ExportFormat } from '../../../shared/ui/data-table';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field } from '../../../shared/ui/field';
import { FilterBar } from '../../../shared/ui/filter-bar';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { RowActions } from '../masters/master-page';
import { DelegationForm } from './DelegationForm';
import {
  amendDelegation,
  type Delegation,
  DELEGATIONS_KEY,
  fromGstInput,
  revokeDelegation,
  toGstInput,
} from './delegations-api';

const STATUSES = ['scheduled', 'active', 'expired', 'revoked'] as const;
const TONE: Record<Delegation['status'], Tone> = {
  scheduled: 'info',
  active: 'success',
  expired: 'neutral',
  revoked: 'warning',
};
const labelOf = (d: Delegation) => `${d.delegator.name} → ${d.delegate.name}`;

/** Delegation administration (spec 10 §2.4, BRD D.2.1.4). */
export default function DelegationsPage() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const has = (right: Right) => can(access, 'admin.delegations', right);
  const queryClient = useQueryClient();
  const { params, update, apiQuery } = useListParams();
  const list = useQuery({
    queryKey: [...DELEGATIONS_KEY, 'list', apiQuery],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/access/delegations', { params: { query: apiQuery } })),
    placeholderData: keepPreviousData,
  });
  const [creating, setCreating] = useState(false);
  const [amending, setAmending] = useState<Delegation | null>(null);
  const [revoking, setRevoking] = useState<Delegation | null>(null);
  const [historyOf, setHistoryOf] = useState<Delegation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: DELEGATIONS_KEY });

  const exportList = (format: ExportFormat) => {
    downloadFile('/api/v1/access/delegations/export', { ...toExportQuery(params), format }).catch(
      (error: unknown) =>
        setNotice(error instanceof Error ? error.message : t('masters.exportFailed')),
    );
  };

  const columns: readonly Column<Delegation>[] = [
    {
      id: 'delegator',
      header: t('delegations.columns.delegator'),
      sortField: 'delegator',
      cell: (d) => d.delegator.name,
    },
    { id: 'delegate', header: t('delegations.columns.delegate'), cell: (d) => d.delegate.name },
    {
      id: 'modules',
      header: t('delegations.columns.modules'),
      cell: (d) => d.moduleKeys?.join(', ') ?? t('account.allWorkflows'),
    },
    {
      id: 'period',
      header: t('delegations.columns.period'),
      sortField: 'startsAt',
      className: 'whitespace-nowrap',
      cell: (d) => `${formatGst(d.startsAt)} – ${formatGst(d.endsAt)}`,
    },
    {
      id: 'reason',
      header: t('delegations.columns.reason'),
      className: 'max-w-60',
      cell: (d) => d.reason,
    },
    {
      id: 'status',
      header: t('delegations.columns.status'),
      cell: (d) => (
        <StatusPill tone={TONE[d.status]}>{t(`delegations.status.${d.status}`)}</StatusPill>
      ),
    },
    {
      id: 'actions',
      header: t('masters.actions'),
      align: 'right',
      cell: (d) => (
        <RowActions
          label={t('delegations.actionsFor', { label: labelOf(d) })}
          items={[
            has('edit') &&
              (d.status === 'scheduled' || d.status === 'active') && {
                label: t('delegations.amend'),
                run: () => setAmending(d),
              },
            has('edit') &&
              (d.status === 'scheduled' || d.status === 'active') && {
                label: t('delegations.revoke'),
                run: () => setRevoking(d),
              },
            { label: t('delegations.history'), run: () => setHistoryOf(d) },
          ]}
        />
      ),
    },
  ];

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title={t('delegations.title')}
        subtitle={t('delegations.subtitle')}
        actions={
          has('create') && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              {t('account.newDelegation')}
            </Button>
          )
        }
      />
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        placeholder={t('delegations.search')}
        activeCount={Object.keys(params.filters).length}
        onClear={() => update({ q: '', filters: {} })}
      >
        <FilterSelect
          label={t('delegations.filters.status')}
          allLabel={t('ui.filter.all')}
          value={params.filters.status}
          options={STATUSES.map((s) => ({ value: s, label: t(`delegations.status.${s}`) }))}
          onChange={(v) => update({ filters: v ? { ...params.filters, status: v } : {} })}
        />
      </FilterBar>
      {notice && <Banner tone="danger">{notice}</Banner>}
      {list.isError && <Banner tone="danger">{list.error.message}</Banner>}
      <DataTable
        caption={t('delegations.title')}
        columns={columns}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(d) => d.id}
        params={params}
        onParamsChange={update}
        loading={list.isFetching}
        exports={{ allowed: has('export'), formats: ['xlsx', 'csv'], onExport: exportList }}
      />
      {creating && (
        <DelegationForm
          scope="admin"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      )}
      {amending && (
        <AmendDialog
          delegation={amending}
          onClose={() => setAmending(null)}
          onSaved={() => {
            setAmending(null);
            void refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title={revoking ? t('delegations.revokeTitle', { label: labelOf(revoking) }) : ''}
        body={t('delegations.revokeBody')}
        confirmLabel={t('delegations.revoke')}
        onConfirm={async (reason) => {
          if (!revoking) return;
          await revokeDelegation(revoking, reason);
          await refresh();
        }}
      />
      {historyOf && (
        <AuditTrailDrawer
          open
          onOpenChange={(open) => {
            if (!open) setHistoryOf(null);
          }}
          title={t('masters.historyOf', { record: labelOf(historyOf) })}
          queryKey={[...DELEGATIONS_KEY, historyOf.id]}
          load={async (cursor) =>
            unwrap(
              await api.GET('/api/v1/access/delegations/{id}/history', {
                params: { path: { id: historyOf.id }, query: cursor ? { cursor } : {} },
              }),
            )
          }
        />
      )}
    </section>
  );
}

function AmendDialog({
  delegation,
  onClose,
  onSaved,
}: {
  delegation: Delegation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const started = delegation.status === 'active';
  const [starts, setStarts] = useState(toGstInput(delegation.startsAt));
  const [ends, setEnds] = useState(toGstInput(delegation.endsAt));
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setFailure(t('delegation.reasonRequired'));
      return;
    }
    try {
      await amendDelegation(delegation, {
        ...(started ? {} : { startsAt: fromGstInput(starts) }),
        endsAt: fromGstInput(ends),
        reason: reason.trim(),
      });
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  };

  return (
    <EntityFormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('delegations.amendTitle', { label: labelOf(delegation) })}
      onSubmit={submit}
      submitLabel={t('delegations.save')}
      error={failure}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          type="datetime-local"
          label={t('delegation.starts')}
          value={starts}
          disabled={started}
          onChange={(e) => setStarts(e.target.value)}
        />
        <Field
          type="datetime-local"
          label={t('delegation.ends')}
          value={ends}
          onChange={(e) => setEnds(e.target.value)}
        />
      </div>
      <Field
        label={t('delegation.reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </EntityFormModal>
  );
}
