import { zodResolver } from '@hookform/resolvers/zod';
import { type ComponentType, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { Column } from '../../../shared/ui/data-table';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { StatusPill } from '../../../shared/ui/status-pill';
import {
  type CodeMaster,
  type CodeMasterKind,
  codeMasterResource,
  type Ref,
  saveCodeMaster,
  useCodeMasterOptions,
} from './code-master-api';
import { CODE_MASTER_VIEWS, type CodeMasterView, type FieldView } from './code-master-defs';
import { MasterPage, type MasterFormProps } from './master-page';

const refOf = (value: unknown) => (value ?? null) as Ref | null;

/**
 * A master that is a code, a name and a few fields (spec 10 §5): zones, location types,
 * installation types, resource categories, cargo types and fuel stations. Its fields come from
 * its view; the code is permanent once saved.
 */
export function CodeMasterPage({ kind }: { kind: CodeMasterKind }) {
  const { t } = useTranslation();
  const [resource] = useState(() =>
    codeMasterResource(kind, CODE_MASTER_VIEWS[kind].deletable !== false),
  );
  const view = CODE_MASTER_VIEWS[kind];
  const flags = view.fields.filter(
    (f): f is Extract<FieldView, { kind: 'flag' }> => f.kind === 'flag',
  );
  const cell = (field: Exclude<FieldView, { kind: 'flag' }>, r: CodeMaster) => {
    const value = r[field.key];
    switch (field.kind) {
      case 'ref':
        return refOf(value)?.name ?? '—';
      case 'choice': {
        const choice = field.choices.find((c) => c.value === value);
        return choice ? t(choice.label) : '—';
      }
      default:
        return typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
    }
  };
  const columns: Column<CodeMaster>[] = [
    {
      id: 'code',
      header: t('places.code.columns.code'),
      sortField: 'code',
      cell: (r) => <span className="font-mono text-sm">{r.code}</span>,
    },
    { id: 'name', header: t('places.code.columns.name'), sortField: 'name', cell: (r) => r.name },
    ...view.fields.flatMap((field): Column<CodeMaster>[] =>
      field.kind === 'flag'
        ? []
        : [{ id: field.key, header: t(field.label), cell: (r) => cell(field, r) }],
    ),
    ...(flags.length > 0
      ? [
          {
            id: 'flags',
            header: t('places.code.columns.flags'),
            cell: (r: CodeMaster) => (
              <div className="flex flex-wrap gap-1">
                {flags.map(
                  (f) =>
                    r[f.key] === true && (
                      <StatusPill key={f.key} tone={f.pill.tone}>
                        {t(f.pill.label)}
                      </StatusPill>
                    ),
                )}
              </div>
            ),
          },
        ]
      : []),
  ];
  return (
    <MasterPage
      resource={resource}
      title={t(view.texts.title)}
      subtitle={t(view.texts.subtitle)}
      noun={t(view.texts.noun)}
      searchPlaceholder={t(view.texts.search)}
      describe={(r) => `${r.code} · ${r.name}`}
      form={FORMS[kind]}
      defaultSort={{ field: 'name', dir: 'asc' }}
      creatable={view.creatable !== false}
      columns={columns}
      deletable={(r) => !isFixed(view, r)}
      lifecycle={(r) =>
        r.isActive ? (isFixed(view, r) ? null : 'deactivate') : 'reactivate'
      }
    />
  );
}

/** Each kind's form, made once so it keeps its state while the page re-renders. */
const FORMS: Readonly<Record<CodeMasterKind, ComponentType<MasterFormProps<CodeMaster>>>> = {
  zones: (props) => <CodeMasterForm {...props} kind="zones" />,
  'location-types': (props) => <CodeMasterForm {...props} kind="location-types" />,
  'installation-types': (props) => <CodeMasterForm {...props} kind="installation-types" />,
  'resource-categories': (props) => <CodeMasterForm {...props} kind="resource-categories" />,
  'cargo-types': (props) => <CodeMasterForm {...props} kind="cargo-types" />,
  'fuel-stations': (props) => <CodeMasterForm {...props} kind="fuel-stations" />,
};

/** What a field's input holds: text for most, a flag for flags. */
function initial(field: FieldView, record: CodeMaster | null): string | boolean {
  const value = record?.[field.key];
  if (field.kind === 'flag') return value === true;
  if (field.kind === 'ref') return refOf(value)?.id ?? '';
  // A select shows its first choice, so a new record starts on it.
  if (field.kind === 'choice' && typeof value !== 'string') return field.choices[0]?.value ?? '';
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** What the API takes for a field's input. */
function sent(field: FieldView, value: string | boolean): unknown {
  if (field.kind === 'flag') return value === true;
  const text = String(value).trim();
  if (field.kind === 'number') return text === '' ? null : Number(text);
  if (field.kind === 'ref') return text;
  return text === '' ? null : text;
}

const apiKey = (field: FieldView) => (field.kind === 'ref' ? `${field.key}Id` : field.key);

/** A built-in record: never deleted or deactivated. */
const isFixed = (view: CodeMasterView, record: CodeMaster) =>
  (view.fixedCodes ?? []).includes(record.code);

function CodeMasterForm({
  open,
  onOpenChange,
  record,
  onSaved,
  kind,
}: MasterFormProps<CodeMaster> & { kind: CodeMasterKind }) {
  const { t } = useTranslation();
  const view = CODE_MASTER_VIEWS[kind];
  const hasRefs = view.fields.some((f) => f.kind === 'ref');
  const options = useCodeMasterOptions(kind, hasRefs);
  const [failure, setFailure] = useState<string | null>(null);
  const max = view.codeMax;
  const fieldSchema = (field: FieldView): z.ZodType<string | boolean> => {
    switch (field.kind) {
      case 'flag':
        return z.boolean();
      case 'text':
        return z
          .string()
          .trim()
          .max(field.max)
          .regex(field.pattern ?? /.*/, field.invalid ? t(field.invalid) : undefined);
      case 'number':
        return z
          .string()
          .trim()
          .refine(
            (v) => v === '' || Number.isFinite(Number(v)),
            t('resources.fields.numberInvalid'),
          );
      default:
        return z.string().min(1, t('resources.fields.required'));
    }
  };
  const schema = z.object({
    code: record
      ? z.string()
      : z
          .string()
          .trim()
          .toUpperCase()
          .regex(new RegExp(`^[A-Z0-9-]{2,${max}}$`), t('places.code.form.codeInvalid', { max })),
    name: z.string().trim().min(1, t('places.code.form.nameRequired')).max(100),
    ...Object.fromEntries(view.fields.map((f) => [f.key, fieldSchema(f)])),
  });
  type Values = Record<string, string | boolean>;
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      ...Object.fromEntries(view.fields.map((f) => [f.key, initial(f, record)])),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const error = (key: string) => errors[key]?.message;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await saveCodeMaster(kind, record, {
        ...(record ? {} : { code: String(values.code).trim().toUpperCase() }),
        name: String(values.name).trim(),
        ...Object.fromEntries(view.fields.map((f) => [apiKey(f), sent(f, values[f.key] ?? '')])),
      });
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
          ? t('places.code.form.editTitle', { name: record.name })
          : t('places.code.form.newTitle', { noun: t(view.texts.noun) })
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
    >
      <Field
        label={t('places.code.form.code')}
        error={error('code')}
        disabled={record !== null}
        {...form.register('code')}
      />
      {!record && (
        <p className="-mt-2 text-xs text-ink-secondary">{t('places.code.form.codeHint')}</p>
      )}
      <Field label={t('places.code.form.name')} error={error('name')} {...form.register('name')} />
      {view.fields.map((field) => {
        switch (field.kind) {
          case 'flag':
            return (
              <label key={field.key} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  {...form.register(field.key)}
                />
                {t(field.label)}
              </label>
            );
          case 'choice':
            return (
              <SelectField
                key={field.key}
                label={t(field.label)}
                error={error(field.key)}
                {...form.register(field.key)}
              >
                {field.choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(c.label)}
                  </option>
                ))}
              </SelectField>
            );
          case 'ref':
            return (
              <SelectField
                key={field.key}
                label={t(field.label)}
                error={error(field.key)}
                {...form.register(field.key)}
              >
                <option value="">{t(field.choose)}</option>
                {(options.data?.[field.key] ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </SelectField>
            );
          default:
            return (
              <div key={field.key}>
                <Field
                  label={t(field.label)}
                  inputMode={field.kind === 'number' ? 'decimal' : undefined}
                  error={error(field.key)}
                  {...form.register(field.key)}
                />
                {field.kind === 'text' && field.hint && (
                  <p className="mt-1 text-xs text-ink-secondary">{t(field.hint)}</p>
                )}
              </div>
            );
        }
      })}
    </EntityFormModal>
  );
}
