import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import { can, type Right } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { AuditTrailDrawer } from '../../../shared/audit/audit-trail';
import { downloadFile } from '../../../shared/lists/download';
import { toExportQuery, useListParams } from '../../../shared/lists/list-params';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { type Column, DataTable, type ExportFormat } from '../../../shared/ui/data-table';
import { FilterBar } from '../../../shared/ui/filter-bar';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { RowActions } from '../masters/master-page';

type Device = components['schemas']['AdminDevice'];
const KEY = ['access', 'devices'] as const;
const STATUSES = ['active', 'revoked', 'blocked'] as const;
const PLATFORMS = ['android', 'ios', 'ipados'] as const;
const TONE: Record<Device['status'], Tone> = {
  active: 'success',
  revoked: 'neutral',
  blocked: 'danger',
};
const ifMatch = (d: Device) => ({ 'If-Match': String(d.version) });

/**
 * App devices for administrators (spec 10 §5.2 Devices, ADR-0039). Revoking here blocks the
 * device until the block is lifted. FIDS displays join this page in Phase 4.
 */
export default function DevicesPage() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const has = (right: Right) => can(access, 'admin.devices', right);
  const queryClient = useQueryClient();
  const { params, update, apiQuery } = useListParams();
  const list = useQuery({
    queryKey: [...KEY, 'list', apiQuery],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/access/devices', { params: { query: apiQuery } })),
    placeholderData: keepPreviousData,
  });
  const [pending, setPending] = useState<{ kind: 'block' | 'unblock'; device: Device } | null>(
    null,
  );
  const [historyOf, setHistoryOf] = useState<Device | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const labelOf = (d: Device) =>
    `${d.model ?? t(`devices.platform.${d.platform}`)} · ${d.user.name}`;
  const setFilter = (name: string, value: string | undefined) => {
    const rest = Object.fromEntries(Object.entries(params.filters).filter(([k]) => k !== name));
    update({ filters: value ? { ...rest, [name]: value } : rest });
  };

  const exportList = (format: ExportFormat) => {
    downloadFile('/api/v1/access/devices/export', { ...toExportQuery(params), format }).catch(
      (error: unknown) =>
        setNotice(error instanceof Error ? error.message : t('masters.exportFailed')),
    );
  };

  const confirm = async (reason: string) => {
    if (!pending) return;
    const { kind, device } = pending;
    const path =
      kind === 'block'
        ? '/api/v1/access/devices/{id}/block'
        : '/api/v1/access/devices/{id}/unblock';
    unwrap(
      await api.POST(path, {
        params: { path: { id: device.id }, header: ifMatch(device) },
        body: { reason },
      }),
    );
    await queryClient.invalidateQueries({ queryKey: KEY });
  };

  const columns: readonly Column<Device>[] = [
    {
      id: 'user',
      header: t('devices.columns.user'),
      sortField: 'user',
      cell: (d) => (
        <div>
          <p className="font-medium text-ink">{d.user.name}</p>
          <p className="text-xs text-ink-secondary">{d.user.email}</p>
        </div>
      ),
    },
    {
      id: 'device',
      header: t('devices.columns.device'),
      cell: (d) => (
        <div>
          <p className="text-ink">{d.model ?? t(`devices.platform.${d.platform}`)}</p>
          <p className="text-xs text-ink-secondary">
            {t(`devices.platform.${d.platform}`)}
            {d.osVersion ? ` ${d.osVersion}` : ''}
          </p>
        </div>
      ),
    },
    { id: 'app', header: t('devices.columns.app'), cell: (d) => d.appVersion },
    {
      id: 'lastSeen',
      header: t('devices.columns.lastSeen'),
      sortField: 'lastSeen',
      className: 'whitespace-nowrap',
      cell: (d) => formatGst(d.lastSeenAt),
    },
    {
      id: 'status',
      header: t('devices.columns.status'),
      cell: (d) => (
        <div>
          <StatusPill tone={TONE[d.status]}>{t(`devices.status.${d.status}`)}</StatusPill>
          {(d.blockedReason ?? d.revokedReason) && (
            <p className="mt-1 text-xs text-ink-secondary">{d.blockedReason ?? d.revokedReason}</p>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: t('masters.actions'),
      align: 'right',
      cell: (d) => (
        <RowActions
          label={t('devices.actionsFor', { label: labelOf(d) })}
          items={[
            has('deactivate') &&
              d.status !== 'blocked' && {
                label: t('devices.block'),
                run: () => setPending({ kind: 'block', device: d }),
              },
            has('deactivate') &&
              d.status === 'blocked' && {
                label: t('devices.unblock'),
                run: () => setPending({ kind: 'unblock', device: d }),
              },
            { label: t('devices.history'), run: () => setHistoryOf(d) },
          ]}
        />
      ),
    },
  ];

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader title={t('devices.title')} subtitle={t('devices.subtitle')} />
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        placeholder={t('devices.search')}
        activeCount={Object.keys(params.filters).length}
        onClear={() => update({ q: '', filters: {} })}
      >
        <FilterSelect
          label={t('devices.filters.status')}
          allLabel={t('ui.filter.all')}
          value={params.filters.status}
          options={STATUSES.map((s) => ({ value: s, label: t(`devices.status.${s}`) }))}
          onChange={(v) => setFilter('status', v)}
        />
        <FilterSelect
          label={t('devices.filters.platform')}
          allLabel={t('ui.filter.all')}
          value={params.filters.platform}
          options={PLATFORMS.map((p) => ({ value: p, label: t(`devices.platform.${p}`) }))}
          onChange={(v) => setFilter('platform', v)}
        />
      </FilterBar>
      {notice && <Banner tone="danger">{notice}</Banner>}
      {list.isError && <Banner tone="danger">{list.error.message}</Banner>}
      <DataTable
        caption={t('devices.title')}
        columns={columns}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(d) => d.id}
        params={params}
        onParamsChange={update}
        loading={list.isFetching}
        exports={{ allowed: has('export'), formats: ['xlsx', 'csv'], onExport: exportList }}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending
            ? t(pending.kind === 'block' ? 'devices.blockTitle' : 'devices.unblockTitle', {
                label: labelOf(pending.device),
              })
            : ''
        }
        body={
          pending ? t(pending.kind === 'block' ? 'devices.blockBody' : 'devices.unblockBody') : ''
        }
        confirmLabel={
          pending ? t(pending.kind === 'block' ? 'devices.block' : 'devices.unblock') : ''
        }
        tone={pending?.kind === 'unblock' ? 'primary' : 'danger'}
        onConfirm={confirm}
      />
      {historyOf && (
        <AuditTrailDrawer
          open
          onOpenChange={(open) => {
            if (!open) setHistoryOf(null);
          }}
          title={t('masters.historyOf', { record: labelOf(historyOf) })}
          queryKey={[...KEY, historyOf.id]}
          load={async (cursor) =>
            unwrap(
              await api.GET('/api/v1/access/devices/{id}/history', {
                params: { path: { id: historyOf.id }, query: cursor ? { cursor } : {} },
              }),
            )
          }
        />
      )}
    </section>
  );
}
