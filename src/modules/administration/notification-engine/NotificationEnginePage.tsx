import { useTranslation } from 'react-i18next';
import { MODULES } from '../../../api/registry.generated';
import { Banner } from '../../../shared/ui/banner';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { describeConditions } from '../approval-engine/workflow-draft';
import { MasterPage } from '../masters/master-page';
import { DeliveryLog } from './DeliveryLog';
import { rulesResource, useTriggers } from './engine-api';
import { NotificationRuleForm } from './NotificationRuleForm';

const MODULE_LABEL = new Map<string, string>(MODULES.map((m) => [m.key, m.label]));
const CATEGORIES = [
  'security',
  'access',
  'approvals',
  'booking',
  'travel',
  'muster',
  'freight',
  'helideck',
  'compliance',
  'admin',
] as const;

/** The Notification Engine (spec 10 §3.3, BRD D.2.2.3): rules on events, and the delivery log. */
export default function NotificationEnginePage() {
  const { t } = useTranslation();
  const catalogue = useTriggers();
  const triggers = catalogue.data?.triggers ?? [];
  const filtersOf = (key: string) => {
    const trigger = triggers.find((tr) => tr.key === key);
    return trigger ? { conditionFields: trigger.filterFields } : undefined;
  };
  const words = {
    yes: t('approvals.conditions.yes'),
    no: t('approvals.conditions.no'),
    fallback: t('engine.everyEvent'),
  };
  return (
    <MasterPage
      resource={rulesResource}
      title={t('engine.title')}
      subtitle={t('engine.subtitle')}
      noun={t('engine.noun')}
      searchPlaceholder={t('engine.search')}
      describe={(r) => r.name}
      form={NotificationRuleForm}
      defaultSort={{ field: 'module', dir: 'asc' }}
      kpis={<Banner tone="info">{t('engine.banner')}</Banner>}
      tabs={{
        label: t('engine.tabs.rules'),
        others: [
          { value: 'deliveries', label: t('engine.tabs.deliveries'), content: <DeliveryLog /> },
        ],
      }}
      columns={[
        {
          id: 'rule',
          header: t('engine.columns.rule'),
          sortField: 'name',
          cell: (r) => (
            <div>
              <p className="font-medium text-ink">{r.name}</p>
              <p className="text-xs text-ink-secondary">
                {r.code}
                {r.mandatory ? ` · ${t('engine.mandatory')}` : ''}
              </p>
            </div>
          ),
        },
        {
          id: 'module',
          header: t('engine.columns.module'),
          sortField: 'module',
          cell: (r) => MODULE_LABEL.get(r.module) ?? r.module,
        },
        {
          id: 'trigger',
          header: t('engine.columns.trigger'),
          sortField: 'trigger',
          className: 'max-w-64',
          cell: (r) => (
            <div>
              <p className="text-sm text-ink">{r.triggerLabel}</p>
              {!r.live && (
                <p className="text-xs text-ink-secondary">
                  {t('engine.waitsShort', { phase: r.phase })}
                </p>
              )}
            </div>
          ),
        },
        {
          id: 'filter',
          header: t('engine.columns.filter'),
          className: 'max-w-64',
          cell: (r) => (
            <span className="line-clamp-2 text-sm">
              {describeConditions(filtersOf(r.trigger), r.filter, words)}
            </span>
          ),
        },
        {
          id: 'frequency',
          header: t('engine.columns.frequency'),
          cell: (r) =>
            r.frequency === 'recurring'
              ? t('engine.everyNDays', { count: r.everyDays ?? 1 })
              : t(`engine.frequency.${r.frequency}`),
        },
        {
          id: 'channels',
          header: t('engine.columns.channels'),
          cell: (r) => r.channels.map((c) => t(`engine.channel.${c}`)).join(', '),
        },
        {
          id: 'recipients',
          header: t('engine.columns.recipients'),
          className: 'max-w-64',
          cell: (r) => <span className="line-clamp-2 text-sm">{r.recipientsSummary}</span>,
        },
      ]}
      filters={({ params, update }) => {
        const set = (name: string, value: string | undefined) => {
          const rest = Object.fromEntries(
            Object.entries(params.filters).filter(([k]) => k !== name),
          );
          update({ filters: value ? { ...rest, [name]: value } : rest });
        };
        return (
          <>
            <FilterSelect
              label={t('engine.filters.module')}
              allLabel={t('ui.filter.all')}
              value={params.filters.module}
              options={MODULES.filter((m) => triggers.some((tr) => tr.module === m.key)).map(
                (m) => ({ value: m.key, label: m.label }),
              )}
              onChange={(v) => set('module', v)}
            />
            <FilterSelect
              label={t('engine.filters.category')}
              allLabel={t('ui.filter.all')}
              value={params.filters.category}
              options={CATEGORIES.map((c) => ({ value: c, label: t(`engine.category.${c}`) }))}
              onChange={(v) => set('category', v)}
            />
          </>
        );
      }}
    />
  );
}
