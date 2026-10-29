import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner } from '../../../shared/ui/banner';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { StatusPill } from '../../../shared/ui/status-pill';
import { decimalText, toNullable, toNumber, toText } from '../masters/form-values';
import { masterResource, saveMaster, useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import {
  type AircraftModel,
  type AircraftModelOptions,
  categoryOptions,
  categoryText,
} from './resources-api';

const resource = masterResource<AircraftModel>('aircraft-models', 'admin.aircraft-models');
type Pending = AircraftModel['unconfirmedFields'][number];

/** Required D or T: the value, or "not recorded", flagged while pending confirmation (P-20). */
function Required({ model, field }: { model: AircraftModel; field: Pending }) {
  const { t } = useTranslation();
  const value = field === 'requiredDM' ? model.requiredDM : model.requiredTT;
  if (value === null)
    return <StatusPill tone="neutral">{t('resources.models.notRecorded')}</StatusPill>;
  return (
    <div className="space-y-1">
      <p>
        {field === 'requiredDM'
          ? t('resources.models.d', { d: value })
          : t('resources.models.t', { t: value })}
      </p>
      {model.unconfirmedFields.includes(field) && (
        <StatusPill tone="warning">{t('resources.models.pending')}</StatusPill>
      )}
    </div>
  );
}

/**
 * Aircraft models (spec 10 §5.2): the helideck D and T each model needs. Values pending
 * Aviation Technical confirmation are flagged (P-20); every change carries a reason.
 */
export default function AircraftModelsPage() {
  const { t } = useTranslation();
  const options = useMasterOptions<AircraftModelOptions>('aircraft-models');
  return (
    <MasterPage
      resource={resource}
      title={t('resources.models.title')}
      subtitle={t('resources.models.subtitle')}
      noun={t('resources.models.noun')}
      searchPlaceholder={t('resources.types.search')}
      describe={(m) => `${m.code} · ${m.name}`}
      form={AircraftModelForm}
      defaultSort={{ field: 'name', dir: 'asc' }}
      columns={[
        {
          id: 'code',
          header: t('resources.models.columns.code'),
          sortField: 'code',
          cell: (m) => <span className="font-mono text-sm">{m.code}</span>,
        },
        {
          id: 'name',
          header: t('resources.models.columns.name'),
          sortField: 'name',
          cell: (m) => m.name,
        },
        {
          id: 'category',
          header: t('resources.models.columns.category'),
          cell: (m) => categoryText(t, m.category, options.data?.categories),
        },
        {
          id: 'd',
          header: t('resources.models.columns.d'),
          cell: (m) => <Required model={m} field="requiredDM" />,
        },
        {
          id: 't',
          header: t('resources.models.columns.t'),
          cell: (m) => <Required model={m} field="requiredTT" />,
        },
        {
          id: 'performance',
          header: t('resources.models.columns.performance'),
          cell: (m) => m.performanceClass ?? '—',
        },
        { id: 'unit', header: t('resources.models.columns.unit'), cell: (m) => m.weightUnit },
        {
          id: 'types',
          header: t('resources.models.columns.types'),
          align: 'right',
          cell: (m) => m.resourceTypes,
        },
      ]}
    />
  );
}

function AircraftModelForm({
  open,
  onOpenChange,
  record,
  onSaved,
}: MasterFormProps<AircraftModel>) {
  const { t } = useTranslation();
  const options = useMasterOptions<AircraftModelOptions>('aircraft-models');
  const [failure, setFailure] = useState<string | null>(null);
  const decimal = decimalText(t('resources.models.form.decimalInvalid'), 0, true);
  const schema = z.object({
    code: record
      ? z.string()
      : z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9-]{2,20}$/, t('resources.models.form.codeInvalid', { max: 20 })),
    name: z.string().trim().min(1, t('resources.models.form.nameRequired')).max(100),
    category: z.string().min(1, t('resources.fields.required')),
    requiredDM: decimal,
    requiredTT: decimal,
    performanceClass: z.string().max(20),
    weightUnit: z.enum(['kg', 'lb']),
    confirmed: z.array(z.string()),
    reason: record
      ? z.string().trim().min(3, t('resources.models.form.reasonRequired'))
      : z.string(),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      category: record?.category ?? '',
      requiredDM: toText(record?.requiredDM),
      requiredTT: toText(record?.requiredTT),
      performanceClass: record?.performanceClass ?? '',
      weightUnit: record?.weightUnit ?? 'lb',
      confirmed: [],
      reason: '',
    },
  });
  const { errors, isSubmitting, dirtyFields } = form.formState;
  const pending = record?.unconfirmedFields ?? [];

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const values = {
      name: v.name,
      category: v.category,
      performanceClass: toNullable(v.performanceClass),
      weightUnit: v.weightUnit,
    };
    try {
      if (record) {
        // Only what changed, so an untouched pending value stays pending.
        await saveMaster('aircraft-models', record, {
          ...values,
          ...(dirtyFields.requiredDM ? { requiredDM: toNumber(v.requiredDM) } : {}),
          ...(dirtyFields.requiredTT ? { requiredTT: toNumber(v.requiredTT) } : {}),
          ...(v.confirmed.length > 0 ? { confirmed: v.confirmed } : {}),
          reason: v.reason.trim(),
        });
      } else {
        await saveMaster('aircraft-models', null, {
          ...values,
          code: v.code,
          requiredDM: toNumber(v.requiredDM),
          requiredTT: toNumber(v.requiredTT),
        });
      }
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
          ? t('resources.models.form.editTitle', { name: record.name })
          : t('resources.models.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      {pending.length > 0 && <Banner tone="warning">{t('resources.models.pending')}</Banner>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('resources.models.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <Field
          label={t('resources.models.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <SelectField
          label={t('resources.models.form.category')}
          error={errors.category?.message}
          {...form.register('category')}
        >
          <option value="">{t('resources.models.form.chooseOne')}</option>
          {categoryOptions(t, options.data?.categories, record && { code: record.category }).map(
            (c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ),
          )}
        </SelectField>
        <SelectField label={t('resources.models.form.unit')} {...form.register('weightUnit')}>
          <option value="lb">{t('resources.choices.lb')}</option>
          <option value="kg">{t('resources.choices.kg')}</option>
        </SelectField>
        <Field
          label={t('resources.models.form.d')}
          inputMode="decimal"
          error={errors.requiredDM?.message}
          {...form.register('requiredDM')}
        />
        <Field
          label={t('resources.models.form.t')}
          inputMode="decimal"
          error={errors.requiredTT?.message}
          {...form.register('requiredTT')}
        />
        <Field
          label={t('resources.models.form.performance')}
          {...form.register('performanceClass')}
        />
      </div>
      {pending.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-ink">
            {t('resources.models.form.confirm')}
          </legend>
          <p className="text-xs text-ink-secondary">{t('resources.models.form.confirmHint')}</p>
          {pending.map((field) => (
            <label key={field} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                value={field}
                className="size-4 accent-primary"
                {...form.register('confirmed')}
              />
              {t(`resources.models.fields.${field}`)}
            </label>
          ))}
        </fieldset>
      )}
      {record && (
        <div className="space-y-1">
          <Field
            label={t('resources.models.form.reason')}
            error={errors.reason?.message}
            {...form.register('reason')}
          />
          <p className="text-xs text-ink-secondary">{t('resources.models.form.reasonHint')}</p>
        </div>
      )}
    </EntityFormModal>
  );
}
