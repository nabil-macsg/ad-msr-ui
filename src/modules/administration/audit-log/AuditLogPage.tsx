import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MODULES } from '../../../api/registry.generated';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { type AuditEvent } from '../../../shared/audit/audit-trail';
import { changesOf } from '../../../shared/audit/changes';
import { downloadFile } from '../../../shared/lists/download';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { EmptyState } from '../../../shared/ui/empty-state';
import { Field } from '../../../shared/ui/field';
import { FilterBar } from '../../../shared/ui/filter-bar';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { PageHeader } from '../../../shared/ui/page-header';
import { Spinner } from '../../../shared/ui/spinner';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Person } from '../delegations/delegations-api';
import { PersonPicker } from '../delegations/PersonPicker';
import {
  type AuditQuery,
  useAuditFacets,
  useAuditLog,
  useAuditRetention,
  useAuditSummary,
} from './audit-api';

const MODULE_LABEL = new Map<string, string>(MODULES.map((m) => [m.key, m.label]));
const OUTCOMES = ['success', 'failure', 'denied'] as const;
const OUTCOME_TONE = { success: 'success', failure: 'danger', denied: 'warning' } as const;
const DAY_MS = 86_400_000;

interface Filters {
  q: string;
  module: string;
  actionType: string;
  outcome: '' | (typeof OUTCOMES)[number];
  referenceId: string;
  actor: Person | null;
  from: string;
  to: string;
}
const EMPTY: Filters = {
  q: '',
  module: '',
  actionType: '',
  outcome: '',
  referenceId: '',
  actor: null,
  from: '',
  to: '',
};

/** GST calendar days to the API's instants: from the start of `from` to the end of `to`. */
function toQuery(f: Filters): AuditQuery {
  const startOf = (day: string) => new Date(`${day}T00:00:00+04:00`);
  return {
    ...(f.q ? { q: f.q } : {}),
    ...(f.module ? { module: f.module } : {}),
    ...(f.actionType ? { actionType: f.actionType } : {}),
    ...(f.outcome ? { outcome: f.outcome } : {}),
    ...(f.referenceId.trim() ? { referenceId: f.referenceId.trim() } : {}),
    ...(f.actor ? { actorUserId: f.actor.userId } : {}),
    ...(f.from ? { from: startOf(f.from).toISOString() } : {}),
    ...(f.to ? { to: new Date(startOf(f.to).getTime() + DAY_MS).toISOString() } : {}),
  };
}

/** Before → after, field by field; a value that isn't a record shows whole. */
function Change({ event }: { event: AuditEvent }) {
  const changes = changesOf(event.before, event.after);
  if (changes.length > 0) {
    return (
      <ul className="space-y-0.5">
        {changes.map((c) => (
          <li key={c.field} className="text-xs">
            <span className="font-medium text-ink">{c.field}</span>: {c.from} → {c.to}
          </li>
        ))}
      </ul>
    );
  }
  const show = (v: unknown) => (v === null || v === undefined ? '—' : JSON.stringify(v));
  if (event.before == null && event.after == null) return null;
  return (
    <p className="line-clamp-3 font-mono text-xs break-all">
      {show(event.before)} → {show(event.after)}
    </p>
  );
}

/**
 * The Audit Log (spec 10 §4, BRD D.2.3.1): every action, newest first, with who, what changed
 * and from where. Module Power Users see their own modules' entries; export is Admin only.
 */
export default function AuditLogPage() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [exportError, setExportError] = useState<string | null>(null);
  const query = toQuery(filters);
  const log = useAuditLog(query);
  const summary = useAuditSummary(query);
  const facets = useAuditFacets();
  const retention = useAuditRetention();
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const entries = log.data?.pages.flatMap((p) => p.items) ?? [];
  const actionTypes = (facets.data?.actionTypes ?? []).filter(
    (a) => !filters.module || a.module === filters.module,
  );
  const active = Object.entries(filters).filter(
    ([k, v]) => k !== 'q' && v !== '' && v !== null,
  ).length;
  const exportAs = (format: 'xlsx' | 'csv') => {
    setExportError(null);
    downloadFile('/api/v1/audit-log/export', { ...query, format }).catch((error: unknown) => {
      setExportError(error instanceof Error ? error.message : t('masters.exportFailed'));
    });
  };

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title={t('auditLog.title')}
        subtitle={t('auditLog.subtitle')}
        actions={
          can(access, 'admin.audit-log', 'export') && (
            <>
              <Button variant="secondary" onClick={() => exportAs('xlsx')}>
                {t('auditLog.exportExcel')}
              </Button>
              <Button variant="secondary" onClick={() => exportAs('csv')}>
                {t('auditLog.exportCsv')}
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t('auditLog.kpi.entries')}
          value={summary.data?.entries ?? '—'}
          subline={t('auditLog.kpi.held', { held: summary.data?.held ?? '—' })}
        />
        <StatCard title={t('auditLog.kpi.people')} value={summary.data?.people ?? '—'} />
        <StatCard title={t('auditLog.kpi.modules')} value={summary.data?.modules ?? '—'} />
        <StatCard title={t('auditLog.kpi.withChange')} value={summary.data?.withChange ?? '—'} />
      </div>

      <FilterBar
        q={filters.q}
        onQChange={(q) => set({ q })}
        placeholder={t('auditLog.search')}
        activeCount={active}
        onClear={() => setFilters(EMPTY)}
      >
        <FilterSelect
          label={t('auditLog.filters.module')}
          allLabel={t('ui.filter.all')}
          value={filters.module || undefined}
          options={(facets.data?.modules ?? []).map((m) => ({
            value: m,
            label: MODULE_LABEL.get(m) ?? m,
          }))}
          onChange={(v) => set({ module: v ?? '', actionType: '' })}
        />
        <FilterSelect
          label={t('auditLog.filters.action')}
          allLabel={t('ui.filter.all')}
          value={filters.actionType || undefined}
          options={actionTypes.map((a) => ({ value: a.key, label: a.label }))}
          onChange={(v) => set({ actionType: v ?? '' })}
        />
        <FilterSelect
          label={t('auditLog.filters.outcome')}
          allLabel={t('ui.filter.all')}
          value={filters.outcome || undefined}
          options={OUTCOMES.map((o) => ({ value: o, label: t(`auditLog.outcome.${o}`) }))}
          onChange={(v) => set({ outcome: (v ?? '') as Filters['outcome'] })}
        />
      </FilterBar>
      <div className="grid gap-3 md:grid-cols-4">
        <Field
          label={t('auditLog.filters.reference')}
          value={filters.referenceId}
          onChange={(e) => set({ referenceId: e.target.value })}
        />
        <Field
          type="date"
          label={t('auditLog.filters.from')}
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
        />
        <Field
          type="date"
          label={t('auditLog.filters.to')}
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
        />
        <PersonPicker
          label={t('auditLog.filters.person')}
          scope="mine"
          value={filters.actor}
          onChange={(actor) => set({ actor })}
        />
      </div>

      {(log.isError || summary.isError) && (
        <Banner tone="danger">{t('auditLog.loadFailed')}</Banner>
      )}
      {exportError && <Banner tone="danger">{exportError}</Banner>}
      {log.isPending && <Spinner label={t('loading')} />}
      {log.isSuccess && entries.length === 0 && <EmptyState title={t('auditLog.empty')} />}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('auditLog.title')}</caption>
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                {(['when', 'module', 'action', 'record', 'who', 'change', 'source'] as const).map(
                  (c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-semibold">
                      {t(`auditLog.columns.${c}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{formatGst(e.occurredAt)}</td>
                  <td className="px-3 py-2">{MODULE_LABEL.get(e.module) ?? e.module}</td>
                  <td className="px-3 py-2">
                    <p className="text-ink">{e.actionLabel}</p>
                    {e.outcome !== 'success' && (
                      <StatusPill tone={OUTCOME_TONE[e.outcome]}>
                        {t(`auditLog.outcome.${e.outcome}`)}
                      </StatusPill>
                    )}
                    {e.reason && <p className="text-xs text-ink-secondary">{e.reason}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-ink">{e.record.ref ?? ''}</p>
                    <p className="text-xs text-ink-secondary">{e.record.label ?? ''}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-ink">{e.actor.label}</p>
                    {e.actor.role && <p className="text-xs text-ink-secondary">{e.actor.role}</p>}
                    {e.actor.onBehalfOf && (
                      <p className="text-xs text-ink-secondary">
                        {t('ui.audit.onBehalfOf', { name: e.actor.onBehalfOf.label ?? '' })}
                      </p>
                    )}
                  </td>
                  <td className="max-w-80 px-3 py-2">
                    <Change event={e} />
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-secondary">
                    {[e.source.ip, e.source.device].filter(Boolean).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entries.length > 0 && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-ink-secondary" aria-live="polite">
            {t('auditLog.showing', {
              shown: entries.length,
              total: summary.data?.entries ?? entries.length,
            })}
          </p>
          {log.hasNextPage && (
            <Button
              variant="secondary"
              disabled={log.isFetchingNextPage}
              onClick={() => void log.fetchNextPage()}
            >
              {t('auditLog.showMore')}
            </Button>
          )}
        </div>
      )}

      {retention.data && (
        <section
          aria-labelledby="audit-retention"
          className="space-y-2 rounded-lg border border-border bg-card p-5 shadow-card"
        >
          <h2 id="audit-retention" className="text-lg font-semibold text-ink">
            {t('auditLog.retention.title')}
          </h2>
          <p className="text-sm text-ink-secondary">{t('auditLog.retention.body')}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-ink">{t('auditLog.retention.audit')}</dt>
              <dd>{t('auditLog.retention.years', { count: retention.data.auditYears })}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">{t('auditLog.retention.records')}</dt>
              <dd>{t('auditLog.retention.kept')}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">{t('auditLog.retention.events')}</dt>
              <dd>{t('auditLog.retention.days', { count: retention.data.outboxDays })}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">{t('auditLog.retention.syncKeys')}</dt>
              <dd>{t('auditLog.retention.days', { count: retention.data.syncKeyDays })}</dd>
            </div>
          </dl>
        </section>
      )}
    </section>
  );
}
