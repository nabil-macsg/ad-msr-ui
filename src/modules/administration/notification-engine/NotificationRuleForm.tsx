import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, type UseFormReturn, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MODULES } from '../../../api/registry.generated';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField, TextAreaField } from '../../../shared/ui/field';
import { Modal } from '../../../shared/ui/modal';
import { Spinner } from '../../../shared/ui/spinner';
import { ConditionsEditor } from '../approval-engine/ConditionsEditor';
import {
  type ConditionsDraft,
  conditionsDraft,
  conditionsOf,
} from '../approval-engine/workflow-draft';
import type { Person } from '../delegations/delegations-api';
import { PersonPicker } from '../delegations/PersonPicker';
import type { MasterFormProps } from '../masters/master-page';
import {
  type Channel,
  type NotificationRule,
  preview,
  type RuleDetail,
  saveRule,
  type Templates,
  type Trigger,
  type TriggerKey,
  type Triggers,
  useRule,
  useTriggers,
} from './engine-api';

const CHANNELS: readonly Channel[] = ['in_app', 'email', 'sms', 'push'];
/** The parts each channel's template has (spec 10 §3.3). */
const PARTS: Record<Channel, readonly ('subject' | 'title' | 'body')[]> = {
  in_app: ['title', 'body'],
  email: ['subject', 'body'],
  sms: ['body'],
  push: ['title'],
};
type TemplateDraft = Record<Channel, { subject: string; title: string; body: string }>;

function formSchema(t: TFunction) {
  return z
    .object({
      code: z.string().regex(/^[a-z][a-z0-9-]{2,60}$/, t('engine.form.codeInvalid')),
      name: z.string().trim().min(1, t('engine.form.nameRequired')).max(200),
      trigger: z.string().min(1, t('engine.form.triggerRequired')),
      frequency: z.enum(['immediate', 'digest', 'recurring']),
      everyDays: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
      channels: z
        .array(z.enum(['in_app', 'email', 'sms', 'push']))
        .min(1, t('engine.form.channelsRequired')),
      people: z.array(z.string()),
      roles: z.array(z.string()),
      users: z.custom<Person[]>(),
      emails: z.string(),
      filter: z.custom<ConditionsDraft>(),
      templates: z.custom<TemplateDraft>(),
    })
    .superRefine((v, ctx) => {
      const n = Number(v.everyDays);
      if (v.frequency === 'recurring' && !(Number.isInteger(n) && n >= 1 && n <= 365)) {
        ctx.addIssue({
          code: 'custom',
          path: ['everyDays'],
          message: t('engine.form.everyDaysInvalid'),
        });
      }
    });
}
type Values = z.infer<ReturnType<typeof formSchema>>;

const splitEmails = (text: string) => [
  ...new Set(
    text
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean),
  ),
];

const templatesOf = (channels: readonly Channel[], draft: TemplateDraft): Templates =>
  Object.fromEntries(
    channels.map((c) => [c, Object.fromEntries(PARTS[c].map((part) => [part, draft[c][part]]))]),
  );

/**
 * New notification rule, or change one (spec 10 §3.3): its trigger and payload filter, frequency,
 * channels, recipients and a template per channel, with a live preview.
 */
export function NotificationRuleForm({
  open,
  onOpenChange,
  record,
  onSaved,
}: MasterFormProps<NotificationRule>) {
  const { t } = useTranslation();
  const triggers = useTriggers();
  const detail = useRule(record?.id ?? null);
  if (triggers.data && (record === null || detail.data)) {
    return (
      <RuleFormBody
        open={open}
        onOpenChange={onOpenChange}
        catalogue={triggers.data}
        detail={detail.data ?? null}
        onSaved={onSaved}
      />
    );
  }
  const failed = triggers.error ?? detail.error;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={record ? t('engine.form.editTitle', { name: record.name }) : t('engine.form.newTitle')}
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
  catalogue: Triggers;
  detail: RuleDetail | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<string | null>(null);
  const [defaults] = useState<Values>(() => {
    const templates = Object.fromEntries(
      CHANNELS.map((c) => {
        const saved = detail?.templates[c];
        return [
          c,
          { subject: saved?.subject ?? '', title: saved?.title ?? '', body: saved?.body ?? '' },
        ];
      }),
    ) as TemplateDraft;
    return {
      code: detail?.code ?? '',
      name: detail?.name ?? '',
      trigger: detail?.trigger ?? '',
      frequency: detail?.frequency ?? 'immediate',
      everyDays: detail?.everyDays ? String(detail.everyDays) : '',
      severity: detail?.severity ?? 'info',
      channels: detail?.channels ?? ['in_app', 'email'],
      people: detail?.recipients.people ?? [],
      roles: detail?.recipients.roles ?? [],
      users: (detail?.namedUsers ?? []).map((u) => ({ ...u, organisation: null })),
      emails: (detail?.recipients.emails ?? []).join(', '),
      filter: conditionsDraft(detail?.filter),
      templates,
    };
  });
  const form = useForm<Values>({ resolver: zodResolver(formSchema(t)), defaultValues: defaults });
  const { errors, isSubmitting } = form.formState;
  const triggerKey = useWatch({ control: form.control, name: 'trigger' });
  const frequency = useWatch({ control: form.control, name: 'frequency' });
  const channels = useWatch({ control: form.control, name: 'channels' });
  const trigger = catalogue.triggers.find((tr) => tr.key === triggerKey);

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    if (!trigger) return;
    try {
      await saveRule(detail, {
        code: values.code,
        trigger: trigger.key,
        name: values.name.trim(),
        filter: conditionsOf(trigger.filterFields, values.filter),
        frequency: values.frequency,
        everyDays: values.frequency === 'recurring' ? Number(values.everyDays) : null,
        channels: values.channels,
        recipients: {
          people: values.people,
          roles: values.roles,
          users: values.users.map((u) => u.userId),
          emails: splitEmails(values.emails),
        },
        severity: values.severity,
        templates: templatesOf(values.channels, values.templates),
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
      title={detail ? t('engine.form.editTitle', { name: detail.name }) : t('engine.form.newTitle')}
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label={t('engine.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <div className="space-y-1">
          <Field
            label={t('engine.form.code')}
            error={errors.code?.message}
            readOnly={detail !== null}
            {...form.register('code')}
          />
          <p className="text-xs text-ink-muted">{t('engine.form.codeHint')}</p>
        </div>
        <SelectField
          label={t('engine.form.trigger')}
          error={errors.trigger?.message}
          disabled={detail !== null}
          {...form.register('trigger', {
            onChange: () => {
              form.setValue('filter', {});
              form.setValue('people', []);
            },
          })}
        >
          <option value="">{t('engine.form.chooseTrigger')}</option>
          {MODULES.map((module) => {
            const options = catalogue.triggers.filter((tr) => tr.module === module.key);
            return (
              options.length > 0 && (
                <optgroup key={module.key} label={module.label}>
                  {options.map((tr) => (
                    <option key={tr.key} value={tr.key}>
                      {tr.live
                        ? tr.label
                        : t('engine.form.fromPhase', { label: tr.label, phase: tr.phase })}
                    </option>
                  ))}
                </optgroup>
              )
            );
          })}
        </SelectField>
      </div>

      {trigger && (
        <>
          {!trigger.live && (
            <Banner tone="info">{t('engine.form.waits', { phase: trigger.phase })}</Banner>
          )}
          {trigger.mandatory && <Banner tone="info">{t('engine.form.mandatory')}</Banner>}
          {trigger.filterFields.length > 0 && (
            <Controller
              control={form.control}
              name="filter"
              render={({ field }) => (
                <ConditionsEditor
                  legend={t('engine.form.filter')}
                  hint={t('engine.form.filterHint')}
                  fields={trigger.filterFields}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label={t('engine.form.frequency')} {...form.register('frequency')}>
              {(['immediate', 'digest', 'recurring'] as const).map((f) => (
                <option key={f} value={f}>
                  {t(`engine.frequency.${f}`)}
                </option>
              ))}
            </SelectField>
            {frequency === 'recurring' && (
              <Field
                label={t('engine.form.everyDays')}
                inputMode="numeric"
                error={errors.everyDays?.message}
                {...form.register('everyDays')}
              />
            )}
            <SelectField label={t('engine.form.severity')} {...form.register('severity')}>
              {(['info', 'warning', 'critical'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`engine.severity.${s}`)}
                </option>
              ))}
            </SelectField>
          </div>
          <Controller
            control={form.control}
            name="channels"
            render={({ field }) => (
              <div className="space-y-1">
                <CheckboxList
                  legend={t('engine.form.channels')}
                  options={CHANNELS.map((c) => ({ value: c, label: t(`engine.channel.${c}`) }))}
                  selected={field.value}
                  onChange={(selected) =>
                    field.onChange(CHANNELS.filter((c) => selected.includes(c)))
                  }
                />
                {errors.channels?.message && (
                  <p role="alert" className="text-sm text-danger-fg">
                    {errors.channels.message}
                  </p>
                )}
              </div>
            )}
          />
          <Recipients form={form} trigger={trigger} catalogue={catalogue} />
          <TemplatesEditor form={form} trigger={trigger} channels={channels} />
        </>
      )}
    </EntityFormModal>
  );
}

/** People found from the event, roles, named users and (Super Admins only) addresses. */
function Recipients({
  form,
  trigger,
  catalogue,
}: {
  form: UseFormReturn<Values>;
  trigger: Trigger;
  catalogue: Triggers;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">{t('engine.form.recipients')}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        <Controller
          control={form.control}
          name="people"
          render={({ field }) => (
            <CheckboxList
              legend={t('engine.form.people')}
              hint={t('engine.form.peopleHint')}
              options={trigger.recipients.map((r) => ({ value: r.key, label: r.label }))}
              selected={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="roles"
          render={({ field }) => (
            <CheckboxList
              legend={t('engine.form.roles')}
              hint={t('engine.form.rolesHint')}
              options={catalogue.roles.map((r) => ({ value: r.code, label: r.name }))}
              selected={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="users"
        render={({ field }) => (
          <div className="space-y-2">
            {field.value.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label={t('engine.form.namedUsers')}>
                {field.value.map((u) => (
                  <li
                    key={u.userId}
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm"
                  >
                    {u.name}
                    <Button
                      variant="ghost"
                      aria-label={t('engine.form.removeUser', { name: u.name })}
                      onClick={() =>
                        field.onChange(field.value.filter((x) => x.userId !== u.userId))
                      }
                    >
                      <X className="size-3.5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <PersonPicker
              label={t('engine.form.addUser')}
              scope="mine"
              value={null}
              onChange={(person) => {
                if (person && !field.value.some((u) => u.userId === person.userId)) {
                  field.onChange([...field.value, person]);
                }
              }}
            />
          </div>
        )}
      />
      <div className="space-y-1">
        <Field label={t('engine.form.emails')} {...form.register('emails')} />
        <p className="text-xs text-ink-muted">{t('engine.form.emailsHint')}</p>
      </div>
    </fieldset>
  );
}

/** A template per chosen channel, the placeholders the trigger gives, and a live preview. */
function TemplatesEditor({
  form,
  trigger,
  channels,
}: {
  form: UseFormReturn<Values>;
  trigger: Trigger;
  channels: readonly Channel[];
}) {
  const { t } = useTranslation();
  const templates = useWatch({ control: form.control, name: 'templates' });
  const draft = templatesOf(channels, templates);
  const key = JSON.stringify([trigger.key, channels, draft]);
  const [debounced, setDebounced] = useState(key);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(key), 400);
    return () => window.clearTimeout(timer);
  }, [key]);
  const live = useQuery({
    queryKey: ['notification-engine', 'preview', debounced],
    queryFn: () => {
      const [triggerKey, chosen, body] = JSON.parse(debounced) as [
        TriggerKey,
        Channel[],
        Templates,
      ];
      return preview(triggerKey, chosen, body);
    },
    enabled: channels.length > 0,
  });

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">{t('engine.form.templates')}</legend>
      <div className="space-y-1">
        <p className="text-xs text-ink-muted">{t('engine.form.placeholders')}</p>
        <ul className="flex flex-wrap gap-1" aria-label={t('engine.form.placeholderList')}>
          {trigger.fields.map((f) => (
            <li
              key={f.key}
              className="rounded bg-surface-muted px-2 py-0.5 font-mono text-xs text-ink"
            >
              {`{{${f.key}}}`} <span className="font-sans text-ink-secondary">{f.label}</span>
            </li>
          ))}
        </ul>
      </div>
      {channels.map((channel) => (
        <div key={channel} className="space-y-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold text-ink">{t(`engine.channel.${channel}`)}</h3>
          {PARTS[channel].map((part) =>
            part === 'body' ? (
              <TextAreaField
                key={part}
                label={t(`engine.form.part.${part}`, { channel: t(`engine.channel.${channel}`) })}
                {...form.register(`templates.${channel}.${part}`)}
              />
            ) : (
              <Field
                key={part}
                label={t(`engine.form.part.${part}`, { channel: t(`engine.channel.${channel}`) })}
                {...form.register(`templates.${channel}.${part}`)}
              />
            ),
          )}
          {live.data?.rendered[channel] && (
            <div className="rounded-md bg-surface-muted p-2 text-sm" aria-live="polite">
              <p className="text-xs font-medium text-ink-secondary">{t('engine.form.preview')}</p>
              {PARTS[channel].map((part) => (
                <p
                  key={part}
                  className={
                    part === 'body' ? 'whitespace-pre-line text-ink' : 'font-medium text-ink'
                  }
                >
                  {live.data.rendered[channel]?.[part]}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
      {live.data && live.data.problems.length > 0 && (
        <Banner tone="warning">
          <ul className="list-disc space-y-1 pl-4">
            {live.data.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Banner>
      )}
    </fieldset>
  );
}
