import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { setFilter } from '../masters/filters';
import { masterResource, saveMaster, useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import type { ChargeCode, ChargeCodeOptions } from './orgs-api';

const resource = masterResource<ChargeCode>('charge-codes', 'admin.charge-codes');
const RECOVERABILITY = ['recoverable', 'non-recoverable'] as const;

/**
 * Charge codes (spec 10 §5.1, BRD D.3.1.11): what travel is charged to, at every site or some,
 * recoverable or not, with validity dates and an owning department.
 */
export default function ChargeCodesPage() {
  const { t } = useTranslation();
  const options = useMasterOptions<ChargeCodeOptions>('charge-codes');
  const validity = (c: ChargeCode) => {
    if (c.validFrom && c.validTo)
      return t('orgs.chargeCodes.fromTo', { from: c.validFrom, to: c.validTo });
    if (c.validFrom) return t('orgs.chargeCodes.from', { from: c.validFrom });
    if (c.validTo) return t('orgs.chargeCodes.until', { to: c.validTo });
    return t('orgs.chargeCodes.always');
  };
  return (
    <MasterPage
      resource={resource}
      title={t('orgs.chargeCodes.title')}
      subtitle={t('orgs.chargeCodes.subtitle')}
      noun={t('orgs.chargeCodes.noun')}
      searchPlaceholder={t('orgs.chargeCodes.search')}
      describe={(c) => `${c.code} · ${c.description}`}
      form={ChargeCodeForm}
      defaultSort={{ field: 'code', dir: 'asc' }}
      columns={[
        {
          id: 'code',
          header: t('orgs.chargeCodes.columns.code'),
          sortField: 'code',
          cell: (c) => <span className="font-mono text-sm">{c.code}</span>,
        },
        {
          id: 'description',
          header: t('orgs.chargeCodes.columns.description'),
          sortField: 'description',
          cell: (c) => c.description,
        },
        {
          id: 'sites',
          header: t('orgs.chargeCodes.columns.sites'),
          cell: (c) =>
            c.allSites ? (
              t('orgs.chargeCodes.allSites')
            ) : (
              <span title={c.sites.map((s) => s.name).join(', ')}>
                {c.sites.length <= 2
                  ? c.sites.map((s) => s.name).join(', ')
                  : t('orgs.chargeCodes.sitesCount', { n: c.sites.length })}
              </span>
            ),
        },
        {
          id: 'recoverability',
          header: t('orgs.chargeCodes.columns.recoverability'),
          cell: (c) => (
            <StatusPill tone={c.recoverability === 'recoverable' ? 'success' : 'neutral'}>
              {t(`orgs.chargeCodes.recoverability.${c.recoverability}`)}
            </StatusPill>
          ),
        },
        { id: 'validity', header: t('orgs.chargeCodes.columns.validity'), cell: validity },
        {
          id: 'department',
          header: t('orgs.chargeCodes.columns.department'),
          cell: (c) => c.owningDepartment?.name ?? '—',
        },
      ]}
      filters={(list) => (
        <>
          <FilterSelect
            label={t('orgs.chargeCodes.filters.recoverability')}
            allLabel={t('ui.filter.all')}
            value={list.params.filters.recoverability}
            options={RECOVERABILITY.map((r) => ({
              value: r,
              label: t(`orgs.chargeCodes.recoverability.${r}`),
            }))}
            onChange={(v) => setFilter(list, 'recoverability', v)}
          />
          <FilterSelect
            label={t('orgs.chargeCodes.filters.site')}
            allLabel={t('ui.filter.all')}
            value={list.params.filters.site}
            options={(options.data?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))}
            onChange={(v) => setFilter(list, 'site', v)}
          />
          <FilterSelect
            label={t('orgs.chargeCodes.filters.department')}
            allLabel={t('ui.filter.all')}
            value={list.params.filters.department}
            options={(options.data?.departments ?? []).map((d) => ({
              value: d.id,
              label: d.name,
            }))}
            onChange={(v) => setFilter(list, 'department', v)}
          />
        </>
      )}
    />
  );
}

function ChargeCodeForm({ open, onOpenChange, record, onSaved }: MasterFormProps<ChargeCode>) {
  const { t } = useTranslation();
  const options = useMasterOptions<ChargeCodeOptions>('charge-codes');
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z
    .object({
      code: record
        ? z.string()
        : z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9-]{1,20}$/, t('orgs.chargeCodes.form.codeInvalid')),
      description: z
        .string()
        .trim()
        .min(1, t('orgs.chargeCodes.form.descriptionRequired'))
        .max(200),
      allSites: z.boolean(),
      siteIds: z.array(z.string()),
      recoverability: z.enum(RECOVERABILITY),
      validFrom: z.string(),
      validTo: z.string(),
      owningDepartmentId: z.string(),
    })
    .refine((v) => v.allSites || v.siteIds.length > 0, {
      message: t('orgs.chargeCodes.form.sitesRequired'),
      path: ['siteIds'],
    })
    .refine((v) => !v.validFrom || !v.validTo || v.validFrom <= v.validTo, {
      message: t('orgs.chargeCodes.form.validityInvalid'),
      path: ['validTo'],
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      description: record?.description ?? '',
      allSites: record?.allSites ?? true,
      siteIds: record?.sites.map((s) => s.id) ?? [],
      recoverability: record?.recoverability ?? 'non-recoverable',
      validFrom: record?.validFrom ?? '',
      validTo: record?.validTo ?? '',
      owningDepartmentId: record?.owningDepartment?.id ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const allSites = useWatch({ control: form.control, name: 'allSites' });

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const body = {
      description: v.description,
      siteIds: v.allSites ? [] : v.siteIds,
      recoverability: v.recoverability,
      validFrom: v.validFrom || null,
      validTo: v.validTo || null,
      owningDepartmentId: v.owningDepartmentId || null,
    };
    try {
      await saveMaster('charge-codes', record, record ? body : { ...body, code: v.code });
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
          ? t('orgs.chargeCodes.form.editTitle', { code: record.code })
          : t('orgs.chargeCodes.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('orgs.chargeCodes.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <Field
          label={t('orgs.chargeCodes.form.description')}
          error={errors.description?.message}
          {...form.register('description')}
        />
        <SelectField
          label={t('orgs.chargeCodes.form.recoverability')}
          {...form.register('recoverability')}
        >
          {RECOVERABILITY.map((r) => (
            <option key={r} value={r}>
              {t(`orgs.chargeCodes.recoverability.${r}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('orgs.chargeCodes.form.department')}
          {...form.register('owningDepartmentId')}
        >
          <option value="">{t('orgs.chargeCodes.form.noDepartment')}</option>
          {(options.data?.departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <Field
          type="date"
          label={t('orgs.chargeCodes.form.validFrom')}
          {...form.register('validFrom')}
        />
        <Field
          type="date"
          label={t('orgs.chargeCodes.form.validTo')}
          error={errors.validTo?.message}
          {...form.register('validTo')}
        />
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        <input type="checkbox" className="size-4 accent-primary" {...form.register('allSites')} />
        {t('orgs.chargeCodes.form.allSites')}
      </label>
      {!allSites && (
        <div>
          <Controller
            control={form.control}
            name="siteIds"
            render={({ field }) => (
              <CheckboxList
                legend={t('orgs.chargeCodes.form.sites')}
                options={(options.data?.locations ?? []).map((l) => ({
                  value: l.id,
                  label: l.name,
                }))}
                selected={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {errors.siteIds?.message && (
            <p className="mt-1 text-sm text-danger-fg">{errors.siteIds.message}</p>
          )}
        </div>
      )}
    </EntityFormModal>
  );
}
