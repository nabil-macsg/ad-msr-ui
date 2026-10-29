import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import type { MasterFormProps } from '../masters/master-page';
import { type Contact, saveContact, useContactProviders } from './contacts-api';

/** Add or edit an external contact; an activated contact's person and user follow the edit. */
export function ContactForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Contact>) {
  const { t } = useTranslation();
  const providers = useContactProviders();
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    displayName: z.string().trim().min(1, t('contacts.form.nameRequired')).max(200),
    email: z.email(t('contacts.form.emailInvalid')),
    serviceProviderId: z.uuid(t('contacts.form.providerRequired')),
    designation: z.string().max(200),
    phone: z.string().max(40),
    gender: z.enum(['', 'M', 'F']),
    nationality: z.string().max(80),
    hsePassportNo: z.string().max(40),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: record?.displayName ?? '',
      email: record?.email ?? '',
      serviceProviderId: record?.serviceProvider.id ?? '',
      designation: record?.designation ?? '',
      phone: record?.phone ?? '',
      gender: record?.gender ?? '',
      nationality: record?.nationality ?? '',
      hsePassportNo: record?.hsePassportNo ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await saveContact(record, {
        ...values,
        designation: values.designation || null,
        phone: values.phone || null,
        gender: values.gender === '' ? null : values.gender,
        nationality: values.nationality || null,
        hsePassportNo: values.hsePassportNo || null,
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
        record
          ? t('contacts.form.editTitle', { name: record.displayName })
          : t('contacts.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('contacts.form.name')}
          error={errors.displayName?.message}
          {...form.register('displayName')}
        />
        <Field
          label={t('contacts.form.email')}
          type="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <SelectField
          label={t('contacts.form.provider')}
          error={errors.serviceProviderId?.message}
          {...form.register('serviceProviderId')}
        >
          <option value="">{t('contacts.form.chooseProvider')}</option>
          {(providers.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </SelectField>
        <Field label={t('contacts.form.designation')} {...form.register('designation')} />
        <Field label={t('contacts.form.phone')} type="tel" {...form.register('phone')} />
        <SelectField label={t('contacts.form.gender')} {...form.register('gender')}>
          <option value="">{t('contacts.form.genderUnknown')}</option>
          <option value="M">{t('contacts.form.male')}</option>
          <option value="F">{t('contacts.form.female')}</option>
        </SelectField>
        <Field label={t('contacts.form.nationality')} {...form.register('nationality')} />
        <Field label={t('contacts.form.hsePassport')} {...form.register('hsePassportNo')} />
      </div>
    </EntityFormModal>
  );
}
