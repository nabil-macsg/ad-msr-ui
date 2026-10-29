import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { gstDayKey } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { Drawer } from '../../../shared/ui/drawer';
import { EmptyState } from '../../../shared/ui/empty-state';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField, TextAreaField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { setFilter } from '../masters/filters';
import { toNumber, toNullable, toText, wholeText } from '../masters/form-values';
import { useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import {
  type EssentialOptions,
  type EssentialPosition,
  propose,
  useTimeline,
  useUnmapped,
} from './pob-api';
import { ApprovalNotice, PobStatus, ProposalScope } from './pob-bits';
import { usePobResource, useReportProposal } from './pob-context';

const CLASSES = ['essential', 'non-essential'] as const;
const CRITICALITY = ['low', 'medium', 'high'] as const;
const PAGE = 'admin.essential-positions';

const formatDay = (day: string) =>
  new Date(`${day}T00:00:00+04:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  });

/**
 * Essential positions (spec 10 §5.3, BRD B.3.7): whether each designation is essential at each
 * site. Changes apply forward only, from today or a later day, so the record of who was
 * essential when is never rewritten; a designation can be classified at many sites at once,
 * one change per site (P-58).
 */
export default function EssentialPositionsPage() {
  return (
    <ProposalScope>
      <EssentialPositions />
    </ProposalScope>
  );
}

function EssentialPositions() {
  const { t } = useTranslation();
  const resource = usePobResource<EssentialPosition>('essential-positions', PAGE);
  const options = useMasterOptions<EssentialOptions>('essential-positions');
  const [timelineOf, setTimelineOf] = useState<EssentialPosition | null>(null);

  return (
    <>
      <MasterPage
        resource={resource}
        title={t('pob.essential.title')}
        subtitle={t('pob.essential.subtitle')}
        noun={t('pob.essential.noun')}
        searchPlaceholder={t('pob.essential.search')}
        describe={(e) => `${e.designation} · ${e.location.name}`}
        form={EssentialPositionForm}
        notice={<ApprovalNotice master="essential-positions" />}
        defaultSort={{ field: 'location', dir: 'asc' }}
        editable={(e) => e.pendingChange === null}
        tabs={{
          label: t('pob.essential.tabs.mappings'),
          others: [
            {
              value: 'unmapped',
              label: t('pob.essential.tabs.unmapped'),
              content: <UnmappedTab />,
            },
          ],
        }}
        columns={[
          {
            id: 'designation',
            header: t('pob.essential.columns.designation'),
            sortField: 'designation',
            cell: (e) => <p className="font-medium text-ink">{e.designation}</p>,
          },
          {
            id: 'location',
            header: t('pob.columns.location'),
            sortField: 'location',
            cell: (e) => e.location.name,
          },
          {
            id: 'classification',
            header: t('pob.essential.columns.classification'),
            sortField: 'classification',
            cell: (e) => (
              <StatusPill tone={e.classification === 'essential' ? 'info' : 'neutral'}>
                {t(`pob.essential.class.${e.classification}`)}
              </StatusPill>
            ),
          },
          {
            id: 'minCount',
            header: t('pob.essential.columns.minCount'),
            align: 'right',
            cell: (e) => e.minCount ?? '—',
          },
          {
            id: 'criticality',
            header: t('pob.essential.columns.criticality'),
            cell: (e) => (e.criticality ? t(`pob.essential.criticality.${e.criticality}`) : '—'),
          },
          {
            id: 'effectiveFrom',
            header: t('pob.essential.columns.effectiveFrom'),
            sortField: 'effectiveFrom',
            cell: (e) => (
              <div className="flex flex-col items-start gap-1">
                <span>{formatDay(e.effectiveFrom)}</span>
                {!e.inForce && <StatusPill tone="info">{t('pob.essential.scheduled')}</StatusPill>}
              </div>
            ),
          },
        ]}
        status={(e) => <PobStatus isActive={e.isActive} pending={e.pendingChange} />}
        actions={(e) => [{ label: t('pob.essential.timeline'), run: () => setTimelineOf(e) }]}
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
              label={t('pob.essential.columns.classification')}
              allLabel={t('ui.filter.all')}
              value={list.params.filters.classification}
              options={CLASSES.map((c) => ({ value: c, label: t(`pob.essential.class.${c}`) }))}
              onChange={(v) => setFilter(list, 'classification', v)}
            />
          </>
        )}
      />
      {timelineOf && <TimelineDrawer position={timelineOf} onClose={() => setTimelineOf(null)} />}
    </>
  );
}

function TimelineDrawer({
  position,
  onClose,
}: {
  position: EssentialPosition;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const timeline = useTimeline(position.id);
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('pob.essential.timelineOf', {
        record: `${position.designation} · ${position.location.name}`,
      })}
      description={t('pob.essential.timelineHint')}
    >
      <ol className="space-y-3">
        {(timeline.data?.items ?? []).map((row) => (
          <li key={row.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <StatusPill tone={row.classification === 'essential' ? 'info' : 'neutral'}>
                {t(`pob.essential.class.${row.classification}`)}
              </StatusPill>
              <span className="text-sm text-ink-secondary">
                {row.effectiveTo
                  ? t('pob.essential.period', {
                      from: formatDay(row.effectiveFrom),
                      to: formatDay(row.effectiveTo),
                    })
                  : t('pob.essential.since', { from: formatDay(row.effectiveFrom) })}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-secondary">
              {[
                row.minCount !== null && t('pob.essential.min', { count: row.minCount }),
                row.criticality && t(`pob.essential.criticality.${row.criticality}`),
                row.notes,
              ]
                .filter(Boolean)
                .join(' · ') || t('pob.essential.noDetail')}
            </p>
          </li>
        ))}
      </ol>
    </Drawer>
  );
}

/** Designations known elsewhere with no classification here (BRD B.3.7-04). */
function UnmappedTab() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const options = useMasterOptions<EssentialOptions>('essential-positions');
  const [location, setLocation] = useState<string | undefined>(undefined);
  const unmapped = useUnmapped(location);
  const [classify, setClassify] = useState<string | null>(null);
  const canCreate = can(access, PAGE, 'create');
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">{t('pob.essential.unmappedHint')}</p>
      <FilterSelect
        label={t('pob.columns.location')}
        allLabel={t('pob.form.chooseLocation')}
        value={location}
        options={(options.data?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))}
        onChange={setLocation}
      />
      {location === undefined ? null : unmapped.data && unmapped.data.items.length === 0 ? (
        <EmptyState title={t('pob.essential.allMapped')} />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(unmapped.data?.items ?? []).map((item) => (
            <li
              key={item.designation}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
            >
              <div>
                <p className="font-medium text-ink">{item.designation}</p>
                <p className="text-xs text-ink-secondary">
                  <StatusPill tone="warning">{t('pob.essential.unmapped')}</StatusPill>{' '}
                  {t('pob.essential.mappedAt', { count: item.sitesMapped })}
                </p>
              </div>
              {canCreate && (
                <Button variant="secondary" onClick={() => setClassify(item.designation)}>
                  {t('pob.essential.classifyHere')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {classify && location && (
        <EssentialPositionForm
          open
          onOpenChange={(open) => {
            if (!open) setClassify(null);
          }}
          record={null}
          initial={{ designation: classify, locationIds: [location] }}
          onSaved={() => {
            setClassify(null);
            void unmapped.refetch();
          }}
        />
      )}
    </div>
  );
}

function EssentialPositionForm({
  open,
  onOpenChange,
  record,
  onSaved,
  initial,
}: MasterFormProps<EssentialPosition> & {
  initial?: { designation: string; locationIds: string[] };
}) {
  const { t } = useTranslation();
  const options = useMasterOptions<EssentialOptions>('essential-positions');
  const report = useReportProposal();
  const [failure, setFailure] = useState<string | null>(null);
  const today = gstDayKey(new Date());
  const [sites, setSites] = useState<string[]>(initial?.locationIds ?? []);
  const schema = z.object({
    designation: record
      ? z.string()
      : z.string().trim().min(1, t('pob.essential.form.designationRequired')).max(120),
    classification: z.enum(CLASSES),
    minCount: wholeText(t('pob.form.numberInvalid')),
    criticality: z.enum(['', ...CRITICALITY]),
    notes: z.string().max(1000),
    effectiveFrom: z
      .string()
      .refine((v) => v === '' || v >= today, t('pob.essential.form.notBackdated')),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      designation: record?.designation ?? initial?.designation ?? '',
      classification: record?.classification ?? 'essential',
      minCount: toText(record?.minCount),
      criticality: record?.criticality ?? '',
      notes: record?.notes ?? '',
      effectiveFrom: '',
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const values = {
      classification: v.classification,
      minCount: toNumber(v.minCount),
      criticality: v.criticality === '' ? null : v.criticality,
      notes: toNullable(v.notes),
    };
    const from = v.effectiveFrom ? { effectiveFrom: v.effectiveFrom } : {};
    try {
      if (record) {
        const current: Record<string, unknown> = {
          classification: record.classification,
          minCount: record.minCount,
          criticality: record.criticality,
          notes: record.notes,
        };
        const changed = Object.fromEntries(
          Object.entries(values).filter(([k, value]) => value !== current[k]),
        );
        if (Object.keys(changed).length === 0) {
          setFailure(t('pob.form.noChange'));
          return;
        }
        report(await propose('essential-positions', record, { ...changed, ...from }));
      } else {
        if (sites.length === 0) {
          setFailure(t('pob.essential.form.chooseSites'));
          return;
        }
        report(
          await propose('essential-positions', null, {
            ...values,
            ...from,
            designation: v.designation.trim(),
            locationIds: sites,
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
          ? t('pob.essential.form.editTitle', {
              name: `${record.designation} · ${record.location.name}`,
            })
          : t('pob.essential.form.newTitle')
      }
      description={t('pob.form.approvalHint')}
      submitLabel={t('pob.form.submit')}
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      {!record && (
        <>
          <Field
            label={t('pob.essential.columns.designation')}
            list="essential-designations"
            error={errors.designation?.message}
            {...form.register('designation')}
          />
          <datalist id="essential-designations">
            {(options.data?.designations ?? []).map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <CheckboxList
            legend={t('pob.essential.form.sites')}
            hint={t('pob.essential.form.sitesHint')}
            options={(options.data?.locations ?? []).map((l) => ({
              value: l.id,
              label: l.name,
            }))}
            selected={sites}
            onChange={setSites}
          />
        </>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label={t('pob.essential.columns.classification')}
          {...form.register('classification')}
        >
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {t(`pob.essential.class.${c}`)}
            </option>
          ))}
        </SelectField>
        <Field
          label={t('pob.essential.columns.minCount')}
          inputMode="numeric"
          error={errors.minCount?.message}
          {...form.register('minCount')}
        />
        <SelectField
          label={t('pob.essential.columns.criticality')}
          {...form.register('criticality')}
        >
          <option value="">{t('pob.form.none')}</option>
          {CRITICALITY.map((c) => (
            <option key={c} value={c}>
              {t(`pob.essential.criticality.${c}`)}
            </option>
          ))}
        </SelectField>
        <Field
          type="date"
          min={today}
          label={t('pob.essential.form.effectiveFrom')}
          error={errors.effectiveFrom?.message}
          {...form.register('effectiveFrom')}
        />
      </div>
      <TextAreaField label={t('pob.essential.form.notes')} {...form.register('notes')} />
      <Banner tone="info">{t('pob.essential.form.forwardOnly')}</Banner>
    </EntityFormModal>
  );
}
