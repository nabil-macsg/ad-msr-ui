import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { setFilter } from '../masters/filters';
import { decimalText, toNumber, toText, wholeText } from '../masters/form-values';
import { masterResource, saveMaster, useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import {
  categoryChoices,
  categoryOptions,
  type ResourceType,
  type ResourceTypeOptions,
  seatMapText,
} from './resources-api';

const resource = masterResource<ResourceType>('resource-types', 'admin.resource-types');

/**
 * Resource types (spec 10 §5.1, BRD D.3.1.8): capacity, seat-map template, baggage and payload.
 * Open seating is for marine types; a loadsheet for fixed and rotary wing, by the category's
 * base mode.
 */
export default function ResourceTypesPage() {
  const { t } = useTranslation();
  const options = useMasterOptions<ResourceTypeOptions>('resource-types');
  return (
    <MasterPage
      resource={resource}
      title={t('resources.types.title')}
      subtitle={t('resources.types.subtitle')}
      noun={t('resources.types.noun')}
      searchPlaceholder={t('resources.types.search')}
      describe={(r) => `${r.code} · ${r.name}`}
      form={ResourceTypeForm}
      defaultSort={{ field: 'category', dir: 'asc' }}
      columns={[
        {
          id: 'code',
          header: t('resources.types.columns.code'),
          sortField: 'code',
          cell: (r) => <span className="font-mono text-sm">{r.code}</span>,
        },
        {
          id: 'name',
          header: t('resources.types.columns.name'),
          sortField: 'name',
          cell: (r) => (
            <div className="space-y-1">
              <p className="font-medium text-ink">{r.name}</p>
              {r.aircraftModel && (
                <p className="text-xs text-ink-secondary">{r.aircraftModel.name}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {r.openSeating && (
                  <StatusPill tone="info">{t('resources.types.openSeating')}</StatusPill>
                )}
                {r.loadsheetRequired && (
                  <StatusPill tone="neutral">{t('resources.types.loadsheet')}</StatusPill>
                )}
              </div>
            </div>
          ),
        },
        {
          id: 'category',
          header: t('resources.types.columns.category'),
          sortField: 'category',
          cell: (r) => r.category.name,
        },
        {
          id: 'capacity',
          header: t('resources.types.columns.capacity'),
          cell: (r) => (
            <div>
              <p>{r.passengerCapacity ?? '—'}</p>
              {r.seatMap && (
                <p className="text-xs text-ink-secondary">{seatMapText(t, r.seatMap)}</p>
              )}
            </div>
          ),
        },
        {
          id: 'payload',
          header: t('resources.types.columns.payload'),
          align: 'right',
          cell: (r) => (r.payloadKg === null ? '—' : t('resources.types.kg', { kg: r.payloadKg })),
        },
        {
          id: 'fleet',
          header: t('resources.types.columns.fleet'),
          align: 'right',
          cell: (r) => r.fleet,
        },
      ]}
      filters={(list) => (
        <FilterSelect
          label={t('resources.types.filters.category')}
          allLabel={t('ui.filter.all')}
          value={list.params.filters.category}
          options={categoryChoices(options.data?.categories)}
          onChange={(v) => setFilter(list, 'category', v)}
        />
      )}
    />
  );
}

function ResourceTypeForm({ open, onOpenChange, record, onSaved }: MasterFormProps<ResourceType>) {
  const { t } = useTranslation();
  const options = useMasterOptions<ResourceTypeOptions>('resource-types');
  const [failure, setFailure] = useState<string | null>(null);
  const whole = wholeText(t('resources.types.form.numberInvalid'));
  const schema = z
    .object({
      code: record
        ? z.string()
        : z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9-]{2,20}$/, t('resources.types.form.codeInvalid', { max: 20 })),
      name: z.string().trim().min(1, t('resources.types.form.nameRequired')).max(100),
      category: z.string().min(1, t('resources.fields.required')),
      aircraftModelId: z.string(),
      passengerCapacity: whole,
      rows: wholeText(t('resources.types.form.numberInvalid'), 1),
      seatsPerRow: wholeText(t('resources.types.form.numberInvalid'), 1),
      aisleAfter: whole,
      baggageAllowanceKg: decimalText(t('resources.types.form.numberInvalid')),
      payloadKg: decimalText(t('resources.types.form.numberInvalid')),
      openSeating: z.boolean(),
      loadsheetRequired: z.boolean(),
    })
    .refine((v) => (v.rows === '') === (v.seatsPerRow === ''), {
      message: t('resources.types.form.seatMapHint'),
      path: ['seatsPerRow'],
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      category: record?.category.code ?? '',
      aircraftModelId: record?.aircraftModel?.id ?? '',
      passengerCapacity: toText(record?.passengerCapacity),
      rows: toText(record?.seatMap?.rows),
      seatsPerRow: toText(record?.seatMap?.seatsPerRow),
      aisleAfter: toText(record?.seatMap?.aisleAfter),
      baggageAllowanceKg: toText(record?.baggageAllowanceKg),
      payloadKg: toText(record?.payloadKg),
      openSeating: record?.openSeating ?? false,
      loadsheetRequired: record?.loadsheetRequired ?? false,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [category, openSeating] = useWatch({
    control: form.control,
    name: ['category', 'openSeating'],
  });
  const categories = options.data?.categories;
  const marine = categories?.find((c) => c.code === category)?.baseMode === 'marine';
  const models = (options.data?.aircraftModels ?? []).filter((m) => m.category === category);

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const rows = toNumber(v.rows);
    const seatsPerRow = toNumber(v.seatsPerRow);
    const body = {
      name: v.name,
      category: v.category,
      aircraftModelId: marine ? null : v.aircraftModelId || null,
      passengerCapacity: toNumber(v.passengerCapacity),
      seatMap:
        rows !== null && seatsPerRow !== null && !(marine && v.openSeating)
          ? { rows, seatsPerRow, aisleAfter: toNumber(v.aisleAfter) }
          : null,
      baggageAllowanceKg: toNumber(v.baggageAllowanceKg),
      payloadKg: toNumber(v.payloadKg),
      openSeating: marine && v.openSeating,
      loadsheetRequired: !marine && v.loadsheetRequired,
    };
    try {
      await saveMaster('resource-types', record, record ? body : { ...body, code: v.code });
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
          ? t('resources.types.form.editTitle', { name: record.name })
          : t('resources.types.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('resources.types.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <Field
          label={t('resources.types.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <SelectField
          label={t('resources.types.form.category')}
          error={errors.category?.message}
          {...form.register('category')}
        >
          <option value="">{t('resources.types.form.chooseOne')}</option>
          {categoryOptions(t, categories, record?.category).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </SelectField>
        {!marine && (
          <SelectField
            label={t('resources.types.form.aircraftModel')}
            {...form.register('aircraftModelId')}
          >
            <option value="">{t('resources.types.form.none')}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
        )}
        <Field
          label={t('resources.types.form.capacity')}
          inputMode="numeric"
          error={errors.passengerCapacity?.message}
          {...form.register('passengerCapacity')}
        />
        <Field
          label={t('resources.types.form.payload')}
          inputMode="decimal"
          error={errors.payloadKg?.message}
          {...form.register('payloadKg')}
        />
        <Field
          label={t('resources.types.form.baggage')}
          inputMode="decimal"
          error={errors.baggageAllowanceKg?.message}
          {...form.register('baggageAllowanceKg')}
        />
      </div>
      {!(marine && openSeating) && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">
            {t('resources.types.form.seatMap')}
          </legend>
          <p className="text-xs text-ink-secondary">{t('resources.types.form.seatMapHint')}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field
              label={t('resources.types.form.rows')}
              inputMode="numeric"
              error={errors.rows?.message}
              {...form.register('rows')}
            />
            <Field
              label={t('resources.types.form.seatsPerRow')}
              inputMode="numeric"
              error={errors.seatsPerRow?.message}
              {...form.register('seatsPerRow')}
            />
            <Field
              label={t('resources.types.form.aisleAfter')}
              inputMode="numeric"
              error={errors.aisleAfter?.message}
              {...form.register('aisleAfter')}
            />
          </div>
        </fieldset>
      )}
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        {marine ? (
          <>
            <input
              type="checkbox"
              className="size-4 accent-primary"
              {...form.register('openSeating')}
            />
            {t('resources.types.form.openSeating')}
          </>
        ) : (
          <>
            <input
              type="checkbox"
              className="size-4 accent-primary"
              {...form.register('loadsheetRequired')}
            />
            {t('resources.types.form.loadsheet')}
          </>
        )}
      </label>
    </EntityFormModal>
  );
}
