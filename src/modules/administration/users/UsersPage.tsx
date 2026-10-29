import { ShieldCheck, Users } from 'lucide-react';
import { Tabs } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { can, type Right } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { downloadFile } from '../../../shared/lists/download';
import { toExportQuery, useListParams } from '../../../shared/lists/list-params';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { type Column, DataTable, type ExportFormat } from '../../../shared/ui/data-table';
import { FilterBar } from '../../../shared/ui/filter-bar';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import { SyncStatus } from './SyncStatus';
import { UsageAnalytics } from './UsageAnalytics';
import { UserDrawer } from './UserDrawer';
import { formatDay, STATUS_TONE, useScopeText } from './user-text';
import {
  type UserSummary,
  useRoleOptions,
  useScopeOptions,
  useUserKpis,
  useUsers,
} from './users-api';

const SOURCES = ['sap', 'fieldglass', 'external_contact', 'manual_exception'] as const;
const STATUSES = ['invited', 'active', 'deactivated'] as const;
const TAB_CLASS =
  'min-h-touch border-b-2 border-transparent px-4 text-sm font-semibold text-ink-secondary data-[state=active]:border-primary data-[state=active]:text-ink';

/**
 * Users (spec 10 §2.1, BRD D.2.1.1). There is no "New user": users arrive from the source
 * systems (BRD overrides demo). Administrators give roles, deactivate and invite in the drawer.
 */
export default function UsersPage() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const has = (right: Right) => can(access, 'admin.users', right);
  const { params, update, apiQuery } = useListParams({ sort: { field: 'name', dir: 'asc' } });
  const users = useUsers(apiQuery);
  const kpis = useUserKpis();
  const roles = useRoleOptions();
  const scope = useScopeOptions();
  const scopeText = useScopeText();
  const [openId, setOpenId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const filter = (name: string) => params.filters[name];
  const setFilter = (name: string, value: string | undefined) => {
    const rest = Object.fromEntries(Object.entries(params.filters).filter(([key]) => key !== name));
    update({ filters: value ? { ...rest, [name]: value } : rest });
  };

  const exportList = (format: ExportFormat) => {
    setExportError(null);
    downloadFile('/api/v1/access/users/export', { ...toExportQuery(params), format }).catch(
      (error: unknown) => {
        setExportError(error instanceof Error ? error.message : t('masters.exportFailed'));
      },
    );
  };

  const columns: readonly Column<UserSummary>[] = [
    {
      id: 'name',
      header: t('users.columns.name'),
      sortField: 'name',
      cell: (u) => (
        <div>
          <p className="font-medium text-ink">{u.displayName}</p>
          <p className="text-xs text-ink-secondary">
            {u.email} · {u.personnelNo}
          </p>
        </div>
      ),
    },
    {
      id: 'organisation',
      header: t('users.columns.organisation'),
      cell: (u) => u.organisation ?? '—',
    },
    { id: 'source', header: t('users.columns.source'), cell: (u) => t(`users.source.${u.source}`) },
    { id: 'signIn', header: t('users.columns.signIn'), cell: (u) => t(`users.signIn.${u.signIn}`) },
    {
      id: 'roles',
      header: t('users.columns.roles'),
      cell: (u) =>
        u.roles.length === 0 ? (
          <span className="text-ink-muted">{t('users.noRole')}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <StatusPill key={r.assignmentId} tone={r.isAdminTier ? 'accent' : 'neutral'}>
                {r.name}
              </StatusPill>
            ))}
          </div>
        ),
    },
    {
      id: 'scope',
      header: t('users.columns.scope'),
      className: 'max-w-56',
      cell: (u) => (
        <span className="line-clamp-2 text-sm">
          {u.roles.map((r) => scopeText(r.scope)).join('; ')}
        </span>
      ),
    },
    {
      id: 'accessUntil',
      header: t('users.columns.accessUntil'),
      className: 'whitespace-nowrap',
      sortField: 'accessUntil',
      cell: (u) =>
        u.roles.length === 0 ? '—' : u.accessUntil ? formatDay(u.accessUntil) : t('users.noExpiry'),
    },
    {
      id: 'status',
      header: t('users.columns.status'),
      className: 'whitespace-nowrap',
      sortField: 'status',
      cell: (u) => (
        <StatusPill tone={STATUS_TONE[u.status]}>{t(`users.status.${u.status}`)}</StatusPill>
      ),
    },
    {
      id: 'lastSignIn',
      header: t('users.columns.lastSignIn'),
      className: 'whitespace-nowrap',
      sortField: 'lastSignIn',
      cell: (u) => (u.lastSignInAt ? formatGst(u.lastSignInAt) : t('users.never')),
    },
  ];

  const k = kpis.data;
  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard
          title={t('users.kpi.registered')}
          value={k?.registered ?? '—'}
          {...(k
            ? {
                subline: t('users.kpi.registeredSub', {
                  invited: k.invited,
                  withoutRoles: k.withoutRoles,
                }),
              }
            : {})}
          icon={<Users className="size-5" aria-hidden />}
        />
        <StatCard title={t('users.kpi.active')} value={k?.active ?? '—'} tone="success" />
        <StatCard
          title={t('users.kpi.expiring')}
          value={k?.expiringIn30Days ?? '—'}
          subline={t('users.kpi.expiringSub')}
          {...(k && k.expiringIn30Days > 0 ? { tone: 'warning' as const } : {})}
        />
        <StatCard
          title={t('users.kpi.external')}
          value={k?.external ?? '—'}
          subline={t('users.kpi.externalSub')}
        />
        <StatCard
          title={t('users.kpi.adminTier')}
          value={k?.adminTierHolders ?? '—'}
          {...(k && k.overLimit.length > 0 ? { tone: 'danger' as const } : {})}
          icon={<ShieldCheck className="size-5" aria-hidden />}
        />
      </div>
      {k?.overLimit.map((role) => (
        <Banner key={role.code} tone="danger">
          {t('users.kpi.overLimit', {
            role: role.name,
            holders: role.holders,
            max: role.maxHolders,
          })}
        </Banner>
      ))}
      <SyncStatus canSync={has('edit')} />

      <Tabs.Root defaultValue="directory" className="space-y-4">
        <Tabs.List className="flex gap-2 border-b border-border" aria-label={t('users.title')}>
          <Tabs.Trigger value="directory" className={TAB_CLASS}>
            {t('users.tabs.directory')}
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics" className={TAB_CLASS}>
            {t('users.tabs.analytics')}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="directory" className="space-y-4">
          <FilterBar
            q={params.q}
            onQChange={(q) => update({ q })}
            placeholder={t('users.filters.search')}
            activeCount={Object.keys(params.filters).length}
            onClear={() => update({ q: '', filters: {} })}
          >
            <FilterSelect
              label={t('users.filters.role')}
              allLabel={t('ui.filter.all')}
              value={filter('role')}
              options={(roles.data ?? []).map((r) => ({ value: r.code, label: r.name }))}
              onChange={(v) => setFilter('role', v)}
            />
            <FilterSelect
              label={t('users.filters.zone')}
              allLabel={t('ui.filter.all')}
              value={filter('zone')}
              options={(scope.data?.zones ?? []).map((z) => ({ value: z.id, label: z.name }))}
              onChange={(v) => setFilter('zone', v)}
            />
            <FilterSelect
              label={t('users.filters.source')}
              allLabel={t('ui.filter.all')}
              value={filter('source')}
              options={SOURCES.map((s) => ({ value: s, label: t(`users.source.${s}`) }))}
              onChange={(v) => setFilter('source', v)}
            />
            <FilterSelect
              label={t('users.filters.status')}
              allLabel={t('ui.filter.all')}
              value={filter('status')}
              options={STATUSES.map((s) => ({ value: s, label: t(`users.status.${s}`) }))}
              onChange={(v) => setFilter('status', v)}
            />
            <FilterSelect
              label={t('users.filters.access')}
              allLabel={t('ui.filter.all')}
              value={filter('access')}
              options={[
                { value: 'expiring', label: t('users.filters.expiring') },
                { value: 'none', label: t('users.filters.none') },
              ]}
              onChange={(v) => setFilter('access', v)}
            />
          </FilterBar>
          {users.isError && <Banner tone="danger">{users.error.message}</Banner>}
          {exportError && <Banner tone="danger">{exportError}</Banner>}
          <DataTable
            caption={t('users.title')}
            columns={columns}
            rows={users.data?.items}
            total={users.data?.total}
            rowKey={(u) => u.id}
            params={params}
            onParamsChange={update}
            loading={users.isFetching}
            deactivatedToggle
            exports={{ allowed: has('export'), formats: ['xlsx', 'csv'], onExport: exportList }}
            onRowClick={(u) => setOpenId(u.id)}
          />
        </Tabs.Content>
        <Tabs.Content value="analytics">
          <UsageAnalytics />
        </Tabs.Content>
      </Tabs.Root>

      {openId && <UserDrawer userId={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}
