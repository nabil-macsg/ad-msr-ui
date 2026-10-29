import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { useReasonOptions } from '../reason-codes/reason-codes-api';
import { setFilter } from '../masters/filters';
import { toNumber, toText, wholeText } from '../masters/form-values';
import { useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import {
  makeUnavailable,
  type MusterPoint,
  type MusterPointOptions,
  propose,
  proposeReturnToUse,
} from './pob-api';
import { ApprovalNotice, PobStatus, ProposalScope } from './pob-bits';
import { usePobResource, useReportProposal } from './pob-context';

const MODES = ['helicopter', 'lifeboat', 'boat'] as const;
const ROLES = ['primary', 'alternate'] as const;
const PAGE = 'admin.muster-points';

/**
 * Muster points (spec 10 §5.3, BRD D.3.3.1): each location's points, its primary and its
 * alternates, how many each holds and how people leave from it. Changes need a second person;
 * a point goes out of use at once and comes back with approval (P-57).
 */
export default function MusterPointsPage() {
  return (
    <ProposalScope>
      <MusterPoints />
    </ProposalScope>
  );
}

function MusterPoints() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const resource = usePobResource<MusterPoint>('muster-points', PAGE);
  const options = useMasterOptions<MusterPointOptions>('muster-points');
  const report = useReportProposal();
  const queryClient = useQueryClient();
  const [unavailable, setUnavailable] = useState<MusterPoint | null>(null);
  const [returning, setReturning] = useState<MusterPoint | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: resource.queryKey });
  const editable = (m: MusterPoint) => can(access, PAGE, 'edit') && m.pendingChange === null;

  return (
    <>
      <MasterPage
        resource={resource}
        title={t('pob.muster.title')}
        subtitle={t('pob.muster.subtitle')}
        noun={t('pob.muster.noun')}
        searchPlaceholder={t('pob.muster.search')}
        describe={(m) => `${m.code} · ${m.name}`}
        form={MusterPointForm}
        notice={<ApprovalNotice master="muster-points" />}
        defaultSort={{ field: 'location', dir: 'asc' }}
        editable={(m) => m.pendingChange === null}
        columns={[
          {
            id: 'code',
            header: t('pob.muster.columns.point'),
            sortField: 'code',
            cell: (m) => (
              <div>
                <p className="font-medium text-ink">{m.name}</p>
                <p className="font-mono text-xs text-ink-secondary">{m.code}</p>
              </div>
            ),
          },
          {
            id: 'location',
            header: t('pob.columns.location'),
            sortField: 'location',
            cell: (m) => (
              <div>
                <p>{m.location.name}</p>
                {m.installation && (
                  <p className="text-xs text-ink-secondary">{m.installation.name}</p>
                )}
              </div>
            ),
          },
          {
            id: 'role',
            header: t('pob.muster.columns.role'),
            cell: (m) => (
              <StatusPill tone={m.role === 'primary' ? 'info' : 'neutral'}>
                {t(`pob.muster.role.${m.role}`)}
              </StatusPill>
            ),
          },
          {
            id: 'modes',
            header: t('pob.muster.columns.modes'),
            cell: (m) =>
              m.evacuationModes.length === 0
                ? t('pob.muster.musterOnly')
                : m.evacuationModes.map((mode) => t(`pob.muster.mode.${mode}`)).join(', '),
          },
          {
            id: 'capacity',
            header: t('pob.muster.columns.capacity'),
            align: 'right',
            cell: (m) => m.capacity ?? '—',
          },
        ]}
        status={(m) => (
          <PobStatus
            isActive={m.isActive}
            pending={m.pendingChange}
            state={
              m.isOperational ? (
                <StatusPill tone="success">{t('pob.muster.operational')}</StatusPill>
              ) : (
                <span title={m.unavailableReason ?? undefined}>
                  <StatusPill tone="danger">{t('pob.muster.unavailable')}</StatusPill>
                </span>
              )
            }
          />
        )}
        actions={(m) => [
          editable(m) &&
            m.isActive &&
            m.isOperational && {
              label: t('pob.muster.makeUnavailable'),
              run: () => setUnavailable(m),
            },
          editable(m) &&
            !m.isOperational && {
              label: t('pob.returnToUse'),
              run: () => setReturning(m),
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
              label={t('pob.muster.columns.role')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.role}
              options={ROLES.map((r) => ({ value: r, label: t(`pob.muster.role.${r}`) }))}
              onChange={(v) => setFilter(list, 'role', v)}
            />
            <FilterSelect
              label={t('pob.muster.filters.operational')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.operational}
              options={[
                { value: 'true', label: t('pob.muster.operational') },
                { value: 'false', label: t('pob.muster.unavailable') },
              ]}
              onChange={(v) => setFilter(list, 'operational', v)}
            />
          </>
        )}
      />
      {unavailable && (
        <UnavailableDialog
          point={unavailable}
          onClose={() => setUnavailable(null)}
          onDone={() => {
            setUnavailable(null);
            void refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={returning !== null}
        onOpenChange={(open) => {
          if (!open) setReturning(null);
        }}
        title={t('pob.returnTitle', {
          record: returning ? `${returning.code} · ${returning.name}` : '',
        })}
        body={t('pob.returnBody')}
        confirmLabel={t('pob.returnToUse')}
        tone="primary"
        onConfirm={async (reason) => {
          if (!returning) return;
          report(await proposeReturnToUse('muster-points', returning, reason));
          await refresh();
        }}
      />
    </>
  );
}

function UnavailableDialog({
  point,
  onClose,
  onDone,
}: {
  point: MusterPoint;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const reasons = useReasonOptions('muster-unavailability');
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    reasonCode: z.string(),
    reason: z.string().trim().min(3, t('pob.muster.reasonRequired')),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { reasonCode: '', reason: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    try {
      await makeUnavailable(point, v.reasonCode, v.reason.trim());
      onDone();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : t('ui.confirm.failed'));
    }
  });
  return (
    <EntityFormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('pob.muster.unavailableTitle', { record: `${point.code} · ${point.name}` })}
      description={t('pob.muster.unavailableBody')}
      submitLabel={t('pob.muster.makeUnavailable')}
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
    >
      <SelectField label={t('pob.muster.reasonCode')} {...form.register('reasonCode')}>
        <option value="">{t('pob.muster.chooseReason')}</option>
        {(reasons.data?.options ?? []).map((o) => (
          <option key={o.code} value={o.code}>
            {o.code} · {o.description}
          </option>
        ))}
      </SelectField>
      <Field
        label={t('pob.muster.reason')}
        error={errors.reason?.message}
        {...form.register('reason')}
      />
    </EntityFormModal>
  );
}

function MusterPointForm({ open, onOpenChange, record, onSaved }: MasterFormProps<MusterPoint>) {
  const { t } = useTranslation();
  const options = useMasterOptions<MusterPointOptions>('muster-points');
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
    installationId: z.string(),
    role: z.enum(ROLES),
    capacity: wholeText(t('pob.form.numberInvalid'), 1),
  });
  type Values = z.infer<typeof schema>;
  const [modes, setModes] = useState<string[]>(record ? [...record.evacuationModes] : []);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      locationId: record?.location.id ?? '',
      installationId: record?.installation?.id ?? '',
      role: record?.role ?? 'alternate',
      capacity: toText(record?.capacity),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const locationId = useWatch({ control: form.control, name: 'locationId' });
  const installations = (options.data?.installations ?? []).filter(
    (i) => i.locationId === locationId,
  );

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const values = {
      name: v.name.trim(),
      installationId: v.installationId || null,
      role: v.role,
      capacity: toNumber(v.capacity),
      evacuationModes: MODES.filter((m) => modes.includes(m)),
    };
    try {
      if (record) {
        const current = {
          name: record.name,
          installationId: record.installation?.id ?? null,
          role: record.role,
          capacity: record.capacity,
          evacuationModes: record.evacuationModes,
        };
        // Only what changed goes for approval.
        const changed = Object.fromEntries(
          Object.entries(values).filter(
            ([k, value]) =>
              JSON.stringify(value) !== JSON.stringify(current[k as keyof typeof current]),
          ),
        );
        if (Object.keys(changed).length === 0) {
          setFailure(t('pob.form.noChange'));
          return;
        }
        report(await propose('muster-points', record, changed));
      } else {
        report(
          await propose('muster-points', null, {
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
          ? t('pob.muster.form.editTitle', { name: record.name })
          : t('pob.muster.form.newTitle')
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
        <SelectField label={t('pob.muster.form.installation')} {...form.register('installationId')}>
          <option value="">{t('pob.form.none')}</option>
          {installations.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('pob.muster.columns.role')} {...form.register('role')}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`pob.muster.role.${r}`)}
            </option>
          ))}
        </SelectField>
        <Field
          label={t('pob.muster.columns.capacity')}
          inputMode="numeric"
          error={errors.capacity?.message}
          {...form.register('capacity')}
        />
      </div>
      <CheckboxList
        legend={t('pob.muster.columns.modes')}
        hint={t('pob.muster.form.modesHint')}
        options={MODES.map((m) => ({ value: m, label: t(`pob.muster.mode.${m}`) }))}
        selected={modes}
        onChange={setModes}
      />
    </EntityFormModal>
  );
}
