import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { MODULES } from '../../../api/registry.generated';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { describeConditions } from '../approval-engine/workflow-draft';
import { MasterPage } from '../masters/master-page';
import { RULES_KEY, type Rule, rulesResource, useRule, useRuleTypes } from './rules-api';
import { RuleForm } from './RuleForm';

const MODULE_LABEL = new Map<string, string>(MODULES.map((m) => [m.key, m.label]));
const STATES = ['active', 'scheduled', 'pending', 'ended', 'draft'] as const;
const TONE = {
  active: 'success',
  scheduled: 'info',
  pending: 'warning',
  ended: 'neutral',
  draft: 'neutral',
} as const;

/** Business Rules (spec 10 §3.2, BRD D.2.2.2): typed, versioned and effective-dated. */
export default function BusinessRulesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const catalogue = useRuleTypes();
  const types = catalogue.data?.types ?? [];
  const typeOf = (key: string) => types.find((ty) => ty.key === key);
  // Approval notifications link to a rule: /admin/business-rules?rule=<id>.
  const [search, setSearch] = useSearchParams();
  const linked = useRule(search.get('rule'));
  const closeLinked = () => {
    const next = new URLSearchParams(search);
    next.delete('rule');
    setSearch(next, { replace: true });
  };
  const missing = types.filter((ty) => ty.ready && !ty.live);
  const words = {
    yes: t('approvals.conditions.yes'),
    no: t('approvals.conditions.no'),
    fallback: t('rules.anyCase'),
  };

  return (
    <>
      <MasterPage
        resource={rulesResource}
        title={t('rules.title')}
        subtitle={t('rules.subtitle')}
        noun={t('rules.noun')}
        searchPlaceholder={t('rules.search')}
        describe={(r) => r.name}
        form={RuleForm}
        defaultSort={{ field: 'module', dir: 'asc' }}
        kpis={
          <div className="space-y-2">
            <Banner tone="info">{t('rules.banner')}</Banner>
            {missing.length > 0 && (
              <Banner tone="warning">
                {t('rules.missing', { types: missing.map((ty) => ty.label).join(', ') })}
              </Banner>
            )}
          </div>
        }
        columns={[
          {
            id: 'rule',
            header: t('rules.columns.rule'),
            sortField: 'name',
            cell: (r) => (
              <div>
                <p className="font-medium text-ink">{r.name}</p>
                <p className="text-xs text-ink-secondary">
                  {r.code}
                  {r.highImpact ? ` · ${t('rules.highImpact')}` : ''}
                </p>
              </div>
            ),
          },
          {
            id: 'module',
            header: t('rules.columns.module'),
            sortField: 'module',
            cell: (r) => MODULE_LABEL.get(r.module) ?? r.module,
          },
          {
            id: 'type',
            header: t('rules.columns.type'),
            sortField: 'type',
            cell: (r) => r.typeLabel,
          },
          {
            id: 'condition',
            header: t('rules.columns.condition'),
            className: 'max-w-64',
            cell: (r) => (
              <span className="line-clamp-2 text-sm">
                {describeConditions(typeOf(r.type), r.condition, words)}
              </span>
            ),
          },
          {
            id: 'value',
            header: t('rules.columns.value'),
            className: 'max-w-80',
            cell: (r) => <span className="line-clamp-2 text-sm">{r.summary}</span>,
          },
          {
            id: 'priority',
            header: t('rules.columns.priority'),
            sortField: 'priority',
            align: 'right',
            cell: (r) => r.priority,
          },
          {
            id: 'version',
            header: t('rules.columns.version'),
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (r) =>
              r.pendingVersionNo !== null && r.pendingVersionNo !== r.versionNo
                ? t('rules.versionPending', { n: r.versionNo, pending: r.pendingVersionNo })
                : `v${r.versionNo}`,
          },
        ]}
        status={(r: Rule) => (
          <StatusPill tone={TONE[r.state]}>
            {r.state === 'scheduled'
              ? t('rules.state.scheduledFrom', { at: formatGst(r.startsAt) })
              : t(`rules.state.${r.state}`)}
          </StatusPill>
        )}
        lifecycle={(r) =>
          r.state === 'active' || r.state === 'scheduled'
            ? 'deactivate'
            : r.state === 'ended'
              ? 'reactivate'
              : null
        }
        lifecycleText={{
          deactivate: {
            menu: t('rules.end.menu'),
            title: (r) => t('rules.end.title', { name: r.name }),
            body: (r) => (r.highImpact ? t('rules.end.bodyApproval') : t('rules.end.body')),
          },
          reactivate: {
            menu: t('rules.reinstate.menu'),
            title: (r) => t('rules.reinstate.title', { name: r.name }),
            body: (r) =>
              r.highImpact ? t('rules.reinstate.bodyApproval') : t('rules.reinstate.body'),
          },
        }}
        filters={({ params, update }) => {
          const set = (name: string, value: string | undefined) => {
            const rest = Object.fromEntries(
              Object.entries(params.filters).filter(([k]) => k !== name),
            );
            update({ filters: value ? { ...rest, [name]: value } : rest });
          };
          const module = params.filters.module;
          return (
            <>
              <FilterSelect
                label={t('rules.filters.module')}
                allLabel={t('ui.filter.all')}
                value={module}
                options={MODULES.filter((m) => types.some((ty) => ty.module === m.key)).map(
                  (m) => ({ value: m.key, label: m.label }),
                )}
                onChange={(v) => set('module', v)}
              />
              <FilterSelect
                label={t('rules.filters.type')}
                allLabel={t('ui.filter.all')}
                value={params.filters.type}
                options={types
                  .filter((ty) => !module || ty.module === module)
                  .map((ty) => ({ value: ty.key, label: ty.label }))}
                onChange={(v) => set('type', v)}
              />
              <FilterSelect
                label={t('rules.filters.state')}
                allLabel={t('ui.filter.all')}
                value={params.filters.state}
                options={STATES.map((s) => ({ value: s, label: t(`rules.state.${s}`) }))}
                onChange={(v) => set('state', v)}
              />
            </>
          );
        }}
      />
      {linked.data && (
        <RuleForm
          open
          onOpenChange={(open) => {
            if (!open) closeLinked();
          }}
          record={linked.data}
          onSaved={() => {
            closeLinked();
            void queryClient.invalidateQueries({ queryKey: RULES_KEY });
          }}
        />
      )}
    </>
  );
}
