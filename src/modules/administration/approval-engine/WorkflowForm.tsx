import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, type UseFormReturn, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MODULES } from '../../../api/registry.generated';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { Modal } from '../../../shared/ui/modal';
import { Spinner } from '../../../shared/ui/spinner';
import type { Person } from '../delegations/delegations-api';
import { PersonPicker } from '../delegations/PersonPicker';
import type { MasterFormProps } from '../masters/master-page';
import { ConditionsEditor } from './ConditionsEditor';
import {
  amountProblem,
  type ConditionField,
  type ConditionsDraft,
  conditionsDraft,
  conditionsOf,
  describeConditions,
  EMPTY_CONDITION,
  newStage,
  type Processes,
  stageDraft,
  stageInput,
} from './workflow-draft';
import {
  saveWorkflow,
  useProcesses,
  useWorkflow,
  type Workflow,
  type WorkflowDetail,
} from './workflows-api';

const MAX_STAGES = 10;

const conditionDraftSchema = z.object({
  list: z.array(z.string()),
  text: z.string(),
  flag: z.enum(['', 'yes', 'no']),
  min: z.string(),
  max: z.string(),
});

/** The form's values and their messages; numbers stay text until saved. */
function formSchema(t: TFunction) {
  const stage = z
    .object({
      name: z.string().trim().min(1, t('approvals.form.stageNameRequired')).max(200),
      approverKind: z.enum(['role', 'user', 'rule']),
      roleCode: z.string(),
      user: z.custom<Person | null>(),
      rule: z.string(),
      mode: z.enum(['any', 'all']),
      slaHours: z
        .string()
        .regex(/^\d+$/, t('approvals.form.slaInvalid'))
        .refine((v) => Number(v) >= 1 && Number(v) <= 2160, t('approvals.form.slaInvalid')),
      reminderHours: z
        .string()
        .regex(/^\d*$/, t('approvals.form.reminderInvalid'))
        .refine(
          (v) => v === '' || (Number(v) >= 1 && Number(v) <= 720),
          t('approvals.form.reminderInvalid'),
        ),
      escalation: z.enum(['none', 'line_manager', 'role']),
      escalationRole: z.string(),
      skip: z.boolean(),
      skipCondition: z.record(z.string(), conditionDraftSchema),
    })
    .superRefine((value, ctx) => {
      const missing = (path: string) =>
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: t('approvals.form.approverRequired'),
        });
      if (value.approverKind === 'role' && !value.roleCode) missing('roleCode');
      if (value.approverKind === 'user' && !value.user) missing('user');
      if (value.approverKind === 'rule' && !value.rule) missing('rule');
      if (value.escalation === 'role' && !value.escalationRole) missing('escalationRole');
    });
  return z.object({
    code: z.string().regex(/^[a-z][a-z0-9-]{2,60}$/, t('approvals.form.codeInvalid')),
    name: z.string().trim().min(1, t('approvals.form.nameRequired')).max(200),
    process: z.string().min(1, t('approvals.form.processRequired')),
    conditions: z.record(z.string(), conditionDraftSchema),
    stages: z.array(stage).min(1).max(MAX_STAGES),
  });
}
type Values = z.infer<ReturnType<typeof formSchema>>;

/**
 * New approval workflow, or change one (spec 10 §3.1): its name, the conditions a request must
 * meet, and its ordered stages. A changed chain is saved as a new version; requests already
 * started keep theirs.
 */
export function WorkflowForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Workflow>) {
  const { t } = useTranslation();
  const catalogue = useProcesses();
  const detail = useWorkflow(record?.id ?? null);
  if (catalogue.data && (record === null || detail.data)) {
    return (
      <WorkflowFormBody
        open={open}
        onOpenChange={onOpenChange}
        catalogue={catalogue.data}
        detail={detail.data ?? null}
        onSaved={onSaved}
      />
    );
  }
  const failed = catalogue.error ?? detail.error;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record ? t('approvals.form.editTitle', { name: record.name }) : t('approvals.form.newTitle')
      }
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

function WorkflowFormBody({
  open,
  onOpenChange,
  catalogue,
  detail,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogue: Processes;
  detail: WorkflowDetail | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<string | null>(null);
  const processOf = (key: string) => catalogue.processes.find((p) => p.key === key);
  const chainOf = (values: Values, of: readonly ConditionField[]) => ({
    conditions: conditionsOf(of, values.conditions),
    stages: values.stages.map((s) => stageInput(of, s)),
  });

  const [defaults] = useState<Values>(() => {
    const active = detail?.versions.find((v) => v.status === 'active');
    return {
      code: detail?.code ?? '',
      name: detail?.name ?? '',
      process: detail?.process ?? '',
      conditions: conditionsDraft(active?.conditions),
      stages: active ? active.stages.map(stageDraft) : [newStage()],
    };
  });
  // What the active version holds, to tell whether a save changes the chain.
  const [initialChain] = useState(() =>
    detail
      ? JSON.stringify(chainOf(defaults, processOf(defaults.process)?.conditionFields ?? []))
      : '',
  );
  const form = useForm<Values>({ resolver: zodResolver(formSchema(t)), defaultValues: defaults });
  const {
    fields: stages,
    append,
    remove,
    move,
  } = useFieldArray({
    control: form.control,
    name: 'stages',
  });
  const { errors, isSubmitting } = form.formState;
  const process = processOf(useWatch({ control: form.control, name: 'process' }));
  const fields = process?.conditionFields ?? [];

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    const amounts = fields.filter((f) => f.type === 'amount');
    const badAmount = (draft: ConditionsDraft) =>
      amounts.some((f) => amountProblem(draft[f.key] ?? EMPTY_CONDITION) !== null);
    if (
      badAmount(values.conditions) ||
      values.stages.some((s) => s.skip && badAmount(s.skipCondition))
    ) {
      setFailure(t('approvals.form.fixAmounts'));
      return;
    }
    const chain = chainOf(values, fields);
    try {
      await saveWorkflow(detail, {
        code: values.code,
        name: values.name.trim(),
        process: values.process,
        chain,
        chainChanged: JSON.stringify(chain) !== initialChain,
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
      title={
        detail ? t('approvals.form.editTitle', { name: detail.name }) : t('approvals.form.newTitle')
      }
      {...(detail ? { description: t('approvals.form.versionNote') } : {})}
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label={t('approvals.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <div className="space-y-1">
          <Field
            label={t('approvals.form.code')}
            error={errors.code?.message}
            readOnly={detail !== null}
            {...form.register('code')}
          />
          <p className="text-xs text-ink-muted">{t('approvals.form.codeHint')}</p>
        </div>
        <SelectField
          label={t('approvals.form.process')}
          error={errors.process?.message}
          disabled={detail !== null}
          {...form.register('process')}
        >
          <option value="">{t('approvals.form.chooseProcess')}</option>
          {MODULES.map((module) => {
            const options = catalogue.processes.filter((p) => p.module === module.key);
            return (
              options.length > 0 && (
                <optgroup key={module.key} label={module.label}>
                  {options.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              )
            );
          })}
        </SelectField>
      </div>

      {process && (
        <Controller
          control={form.control}
          name="conditions"
          render={({ field }) => (
            <ConditionsEditor
              legend={t('approvals.form.conditions')}
              hint={t('approvals.form.conditionsHint')}
              fields={fields}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">{t('approvals.form.stages')}</legend>
        <p className="text-xs text-ink-muted">{t('approvals.form.stagesHint')}</p>
        <ol className="space-y-3">
          {stages.map((item, index) => (
            <li key={item.id} className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">
                  {t('approvals.form.stageN', { n: index + 1 })}
                </h3>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    aria-label={t('approvals.form.moveUp', { n: index + 1 })}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={t('approvals.form.moveDown', { n: index + 1 })}
                    disabled={index === stages.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={t('approvals.form.removeStage', { n: index + 1 })}
                    disabled={stages.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
              <StageFields form={form} index={index} catalogue={catalogue} fields={fields} />
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          disabled={stages.length >= MAX_STAGES}
          onClick={() => append(newStage())}
        >
          <Plus className="size-4" aria-hidden />
          {t('approvals.form.addStage')}
        </Button>
      </fieldset>

      {detail && <Versions detail={detail} catalogue={catalogue} />}
    </EntityFormModal>
  );
}

/** One stage's approver, timing, escalation and skip condition. */
function StageFields({
  form,
  index,
  catalogue,
  fields,
}: {
  form: UseFormReturn<Values>;
  index: number;
  catalogue: Processes;
  fields: readonly ConditionField[];
}) {
  const { t } = useTranslation();
  const stage = useWatch({ control: form.control, name: `stages.${index}` });
  const errors = form.formState.errors.stages?.[index];
  const roleOptions = catalogue.roles.map((r) => (
    <option key={r.code} value={r.code}>
      {r.name}
    </option>
  ));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label={t('approvals.form.stageName')}
          error={errors?.name?.message}
          {...form.register(`stages.${index}.name`)}
        />
        <SelectField
          label={t('approvals.form.approverKind')}
          {...form.register(`stages.${index}.approverKind`)}
        >
          {(['role', 'user', 'rule'] as const).map((kind) => (
            <option key={kind} value={kind}>
              {t(`approvals.approverKind.${kind}`)}
            </option>
          ))}
        </SelectField>
        {stage.approverKind === 'role' && (
          <SelectField
            label={t('approvals.form.role')}
            error={errors?.roleCode?.message}
            {...form.register(`stages.${index}.roleCode`)}
          >
            <option value="">{t('approvals.form.chooseRole')}</option>
            {roleOptions}
          </SelectField>
        )}
        {stage.approverKind === 'rule' && (
          <SelectField
            label={t('approvals.form.rule')}
            error={errors?.rule?.message}
            {...form.register(`stages.${index}.rule`)}
          >
            <option value="">{t('approvals.form.chooseRule')}</option>
            {catalogue.rules.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      {stage.approverKind === 'user' && (
        <Controller
          control={form.control}
          name={`stages.${index}.user`}
          render={({ field }) => (
            <PersonPicker
              label={t('approvals.form.person')}
              scope="mine"
              value={field.value}
              onChange={field.onChange}
              error={errors?.user?.message}
            />
          )}
        />
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <SelectField label={t('approvals.form.mode')} {...form.register(`stages.${index}.mode`)}>
          <option value="any">{t('approvals.mode.any')}</option>
          <option value="all">{t('approvals.mode.all')}</option>
        </SelectField>
        <Field
          label={t('approvals.form.slaHours')}
          inputMode="numeric"
          error={errors?.slaHours?.message}
          {...form.register(`stages.${index}.slaHours`)}
        />
        <div className="space-y-1">
          <Field
            label={t('approvals.form.reminderHours')}
            inputMode="numeric"
            error={errors?.reminderHours?.message}
            {...form.register(`stages.${index}.reminderHours`)}
          />
          <p className="text-xs text-ink-muted">{t('approvals.form.reminderHint')}</p>
        </div>
        <SelectField
          label={t('approvals.form.escalation')}
          {...form.register(`stages.${index}.escalation`)}
        >
          {(['none', 'line_manager', 'role'] as const).map((kind) => (
            <option key={kind} value={kind}>
              {t(`approvals.escalation.${kind}`)}
            </option>
          ))}
        </SelectField>
        {stage.escalation === 'role' && (
          <SelectField
            label={t('approvals.form.escalationRole')}
            error={errors?.escalationRole?.message}
            {...form.register(`stages.${index}.escalationRole`)}
          >
            <option value="">{t('approvals.form.chooseRole')}</option>
            {roleOptions}
          </SelectField>
        )}
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          {...form.register(`stages.${index}.skip`)}
        />
        {t('approvals.form.skip')}
      </label>
      {stage.skip && (
        <Controller
          control={form.control}
          name={`stages.${index}.skipCondition`}
          render={({ field }) => (
            <ConditionsEditor
              legend={t('approvals.form.skipWhen', { n: index + 1 })}
              hint={t('approvals.form.skipHint')}
              fields={fields}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}
    </div>
  );
}

/** Every version of the chain, newest first; requests stay on the one they started with. */
function Versions({ detail, catalogue }: { detail: WorkflowDetail; catalogue: Processes }) {
  const { t } = useTranslation();
  const process = catalogue.processes.find((p) => p.key === detail.process);
  return (
    <section aria-labelledby="workflow-versions" className="space-y-2">
      <h3 id="workflow-versions" className="text-sm font-semibold text-ink">
        {t('approvals.form.versions')}
      </h3>
      <p className="text-xs text-ink-muted">
        {t('approvals.form.requests', { count: detail.requests })}
      </p>
      <ol className="space-y-2">
        {detail.versions.map((v) => (
          <li key={v.versionNo} className="rounded-md border border-border px-3 py-2 text-sm">
            <p className="font-medium text-ink">
              {t('approvals.form.versionLine', {
                n: v.versionNo,
                status: t(`approvals.versionStatus.${v.status}`),
                at: formatGst(v.createdAt),
                by: v.createdBy ?? t('approvals.form.referenceSeed'),
              })}
            </p>
            <p className="text-ink-secondary">
              {v.stages.map((s) => s.approver.label).join(' → ')}
            </p>
            <p className="text-xs text-ink-muted">
              {describeConditions(process, v.conditions, {
                yes: t('approvals.conditions.yes'),
                no: t('approvals.conditions.no'),
                fallback: t('approvals.conditions.fallback'),
              })}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
