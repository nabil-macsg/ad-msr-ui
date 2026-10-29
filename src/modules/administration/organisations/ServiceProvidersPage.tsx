import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { setFilter } from '../masters/filters';
import { toNullable } from '../masters/form-values';
import { masterResource, saveMaster } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import type { ServiceProvider } from './orgs-api';

const resource = masterResource<ServiceProvider>('service-providers', 'admin.service-providers');
const TYPES = ['aviation', 'marine', 'test'] as const;

/**
 * Service providers (spec 10 §5.1, BRD D.3.1.9). The code prefixes every flight and voyage
 * number, so it is permanent. External users see only their own organisation.
 */
export default function ServiceProvidersPage() {
  const { t } = useTranslation();
  return (
    <MasterPage
      resource={resource}
      title={t('orgs.providers.title')}
      subtitle={t('orgs.providers.subtitle')}
      noun={t('orgs.providers.noun')}
      searchPlaceholder={t('orgs.providers.search')}
      describe={(p) => `${p.code} · ${p.legalName}`}
      form={ProviderForm}
      defaultSort={{ field: 'name', dir: 'asc' }}
      columns={[
        {
          id: 'code',
          header: t('orgs.providers.columns.code'),
          sortField: 'code',
          cell: (p) => <span className="font-mono text-sm">{p.code}</span>,
        },
        {
          id: 'name',
          header: t('orgs.providers.columns.name'),
          sortField: 'name',
          cell: (p) => p.legalName,
        },
        {
          id: 'type',
          header: t('orgs.providers.columns.type'),
          sortField: 'type',
          cell: (p) => t(`orgs.providers.type.${p.providerType}`),
        },
        {
          id: 'contact',
          header: t('orgs.providers.columns.contact'),
          cell: (p) => (
            <div className="text-sm">
              {p.contactName && <p className="text-ink">{p.contactName}</p>}
              {p.contactEmail && <p className="text-ink-secondary">{p.contactEmail}</p>}
              {p.contactPhone && <p className="text-ink-secondary">{p.contactPhone}</p>}
              {!p.contactName && !p.contactEmail && !p.contactPhone && '—'}
            </div>
          ),
        },
        {
          id: 'fleet',
          header: t('orgs.providers.columns.fleet'),
          align: 'right',
          cell: (p) => p.fleet,
        },
        {
          id: 'contacts',
          header: t('orgs.providers.columns.contacts'),
          align: 'right',
          cell: (p) => p.contacts,
        },
      ]}
      filters={(list) => (
        <FilterSelect
          label={t('orgs.providers.filters.type')}
          allLabel={t('ui.filter.all')}
          value={list.params.filters.type}
          options={TYPES.map((type) => ({ value: type, label: t(`orgs.providers.type.${type}`) }))}
          onChange={(v) => setFilter(list, 'type', v)}
        />
      )}
    />
  );
}

function ProviderForm({ open, onOpenChange, record, onSaved }: MasterFormProps<ServiceProvider>) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    code: record
      ? z.string()
      : z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{2,3}$/, t('orgs.providers.form.codeInvalid')),
    legalName: z.string().trim().min(1, t('orgs.providers.form.nameRequired')).max(200),
    providerType: z.enum(TYPES),
    contactName: z.string().max(200),
    contactEmail: z.union([z.literal(''), z.email(t('orgs.providers.form.emailInvalid'))]),
    contactPhone: z.string().max(40),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      legalName: record?.legalName ?? '',
      providerType: record?.providerType ?? 'aviation',
      contactName: record?.contactName ?? '',
      contactEmail: record?.contactEmail ?? '',
      contactPhone: record?.contactPhone ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const body = {
      legalName: v.legalName,
      providerType: v.providerType,
      contactName: toNullable(v.contactName),
      contactEmail: toNullable(v.contactEmail),
      contactPhone: toNullable(v.contactPhone),
    };
    try {
      await saveMaster('service-providers', record, record ? body : { ...body, code: v.code });
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
          ? t('orgs.providers.form.editTitle', { name: record.legalName })
          : t('orgs.providers.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Field
            label={t('orgs.providers.form.code')}
            error={errors.code?.message}
            disabled={record !== null}
            {...form.register('code')}
          />
          {!record && (
            <p className="mt-1 text-xs text-ink-secondary">{t('orgs.providers.form.codeHint')}</p>
          )}
        </div>
        <Field
          label={t('orgs.providers.form.name')}
          error={errors.legalName?.message}
          {...form.register('legalName')}
        />
        <SelectField label={t('orgs.providers.form.type')} {...form.register('providerType')}>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`orgs.providers.type.${type}`)}
            </option>
          ))}
        </SelectField>
        <Field label={t('orgs.providers.form.contactName')} {...form.register('contactName')} />
        <Field
          label={t('orgs.providers.form.contactEmail')}
          type="email"
          error={errors.contactEmail?.message}
          {...form.register('contactEmail')}
        />
        <Field
          label={t('orgs.providers.form.contactPhone')}
          type="tel"
          {...form.register('contactPhone')}
        />
      </div>
    </EntityFormModal>
  );
}
