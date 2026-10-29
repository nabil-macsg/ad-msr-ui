import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import type { MasterFormProps } from '../masters/master-page';
import { ROLE_TYPES, type Role, SCOPE_LEVELS, saveRole } from './roles-api';

const CODE_PATTERN = /^[a-z][a-z0-9-]{2,40}$/;

/** A code from a name: "ASP Team" → "asp-team". */
function codeFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 41)
    .replace(/-+$/, '');
}

/** New role, or edit one. The Super Admin role and roles the viewer holds can't be changed; the API says so. */
export function RoleForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Role>) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z
    .object({
      code: z.string().trim(),
      name: z.string().trim().min(1, t('roles.form.nameRequired')).max(100),
      description: z.string().trim().min(1, t('roles.form.descriptionRequired')).max(500),
      type: z.enum(ROLE_TYPES),
      scopeLevel: z.enum(SCOPE_LEVELS),
      // Empty for no limit, otherwise 1–100,000 as the API allows.
      maxHolders: z
        .string()
        .trim()
        .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100_000), {
          message: t('roles.form.maxHoldersInvalid'),
        }),
    })
    .superRefine((values, ctx) => {
      // An empty code is generated from the name, so the name has to make a valid one.
      if (!CODE_PATTERN.test(values.code || codeFromName(values.name))) {
        ctx.addIssue({ code: 'custom', path: ['code'], message: t('roles.form.codeInvalid') });
      }
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      description: record?.description ?? '',
      type: record?.type ?? 'module',
      scopeLevel: record?.scopeLevel ?? 'site',
      maxHolders: record?.maxHolders === null || !record ? '' : String(record.maxHolders),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const name = useWatch({ control: form.control, name: 'name' });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      // Lock, external and channels are no longer on the form:
      // an edit keeps what the role has, a new role takes the defaults.
      await saveRole(record, {
        code: values.code || codeFromName(values.name),
        name: values.name,
        description: values.description,
        type: values.type,
        scopeLevel: values.scopeLevel,
        maxHolders: values.maxHolders === '' ? null : Number(values.maxHolders),
        isLocked: record?.isLocked ?? false,
        isExternal: record?.isExternal ?? false,
        channels: record?.channels ?? ['web'],
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
      title={record ? t('roles.form.editTitle', { name: record.name }) : t('roles.form.newTitle')}
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Field
            label={t('roles.form.code')}
            error={errors.code?.message}
            readOnly={record !== null}
            placeholder={record ? undefined : codeFromName(name)}
            {...form.register('code')}
          />
          <p className="text-xs text-ink-muted">
            {t(record ? 'roles.form.codeHint' : 'roles.form.codeHintNew')}
          </p>
        </div>
        <Field
          label={t('roles.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <Field
          className="md:col-span-2"
          label={t('roles.form.description')}
          error={errors.description?.message}
          {...form.register('description')}
        />
        <SelectField label={t('roles.form.type')} {...form.register('type')}>
          {ROLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`roles.type.${type}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('roles.form.scopeLevel')} {...form.register('scopeLevel')}>
          {SCOPE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(`roles.scopeLevel.${level}`)}
            </option>
          ))}
        </SelectField>
        <div className="space-y-1">
          <Field
            label={t('roles.form.maxHolders')}
            inputMode="numeric"
            error={errors.maxHolders?.message}
            {...form.register('maxHolders')}
          />
          <p className="text-xs text-ink-muted">{t('roles.form.maxHoldersHint')}</p>
        </div>
      </div>
    </EntityFormModal>
  );
}
