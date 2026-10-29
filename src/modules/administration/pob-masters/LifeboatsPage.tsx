import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { formatGstDate } from '../../../shared/time/format';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import { setFilter } from '../masters/filters';
import { toNullable, toText, wholeText } from '../masters/form-values';
import { useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import {
  type Lifeboat,
  type LifeboatOptions,
  propose,
  proposeReturnToUse,
  takeOutOfService,
  useLifeboatCapacity,
} from './pob-api';
import { ApprovalNotice, PobStatus, ProposalScope } from './pob-bits';
import { usePobResource, useReportProposal } from './pob-context';

const CRAFT = ['lifeboat', 'liferaft', 'rescue-boat'] as const;
const PAGE = 'admin.lifeboats';
const DAY = 86_400_000;

/** Days until a certificate expires, from today in GST. */
const daysLeft = (date: string) =>
  Math.floor((new Date(`${date}T00:00:00+04:00`).getTime() - Date.now()) / DAY);

/**
 * Lifeboats (spec 10 §5.3, BRD D.3.3.2): each craft and its certificate. A location's counted
 * capacity is what is in service, less its largest craft while that rule is on (P-03). A craft
 * goes out of service at once and comes back with a second person's approval (P-57).
 */
export default function LifeboatsPage() {
  return (
    <ProposalScope>
      <Lifeboats />
    </ProposalScope>
  );
}

function Lifeboats() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const resource = usePobResource<Lifeboat>('lifeboats', PAGE);
  const options = useMasterOptions<LifeboatOptions>('lifeboats');
  const capacity = useLifeboatCapacity();
  const report = useReportProposal();
  const queryClient = useQueryClient();
  const [outOf, setOutOf] = useState<Lifeboat | null>(null);
  const [returning, setReturning] = useState<Lifeboat | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: resource.queryKey });
  const editable = (b: Lifeboat) => can(access, PAGE, 'edit') && b.pendingChange === null;

  const items = capacity.data?.items ?? [];
  const sum = (pick: (c: (typeof items)[number]) => number) =>
    items.reduce((total, c) => total + pick(c), 0);
  const kpis = (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('pob.lifeboats.kpi.counted')}
          value={sum((c) => c.countedCapacity)}
          subline={
            capacity.data?.holdBackLargest
              ? t('pob.lifeboats.kpi.heldBack', { seats: sum((c) => c.heldBack ?? 0) })
              : t('pob.lifeboats.kpi.noHoldBack')
          }
        />
        <StatCard
          title={t('pob.lifeboats.kpi.inService')}
          value={`${sum((c) => c.inService)} / ${sum((c) => c.craft)}`}
          subline={t('pob.lifeboats.kpi.seats', { seats: sum((c) => c.inServiceCapacity) })}
        />
        <StatCard
          title={t('pob.lifeboats.kpi.outOfService')}
          value={sum((c) => c.craft - c.inService)}
          tone={sum((c) => c.craft - c.inService) > 0 ? 'warning' : 'success'}
        />
        <StatCard title={t('pob.lifeboats.kpi.locations')} value={items.length} />
      </div>
      {items.length > 0 && (
        <p className="text-xs text-ink-secondary">
          {items
            .map((c) =>
              t('pob.lifeboats.kpi.location', {
                location: c.location.name,
                counted: c.countedCapacity,
              }),
            )
            .join(' · ')}
        </p>
      )}
    </div>
  );

  return (
    <>
      <MasterPage
        resource={resource}
        title={t('pob.lifeboats.title')}
        subtitle={t('pob.lifeboats.subtitle')}
        noun={t('pob.lifeboats.noun')}
        searchPlaceholder={t('pob.lifeboats.search')}
        describe={(b) => `${b.code} · ${b.name} · ${b.location.name}`}
        form={LifeboatForm}
        notice={<ApprovalNotice master="lifeboats" />}
        kpis={kpis}
        defaultSort={{ field: 'location', dir: 'asc' }}
        editable={(b) => b.pendingChange === null}
        columns={[
          {
            id: 'code',
            header: t('pob.lifeboats.columns.craft'),
            sortField: 'code',
            cell: (b) => (
              <div>
                <p className="font-medium text-ink">{b.name}</p>
                <p className="font-mono text-xs text-ink-secondary">{b.code}</p>
              </div>
            ),
          },
          {
            id: 'location',
            header: t('pob.columns.location'),
            sortField: 'location',
            cell: (b) => (
              <div>
                <p>{b.location.name}</p>
                {b.station && <p className="text-xs text-ink-secondary">{b.station}</p>}
              </div>
            ),
          },
          {
            id: 'type',
            header: t('pob.lifeboats.columns.type'),
            cell: (b) => t(`pob.lifeboats.craft.${b.craftType}`),
          },
          {
            id: 'capacity',
            header: t('pob.lifeboats.columns.capacity'),
            align: 'right',
            cell: (b) => b.ratedCapacity,
          },
          {
            id: 'certificate',
            header: t('pob.lifeboats.columns.certificate'),
            sortField: 'certificate',
            cell: (b) => {
              if (!b.certificateExpiresOn) return t('pob.lifeboats.notRecorded');
              const left = daysLeft(b.certificateExpiresOn);
              return (
                <div className="flex flex-col items-start gap-1">
                  <span>{formatGstDate(`${b.certificateExpiresOn}T00:00:00+04:00`)}</span>
                  {left < 0 ? (
                    <StatusPill tone="danger">{t('pob.lifeboats.expired')}</StatusPill>
                  ) : (
                    left < 60 && (
                      <StatusPill tone="warning">
                        {t('pob.lifeboats.expiresIn', { count: left })}
                      </StatusPill>
                    )
                  )}
                </div>
              );
            },
          },
        ]}
        status={(b) => (
          <PobStatus
            isActive={b.isActive}
            pending={b.pendingChange}
            state={
              b.isInService ? (
                <StatusPill tone="success">{t('pob.lifeboats.inService')}</StatusPill>
              ) : (
                <span title={b.outOfServiceReason ?? undefined}>
                  <StatusPill tone="danger">{t('pob.lifeboats.outOfService')}</StatusPill>
                </span>
              )
            }
          />
        )}
        actions={(b) => [
          editable(b) &&
            b.isActive &&
            b.isInService && {
              label: t('pob.lifeboats.takeOut'),
              run: () => setOutOf(b),
            },
          editable(b) &&
            !b.isInService && {
              label: t('pob.lifeboats.returnToService'),
              run: () => setReturning(b),
            },
        ]}
        filters={(list) => (
          <>
            <FilterSelect
              label={t('pob.columns.location')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.location}
              options={(options.data?.locations ?? []).map((l) => ({
                value: l.id,
                label: l.name,
              }))}
              onChange={(v) => setFilter(list, 'location', v)}
            />
            <FilterSelect
              label={t('pob.lifeboats.filters.service')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.inService}
              options={[
                { value: 'true', label: t('pob.lifeboats.inService') },
                { value: 'false', label: t('pob.lifeboats.outOfService') },
              ]}
              onChange={(v) => setFilter(list, 'inService', v)}
            />
            <FilterSelect
              label={t('pob.lifeboats.filters.certificate')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.expiring}
              options={[{ value: 'true', label: t('pob.lifeboats.filters.expiring') }]}
              onChange={(v) => setFilter(list, 'expiring', v)}
            />
          </>
        )}
      />
      <ConfirmDialog
        open={outOf !== null}
        onOpenChange={(open) => {
          if (!open) setOutOf(null);
        }}
        title={t('pob.lifeboats.takeOutTitle', {
          record: outOf ? `${outOf.code} · ${outOf.name}` : '',
        })}
        body={t('pob.lifeboats.takeOutBody')}
        confirmLabel={t('pob.lifeboats.takeOut')}
        onConfirm={async (reason) => {
          if (!outOf) return;
          await takeOutOfService(outOf, reason);
          await refresh();
        }}
      />
      <ConfirmDialog
        open={returning !== null}
        onOpenChange={(open) => {
          if (!open) setReturning(null);
        }}
        title={t('pob.returnTitle', {
          record: returning ? `${returning.code} · ${returning.name}` : '',
        })}
        body={t('pob.returnBody')}
        confirmLabel={t('pob.lifeboats.returnToService')}
        tone="primary"
        onConfirm={async (reason) => {
          if (!returning) return;
          report(await proposeReturnToUse('lifeboats', returning, reason));
          await refresh();
        }}
      />
    </>
  );
}

function LifeboatForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Lifeboat>) {
  const { t } = useTranslation();
  const options = useMasterOptions<LifeboatOptions>('lifeboats');
  const report = useReportProposal();
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    code: record
      ? z.string()
      : z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9-]{2,24}$/, t('pob.muster.form.codeInvalid')),
    name: z.string().trim().min(1, t('pob.muster.form.nameRequired')).max(100),
    locationId: z.string().min(1, t('pob.form.chooseLocation')),
    craftType: z.enum(CRAFT),
    station: z.string().max(100),
    ratedCapacity: wholeText(t('pob.form.numberInvalid'), 1).refine(
      (v) => v !== '',
      t('pob.lifeboats.form.capacityRequired'),
    ),
    certificateExpiresOn: z.string(),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      locationId: record?.location.id ?? '',
      craftType: record?.craftType ?? 'lifeboat',
      station: record?.station ?? '',
      ratedCapacity: toText(record?.ratedCapacity),
      certificateExpiresOn: record?.certificateExpiresOn ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const values = {
      name: v.name.trim(),
      craftType: v.craftType,
      station: toNullable(v.station),
      ratedCapacity: Number(v.ratedCapacity),
      certificateExpiresOn: v.certificateExpiresOn || null,
    };
    try {
      if (record) {
        const current: Record<string, unknown> = {
          name: record.name,
          craftType: record.craftType,
          station: record.station,
          ratedCapacity: record.ratedCapacity,
          certificateExpiresOn: record.certificateExpiresOn,
        };
        const changed = Object.fromEntries(
          Object.entries(values).filter(([k, value]) => value !== current[k]),
        );
        if (Object.keys(changed).length === 0) {
          setFailure(t('pob.form.noChange'));
          return;
        }
        report(await propose('lifeboats', record, changed));
      } else {
        report(
          await propose('lifeboats', null, {
            ...values,
            code: v.code.trim().toUpperCase(),
            locationId: v.locationId,
          }),
        );
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
          ? t('pob.lifeboats.form.editTitle', { name: `${record.code} · ${record.name}` })
          : t('pob.lifeboats.form.newTitle')
      }
      description={t('pob.form.approvalHint')}
      submitLabel={t('pob.form.submit')}
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('pob.muster.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <Field
          label={t('pob.muster.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <SelectField
          label={t('pob.columns.location')}
          error={errors.locationId?.message}
          disabled={record !== null}
          {...form.register('locationId')}
        >
          <option value="">{t('pob.form.chooseLocation')}</option>
          {(options.data?.locations ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('pob.lifeboats.columns.type')} {...form.register('craftType')}>
          {CRAFT.map((c) => (
            <option key={c} value={c}>
              {t(`pob.lifeboats.craft.${c}`)}
            </option>
          ))}
        </SelectField>
        <Field
          label={t('pob.lifeboats.form.station')}
          placeholder={t('pob.lifeboats.form.stationHint')}
          {...form.register('station')}
        />
        <Field
          label={t('pob.lifeboats.columns.capacity')}
          inputMode="numeric"
          error={errors.ratedCapacity?.message}
          {...form.register('ratedCapacity')}
        />
        <Field
          type="date"
          label={t('pob.lifeboats.columns.certificate')}
          {...form.register('certificateExpiresOn')}
        />
      </div>
    </EntityFormModal>
  );
}
