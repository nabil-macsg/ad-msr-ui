import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner } from '../../../shared/ui/banner';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import type { MasterFormProps } from '../masters/master-page';
import { coordinateText, readCoordinates } from './coordinates';
import { CoordinateFields } from './place-bits';
import {
  type Installation,
  type InstallationInput,
  saveInstallation,
  type UnconfirmedField,
  useInstallationOptions,
} from './places-api';

const TEXT_FIELDS = [
  'callsign',
  'material',
  'gcaaClassOfUse',
  'deckClass',
  'minPerformanceClass',
  'radioFrequency',
  'ndb',
  'heading',
  'firefighting',
  'operator',
] as const;
const NUMBER_FIELDS = ['dValue', 'tValue', 'elevationM', 'deckHeightFt'] as const;
const FLAG_FIELDS = ['statusLights', 'fuelAvailable', 'gpuAvailable'] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type NumberField = (typeof NUMBER_FIELDS)[number];
type FlagField = (typeof FLAG_FIELDS)[number];

const LABELS = {
  callsign: 'callsign',
  material: 'material',
  gcaaClassOfUse: 'classOfUse',
  deckClass: 'deckClass',
  minPerformanceClass: 'minPerformanceClass',
  radioFrequency: 'radioFrequency',
  ndb: 'ndb',
  heading: 'heading',
  firefighting: 'firefighting',
  operator: 'operator',
  dValue: 'dValue',
  tValue: 'tValue',
  elevationM: 'elevation',
  deckHeightFt: 'deckHeight',
  statusLights: 'statusLights',
  fuelAvailable: 'fuel',
  gpuAvailable: 'gpu',
} as const satisfies Record<TextField | NumberField | FlagField, string>;
const label = (field: keyof typeof LABELS) => `places.installations.form.${LABELS[field]}` as const;

const toText = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);
const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));
const toNullable = (value: string) => value.trim() || null;

/**
 * New or edited installation (spec 10 §5.1): every technical value, with each change's reason.
 * Placeholder values awaiting Aviation Technical confirmation (P-53) can be confirmed as they are.
 */
export function InstallationForm({
  open,
  onOpenChange,
  record,
  onSaved,
}: MasterFormProps<Installation>) {
  const { t, i18n } = useTranslation();
  const options = useInstallationOptions();
  const [failure, setFailure] = useState<string | null>(null);
  const numeric = z
    .string()
    .trim()
    .refine(
      (v) => v === '' || Number.isFinite(Number(v)),
      t('places.installations.form.numberInvalid'),
    );
  const schema = z
    .object({
      code: record
        ? z.string()
        : z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9-]{2,16}$/, t('places.installations.form.codeInvalid')),
      name: z.string().trim().min(1, t('places.installations.form.nameRequired')).max(200),
      installationTypeId: z.uuid(t('places.installations.form.typeRequired')),
      locationId: z.uuid(t('places.installations.form.locationRequired')),
      ...(Object.fromEntries(TEXT_FIELDS.map((f) => [f, z.string().max(120)])) as Record<
        TextField,
        z.ZodString
      >),
      dValue: numeric,
      tValue: numeric,
      elevationM: numeric,
      deckHeightFt: numeric,
      statusLights: z.boolean(),
      fuelAvailable: z.boolean(),
      gpuAvailable: z.boolean(),
      riskLevel: z.enum(['', 'low', 'medium', 'high']),
      lastOpsSurveyOn: z.string(),
      lat: z.string(),
      lng: z.string(),
      confirmed: z.array(z.string()),
      reason: record
        ? z.string().trim().min(3, t('places.installations.form.reasonRequired'))
        : z.string(),
    })
    .superRefine((v, ctx) => {
      if (readCoordinates(v, record?.coordinates ?? null) === 'invalid')
        ctx.addIssue({ code: 'custom', path: ['lat'], message: t('places.coordinates.invalid') });
    });
  type Values = z.infer<typeof schema>;
  const defaults: Values = {
    code: record?.code ?? '',
    name: record?.name ?? '',
    installationTypeId: record?.installationType.id ?? '',
    locationId: record?.location.id ?? '',
    callsign: toText(record?.callsign),
    material: toText(record?.material),
    gcaaClassOfUse: toText(record?.gcaaClassOfUse),
    deckClass: toText(record?.deckClass),
    minPerformanceClass: toText(record?.minPerformanceClass),
    radioFrequency: toText(record?.radioFrequency),
    ndb: toText(record?.ndb),
    heading: toText(record?.heading),
    firefighting: toText(record?.firefighting),
    operator: toText(record?.operator),
    dValue: toText(record?.dValue),
    tValue: toText(record?.tValue),
    elevationM: toText(record?.elevationM),
    deckHeightFt: toText(record?.deckHeightFt),
    statusLights: record?.statusLights ?? false,
    fuelAvailable: record?.fuelAvailable ?? false,
    gpuAvailable: record?.gpuAvailable ?? false,
    riskLevel: record?.riskLevel ?? '',
    lastOpsSurveyOn: record?.lastOpsSurveyOn ?? '',
    ...coordinateText(record?.coordinates ?? null),
    confirmed: [],
    reason: '',
  };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { errors, isSubmitting, dirtyFields } = form.formState;
  const [lat, lng] = useWatch({ control: form.control, name: ['lat', 'lng'] });
  const unconfirmed = record?.unconfirmedFields ?? [];

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const coordinates = readCoordinates(v, record?.coordinates ?? null);
    const point = coordinates === 'invalid' ? undefined : coordinates;
    const all: Omit<InstallationInput, 'code' | 'name' | 'installationTypeId' | 'locationId'> = {
      ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, toNullable(v[f])])),
      ...Object.fromEntries(NUMBER_FIELDS.map((f) => [f, toNumber(v[f])])),
      statusLights: v.statusLights,
      fuelAvailable: v.fuelAvailable,
      gpuAvailable: v.gpuAvailable,
      riskLevel: v.riskLevel === '' ? null : v.riskLevel,
      lastOpsSurveyOn: v.lastOpsSurveyOn || null,
    };
    try {
      if (record) {
        // Only what changed, so an untouched placeholder stays pending (P-53).
        const changed = Object.fromEntries(
          Object.entries(all).filter(([key]) => dirtyFields[key as keyof Values]),
        );
        await saveInstallation(
          record,
          {
            code: v.code,
            name: v.name,
            installationTypeId: v.installationTypeId,
            locationId: v.locationId,
          },
          {
            ...changed,
            ...(dirtyFields.name ? { name: v.name } : {}),
            ...(dirtyFields.installationTypeId ? { installationTypeId: v.installationTypeId } : {}),
            ...(dirtyFields.locationId ? { locationId: v.locationId } : {}),
            ...(point === undefined ? {} : { coordinates: point }),
            ...(v.confirmed.length > 0 ? { confirmed: v.confirmed as UnconfirmedField[] } : {}),
            reason: v.reason.trim(),
          },
        );
      } else {
        await saveInstallation(
          null,
          {
            ...all,
            code: v.code,
            name: v.name,
            installationTypeId: v.installationTypeId,
            locationId: v.locationId,
            ...(point ? { coordinates: point } : {}),
          },
          { reason: '' },
        );
      }
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  });

  const text = (field: TextField) => (
    <Field
      key={field}
      label={t(label(field))}
      error={errors[field]?.message}
      {...form.register(field)}
    />
  );
  const number = (field: NumberField) => (
    <Field
      key={field}
      label={t(label(field))}
      inputMode="decimal"
      error={errors[field]?.message}
      {...form.register(field)}
    />
  );
  const moving =
    record?.coordinates !== null &&
    record?.coordinates !== undefined &&
    readCoordinates({ lat, lng }, record.coordinates) !== undefined;

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record
          ? t('places.installations.form.editTitle', { name: record.name })
          : t('places.installations.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      {unconfirmed.length > 0 && (
        <Banner tone="warning">
          {t('places.installations.pendingFields', {
            fields: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
              unconfirmed.map((f) => t(`places.installations.fields.${f}`)),
            ),
          })}
        </Banner>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('places.installations.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <Field
          label={t('places.installations.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <SelectField
          label={t('places.installations.form.type')}
          error={errors.installationTypeId?.message}
          {...form.register('installationTypeId')}
        >
          <option value="">{t('places.installations.form.chooseType')}</option>
          {(options.data?.installationTypes ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('places.installations.form.location')}
          error={errors.locationId?.message}
          {...form.register('locationId')}
        >
          <option value="">{t('places.installations.form.chooseLocation')}</option>
          {(options.data?.locations ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.code})
            </option>
          ))}
        </SelectField>
        {text('callsign')}
        {text('material')}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">
          {t('places.installations.form.technical')}
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          {number('dValue')}
          {number('tValue')}
          {text('gcaaClassOfUse')}
          {number('elevationM')}
          <CoordinateFields
            lat={form.register('lat')}
            lng={form.register('lng')}
            error={errors.lat?.message}
          />
          {text('deckClass')}
          {text('minPerformanceClass')}
          {text('radioFrequency')}
          {number('deckHeightFt')}
          {text('ndb')}
          {text('heading')}
          {text('firefighting')}
          {text('operator')}
          <SelectField
            label={t('places.installations.form.riskLevel')}
            {...form.register('riskLevel')}
          >
            <option value="">{t('places.installations.form.noRisk')}</option>
            {(['low', 'medium', 'high'] as const).map((level) => (
              <option key={level} value={level}>
                {t(`places.installations.form.risk.${level}`)}
              </option>
            ))}
          </SelectField>
          <Field
            label={t('places.installations.form.lastOpsSurvey')}
            type="date"
            {...form.register('lastOpsSurveyOn')}
          />
        </div>
        <div className="flex flex-wrap gap-x-6">
          {FLAG_FIELDS.map((flag) => (
            <label key={flag} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="size-4 accent-primary" {...form.register(flag)} />
              {t(label(flag))}
            </label>
          ))}
        </div>
      </fieldset>

      {unconfirmed.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-ink">
            {t('places.installations.form.confirm')}
          </legend>
          <p className="text-xs text-ink-secondary">{t('places.installations.form.confirmHint')}</p>
          {unconfirmed.map((field) => (
            <label key={field} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                value={field}
                className="size-4 accent-primary"
                {...form.register('confirmed')}
              />
              {t(`places.installations.fields.${field}`)}
            </label>
          ))}
        </fieldset>
      )}

      <section className="space-y-1">
        <h3 className="text-sm font-semibold text-ink">
          {t('places.installations.form.validity')}
        </h3>
        <p className="text-sm text-ink-secondary">{t('places.installations.form.validityNote')}</p>
      </section>

      {record && (
        <div className="space-y-1">
          <Field
            label={t('places.installations.form.reason')}
            error={errors.reason?.message}
            {...form.register('reason')}
          />
          <p className="text-xs text-ink-secondary">
            {moving
              ? t('places.coordinates.reasonHint')
              : t('places.installations.form.reasonHint')}
          </p>
        </div>
      )}
    </EntityFormModal>
  );
}
