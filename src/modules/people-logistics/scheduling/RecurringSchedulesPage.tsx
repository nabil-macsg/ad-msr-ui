import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { formatGstDate } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { Drawer } from '../../../shared/ui/drawer';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { setFilter } from '../../administration/masters/filters';
import { masterResource } from '../../administration/masters/master-api';
import { MasterPage, type MasterFormProps } from '../../administration/masters/master-page';
import {
  baseModeOf,
  MODES,
  modesOf,
  type PreviewInput,
  type RecurringSchedule,
  SCHEDULES_PATH,
  saveSchedule,
  usePreview,
  useReassignment,
  useScheduleOptions,
} from './scheduling-api';

const resource = masterResource<RecurringSchedule>('recurring-schedules', 'scheduling.recurring', {
  path: SCHEDULES_PATH,
  deletable: false,
});
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const NUMBER = /^[A-Z]{2,3}\d{3}$/;
const day = (iso: string) => formatGstDate(`${iso}T12:00:00+04:00`);

/**
 * Recurring schedules (spec 20 §2.1, BRD A.3.3-02/03): a route on a pattern of weekdays within a
 * validity. Saving one materialises its journeys at once; an edit replans those without
 * bookings and lists booked ones for reassignment.
 */
export default function RecurringSchedulesPage() {
  const { t } = useTranslation();
  // "Set up schedule" from an unscheduled request opens the form with its route and day.
  const [search] = useSearchParams();
  const options = useScheduleOptions();
  const [reassigning, setReassigning] = useState<RecurringSchedule | null>(null);
  const days = (s: RecurringSchedule) =>
    s.days.length === 7
      ? t('scheduling.days.daily')
      : s.days.map((d) => t(`scheduling.days.short.${d as 1}`)).join(' ');

  return (
    <>
      <MasterPage
        resource={resource}
        title={t('scheduling.recurring.title')}
        subtitle={t('scheduling.recurring.subtitle')}
        noun={t('scheduling.recurring.noun')}
        searchPlaceholder={t('scheduling.recurring.search')}
        describe={(s) => `${s.flightNumber} · ${s.displayName}`}
        form={ScheduleForm}
        startNew={search.get('new') === '1'}
        defaultSort={{ field: 'flightNumber', dir: 'asc' }}
        lifecycleText={{
          deactivate: {
            menu: t('scheduling.recurring.end'),
            title: (s) =>
              t('scheduling.recurring.endTitle', { record: `${s.flightNumber} · ${s.ref}` }),
            body: () => t('scheduling.recurring.endBody'),
          },
          reactivate: {
            menu: t('scheduling.recurring.resume'),
            title: (s) =>
              t('scheduling.recurring.resumeTitle', { record: `${s.flightNumber} · ${s.ref}` }),
            body: () => t('scheduling.recurring.resumeBody'),
          },
        }}
        columns={[
          {
            id: 'flightNumber',
            header: t('scheduling.columns.flight'),
            sortField: 'flightNumber',
            cell: (s) => (
              <div>
                <p className="font-mono text-sm font-semibold text-ink">{s.flightNumber}</p>
                <p className="font-mono text-xs text-ink-secondary">{s.ref}</p>
              </div>
            ),
          },
          {
            id: 'route',
            header: t('scheduling.columns.route'),
            sortField: 'route',
            cell: (s) => (
              <div>
                <p className="text-ink">{s.displayName}</p>
                <p className="text-xs text-ink-secondary">
                  {s.route.stops.map((stop) => stop.code).join(' → ')} ·{' '}
                  {t(`scheduling.mode.${s.mode}`)}
                </p>
              </div>
            ),
          },
          {
            id: 'resource',
            header: t('scheduling.columns.resource'),
            cell: (s) => (
              <div className="flex flex-col items-start gap-1">
                <span>{s.resourceType.name}</span>
                {s.fleet ? (
                  <span className="font-mono text-xs text-ink-secondary">
                    {s.fleet.registration}
                  </span>
                ) : (
                  <StatusPill tone="warning">{t('scheduling.recurring.unassigned')}</StatusPill>
                )}
              </div>
            ),
          },
          {
            id: 'pattern',
            header: t('scheduling.columns.pattern'),
            cell: (s) => (
              <div>
                <p>{days(s)}</p>
                <p className="text-xs text-ink-secondary">
                  {s.departureTime
                    ? `${s.departureTime}${s.arrivalTime ? ` → ${s.arrivalTime}` : ''} GST`
                    : t('scheduling.recurring.noTime')}
                </p>
              </div>
            ),
          },
          {
            id: 'validity',
            header: t('scheduling.columns.validity'),
            sortField: 'validFrom',
            cell: (s) =>
              s.validTo
                ? t('scheduling.recurring.validFromTo', {
                    from: day(s.validFrom),
                    to: day(s.validTo),
                  })
                : t('scheduling.recurring.validFrom', { from: day(s.validFrom) }),
          },
          {
            id: 'journeys',
            header: t('scheduling.columns.journeys'),
            align: 'right',
            cell: (s) => (
              <div className="flex flex-col items-end gap-1">
                <span>{s.journeys.upcoming}</span>
                {s.journeys.needingReassignment > 0 && (
                  <StatusPill tone="warning">
                    {t('scheduling.recurring.toReassign', {
                      count: s.journeys.needingReassignment,
                    })}
                  </StatusPill>
                )}
              </div>
            ),
          },
        ]}
        actions={(s) => [
          s.journeys.needingReassignment > 0 && {
            label: t('scheduling.recurring.reassignment'),
            run: () => setReassigning(s),
          },
        ]}
        filters={(list) => (
          <>
            <FilterSelect
              label={t('scheduling.columns.mode')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.mode}
              options={MODES.map((m) => ({ value: m, label: t(`scheduling.mode.${m}`) }))}
              onChange={(v) => setFilter(list, 'mode', v)}
            />
            <FilterSelect
              label={t('scheduling.columns.operator')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.provider}
              options={(options.data?.serviceProviders ?? []).map((p) => ({
                value: p.id,
                label: `${p.code} · ${p.name}`,
              }))}
              onChange={(v) => setFilter(list, 'provider', v)}
            />
            <FilterSelect
              label={t('scheduling.columns.resource')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.unassigned}
              options={[{ value: 'true', label: t('scheduling.recurring.unassigned') }]}
              onChange={(v) => setFilter(list, 'unassigned', v)}
            />
          </>
        )}
      />
      {reassigning && (
        <ReassignmentDrawer schedule={reassigning} onClose={() => setReassigning(null)} />
      )}
    </>
  );
}

function ReassignmentDrawer({
  schedule,
  onClose,
}: {
  schedule: RecurringSchedule;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const list = useReassignment(schedule.id);
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('scheduling.recurring.reassignmentOf', {
        record: `${schedule.flightNumber} · ${schedule.ref}`,
      })}
      description={t('scheduling.recurring.reassignmentHint')}
    >
      <ul className="divide-y divide-border">
        {(list.data?.items ?? []).map((j) => (
          <li key={j.id} className="py-2">
            <p className="font-medium text-ink">
              {j.flightNumber} · {day(j.serviceDate)}
            </p>
            <p className="text-sm text-ink-secondary">{j.reason}</p>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

/** Debounces a value: what the preview asks about once typing pauses. */
function useSettled<T>(value: T, ms = 400): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

function ScheduleForm({ open, onOpenChange, record, onSaved }: MasterFormProps<RecurringSchedule>) {
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const asked = record ? null : { route: search.get('route'), from: search.get('from') };
  const options = useScheduleOptions();
  const [failure, setFailure] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>((record?.days ?? [1, 2, 3, 4, 5]).map(String));
  const time = z
    .string()
    .refine(
      (v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
      t('scheduling.form.timeInvalid'),
    );
  const schema = z
    .object({
      name: z.string().max(200),
      flightNumber: z
        .string()
        .trim()
        .toUpperCase()
        .regex(NUMBER, t('scheduling.form.numberInvalid')),
      routeId: z.string().min(1, t('scheduling.form.chooseRoute')),
      mode: z.enum(MODES),
      resourceTypeId: z.string().min(1, t('scheduling.form.chooseType')),
      fleetId: z.string(),
      departureTime: time,
      arrivalTime: time,
      validFrom: z.string().min(1, t('scheduling.form.validFromRequired')),
      validTo: z.string(),
    })
    .refine((v) => v.arrivalTime === '' || v.departureTime !== '', {
      path: ['arrivalTime'],
      message: t('scheduling.form.arrivalNeedsDeparture'),
    })
    .refine((v) => v.validTo === '' || v.validTo >= v.validFrom, {
      path: ['validTo'],
      message: t('scheduling.form.validToBefore'),
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: record?.name ?? '',
      flightNumber: record?.flightNumber ?? '',
      routeId: record?.route.id ?? asked?.route ?? '',
      mode: record?.mode ?? 'fixed-wing',
      resourceTypeId: record?.resourceType.id ?? '',
      fleetId: record?.fleet?.id ?? '',
      departureTime: record?.departureTime ?? '',
      arrivalTime: record?.arrivalTime ?? '',
      validFrom: record?.validFrom ?? asked?.from ?? '',
      validTo: record?.validTo ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [routeId, mode, typeId, flightNumber, validFrom, validTo] = useWatch({
    control: form.control,
    name: ['routeId', 'mode', 'resourceTypeId', 'flightNumber', 'validFrom', 'validTo'],
  });
  // A route asked for in the link can be chosen only once the routes have loaded.
  const askedRoute = asked?.route;
  useEffect(() => {
    if (askedRoute && options.data?.routes.some((r) => r.id === askedRoute))
      form.setValue('routeId', askedRoute);
  }, [askedRoute, options.data, form]);
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

  // A route of another kind of transport than the mode: take its first mode.
  useEffect(() => {
    // Every route category has a mode.
    if (route && !modes.includes(mode)) form.setValue('mode', modes[0]);
  }, [route, modes, mode, form]);

  const previewInput: PreviewInput | null =
    NUMBER.test(flightNumber.trim().toUpperCase()) && routeId && validFrom && days.length > 0
      ? {
          scheduleId: record?.id ?? null,
          flightNumber: flightNumber.trim().toUpperCase(),
          routeId,
          days: days.map(Number),
          validFrom,
          validTo: validTo || null,
        }
      : null;
  const preview = usePreview(useSettled(previewInput));

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    if (days.length === 0) {
      setFailure(t('scheduling.form.chooseDays'));
      return;
    }
    const values = {
      name: v.name.trim() || null,
      flightNumber: v.flightNumber,
      routeId: v.routeId,
      mode: v.mode,
      resourceTypeId: v.resourceTypeId,
      fleetId: v.fleetId || null,
      days: days.map(Number).sort((a, b) => a - b),
      departureTime: v.departureTime || null,
      arrivalTime: v.arrivalTime || null,
      validFrom: v.validFrom,
      validTo: v.validTo || null,
    };
    try {
      if (record) {
        const current: Record<string, unknown> = {
          name: record.name,
          flightNumber: record.flightNumber,
          routeId: record.route.id,
          mode: record.mode,
          resourceTypeId: record.resourceType.id,
          fleetId: record.fleet?.id ?? null,
          days: record.days,
          departureTime: record.departureTime,
          arrivalTime: record.arrivalTime,
          validFrom: record.validFrom,
          validTo: record.validTo,
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
        await saveSchedule(record, changed);
      } else {
        await saveSchedule(null, values);
      }
      onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : t('ui.confirm.failed'));
    }
  });

  const p = preview.data;
  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record
          ? t('scheduling.form.editTitle', { name: `${record.flightNumber} · ${record.ref}` })
          : t('scheduling.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('scheduling.form.flightNumber')}
          placeholder="ADA101"
          error={errors.flightNumber?.message}
          {...form.register('flightNumber')}
        />
        <Field label={t('scheduling.form.name')} {...form.register('name')} />
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
          type="date"
          label={t('scheduling.form.validFrom')}
          error={errors.validFrom?.message}
          {...form.register('validFrom')}
        />
        <Field
          type="date"
          label={t('scheduling.form.validTo')}
          error={errors.validTo?.message}
          {...form.register('validTo')}
        />
      </div>
      <CheckboxList
        legend={t('scheduling.form.days')}
        options={WEEKDAYS.map((d) => ({ value: String(d), label: t(`scheduling.days.long.${d}`) }))}
        selected={days}
        onChange={setDays}
      />
      <p className="text-xs text-ink-secondary">{t('scheduling.form.timesHint')}</p>
      {p && (
        <Banner tone={p.conflictCount > 0 ? 'danger' : 'info'} title={t('scheduling.form.preview')}>
          <p>
            {p.movements === 0 || !p.first || !p.last
              ? t('scheduling.form.previewNone')
              : t('scheduling.form.previewSome', {
                  count: p.movements,
                  first: day(p.first),
                  last: day(p.last),
                })}
          </p>
          {p.conflictCount > 0 && (
            <p>
              {t('scheduling.form.previewTaken', {
                count: p.conflictCount,
                dates: p.conflicts
                  .map((c) => (c.ref ? `${day(c.date)} (${c.ref})` : day(c.date)))
                  .join(', '),
              })}
            </p>
          )}
          {p.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </Banner>
      )}
      {record && record.journeys.upcoming > 0 && (
        <p className="text-xs text-ink-secondary">{t('scheduling.form.replanHint')}</p>
      )}
    </EntityFormModal>
  );
}
