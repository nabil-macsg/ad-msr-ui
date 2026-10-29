import { useTranslation } from 'react-i18next';
import { MODULES } from '../../../api/registry.generated';
import { Banner } from '../../../shared/ui/banner';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { MasterPage } from '../masters/master-page';
import { describeConditions } from './workflow-draft';
import { useProcesses, workflowsResource } from './workflows-api';
import { WorkflowForm } from './WorkflowForm';

const MODULE_LABEL = new Map<string, string>(MODULES.map((m) => [m.key, m.label]));

/** The Approval Engine (spec 10 §3.1, BRD D.2.2.1): one engine; each module owns its chains. */
export default function ApprovalEnginePage() {
  const { t } = useTranslation();
  const catalogue = useProcesses();
  const processes = catalogue.data?.processes ?? [];
  const words = {
    yes: t('approvals.conditions.yes'),
    no: t('approvals.conditions.no'),
    fallback: t('approvals.conditions.fallback'),
  };
  return (
    <MasterPage
      resource={workflowsResource}
      title={t('approvals.title')}
      subtitle={t('approvals.subtitle')}
      noun={t('approvals.noun')}
      searchPlaceholder={t('approvals.search')}
      describe={(w) => w.name}
      form={WorkflowForm}
      defaultSort={{ field: 'name', dir: 'asc' }}
      kpis={<Banner tone="info">{t('approvals.banner')}</Banner>}
      columns={[
        {
          id: 'workflow',
          header: t('approvals.columns.workflow'),
          sortField: 'name',
          cell: (w) => (
            <div>
              <p className="font-medium text-ink">{w.name}</p>
              <p className="text-xs text-ink-secondary">{w.code}</p>
            </div>
          ),
        },
        {
          id: 'module',
          header: t('approvals.columns.module'),
          sortField: 'module',
          cell: (w) => MODULE_LABEL.get(w.module) ?? w.module,
        },
        {
          id: 'process',
          header: t('approvals.columns.process'),
          sortField: 'process',
          cell: (w) => w.processLabel,
        },
        {
          id: 'conditions',
          header: t('approvals.columns.conditions'),
          className: 'max-w-80',
          cell: (w) => (
            <span className="line-clamp-2 text-sm">
              {describeConditions(
                processes.find((p) => p.key === w.process),
                w.conditions,
                words,
              )}
            </span>
          ),
        },
        {
          id: 'stages',
          header: t('approvals.columns.stages'),
          align: 'right',
          cell: (w) => w.stages,
        },
        {
          id: 'version',
          header: t('approvals.columns.version'),
          align: 'right',
          cell: (w) => (w.activeVersionNo === null ? '—' : `v${w.activeVersionNo}`),
        },
      ]}
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
              label={t('approvals.filters.module')}
              allLabel={t('ui.filter.all')}
              value={module}
              options={MODULES.filter((m) => processes.some((p) => p.module === m.key)).map(
                (m) => ({ value: m.key, label: m.label }),
              )}
              onChange={(v) => set('module', v)}
            />
            <FilterSelect
              label={t('approvals.filters.process')}
              allLabel={t('ui.filter.all')}
              value={params.filters.process}
              options={processes
                .filter((p) => !module || p.module === module)
                .map((p) => ({ value: p.key, label: p.label }))}
              onChange={(v) => set('process', v)}
            />
          </>
        );
      }}
    />
  );
}
