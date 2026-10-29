import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner } from '../../../shared/ui/banner';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { setFilter } from '../masters/filters';
import { masterResource, saveMaster, useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import type { Quota, QuotaOptions } from './resources-api';

const resource = masterResource<Quota>('quotas', 'admin.quotas');
const DIMENSIONS = [
  'department',
  'location',
  'zone',
  'service-provider',
  'passenger-category',
] as const;
const SCOPES = ['resource-type', 'route'] as const;
const PERIODS = ['flight', 'day', 'week', 'month'] as const;

/**
 * Quotas (spec 10 §5.2, BRD D.3.2.2): seats held for one department, location, zone, provider
 * or passenger category on a resource type or route. Fixed wing only (SCH-R4).
 */
export default function QuotasPage() {
  const { t } = useTranslation();
  return (
    <MasterPage
      resource={resource}
      title={t('resources.quotas.title')}
      subtitle={t('resources.quotas.subtitle')}
      noun={t('resources.quotas.noun')}
      searchPlaceholder={t('resources.quotas.search')}
      describe={(q) => q.code}
      form={QuotaForm}
      defaultSort={{ field: 'code', dir: 'asc' }}
      notice={<Banner tone="info">{t('resources.quotas.notice')}</Banner>}
      columns={[
        {
          id: 'code',
          header: t('resources.quotas.columns.code'),
          sortField: 'code',
          cell: (q) => <span className="font-mono text-sm">{q.code}</span>,
        },
        {
          id: 'appliesTo',
          header: t('resources.quotas.columns.appliesTo'),
          cell: (q) => (
            <div>
              <p>{q.appliesTo.record.name}</p>
              <p className="text-xs text-ink-secondary">
                {t(`resources.quotas.dimension.${q.appliesTo.dimension}`)}
              </p>
            </div>
          ),
        },
        {
          id: 'scope',
          header: t('resources.quotas.columns.scope'),
          cell: (q) => (
            <div>
              <p>{q.scope.record.name}</p>
              <p className="text-xs text-ink-secondary">
                {t(`resources.quotas.scope.${q.scope.kind}`)}
              </p>
            </div>
          ),
        },
        {
          id: 'period',
          header: t('resources.quotas.columns.period'),
          cell: (q) => t(`resources.quotas.period.${q.period}`),
        },
        {
          id: 'limit',
          header: t('resources.quotas.columns.limit'),
          sortField: 'seatLimit',
          cell: (q) => t('resources.quotas.limit', { n: q.seatLimit, pct: q.warningPct }),
        },
        {
          id: 'validity',
          header: t('resources.quotas.columns.validity'),
          sortField: 'validFrom',
          cell: (q) =>
            q.validTo
              ? t('resources.quotas.fromTo', { from: q.validFrom, to: q.validTo })
              : t('resources.quotas.from', { from: q.validFrom }),
        },
      ]}
      filters={(list) => (
        <>
          <FilterSelect
            label={t('resources.quotas.filters.dimension')}
            allLabel={t('ui.filter.all')}
            value={list.params.filters.dimension}
            options={DIMENSIONS.map((d) => ({
              value: d,
              label: t(`resources.quotas.dimension.${d}`),
            }))}
            onChange={(v) => setFilter(list, 'dimension', v)}
          />
          <FilterSelect
            label={t('resources.quotas.filters.scope')}
            allLabel={t('ui.filter.all')}
            value={list.params.filters.scopeKind}
            options={SCOPES.map((s) => ({ value: s, label: t(`resources.quotas.scope.${s}`) }))}
            onChange={(v) => setFilter(list, 'scopeKind', v)}
          />
          <FilterSelect
            label={t('resources.quotas.filters.period')}
            allLabel={t('ui.filter.all')}
            value={list.params.filters.period}
            options={PERIODS.map((p) => ({ value: p, label: t(`resources.quotas.period.${p}`) }))}
            onChange={(v) => setFilter(list, 'period', v)}
          />
        </>
      )}
    />
  );
}

function QuotaForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Quota>) {
  const { t } = useTranslation();
  const options = useMasterOptions<QuotaOptions>('quotas');
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z
    .object({
      code: record
        ? z.string()
        : z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9-]{2,30}$/, t('resources.quotas.form.codeInvalid', { max: 30 })),
      appliesTo: z.enum(DIMENSIONS),
      appliesToId: z.string().min(1, t('resources.quotas.form.chooseValue')),
      scopeKind: z.enum(SCOPES),
      scopeId: z.string().min(1, t('resources.quotas.form.chooseValue')),
      period: z.enum(PERIODS),
      seatLimit: z.string().trim().regex(/^\d+$/, t('resources.quotas.form.numberInvalid')),
      warningPct: z
        .string()
        .trim()
        .refine(
          (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100,
          t('resources.quotas.form.pctInvalid'),
        ),
      validFrom: z.string().min(1, t('resources.quotas.form.validFromRequired')),
      validTo: z.string(),
    })
    .refine((v) => !v.validTo || v.validFrom <= v.validTo, {
      message: t('orgs.chargeCodes.form.validityInvalid'),
      path: ['validTo'],
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      appliesTo: record?.appliesTo.dimension ?? 'passenger-category',
      appliesToId: record?.appliesTo.record.id ?? '',
      scopeKind: record?.scope.kind ?? 'resource-type',
      scopeId: record?.scope.record.id ?? '',
      period: record?.period ?? 'flight',
      seatLimit: record ? String(record.seatLimit) : '',
      warningPct: String(record?.warningPct ?? 80),
      validFrom: record?.validFrom ?? '',
      validTo: record?.validTo ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [appliesTo, scopeKind] = useWatch({
    control: form.control,
    name: ['appliesTo', 'scopeKind'],
  });

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const body = {
      appliesTo: v.appliesTo,
      appliesToId: v.appliesToId,
      scopeKind: v.scopeKind,
      scopeId: v.scopeId,
      period: v.period,
      seatLimit: Number(v.seatLimit),
      warningPct: Number(v.warningPct),
      validFrom: v.validFrom,
      validTo: v.validTo || null,
    };
    try {
      await saveMaster('quotas', record, record ? body : { ...body, code: v.code });
      onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : t('ui.confirm.failed'));
    }
  });

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record
          ? t('resources.quotas.form.editTitle', { name: record.code })
          : t('resources.quotas.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <Banner tone="info">{t('resources.quotas.notice')}</Banner>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('resources.quotas.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <SelectField label={t('resources.quotas.form.period')} {...form.register('period')}>
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {t(`resources.quotas.period.${p}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('resources.quotas.form.dimension')}
          {...form.register('appliesTo', {
            onChange: () => form.setValue('appliesToId', ''),
          })}
        >
          {DIMENSIONS.map((d) => (
            <option key={d} value={d}>
              {t(`resources.quotas.dimension.${d}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('resources.quotas.form.value')}
          error={errors.appliesToId?.message}
          {...form.register('appliesToId')}
        >
          <option value="">{t('resources.quotas.form.chooseValue')}</option>
          {(options.data?.[appliesTo] ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('resources.quotas.form.scopeKind')}
          {...form.register('scopeKind', { onChange: () => form.setValue('scopeId', '') })}
        >
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {t(`resources.quotas.scope.${s}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('resources.quotas.form.scope')}
          error={errors.scopeId?.message}
          {...form.register('scopeId')}
        >
          <option value="">{t('resources.quotas.form.chooseValue')}</option>
          {(options.data?.[scopeKind] ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
        <Field
          label={t('resources.quotas.form.limit')}
          inputMode="numeric"
          error={errors.seatLimit?.message}
          {...form.register('seatLimit')}
        />
        <Field
          label={t('resources.quotas.form.warning')}
          inputMode="numeric"
          error={errors.warningPct?.message}
          {...form.register('warningPct')}
        />
        <Field
          type="date"
          label={t('resources.quotas.form.validFrom')}
          error={errors.validFrom?.message}
          {...form.register('validFrom')}
        />
        <Field
          type="date"
          label={t('resources.quotas.form.validTo')}
          error={errors.validTo?.message}
          {...form.register('validTo')}
        />
      </div>
    </EntityFormModal>
  );
}
