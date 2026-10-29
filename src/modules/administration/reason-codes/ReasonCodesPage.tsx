import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MODULES } from '../../../api/registry.generated';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField, TextAreaField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import {
  acceptRequest,
  codesResource,
  declineRequest,
  REASONS_KEY,
  type ReasonCode,
  type ReasonContext,
  type ReasonRequest,
  saveCode,
  setMandatory,
  submitRequest,
  useContexts,
  useRequests,
} from './reason-codes-api';

const MODULE_LABEL = new Map<string, string>(MODULES.map((m) => [m.key, m.label]));
const CODE = /^[A-Za-z][A-Za-z0-9]*(-[A-Za-z0-9]+)*$/;
const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-secondary';

function ContextSelect({
  contexts,
  disabled,
  ...props
}: { contexts: readonly ReasonContext[]; disabled?: boolean } & React.ComponentProps<
  typeof SelectField
>) {
  const { t } = useTranslation();
  return (
    <SelectField disabled={disabled} {...props}>
      <option value="">{t('reasons.form.chooseContext')}</option>
      {contexts.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </SelectField>
  );
}

/** New code, or change one: its description and flags (context and code are permanent). */
function CodeForm({ open, onOpenChange, record, onSaved }: MasterFormProps<ReasonCode>) {
  const { t } = useTranslation();
  const contexts = useContexts().data?.items ?? [];
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    context: z.string().min(1, t('reasons.form.contextRequired')),
    code: z.string().trim().regex(CODE, t('reasons.form.codeInvalid')).max(30),
    description: z.string().trim().min(1, t('reasons.form.descriptionRequired')).max(200),
    commentRequired: z.boolean(),
    crewChange: z.boolean(),
    sortOrder: z.string().regex(/^\d{1,4}$/, t('reasons.form.orderInvalid')),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      context: record?.context ?? '',
      code: record?.code ?? '',
      description: record?.description ?? '',
      commentRequired: record?.commentRequired ?? false,
      crewChange: record?.crewChange ?? false,
      sortOrder: String(record?.sortOrder ?? 100),
    },
  });
  const contextKey = useWatch({ control: form.control, name: 'context' });
  const crewChangeAllowed = contexts.find((c) => c.key === contextKey)?.crewChange ?? false;
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await saveCode(record, {
        context: values.context as ReasonContext['key'],
        code: values.code.toUpperCase(),
        description: values.description,
        commentRequired: values.commentRequired,
        crewChange: crewChangeAllowed && values.crewChange,
        sortOrder: Number(values.sortOrder),
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
        record ? t('reasons.form.editTitle', { code: record.code }) : t('reasons.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
    >
      <ContextSelect
        contexts={contexts}
        label={t('reasons.form.context')}
        error={errors.context?.message}
        disabled={record !== null}
        {...form.register('context')}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('reasons.form.code')}
          error={errors.code?.message}
          readOnly={record !== null}
          {...form.register('code')}
        />
        <Field
          label={t('reasons.form.order')}
          inputMode="numeric"
          error={errors.sortOrder?.message}
          {...form.register('sortOrder')}
        />
      </div>
      <Field
        label={t('reasons.form.description')}
        error={errors.description?.message}
        {...form.register('description')}
      />
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          {...form.register('commentRequired')}
        />
        {t('reasons.form.commentRequired')}
      </label>
      {crewChangeAllowed && (
        <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            {...form.register('crewChange')}
          />
          {t('reasons.form.crewChange')}
        </label>
      )}
    </EntityFormModal>
  );
}

/** The events that ask for a reason, and whether one is required (spec 10 §3.4). */
function ContextsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: access } = useMyAccess();
  const contexts = useContexts();
  const [pending, setPending] = useState<ReasonContext | null>(null);
  const editable = can(access, 'admin.reason-codes', 'edit');
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('reasons.tabs.contexts')}</caption>
        <thead className="bg-surface-muted">
          <tr>
            <th scope="col" className={TH}>
              {t('reasons.contexts.context')}
            </th>
            <th scope="col" className={TH}>
              {t('reasons.contexts.module')}
            </th>
            <th scope="col" className={TH}>
              {t('reasons.contexts.codes')}
            </th>
            <th scope="col" className={TH}>
              {t('reasons.contexts.required')}
            </th>
            <th scope="col" className={TH}>
              {t('masters.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {(contexts.data?.items ?? []).map((c) => (
            <tr key={c.key} className="border-t border-border">
              <td className="px-3 py-2">{c.label}</td>
              <td className="px-3 py-2">{MODULE_LABEL.get(c.module) ?? c.module}</td>
              <td className="px-3 py-2">{c.activeCodes}</td>
              <td className="px-3 py-2">
                {c.mandatory ? (
                  <StatusPill tone="info">{t('reasons.contexts.yes')}</StatusPill>
                ) : (
                  <StatusPill tone="neutral">{t('reasons.contexts.no')}</StatusPill>
                )}
              </td>
              <td className="px-3 py-2">
                {editable && (
                  <Button variant="secondary" onClick={() => setPending(c)}>
                    {c.mandatory
                      ? t('reasons.contexts.makeOptional', { label: c.label })
                      : t('reasons.contexts.makeRequired', { label: c.label })}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending
            ? t(
                pending.mandatory
                  ? 'reasons.contexts.optionalTitle'
                  : 'reasons.contexts.requiredTitle',
                { label: pending.label },
              )
            : ''
        }
        body={t('reasons.contexts.confirmBody')}
        confirmLabel={t('ui.save')}
        tone="primary"
        onConfirm={async (reason) => {
          if (!pending) return;
          await setMandatory(pending, !pending.mandatory, reason);
          await queryClient.invalidateQueries({ queryKey: REASONS_KEY });
        }}
      />
    </div>
  );
}

/** Ask for a new code (P-51): those who add codes are told. */
function RequestForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const contexts = useContexts().data?.items ?? [];
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    context: z.string().min(1, t('reasons.form.contextRequired')),
    code: z.string().trim().regex(CODE, t('reasons.form.codeInvalid')).max(30),
    description: z.string().trim().min(1, t('reasons.form.descriptionRequired')).max(200),
    why: z.string().trim().min(3, t('reasons.requests.whyRequired')).max(1000),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { context: '', code: '', description: '', why: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await submitRequest({
        ...values,
        context: values.context as ReasonContext['key'],
        code: values.code.toUpperCase(),
      });
      await queryClient.invalidateQueries({ queryKey: [...REASONS_KEY, 'requests'] });
      onClose();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  });
  return (
    <EntityFormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('reasons.requests.newTitle')}
      description={t('reasons.requests.newBody')}
      onSubmit={submit}
      submitting={isSubmitting}
      submitLabel={t('reasons.requests.send')}
      error={failure}
    >
      <ContextSelect
        contexts={contexts}
        label={t('reasons.form.context')}
        error={errors.context?.message}
        {...form.register('context')}
      />
      <Field
        label={t('reasons.requests.code')}
        error={errors.code?.message}
        {...form.register('code')}
      />
      <Field
        label={t('reasons.form.description')}
        error={errors.description?.message}
        {...form.register('description')}
      />
      <TextAreaField
        label={t('reasons.requests.why')}
        error={errors.why?.message}
        {...form.register('why')}
      />
    </EntityFormModal>
  );
}

/** Add a requested code, as asked or amended. */
function AcceptForm({ request, onClose }: { request: ReasonRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const crewChangeAllowed =
    useContexts().data?.items.find((c) => c.key === request.context)?.crewChange ?? false;
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    code: z.string().trim().regex(CODE, t('reasons.form.codeInvalid')).max(30),
    description: z.string().trim().min(1, t('reasons.form.descriptionRequired')).max(200),
    commentRequired: z.boolean(),
    crewChange: z.boolean(),
    note: z.string().max(500),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: request.code,
      description: request.description,
      commentRequired: false,
      crewChange: false,
      note: '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await acceptRequest(request, {
        code: values.code.toUpperCase(),
        description: values.description,
        commentRequired: values.commentRequired,
        crewChange: crewChangeAllowed && values.crewChange,
        sortOrder: 100,
        ...(values.note.trim() ? { note: values.note.trim() } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: REASONS_KEY });
      onClose();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  });
  return (
    <EntityFormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('reasons.requests.addTitle', { code: request.code, label: request.contextLabel })}
      onSubmit={submit}
      submitting={isSubmitting}
      submitLabel={t('reasons.requests.add')}
      error={failure}
    >
      <p className="text-sm text-ink-secondary">{request.why}</p>
      <Field
        label={t('reasons.form.code')}
        error={errors.code?.message}
        {...form.register('code')}
      />
      <Field
        label={t('reasons.form.description')}
        error={errors.description?.message}
        {...form.register('description')}
      />
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          {...form.register('commentRequired')}
        />
        {t('reasons.form.commentRequired')}
      </label>
      {crewChangeAllowed && (
        <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            {...form.register('crewChange')}
          />
          {t('reasons.form.crewChange')}
        </label>
      )}
      <Field label={t('reasons.requests.note')} {...form.register('note')} />
    </EntityFormModal>
  );
}

/** Requests for new codes: my own, or all of them for those who add codes (P-51). */
function RequestsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: access } = useMyAccess();
  const [status, setStatus] = useState<ReasonRequest['status'] | undefined>('open');
  const requests = useRequests(status);
  const [asking, setAsking] = useState(false);
  const [accepting, setAccepting] = useState<ReasonRequest | null>(null);
  const [declining, setDeclining] = useState<ReasonRequest | null>(null);
  const decides = can(access, 'admin.reason-codes', 'create');
  const items = requests.data?.items ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterSelect
          label={t('reasons.requests.status')}
          allLabel={t('ui.filter.all')}
          value={status}
          options={(['open', 'added', 'declined'] as const).map((s) => ({
            value: s,
            label: t(`reasons.requests.state.${s}`),
          }))}
          onChange={(v) => setStatus(v as ReasonRequest['status'] | undefined)}
        />
        <Button onClick={() => setAsking(true)}>{t('reasons.requests.ask')}</Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-secondary">{t('reasons.requests.none')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('reasons.tabs.requests')}</caption>
            <thead className="bg-surface-muted">
              <tr>
                {(['requested', 'context', 'code', 'why', 'status', 'actions'] as const).map(
                  (c) => (
                    <th key={c} scope="col" className={TH}>
                      {t(`reasons.requests.columns.${c}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <p>{r.requestedBy}</p>
                    <p className="text-xs text-ink-secondary">{formatGst(r.requestedAt)}</p>
                  </td>
                  <td className="px-3 py-2">{r.contextLabel}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.code}</p>
                    <p className="text-xs text-ink-secondary">{r.description}</p>
                  </td>
                  <td className="max-w-80 px-3 py-2">{r.why}</td>
                  <td className="px-3 py-2">
                    <StatusPill
                      tone={
                        r.status === 'open' ? 'info' : r.status === 'added' ? 'success' : 'neutral'
                      }
                    >
                      {t(`reasons.requests.state.${r.status}`)}
                    </StatusPill>
                    {r.decisionNote && (
                      <p className="text-xs text-ink-secondary">{r.decisionNote}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {decides && r.status === 'open' && (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setAccepting(r)}>
                          {t('reasons.requests.addFor', { code: r.code })}
                        </Button>
                        <Button variant="ghost" onClick={() => setDeclining(r)}>
                          {t('reasons.requests.declineFor', { code: r.code })}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {requests.isError && <Banner tone="danger">{t('masters.loadFailed')}</Banner>}
      {asking && <RequestForm onClose={() => setAsking(false)} />}
      {accepting && <AcceptForm request={accepting} onClose={() => setAccepting(null)} />}
      <ConfirmDialog
        open={declining !== null}
        onOpenChange={(open) => {
          if (!open) setDeclining(null);
        }}
        title={declining ? t('reasons.requests.declineTitle', { code: declining.code }) : ''}
        body={t('reasons.requests.declineBody')}
        confirmLabel={t('reasons.requests.decline')}
        onConfirm={async (note) => {
          if (!declining) return;
          await declineRequest(declining, note);
          await queryClient.invalidateQueries({ queryKey: [...REASONS_KEY, 'requests'] });
        }}
      />
    </div>
  );
}

/** Reason Codes (spec 10 §3.4, BRD D.2.2.4): one central list behind every reason dropdown. */
export default function ReasonCodesPage() {
  const { t } = useTranslation();
  const contexts = useContexts().data?.items ?? [];
  return (
    <MasterPage
      resource={codesResource}
      title={t('reasons.title')}
      subtitle={t('reasons.subtitle')}
      noun={t('reasons.noun')}
      searchPlaceholder={t('reasons.search')}
      describe={(c) => `${c.code} · ${c.description}`}
      form={CodeForm}
      defaultSort={{ field: 'context', dir: 'asc' }}
      tabs={{
        label: t('reasons.tabs.codes'),
        others: [
          { value: 'contexts', label: t('reasons.tabs.contexts'), content: <ContextsTab /> },
          { value: 'requests', label: t('reasons.tabs.requests'), content: <RequestsTab /> },
        ],
      }}
      columns={[
        {
          id: 'code',
          header: t('reasons.columns.code'),
          sortField: 'code',
          cell: (c) => (
            <div>
              <p className="font-medium text-ink">{c.code}</p>
              <p className="text-xs text-ink-secondary">{c.description}</p>
            </div>
          ),
        },
        {
          id: 'context',
          header: t('reasons.columns.context'),
          sortField: 'context',
          cell: (c) => c.contextLabel,
        },
        {
          id: 'flags',
          header: t('reasons.columns.flags'),
          cell: (c) =>
            [
              c.mandatory ? t('reasons.flags.required') : t('reasons.flags.optional'),
              c.commentRequired && t('reasons.flags.comment'),
              c.crewChange && t('reasons.flags.crewChange'),
            ]
              .filter(Boolean)
              .join(' · '),
        },
        {
          id: 'order',
          header: t('reasons.columns.order'),
          sortField: 'sortOrder',
          align: 'right',
          cell: (c) => c.sortOrder,
        },
      ]}
      filters={({ params, update }) => (
        <FilterSelect
          label={t('reasons.columns.context')}
          allLabel={t('ui.filter.all')}
          value={params.filters.context}
          options={contexts.map((c) => ({ value: c.key, label: c.label }))}
          onChange={(v) =>
            update({
              filters: v
                ? { ...params.filters, context: v }
                : Object.fromEntries(
                    Object.entries(params.filters).filter(([k]) => k !== 'context'),
                  ),
            })
          }
        />
      )}
    />
  );
}
