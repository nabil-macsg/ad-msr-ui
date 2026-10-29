import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MODULES } from '../../../api/registry.generated';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { Modal } from '../../../shared/ui/modal';
import { Spinner } from '../../../shared/ui/spinner';
import { ConditionsEditor } from '../approval-engine/ConditionsEditor';
import {
  amountProblem,
  type ConditionsDraft,
  conditionsDraft,
  conditionsOf,
  EMPTY_CONDITION,
} from '../approval-engine/workflow-draft';
import type { MasterFormProps } from '../masters/master-page';
import {
  gstMoment,
  type ParamProblem,
  type ParamsDraft,
  paramsDraft,
  paramsOf,
} from './param-draft';
import { useReasonOptions } from '../reason-codes/reason-codes-api';
import { ParametersEditor } from './ParametersEditor';
import {
  approveTask,
  returnTask,
  type Rule,
  type RuleDetail,
  type RuleType,
  type RuleTypes,
  saveRule,
  useRule,
  useRuleTypes,
  withdrawVersion,
} from './rules-api';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function formSchema(t: TFunction) {
  const moment = (enabled: boolean, date: string, time: string) =>
    !enabled || (DATE.test(date) && TIME.test(time));
  return z
    .object({
      code: z.string().regex(/^[a-z][a-z0-9-]{2,60}$/, t('rules.form.codeInvalid')),
      name: z.string().trim().min(1, t('rules.form.nameRequired')).max(200),
      type: z.string().min(1, t('rules.form.typeRequired')),
      priority: z
        .string()
        .regex(/^\d+$/, t('rules.form.priorityInvalid'))
        .refine((v) => Number(v) >= 1 && Number(v) <= 999, t('rules.form.priorityInvalid')),
      scheduled: z.boolean(),
      fromDate: z.string(),
      fromTime: z.string(),
      ends: z.boolean(),
      toDate: z.string(),
      toTime: z.string(),
      note: z.string().max(500),
      condition: z.custom<ConditionsDraft>(),
      parameters: z.custom<ParamsDraft>(),
    })
    .superRefine((v, ctx) => {
      if (!moment(v.scheduled, v.fromDate, v.fromTime)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fromDate'],
          message: t('rules.form.momentRequired'),
        });
      }
      if (!moment(v.ends, v.toDate, v.toTime)) {
        ctx.addIssue({ code: 'custom', path: ['toDate'], message: t('rules.form.momentRequired') });
      }
    });
}
type Values = z.infer<ReturnType<typeof formSchema>>;

/**
 * New business rule, or change one (spec 10 §3.2): its type, condition, typed parameters,
 * priority and effective dates. A change is a new version; a high-impact one waits for a Super
 * Admin's approval (ADR-0043), which is decided here too.
 */
export function RuleForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Rule>) {
  const { t } = useTranslation();
  const types = useRuleTypes();
  const detail = useRule(record?.id ?? null);
  if (types.data && (record === null || detail.data)) {
    return (
      <RuleFormBody
        open={open}
        onOpenChange={onOpenChange}
        catalogue={types.data}
        detail={detail.data ?? null}
        onSaved={onSaved}
      />
    );
  }
  const failed = types.error ?? detail.error;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={record ? t('rules.form.editTitle', { name: record.name }) : t('rules.form.newTitle')}
      size="lg"
    >
      {failed ? (
        <Banner tone="danger">
          {failed instanceof Error ? failed.message : t('masters.loadFailed')}
        </Banner>
      ) : (
        <Spinner label={t('loading')} />
      )}
    </Modal>
  );
}

function RuleFormBody({
  open,
  onOpenChange,
  catalogue,
  detail,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogue: RuleTypes;
  detail: RuleDetail | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, ParamProblem>>({});
  const typeOf = (key: string) => catalogue.types.find((ty) => ty.key === key);

  const [defaults] = useState<Values>(() => ({
    code: detail?.code ?? '',
    name: detail?.name ?? '',
    type: detail?.type ?? '',
    priority: String(detail?.priority ?? 100),
    scheduled: false,
    fromDate: '',
    fromTime: '',
    ends: false,
    toDate: '',
    toTime: '',
    note: '',
    condition: conditionsDraft(detail?.condition),
    parameters: paramsDraft(
      typeOf(detail?.type ?? '')?.parameterFields ?? [],
      detail?.parameters ?? null,
    ),
  }));
  const form = useForm<Values>({ resolver: zodResolver(formSchema(t)), defaultValues: defaults });
  const { errors, isSubmitting } = form.formState;
  const typeKey = useWatch({ control: form.control, name: 'type' });
  const scheduled = useWatch({ control: form.control, name: 'scheduled' });
  const ends = useWatch({ control: form.control, name: 'ends' });
  const type = typeOf(typeKey);
  const pending = detail?.versions.find((v) => v.status === 'pending') ?? null;

  const contentOf = (values: Values, of: RuleType | undefined) => ({
    condition: conditionsOf(of?.conditionFields ?? [], values.condition),
    parameters: paramsOf(of?.parameterFields ?? [], values.parameters),
    priority: Number(values.priority),
  });
  // The shown version's content, to tell whether a save changes the rule.
  const [initial] = useState(() => {
    const c = contentOf(defaults, typeOf(defaults.type));
    return JSON.stringify([c.condition, c.parameters.value, c.priority]);
  });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    if (!type) return;
    const amounts = type.conditionFields.filter((f) => f.type === 'amount');
    if (amounts.some((f) => amountProblem(values.condition[f.key] ?? EMPTY_CONDITION) !== null)) {
      setFailure(t('approvals.form.fixAmounts'));
      return;
    }
    const content = contentOf(values, type);
    setProblems(content.parameters.problems);
    if (Object.keys(content.parameters.problems).length > 0) return;
    const changed =
      values.scheduled ||
      values.ends ||
      JSON.stringify([content.condition, content.parameters.value, content.priority]) !== initial;
    try {
      await saveRule(detail, {
        code: values.code,
        name: values.name.trim(),
        type: type.key,
        version: {
          condition: content.condition,
          parameters: content.parameters.value,
          priority: content.priority,
          ...(values.scheduled
            ? { effectiveFrom: gstMoment(values.fromDate, values.fromTime) }
            : {}),
          effectiveTo: values.ends ? gstMoment(values.toDate, values.toTime) : null,
          ...(values.note.trim() ? { note: values.note.trim() } : {}),
        },
        versionChanged: detail === null || changed,
      });
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  });

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={detail ? t('rules.form.editTitle', { name: detail.name }) : t('rules.form.newTitle')}
      onSubmit={submit}
      submitting={isSubmitting || pending !== null}
      submitLabel={type?.highImpact ? t('rules.form.submitForApproval') : t('ui.save')}
      error={failure}
      size="lg"
    >
      {detail && pending && (
        <PendingVersion detail={detail} versionNo={pending.versionNo} onDone={onSaved} />
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label={t('rules.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <div className="space-y-1">
          <Field
            label={t('rules.form.code')}
            error={errors.code?.message}
            readOnly={detail !== null}
            {...form.register('code')}
          />
          <p className="text-xs text-ink-muted">{t('rules.form.codeHint')}</p>
        </div>
        <SelectField
          label={t('rules.form.type')}
          error={errors.type?.message}
          disabled={detail !== null}
          {...form.register('type', {
            onChange: (e: { target: { value: string } }) => {
              form.setValue('condition', {});
              form.setValue(
                'parameters',
                paramsDraft(typeOf(e.target.value)?.parameterFields ?? [], null),
              );
              setProblems({});
            },
          })}
        >
          <option value="">{t('rules.form.chooseType')}</option>
          {MODULES.map((module) => {
            const options = catalogue.types.filter((ty) => ty.module === module.key && ty.ready);
            return (
              options.length > 0 && (
                <optgroup key={module.key} label={module.label}>
                  {options.map((ty) => (
                    <option key={ty.key} value={ty.key}>
                      {ty.label}
                    </option>
                  ))}
                </optgroup>
              )
            );
          })}
        </SelectField>
      </div>

      {type && (
        <>
          <p className="text-sm text-ink-secondary">{type.description}</p>
          {type.highImpact && <Banner tone="warning">{t('rules.form.highImpact')}</Banner>}
          {type.conditionFields.length > 0 && (
            <Controller
              control={form.control}
              name="condition"
              render={({ field }) => (
                <ConditionsEditor
                  legend={t('rules.form.condition')}
                  hint={t('rules.form.conditionHint')}
                  fields={type.conditionFields}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          )}
          <Controller
            control={form.control}
            name="parameters"
            render={({ field }) => (
              <ParametersEditor
                fields={type.parameterFields}
                value={field.value}
                onChange={field.onChange}
                problems={problems}
              />
            )}
          />
        </>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Field
            label={t('rules.form.priority')}
            inputMode="numeric"
            error={errors.priority?.message}
            {...form.register('priority')}
          />
          <p className="text-xs text-ink-muted">{t('rules.form.priorityHint')}</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t('rules.form.starts')}</legend>
          <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              {...form.register('scheduled')}
            />
            {t('rules.form.scheduled')}
          </label>
          {scheduled && (
            <div className="grid grid-cols-2 gap-2">
              <Field
                type="date"
                label={t('rules.form.fromDate')}
                error={errors.fromDate?.message}
                {...form.register('fromDate')}
              />
              <Field type="time" label={t('rules.form.fromTime')} {...form.register('fromTime')} />
            </div>
          )}
          <p className="text-xs text-ink-muted">
            {type?.highImpact ? t('rules.form.startsHintApproval') : t('rules.form.startsHint')}
          </p>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t('rules.form.endsLegend')}</legend>
          <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-primary" {...form.register('ends')} />
            {t('rules.form.ends')}
          </label>
          {ends && (
            <div className="grid grid-cols-2 gap-2">
              <Field
                type="date"
                label={t('rules.form.toDate')}
                error={errors.toDate?.message}
                {...form.register('toDate')}
              />
              <Field type="time" label={t('rules.form.toTime')} {...form.register('toTime')} />
            </div>
          )}
        </fieldset>
      </div>
      <Field label={t('rules.form.note')} {...form.register('note')} />

      {detail && <Versions detail={detail} />}
    </EntityFormModal>
  );
}

/** The version awaiting approval: approve or return it (its approver), or withdraw it (editors). */
function PendingVersion({
  detail,
  versionNo,
  onDone,
}: {
  detail: RuleDetail;
  versionNo: number;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const [mode, setMode] = useState<'idle' | 'return' | 'withdraw'>('idle');
  const [reasonCode, setReasonCode] = useState('');
  // Approver Rejection reasons, from the central list (spec 10 §3.4).
  const reasons = useReasonOptions('approver-rejection', mode === 'return');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const task = detail.myTask;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ui.confirm.failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-labelledby="rule-pending"
      className="space-y-2 rounded-md border border-border p-3"
    >
      <h3 id="rule-pending" className="text-sm font-semibold text-ink">
        {t('rules.pending.title', { n: versionNo })}
      </h3>
      <p className="text-sm text-ink-secondary">
        {task ? t('rules.pending.yours') : t('rules.pending.waiting')}
      </p>
      {error && <Banner tone="danger">{error}</Banner>}
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {task && (
            <>
              <Button disabled={busy} onClick={() => void run(() => approveTask(task))}>
                {t('rules.pending.approve')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setMode('return')}>
                {t('rules.pending.return')}
              </Button>
            </>
          )}
          {can(access, 'admin.business-rules', 'edit') && (
            <Button variant="secondary" disabled={busy} onClick={() => setMode('withdraw')}>
              {t('rules.pending.withdraw')}
            </Button>
          )}
        </div>
      )}
      {mode === 'return' && task && (
        <div className="grid gap-2 md:grid-cols-3">
          <SelectField
            label={t('rules.pending.reasonCode')}
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
          >
            <option value="">{t('rules.pending.chooseReason')}</option>
            {(reasons.data?.options ?? []).map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} · {o.description}
              </option>
            ))}
          </SelectField>
          <Field
            className="md:col-span-2"
            label={t('rules.pending.comment')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2 md:col-span-3">
            <Button
              disabled={busy || reasonCode.trim().length < 2 || text.trim().length < 3}
              onClick={() => void run(() => returnTask(task, reasonCode.trim(), text.trim()))}
            >
              {t('rules.pending.confirmReturn')}
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              {t('ui.cancel')}
            </Button>
          </div>
        </div>
      )}
      {mode === 'withdraw' && (
        <div className="grid gap-2 md:grid-cols-3">
          <Field
            className="md:col-span-2"
            label={t('rules.pending.reason')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-end gap-2">
            <Button
              disabled={busy || text.trim().length < 3}
              onClick={() => void run(() => withdrawVersion(detail, versionNo, text.trim()))}
            >
              {t('rules.pending.confirmWithdraw')}
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              {t('ui.cancel')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Every version, newest first. */
function Versions({ detail }: { detail: RuleDetail }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="rule-versions" className="space-y-2">
      <h3 id="rule-versions" className="text-sm font-semibold text-ink">
        {t('rules.form.versions')}
      </h3>
      <ol className="space-y-2">
        {detail.versions.map((v) => (
          <li key={v.versionNo} className="rounded-md border border-border px-3 py-2 text-sm">
            <p className="font-medium text-ink">
              {t('rules.form.versionLine', {
                n: v.versionNo,
                status: v.inEffect
                  ? t('rules.versionStatus.inEffect')
                  : t(`rules.versionStatus.${v.status}`),
                by: v.createdBy ?? t('rules.form.referenceSeed'),
                at: formatGst(v.createdAt),
              })}
            </p>
            <p className="text-ink-secondary">{v.summary}</p>
            <p className="text-xs text-ink-muted">
              {v.effectiveTo
                ? t('rules.form.window', {
                    from: formatGst(v.startsAt),
                    to: formatGst(v.effectiveTo),
                  })
                : t('rules.form.from', { from: formatGst(v.startsAt) })}
              {v.note ? ` · ${v.note}` : ''}
              {v.decidedReason && v.status !== 'approved' ? ` · ${v.decidedReason}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
