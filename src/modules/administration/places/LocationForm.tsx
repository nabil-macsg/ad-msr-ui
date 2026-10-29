import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import type { MasterFormProps } from '../masters/master-page';
import { coordinateText, readCoordinates } from './coordinates';
import { CoordinateFields } from './place-bits';
import { type Location, saveLocation, useLocationOptions } from './places-api';

const FLAGS = ['isHub', 'isResidencyReset', 'isComplex', 'hasAccommodation'] as const;
const FLAG_TEXT = {
  isHub: 'hub',
  isResidencyReset: 'residencyReset',
  isComplex: 'complex',
  hasAccommodation: 'accommodation',
} as const;

/** New or edited location (spec 10 §5.1); moving coordinates already set needs a reason. */
export function LocationForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Location>) {
  const { t } = useTranslation();
  const options = useLocationOptions();
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z
    .object({
      code: record
        ? z.string()
        : z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9-]{2,12}$/, t('places.locations.form.codeInvalid')),
      name: z.string().trim().min(1, t('places.locations.form.nameRequired')).max(200),
      locationTypeId: z.uuid(t('places.locations.form.typeRequired')),
      zoneId: z.uuid(t('places.locations.form.zoneRequired')),
      parentLocationId: z.string(),
      lat: z.string(),
      lng: z.string(),
      reason: z.string(),
      pobLimit: z
        .string()
        .trim()
        .regex(/^(\d+)?$/, t('places.locations.form.pobInvalid'))
        .refine((v) => v === '' || Number(v) > 0, t('places.locations.form.pobInvalid')),
      isHub: z.boolean(),
      isResidencyReset: z.boolean(),
      isComplex: z.boolean(),
      hasAccommodation: z.boolean(),
      focalPointName: z.string().max(200),
      focalPointEmail: z.union([z.literal(''), z.email(t('places.locations.form.emailInvalid'))]),
    })
    .superRefine((v, ctx) => {
      const coordinates = readCoordinates(v, record?.coordinates ?? null);
      if (coordinates === 'invalid')
        ctx.addIssue({ code: 'custom', path: ['lat'], message: t('places.coordinates.invalid') });
      else if (coordinates !== undefined && record?.coordinates && v.reason.trim().length < 3)
        ctx.addIssue({
          code: 'custom',
          path: ['reason'],
          message: t('places.coordinates.reasonRequired'),
        });
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      locationTypeId: record?.locationType.id ?? '',
      zoneId: record?.zone.id ?? '',
      parentLocationId: record?.parent?.id ?? '',
      ...coordinateText(record?.coordinates ?? null),
      reason: '',
      pobLimit: record?.pobLimit ? String(record.pobLimit) : '',
      isHub: record?.isHub ?? false,
      isResidencyReset: record?.isResidencyReset ?? false,
      isComplex: record?.isComplex ?? false,
      hasAccommodation: record?.hasAccommodation ?? false,
      focalPointName: record?.focalPointName ?? '',
      focalPointEmail: record?.focalPointEmail ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [lat, lng] = useWatch({ control: form.control, name: ['lat', 'lng'] });
  const moving =
    record?.coordinates !== null &&
    record?.coordinates !== undefined &&
    readCoordinates({ lat, lng }, record.coordinates) !== undefined;

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const coordinates = readCoordinates(v, record?.coordinates ?? null);
    const values = {
      name: v.name,
      locationTypeId: v.locationTypeId,
      zoneId: v.zoneId,
      parentLocationId: v.parentLocationId || null,
      pobLimit: v.pobLimit ? Number(v.pobLimit) : null,
      isHub: v.isHub,
      isResidencyReset: v.isResidencyReset,
      isComplex: v.isComplex,
      hasAccommodation: v.hasAccommodation,
      focalPointName: v.focalPointName.trim() || null,
      focalPointEmail: v.focalPointEmail || null,
    };
    const point = coordinates === 'invalid' ? undefined : coordinates;
    try {
      await saveLocation(
        record,
        { ...values, code: v.code, ...(point ? { coordinates: point } : {}) },
        {
          ...values,
          ...(point === undefined ? {} : { coordinates: point }),
          ...(point !== undefined && v.reason.trim() ? { reason: v.reason.trim() } : {}),
        },
      );
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  });

  const parents = (options.data?.locations ?? []).filter((l) => l.id !== record?.id);
  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record
          ? t('places.locations.form.editTitle', { name: record.name })
          : t('places.locations.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('places.locations.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <Field
          label={t('places.locations.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <SelectField
          label={t('places.locations.form.type')}
          error={errors.locationTypeId?.message}
          {...form.register('locationTypeId')}
        >
          <option value="">{t('places.locations.form.chooseType')}</option>
          {(options.data?.locationTypes ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('places.locations.form.zone')}
          error={errors.zoneId?.message}
          {...form.register('zoneId')}
        >
          <option value="">{t('places.locations.form.chooseZone')}</option>
          {(options.data?.zones ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('places.locations.form.parent')}
          {...form.register('parentLocationId')}
        >
          <option value="">{t('places.locations.form.noParent')}</option>
          {parents.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.code})
            </option>
          ))}
        </SelectField>
        <Field
          label={t('places.locations.form.pobLimit')}
          inputMode="numeric"
          error={errors.pobLimit?.message}
          {...form.register('pobLimit')}
        />
        <CoordinateFields
          lat={form.register('lat')}
          lng={form.register('lng')}
          error={errors.lat?.message}
          reason={
            moving ? { ...form.register('reason'), error: errors.reason?.message } : undefined
          }
        />
        <Field label={t('places.locations.form.focalPoint')} {...form.register('focalPointName')} />
        <Field
          label={t('places.locations.form.focalPointEmail')}
          type="email"
          error={errors.focalPointEmail?.message}
          {...form.register('focalPointEmail')}
        />
        <div className="space-y-1 md:col-span-2">
          {FLAGS.map((flag) => (
            <label key={flag} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="size-4 accent-primary" {...form.register(flag)} />
              {t(`places.locations.form.${FLAG_TEXT[flag]}`)}
            </label>
          ))}
        </div>
      </div>
    </EntityFormModal>
  );
}
