import { zodResolver } from '@hookform/resolvers/zod';
import { Armchair } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner } from '../../../shared/ui/banner';
import { Drawer } from '../../../shared/ui/drawer';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { SeatMap as SeatMapView, type SeatLayout } from '../../../shared/ui/seat-map';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { setFilter } from '../masters/filters';
import { toNumber, toText, wholeText } from '../masters/form-values';
import { masterResource, saveMaster, useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import {
  categoryChoices,
  categoryText,
  seatMapText,
  type FleetOptions,
  type FleetUnit,
  type SeatMap,
} from './resources-api';

const resource = masterResource<FleetUnit>('fleet', 'admin.fleet');
const AVAILABILITY = ['available', 'maintenance', 'retired'] as const;
/** As the API: 2–40 letters, digits, spaces, dots or hyphens, starting alphanumeric. */
const REGISTRATION = /^[A-Za-z0-9][A-Za-z0-9 .-]{1,39}$/;
/** The API's upper bound on a unit's seat capacity; the type's seat map bounds it further. */
const MAX_CAPACITY = 1000;
const AVAILABILITY_TONE: Readonly<Record<FleetUnit['availability'], Tone>> = {
  available: 'success',
  maintenance: 'warning',
  retired: 'neutral',
};

type BaseMode = FleetUnit['resourceType']['baseMode'];
type TypeOption = FleetOptions['resourceTypes'][number];
type Specs = TypeOption['specs'];
type Helideck = NonNullable<FleetUnit['helideck']>;

/** Fixed and rotary wing fly; marine sails (the categories' base modes, BRD D.3.1.7). */
const modeOf = (baseMode: BaseMode) => (baseMode === 'marine' ? 'marine' : 'air');

/** A type's seat map as the shared seat map draws it: seats A, B, … with the aisle as a gap. */
function layoutOf(map: SeatMap): SeatLayout {
  const columns: string[] = [];
  for (let seat = 1; seat <= map.seatsPerRow; seat += 1) {
    columns.push(String.fromCharCode(64 + seat));
    if (seat === map.aisleAfter) columns.push('');
  }
  return { rows: map.rows, columns };
}

/**
 * Fleet (spec 10 §5.2, BRD D.3.2.1): each aircraft, helicopter and vessel, of a Resource Type
 * and a Service Provider. The category is the type's. Seat map, baggage, payload and helideck
 * needs are the type's (D.3.1.8); only the seat capacity may be the unit's own. Seat quotas are
 * the Quotas master's (D.3.2.2).
 */
export default function FleetPage() {
  const { t } = useTranslation();
  const options = useMasterOptions<FleetOptions>('fleet');
  const [viewing, setViewing] = useState<FleetUnit | null>(null);
  return (
    <>
      <MasterPage
        resource={resource}
        title={t('resources.fleet.title')}
        subtitle={t('resources.fleet.subtitle')}
        noun={t('resources.fleet.noun')}
        searchPlaceholder={t('resources.fleet.search')}
        describe={(f) => `${f.registration} · ${f.resourceType.name}`}
        form={FleetForm}
        defaultSort={{ field: 'registration', dir: 'asc' }}
        actions={(f) => [{ label: t('resources.fleet.view'), run: () => setViewing(f) }]}
        columns={[
          {
            id: 'registration',
            header: t('resources.fleet.columns.registration'),
            sortField: 'registration',
            cell: (f) => (
              <div className="space-y-1">
                <p className="font-mono text-sm font-medium text-ink">{f.registration}</p>
                {!f.isBookable && (
                  <StatusPill tone="neutral">{t('resources.fleet.notBookable')}</StatusPill>
                )}
              </div>
            ),
          },
          {
            id: 'type',
            header: t('resources.fleet.columns.type'),
            sortField: 'type',
            cell: (f) => (
              <div>
                <p>{f.resourceType.name}</p>
                <p className="text-xs text-ink-secondary">
                  {categoryText(t, f.resourceType.category, options.data?.categories)} ·{' '}
                  {t(`resources.fleet.mode.${modeOf(f.resourceType.baseMode)}`)}
                </p>
              </div>
            ),
          },
          {
            id: 'provider',
            header: t('resources.fleet.columns.provider'),
            sortField: 'provider',
            cell: (f) => f.serviceProvider.name,
          },
          {
            id: 'availability',
            header: t('resources.fleet.columns.availability'),
            sortField: 'availability',
            cell: (f) => (
              <StatusPill tone={AVAILABILITY_TONE[f.availability]}>
                {t(`resources.fleet.availability.${f.availability}`)}
              </StatusPill>
            ),
          },
          {
            id: 'seats',
            header: t('resources.fleet.columns.seats'),
            align: 'right',
            cell: (f) => (
              <span>
                {f.effective.passengerCapacity ?? '—'}
                {f.overrides.passengerCapacity !== null && (
                  <span className="ml-1 text-xs text-ink-secondary">
                    ({t('resources.fleet.own')})
                  </span>
                )}
              </span>
            ),
          },
          {
            id: 'payload',
            header: t('resources.fleet.columns.payload'),
            align: 'right',
            cell: (f) =>
              f.effective.payloadKg === null
                ? '—'
                : t('resources.types.kg', { kg: f.effective.payloadKg }),
          },
        ]}
        filters={(list) => (
          <>
            <FilterSelect
              label={t('resources.fleet.filters.category')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.category}
              options={categoryChoices(options.data?.categories)}
              onChange={(v) => setFilter(list, 'category', v)}
            />
            <FilterSelect
              label={t('resources.fleet.filters.type')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.type}
              options={(options.data?.resourceTypes ?? [])
                .filter(
                  (r) =>
                    list.params.filters.category === undefined ||
                    r.category === list.params.filters.category,
                )
                .map((r) => ({ value: r.id, label: r.name }))}
              onChange={(v) => setFilter(list, 'type', v)}
            />
            <FilterSelect
              label={t('resources.fleet.filters.provider')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.provider}
              options={(options.data?.serviceProviders ?? []).map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              onChange={(v) => setFilter(list, 'provider', v)}
            />
            <FilterSelect
              label={t('resources.fleet.filters.availability')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.availability}
              options={AVAILABILITY.map((a) => ({
                value: a,
                label: t(`resources.fleet.availability.${a}`),
              }))}
              onChange={(v) => setFilter(list, 'availability', v)}
            />
          </>
        )}
      />
      {viewing && (
        <FleetDetails
          unit={viewing}
          categories={options.data?.categories}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

/** A unit's type, as the options list it; a type no longer offered comes from the unit itself. */
function typeOfUnit(unit: FleetUnit): TypeOption {
  return {
    ...unit.resourceType,
    specs: {
      ...unit.effective,
      passengerCapacity:
        unit.overrides.passengerCapacity === null ? unit.effective.passengerCapacity : null,
    },
    helideck: unit.helideck,
  };
}

function FleetForm({ open, onOpenChange, record, onSaved }: MasterFormProps<FleetUnit>) {
  const { t } = useTranslation();
  const options = useMasterOptions<FleetOptions>('fleet');
  const [failure, setFailure] = useState<string | null>(null);
  const offered = options.data?.resourceTypes ?? [];
  const types =
    record && !offered.some((r) => r.id === record.resourceType.id)
      ? [typeOfUnit(record), ...offered]
      : offered;
  // The rules the API applies (BRD D.3.2.1, D.3.1.8), checked as the user types.
  const schema = z
    .object({
      registration: record
        ? z.string()
        : z
            .string()
            .trim()
            .min(1, t('resources.fleet.form.registrationRequired'))
            .regex(REGISTRATION, t('resources.fleet.form.registrationInvalid')),
      category: z.string().min(1, t('resources.fleet.form.chooseCategory')),
      resourceTypeId: z.string().min(1, t('resources.fleet.form.chooseType')),
      serviceProviderId: z.string().min(1, t('resources.fleet.form.chooseProvider')),
      availability: z.enum(AVAILABILITY),
      isBookable: z.boolean(),
      capacity: wholeText(t('resources.fleet.form.capacityInvalid', { max: MAX_CAPACITY }), 1),
    })
    .superRefine((v, ctx) => {
      const capacity = toNumber(v.capacity);
      if (capacity === null) return;
      if (capacity > MAX_CAPACITY) {
        ctx.addIssue({
          code: 'custom',
          path: ['capacity'],
          message: t('resources.fleet.form.capacityInvalid', { max: MAX_CAPACITY }),
        });
        return;
      }
      const map = types.find((r) => r.id === v.resourceTypeId)?.specs.seatMap;
      if (map && capacity > map.rows * map.seatsPerRow) {
        ctx.addIssue({
          code: 'custom',
          path: ['capacity'],
          message: t('resources.fleet.form.capacityAboveMap', {
            seats: map.rows * map.seatsPerRow,
          }),
        });
      }
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      registration: record?.registration ?? '',
      category: record?.resourceType.category ?? '',
      resourceTypeId: record?.resourceType.id ?? '',
      serviceProviderId: record?.serviceProvider.id ?? '',
      availability: record?.availability ?? 'available',
      isBookable: record?.isBookable ?? true,
      capacity: toText(record?.overrides.passengerCapacity),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [category, typeId, availability] = useWatch({
    control: form.control,
    name: ['category', 'resourceTypeId', 'availability'],
  });

  const categories = [...(options.data?.categories ?? [])];
  if (record && !categories.some((c) => c.code === record.resourceType.category)) {
    categories.unshift({
      code: record.resourceType.category,
      name: categoryText(t, record.resourceType.category),
      weightUnit: 'kg',
      baseMode: record.resourceType.baseMode,
    });
  }
  const inCategory = types.filter((r) => r.category === category);
  const type = types.find((r) => r.id === typeId);
  const providers = options.data?.serviceProviders ?? [];
  const provider = record?.serviceProvider;
  const providerChoices =
    provider && !providers.some((p) => p.id === provider.id) ? [provider, ...providers] : providers;

  const register = form.register('category');
  const categoryField = {
    ...register,
    onChange: async (event: { target: { value: string } }) => {
      await register.onChange(event);
      // The category only narrows the types: a type of another category no longer fits.
      const chosen = types.find((r) => r.id === form.getValues('resourceTypeId'));
      if (chosen && chosen.category !== event.target.value) form.setValue('resourceTypeId', '');
    },
  };
  const typeField = form.register('resourceTypeId');
  const resourceTypeField = {
    ...typeField,
    onChange: async (event: { target: { value: string } }) => {
      await typeField.onChange(event);
      // A capacity that fitted the old type's seat map may not fit the new one's.
      if (form.getValues('capacity') !== '') await form.trigger('capacity');
    },
  };

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const body = {
      resourceTypeId: v.resourceTypeId,
      serviceProviderId: v.serviceProviderId,
      availability: v.availability,
      isBookable: v.availability === 'retired' ? false : v.isBookable,
      passengerCapacity: toNumber(v.capacity),
    };
    try {
      await saveMaster('fleet', record, record ? body : { ...body, registration: v.registration });
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
          ? t('resources.fleet.form.editTitle', { name: record.registration })
          : t('resources.fleet.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      {options.isError && <Banner tone="danger">{t('resources.fleet.form.optionsFailed')}</Banner>}
      <Section title={t('resources.fleet.form.identification')}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label={t('resources.fleet.form.registration')}
            required={!record}
            error={errors.registration?.message}
            disabled={record !== null}
            {...form.register('registration')}
          />
          <SelectField
            label={t('resources.fleet.form.provider')}
            required
            error={errors.serviceProviderId?.message}
            {...form.register('serviceProviderId')}
          >
            <option value="">{t('resources.fleet.form.chooseProvider')}</option>
            {providerChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('resources.fleet.form.category')}
            required
            error={errors.category?.message}
            {...categoryField}
          >
            <option value="">{t('resources.fleet.form.chooseCategory')}</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} · {t(`resources.fleet.mode.${modeOf(c.baseMode)}`)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('resources.fleet.form.type')}
            required
            disabled={category === ''}
            error={errors.resourceTypeId?.message}
            {...resourceTypeField}
          >
            <option value="">
              {category === ''
                ? t('resources.fleet.form.categoryFirst')
                : t('resources.fleet.form.chooseType')}
            </option>
            {inCategory.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
        </div>
        {record && typeId !== '' && typeId !== record.resourceType.id && (
          <Banner tone="info">{t('resources.fleet.form.typeChanged')}</Banner>
        )}
      </Section>

      <Section title={t('resources.fleet.form.availabilitySection')}>
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label={t('resources.fleet.form.availability')}
            {...form.register('availability')}
          >
            {AVAILABILITY.map((a) => (
              <option key={a} value={a}>
                {t(`resources.fleet.availability.${a}`)}
              </option>
            ))}
          </SelectField>
          {availability !== 'retired' && (
            <label className="flex min-h-9 items-center gap-2 self-end text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                {...form.register('isBookable')}
              />
              {t('resources.fleet.form.bookable')}
            </label>
          )}
        </div>
        <p className="text-xs text-ink-secondary">{t('resources.fleet.form.availabilityHint')}</p>
        {availability !== 'available' && record?.availability !== availability && (
          <Banner tone="warning">{t(`resources.fleet.form.becomes.${availability}`)}</Banner>
        )}
      </Section>

      <Section title={t('resources.fleet.form.capacitySection')}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field
            label={t('resources.fleet.form.capacity')}
            inputMode="numeric"
            maxLength={4}
            {...(type?.specs.passengerCapacity !== null &&
            type?.specs.passengerCapacity !== undefined
              ? {
                  placeholder: t('resources.fleet.fromType', {
                    value: type.specs.passengerCapacity,
                  }),
                }
              : {})}
            error={errors.capacity?.message}
            {...form.register('capacity')}
          />
        </div>
        <p className="text-xs text-ink-secondary">
          {t('resources.fleet.form.capacityHint', { max: MAX_CAPACITY })}
        </p>
        {type ? <TypeSpecs specs={type.specs} /> : <SeatLayoutPlaceholder />}
      </Section>

      {type?.baseMode === 'rotary-wing' && (
        <Section title={t('resources.fleet.helideck.title')}>
          <HelideckDetails helideck={type.helideck} />
        </Section>
      )}
      <p className="text-xs text-ink-secondary">{t('resources.fleet.certification')}</p>
    </EntityFormModal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    // The divider is on the legend: a bordered fieldset draws its legend inside the line.
    <fieldset className="group space-y-3">
      <legend className="w-full border-t border-border pt-4 text-sm font-semibold text-ink group-first:border-t-0 group-first:pt-0">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-secondary">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

/** The type's specifications, read-only: they are kept on Resource Types (BRD D.3.1.8). */
function TypeSpecs({ specs }: { specs: Specs }) {
  const { t } = useTranslation();
  const kg = (value: number | null) =>
    value === null ? t('resources.fleet.notRecorded') : t('resources.types.kg', { kg: value });
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-muted p-3">
      <p className="text-xs text-ink-secondary">{t('resources.fleet.form.fromTypeHint')}</p>
      <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Detail label={t('resources.fleet.form.typeSeats')}>
          {specs.passengerCapacity ?? t('resources.fleet.notRecorded')}
        </Detail>
        <Detail label={t('resources.fleet.form.payload')}>{kg(specs.payloadKg)}</Detail>
        <Detail label={t('resources.fleet.form.baggage')}>{kg(specs.baggageAllowanceKg)}</Detail>
        <Detail label={t('resources.fleet.form.seatLayout')}>
          {specs.openSeating
            ? t('resources.fleet.openSeating')
            : specs.seatMap
              ? seatMapText(t, specs.seatMap)
              : t('resources.fleet.notRecorded')}
        </Detail>
      </dl>
      {specs.seatMap && !specs.openSeating ? (
        <div className="overflow-x-auto">
          <SeatMapView layout={layoutOf(specs.seatMap)} seats={{}} readOnly />
        </div>
      ) : (
        <SeatLayoutPlaceholder />
      )}
    </div>
  );
}

/** Where the seat map shows: until a type with one is chosen, a seat icon holds its place. */
function SeatLayoutPlaceholder() {
  const { t } = useTranslation();
  return (
    <div
      role="img"
      aria-label={t('resources.fleet.form.seatLayout')}
      className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted text-ink-muted"
    >
      <Armchair className="size-8" aria-hidden />
      <span className="text-xs">{t('resources.fleet.form.seatLayout')}</span>
    </div>
  );
}

/** What the aircraft model needs of a helideck; the scheduling checks compare it (BRD A.3.3-7). */
function HelideckDetails({ helideck }: { helideck: Helideck | null }) {
  const { t } = useTranslation();
  if (!helideck)
    return <p className="text-sm text-ink-secondary">{t('resources.fleet.helideck.noModel')}</p>;
  const value = (v: number | null, unit: string) =>
    v === null ? t('resources.fleet.notRecorded') : `${v} ${unit}`;
  return (
    <div className="space-y-2">
      <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Detail label={t('resources.fleet.helideck.model')}>{helideck.aircraftModel.name}</Detail>
        <Detail label={t('resources.fleet.helideck.requiredD')}>
          {value(helideck.requiredDM, 'm')}
        </Detail>
        <Detail label={t('resources.fleet.helideck.requiredT')}>
          {value(helideck.requiredTT, 't')}
        </Detail>
        <Detail label={t('resources.fleet.helideck.performanceClass')}>
          {helideck.performanceClass ?? t('resources.fleet.notRecorded')}
        </Detail>
      </dl>
      <p className="text-xs text-ink-secondary">{t('resources.fleet.helideck.hint')}</p>
    </div>
  );
}

/** A unit, read-only: for everyone who may view the Fleet (BRD D.3.2.1). */
function FleetDetails({
  unit,
  categories,
  onClose,
}: {
  unit: FleetUnit;
  categories: FleetOptions['categories'] | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={unit.registration}
    >
      <div className="space-y-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label={t('resources.fleet.form.type')}>{unit.resourceType.name}</Detail>
          <Detail label={t('resources.fleet.form.category')}>
            {categoryText(t, unit.resourceType.category, categories)} ·{' '}
            {t(`resources.fleet.mode.${modeOf(unit.resourceType.baseMode)}`)}
          </Detail>
          <Detail label={t('resources.fleet.form.provider')}>{unit.serviceProvider.name}</Detail>
          <Detail label={t('resources.fleet.form.availability')}>
            <StatusPill tone={AVAILABILITY_TONE[unit.availability]}>
              {t(`resources.fleet.availability.${unit.availability}`)}
            </StatusPill>
          </Detail>
          <Detail label={t('resources.fleet.form.bookable')}>
            {unit.isBookable ? t('resources.fleet.yes') : t('resources.fleet.no')}
          </Detail>
          <Detail label={t('resources.fleet.status')}>
            {unit.isActive ? t('masters.active') : t('masters.deactivated')}
          </Detail>
          <Detail label={t('resources.fleet.form.capacity')}>
            {unit.effective.passengerCapacity ?? t('resources.fleet.notRecorded')}
            {unit.overrides.passengerCapacity !== null && (
              <span className="ml-1 text-xs text-ink-secondary">({t('resources.fleet.own')})</span>
            )}
          </Detail>
        </dl>
        <TypeSpecs specs={unit.effective} />
        {unit.resourceType.baseMode === 'rotary-wing' && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">
              {t('resources.fleet.helideck.title')}
            </h3>
            <HelideckDetails helideck={unit.helideck} />
          </section>
        )}
      </div>
    </Drawer>
  );
}
