import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { formatGstDate } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { setFilter } from '../../administration/masters/filters';
import { masterResource } from '../../administration/masters/master-api';
import { MasterPage, type MasterFormProps } from '../../administration/masters/master-page';
import {
  ADHOC_PATH,
  type AdhocMovement,
  baseModeOf,
  MODES,
  modesOf,
  saveAdhoc,
  type Suggestion,
  useAdhocOptions,
  useSuggestion,
} from './scheduling-api';

const resource = masterResource<AdhocMovement>('adhoc-movements', 'scheduling.adhoc', {
  path: ADHOC_PATH,
  deletable: false,
});
const NUMBER = /^[A-Z]{2,3}9\d{2}$/;
const day = (iso: string) => formatGstDate(`${iso}T12:00:00+04:00`);

/** The requests a link asks the form to take up: `?requests=<id>,<id>`. */
const requestsIn = (search: URLSearchParams) =>
  (search.get('requests') ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id));

/**
 * Ad hoc movements (spec 20 §2.1, BRD A.3.3-04/05/06): one-off movements in the 9xx band on
 * master routes, each with one journey. Opened from unscheduled requests, the form suggests the
 * movements that can carry them and takes them up.
 */
export default function AdhocMovementsPage() {
  const { t } = useTranslation();
  const [search] = useSearchParams();
  return (
    <MasterPage
      resource={resource}
      title={t('scheduling.adhoc.title')}
      subtitle={t('scheduling.adhoc.subtitle')}
      noun={t('scheduling.adhoc.noun')}
      searchPlaceholder={t('scheduling.adhoc.search')}
      describe={(a) => `${a.flightNumber} · ${a.ref}`}
      form={AdhocForm}
      startNew={requestsIn(search).length > 0}
      defaultSort={{ field: 'serviceDate', dir: 'desc' }}
      lifecycleText={{
        deactivate: {
          menu: t('scheduling.recurring.end'),
          title: (a) => t('scheduling.adhoc.endTitle', { record: `${a.flightNumber} · ${a.ref}` }),
          body: () => t('scheduling.adhoc.endBody'),
        },
        reactivate: {
          menu: t('scheduling.recurring.resume'),
          title: (a) =>
            t('scheduling.adhoc.resumeTitle', { record: `${a.flightNumber} · ${a.ref}` }),
          body: () => t('scheduling.adhoc.resumeBody'),
        },
      }}
      columns={[
        {
          id: 'flightNumber',
          header: t('scheduling.columns.flight'),
          sortField: 'flightNumber',
          cell: (a) => (
            <div className="flex flex-col items-start gap-1">
              <span className="font-mono text-sm font-semibold text-ink">{a.flightNumber}</span>
              <span className="font-mono text-xs text-ink-secondary">{a.ref}</span>
              {a.warnings.map((w) => (
                <StatusPill key={w} tone="warning">
                  {w}
                </StatusPill>
              ))}
            </div>
          ),
        },
        {
          id: 'serviceDate',
          header: t('scheduling.adhoc.date'),
          sortField: 'serviceDate',
          cell: (a) => (
            <div>
              <p className="text-ink">{day(a.serviceDate)}</p>
              <p className="text-xs text-ink-secondary">
                {a.departureTime
                  ? `${a.departureTime}${a.arrivalTime ? ` → ${a.arrivalTime}` : ''} GST`
                  : t('scheduling.recurring.noTime')}
              </p>
            </div>
          ),
        },
        {
          id: 'route',
          header: t('scheduling.columns.route'),
          sortField: 'route',
          cell: (a) => (
            <div>
              <p className="text-ink">{a.route.name}</p>
              <p className="text-xs text-ink-secondary">
                {a.route.stops.map((s) => s.code).join(' → ')} · {t(`scheduling.mode.${a.mode}`)}
              </p>
            </div>
          ),
        },
        {
          id: 'resource',
          header: t('scheduling.columns.resource'),
          cell: (a) => (
            <div className="flex flex-col items-start gap-1">
              <span>{a.resourceType.name}</span>
              {a.fleet ? (
                <span className="font-mono text-xs text-ink-secondary">{a.fleet.registration}</span>
              ) : (
                <StatusPill tone="warning">{t('scheduling.recurring.unassigned')}</StatusPill>
              )}
            </div>
          ),
        },
        {
          id: 'requests',
          header: t('scheduling.adhoc.requests'),
          align: 'right',
          cell: (a) => (
            <div>
              <p>{a.requests}</p>
              {a.journey && (
                <p className="text-xs text-ink-secondary">
                  {t('scheduling.adhoc.booked', { count: a.journey.booked })}
                </p>
              )}
            </div>
          ),
        },
      ]}
      filters={(list) => (
        <FilterSelect
          label={t('scheduling.columns.mode')}
          allLabel={t('ui.filter.all')}
          value={list.params.filters.mode}
          options={MODES.map((m) => ({ value: m, label: t(`scheduling.mode.${m}`) }))}
          onChange={(v) => setFilter(list, 'mode', v)}
        />
      )}
    />
  );
}

type Group = Suggestion['groups'][number];

function AdhocForm({ open, onOpenChange, record, onSaved }: MasterFormProps<AdhocMovement>) {
  const { t } = useTranslation();
  const options = useAdhocOptions();
  const [search] = useSearchParams();
  const asked = record ? [] : requestsIn(search);
  const suggestion = useSuggestion(asked);
  const [picked, setPicked] = useState<Group | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const time = z
    .string()
    .refine(
      (v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
      t('scheduling.form.timeInvalid'),
    );
  const schema = z
    .object({
      flightNumber: z
        .string()
        .trim()
        .toUpperCase()
        .regex(NUMBER, t('scheduling.adhoc.numberInvalid')),
      routeId: z.string().min(1, t('scheduling.form.chooseRoute')),
      mode: z.enum(MODES),
      resourceTypeId: z.string().min(1, t('scheduling.form.chooseType')),
      fleetId: z.string(),
      serviceDate: z.string().min(1, t('scheduling.adhoc.dateRequired')),
      departureTime: time,
      arrivalTime: time,
      purpose: z.string().max(500),
    })
    .refine((v) => v.arrivalTime === '' || v.departureTime !== '', {
      path: ['arrivalTime'],
      message: t('scheduling.form.arrivalNeedsDeparture'),
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      flightNumber: record?.flightNumber ?? '',
      routeId: record?.route.id ?? '',
      mode: record?.mode ?? 'fixed-wing',
      resourceTypeId: record?.resourceType.id ?? '',
      fleetId: record?.fleet?.id ?? '',
      serviceDate: record?.serviceDate ?? '',
      departureTime: record?.departureTime ?? '',
      arrivalTime: record?.arrivalTime ?? '',
      purpose: record?.purpose ?? (asked.length > 0 ? t('scheduling.adhoc.fromRequests') : ''),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [routeId, mode, typeId, flightNumber] = useWatch({
    control: form.control,
    name: ['routeId', 'mode', 'resourceTypeId', 'flightNumber'],
  });
  const route = options.data?.routes.find((r) => r.id === routeId);
  const modes = route ? modesOf(route.baseMode) : MODES;
  const operator = flightNumber.trim().toUpperCase().slice(0, -3);
  const provider = options.data?.serviceProviders.find((p) => p.code === operator);
  // A type of the route's category; before a route is chosen, any of the mode's base mode.
  const types = (options.data?.resourceTypes ?? []).filter((r) =>
    route ? r.category === route.category : r.baseMode === baseModeOf(mode),
  );
  const fleet = (options.data?.fleet ?? []).filter(
    (f) => f.resourceTypeId === typeId && (!provider || f.serviceProviderId === provider.id),
  );

  useEffect(() => {
    if (route && !modes.includes(mode)) form.setValue('mode', modes[0]);
  }, [route, modes, mode, form]);

  // A suggestion fills the route, its kind of resource and the day; the first is taken until
  // another is chosen.
  const fill = (g: Group) => {
    form.setValue('routeId', g.route.id);
    form.setValue('serviceDate', g.date);
    const baseMode = options.data?.routes.find((r) => r.id === g.route.id)?.baseMode;
    const firstMode = baseMode && modesOf(baseMode)[0];
    if (firstMode) form.setValue('mode', firstMode);
    if (g.resourceType) form.setValue('resourceTypeId', g.resourceType.id);
  };
  const first = suggestion.data?.groups[0];
  const group = picked ?? first ?? null;
  const choose = (g: Group) => {
    setPicked(g);
    fill(g);
  };
  // The type is offered only once the mode is the route's: set it again when it appears.
  const wantedType = group?.resourceType?.id;
  const typeOffered = types.some((r) => r.id === wantedType);
  useEffect(() => {
    if (wantedType && typeOffered) form.setValue('resourceTypeId', wantedType);
  }, [wantedType, typeOffered, form]);
  useEffect(() => {
    if (first && options.data && picked === null) fill(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once both have loaded, until a choice
  }, [first, options.data]);

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const values = {
      flightNumber: v.flightNumber,
      routeId: v.routeId,
      mode: v.mode,
      resourceTypeId: v.resourceTypeId,
      fleetId: v.fleetId || null,
      serviceDate: v.serviceDate,
      departureTime: v.departureTime || null,
      arrivalTime: v.arrivalTime || null,
      purpose: v.purpose.trim() || null,
    };
    try {
      if (record) {
        const current: Record<string, unknown> = {
          flightNumber: record.flightNumber,
          routeId: record.route.id,
          mode: record.mode,
          resourceTypeId: record.resourceType.id,
          fleetId: record.fleet?.id ?? null,
          serviceDate: record.serviceDate,
          departureTime: record.departureTime,
          arrivalTime: record.arrivalTime,
          purpose: record.purpose,
        };
        const changed = Object.fromEntries(
          Object.entries(values).filter(
            ([k, value]) => JSON.stringify(value) !== JSON.stringify(current[k]),
          ),
        );
        if (Object.keys(changed).length === 0) {
          setFailure(t('scheduling.form.noChange'));
          return;
        }
        await saveAdhoc(record, changed);
      } else {
        await saveAdhoc(null, {
          ...values,
          ...(group ? { requestIds: group.requestIds } : {}),
        });
      }
      onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : t('ui.confirm.failed'));
    }
  });

  const unplaced = suggestion.data?.unplaced ?? [];
  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record
          ? t('scheduling.form.editTitle', { name: `${record.flightNumber} · ${record.ref}` })
          : t('scheduling.adhoc.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      {asked.length > 0 && (
        <fieldset className="space-y-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-semibold text-ink">
            {t('scheduling.adhoc.suggestions', { count: asked.length })}
          </legend>
          {suggestion.isLoading && (
            <p className="text-sm text-ink-secondary">{t('scheduling.adhoc.suggesting')}</p>
          )}
          {(suggestion.data?.groups ?? []).map((g, i) => (
            <label key={`${g.route.id}-${g.date}-${i}`} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="suggestion"
                className="mt-1"
                checked={group === g}
                onChange={() => choose(g)}
              />
              <span>
                <span className="font-semibold text-ink">
                  {g.route.code} · {day(g.date)}
                </span>
                <span className="block text-ink-secondary">
                  {t('scheduling.adhoc.groupLine', {
                    count: g.requestIds.length,
                    stops: g.route.stops.map((s) => s.code).join(' → '),
                  })}
                  {g.resourceType
                    ? ` · ${t('scheduling.adhoc.seats', { type: g.resourceType.name, count: g.resourceType.capacity })}`
                    : ''}
                  {g.distanceKm !== null ? ` · ${Math.round(g.distanceKm)} km` : ''}
                </span>
              </span>
            </label>
          ))}
          {unplaced.length > 0 && (
            <Banner tone="warning">
              {t('scheduling.adhoc.unplaced', { count: unplaced.length })}
            </Banner>
          )}
        </fieldset>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('scheduling.form.flightNumber')}
          placeholder="ADA901"
          error={errors.flightNumber?.message}
          {...form.register('flightNumber')}
        />
        <Field
          type="date"
          label={t('scheduling.adhoc.date')}
          error={errors.serviceDate?.message}
          {...form.register('serviceDate')}
        />
        <SelectField
          label={t('scheduling.form.route')}
          error={errors.routeId?.message}
          {...form.register('routeId')}
        >
          <option value="">{t('scheduling.form.chooseRoute')}</option>
          {(options.data?.routes ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} · {r.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('scheduling.form.mode')} {...form.register('mode')}>
          {modes.map((m) => (
            <option key={m} value={m}>
              {t(`scheduling.mode.${m}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('scheduling.form.resourceType')}
          error={errors.resourceTypeId?.message}
          {...form.register('resourceTypeId')}
        >
          <option value="">{t('scheduling.form.chooseType')}</option>
          {types.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('scheduling.form.fleet')} {...form.register('fleetId')}>
          <option value="">{t('scheduling.form.notAssigned')}</option>
          {fleet.map((f) => (
            <option key={f.id} value={f.id}>
              {f.registration}
              {f.availability === 'maintenance' ? ` (${t('scheduling.form.maintenance')})` : ''}
            </option>
          ))}
        </SelectField>
        <Field
          type="time"
          label={t('scheduling.form.departure')}
          error={errors.departureTime?.message}
          {...form.register('departureTime')}
        />
        <Field
          type="time"
          label={t('scheduling.form.arrival')}
          error={errors.arrivalTime?.message}
          {...form.register('arrivalTime')}
        />
        <Field
          className="md:col-span-2"
          label={t('scheduling.adhoc.purpose')}
          {...form.register('purpose')}
        />
      </div>
      <p className="text-xs text-ink-secondary">{t('scheduling.adhoc.hint')}</p>
      {record && record.journey && record.journey.booked + record.requests > 0 && (
        <Banner tone="info">{t('scheduling.adhoc.hasPassengers')}</Banner>
      )}
    </EntityFormModal>
  );
}
