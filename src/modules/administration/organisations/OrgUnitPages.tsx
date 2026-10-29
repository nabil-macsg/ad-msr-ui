import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { type Provenance, ProvenanceChip } from '../../../shared/ui/provenance-chip';
import { setFilter } from '../masters/filters';
import { masterResource, saveMaster, useMasterOptions } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import type { Company, Department, OrganisationOptions } from './orgs-api';

const departments = masterResource<Department>('departments', 'admin.departments');
const companies = masterResource<Company>('companies', 'admin.companies');

const PROVENANCE: Readonly<Record<Department['source'] | Company['source'], Provenance>> = {
  sap: 'sap',
  fieldglass: 'fieldglass',
  manual: 'masar',
  external: 'masar',
};

function Source({
  record,
}: {
  record: { source: Department['source'] | Company['source']; syncedAt: string | null };
}) {
  return (
    <ProvenanceChip
      source={PROVENANCE[record.source]}
      {...(record.syncedAt ? { syncedAt: record.syncedAt } : {})}
    />
  );
}

/** Departments (spec 10 §5.1): SAP's synced and read-only here; others kept in MASAR. */
export function DepartmentsPage() {
  const { t } = useTranslation();
  return (
    <MasterPage
      resource={departments}
      title={t('orgs.departments.title')}
      subtitle={t('orgs.departments.subtitle')}
      noun={t('orgs.departments.noun')}
      searchPlaceholder={t('orgs.departments.search')}
      describe={(d) => `${d.code} · ${d.name}`}
      form={DepartmentForm}
      defaultSort={{ field: 'name', dir: 'asc' }}
      editable={(d) => d.source === 'manual'}
      columns={[
        {
          id: 'code',
          header: t('orgs.departments.columns.code'),
          sortField: 'code',
          cell: (d) => <span className="font-mono text-sm">{d.code}</span>,
        },
        {
          id: 'name',
          header: t('orgs.departments.columns.name'),
          sortField: 'name',
          cell: (d) => (
            <div>
              <p className="font-medium text-ink">{d.name}</p>
              {d.parent && (
                <p className="text-xs text-ink-secondary">
                  {t('orgs.departments.under', { name: d.parent.name })}
                </p>
              )}
            </div>
          ),
        },
        {
          id: 'source',
          header: t('orgs.departments.columns.source'),
          sortField: 'source',
          cell: (d) => <Source record={d} />,
        },
        {
          id: 'people',
          header: t('orgs.departments.columns.people'),
          align: 'right',
          cell: (d) => d.people,
        },
      ]}
      filters={(list) => (
        <FilterSelect
          label={t('orgs.departments.filters.source')}
          allLabel={t('ui.filter.all')}
          value={list.params.filters.source}
          options={(['sap', 'manual'] as const).map((s) => ({
            value: s,
            label: t(`orgs.departments.source.${s}`),
          }))}
          onChange={(v) => setFilter(list, 'source', v)}
        />
      )}
    />
  );
}

function DepartmentForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Department>) {
  const { t } = useTranslation();
  const options = useMasterOptions<OrganisationOptions>('departments');
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    code: record
      ? z.string()
      : z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9-]{2,20}$/, t('orgs.departments.form.codeInvalid')),
    name: z.string().trim().min(1, t('orgs.departments.form.nameRequired')).max(200),
    parentId: z.string(),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      parentId: record?.parent?.id ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const body = { name: v.name, parentId: v.parentId || null };
    try {
      await saveMaster('departments', record, record ? body : { ...body, code: v.code });
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
          ? t('orgs.departments.form.editTitle', { name: record.name })
          : t('orgs.departments.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
    >
      <Field
        label={t('orgs.departments.form.code')}
        error={errors.code?.message}
        disabled={record !== null}
        {...form.register('code')}
      />
      <Field
        label={t('orgs.departments.form.name')}
        error={errors.name?.message}
        {...form.register('name')}
      />
      <SelectField label={t('orgs.departments.form.parent')} {...form.register('parentId')}>
        <option value="">{t('orgs.departments.form.noParent')}</option>
        {(options.data?.departments ?? [])
          .filter((d) => d.id !== record?.id)
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
      </SelectField>
    </EntityFormModal>
  );
}

/**
 * Companies (spec 10 §5.1): SAP's and Fieldglass's synced and read-only here; providers'
 * external organisations kept in MASAR.
 */
export function CompaniesPage() {
  const { t } = useTranslation();
  const options = useMasterOptions<OrganisationOptions>('companies');
  return (
    <MasterPage
      resource={companies}
      title={t('orgs.companies.title')}
      subtitle={t('orgs.companies.subtitle')}
      noun={t('orgs.companies.noun')}
      searchPlaceholder={t('orgs.companies.search')}
      describe={(c) => `${c.code} · ${c.name}`}
      form={CompanyForm}
      defaultSort={{ field: 'name', dir: 'asc' }}
      editable={(c) => c.source === 'external'}
      columns={[
        {
          id: 'code',
          header: t('orgs.companies.columns.code'),
          sortField: 'code',
          cell: (c) => <span className="font-mono text-sm">{c.code}</span>,
        },
        {
          id: 'name',
          header: t('orgs.companies.columns.name'),
          sortField: 'name',
          cell: (c) => c.name,
        },
        {
          id: 'source',
          header: t('orgs.companies.columns.source'),
          sortField: 'source',
          cell: (c) => <Source record={c} />,
        },
        {
          id: 'provider',
          header: t('orgs.companies.columns.provider'),
          cell: (c) => c.serviceProvider?.name ?? '—',
        },
        {
          id: 'people',
          header: t('orgs.companies.columns.people'),
          align: 'right',
          cell: (c) => c.people,
        },
      ]}
      filters={(list) => (
        <>
          <FilterSelect
            label={t('orgs.companies.filters.source')}
            allLabel={t('ui.filter.all')}
            value={list.params.filters.source}
            options={(['sap', 'fieldglass', 'external'] as const).map((s) => ({
              value: s,
              label: t(`orgs.companies.source.${s}`),
            }))}
            onChange={(v) => setFilter(list, 'source', v)}
          />
          <FilterSelect
            label={t('orgs.companies.filters.provider')}
            allLabel={t('ui.filter.all')}
            value={list.params.filters.provider}
            options={(options.data?.serviceProviders ?? []).map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            onChange={(v) => setFilter(list, 'provider', v)}
          />
        </>
      )}
    />
  );
}

function CompanyForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Company>) {
  const { t } = useTranslation();
  const options = useMasterOptions<OrganisationOptions>('companies');
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    code: record
      ? z.string()
      : z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9-]{2,20}$/, t('orgs.companies.form.codeInvalid')),
    name: z.string().trim().min(1, t('orgs.companies.form.nameRequired')).max(200),
    serviceProviderId: z.string().min(1, t('orgs.companies.form.providerRequired')),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      serviceProviderId: record?.serviceProvider?.id ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const body = { name: v.name, serviceProviderId: v.serviceProviderId };
    try {
      await saveMaster('companies', record, record ? body : { ...body, code: v.code });
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
          ? t('orgs.companies.form.editTitle', { name: record.name })
          : t('orgs.companies.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
    >
      <Field
        label={t('orgs.companies.form.code')}
        error={errors.code?.message}
        disabled={record !== null}
        {...form.register('code')}
      />
      <Field
        label={t('orgs.companies.form.name')}
        error={errors.name?.message}
        {...form.register('name')}
      />
      <SelectField
        label={t('orgs.companies.form.provider')}
        error={errors.serviceProviderId?.message}
        {...form.register('serviceProviderId')}
      >
        <option value="">{t('orgs.companies.form.chooseProvider')}</option>
        {(options.data?.serviceProviders ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.code})
          </option>
        ))}
      </SelectField>
    </EntityFormModal>
  );
}
