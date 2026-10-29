import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { MasterPage } from '../masters/master-page';
import { AccessChangeDialog } from '../users/AccessChangeDialog';
import { ContactForm } from './ContactForm';
import {
  activateContact,
  type Contact,
  CONTACTS_KEY,
  contactsResource,
  useContactProviders,
} from './contacts-api';

type Access = 'pending' | 'invited' | 'active' | 'deactivated';
const ACCESS_TONE: Record<Access, Tone> = {
  pending: 'neutral',
  invited: 'info',
  active: 'success',
  deactivated: 'warning',
};
const accessOf = (c: Contact): Access => c.user?.status ?? 'pending';

/**
 * External Organisation Contacts (spec 10 §2.1, §5.1): the source of providers' people outside
 * Fieldglass. "Activate access" creates their invited user and emails the invitation.
 */
export default function ExternalContactsPage() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const queryClient = useQueryClient();
  const providers = useContactProviders();
  const [activating, setActivating] = useState<Contact | null>(null);

  return (
    <>
      <MasterPage
        resource={contactsResource}
        title={t('contacts.title')}
        subtitle={t('contacts.subtitle')}
        noun={t('contacts.noun')}
        searchPlaceholder={t('contacts.search')}
        describe={(c) => `${c.personnelNo} · ${c.displayName}`}
        form={ContactForm}
        defaultSort={{ field: 'name', dir: 'asc' }}
        columns={[
          {
            id: 'personnelNo',
            header: t('contacts.columns.personnelNo'),
            sortField: 'personnelNo',
            cell: (c) => c.personnelNo,
          },
          {
            id: 'name',
            header: t('contacts.columns.name'),
            sortField: 'name',
            cell: (c) => (
              <div>
                <p className="font-medium text-ink">{c.displayName}</p>
                <p className="text-xs text-ink-secondary">{c.email}</p>
              </div>
            ),
          },
          {
            id: 'provider',
            header: t('contacts.columns.provider'),
            sortField: 'provider',
            cell: (c) => c.serviceProvider.name,
          },
          {
            id: 'designation',
            header: t('contacts.columns.designation'),
            cell: (c) => c.designation ?? '—',
          },
          {
            id: 'access',
            header: t('contacts.columns.access'),
            cell: (c) => (
              <StatusPill tone={ACCESS_TONE[accessOf(c)]}>
                {t(`contacts.access.${accessOf(c)}`)}
              </StatusPill>
            ),
          },
        ]}
        filters={({ params, update }) => {
          const set = (name: string, value: string | undefined) => {
            const rest = Object.fromEntries(
              Object.entries(params.filters).filter(([k]) => k !== name),
            );
            update({ filters: value ? { ...rest, [name]: value } : rest });
          };
          return (
            <>
              <FilterSelect
                label={t('contacts.filters.provider')}
                allLabel={t('ui.filter.all')}
                value={params.filters.provider}
                options={(providers.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(v) => set('provider', v)}
              />
              <FilterSelect
                label={t('contacts.filters.state')}
                allLabel={t('ui.filter.all')}
                value={params.filters.state}
                options={[
                  { value: 'pending', label: t('contacts.filters.pending') },
                  { value: 'activated', label: t('contacts.filters.activated') },
                ]}
                onChange={(v) => set('state', v)}
              />
            </>
          );
        }}
        actions={(c) => [
          can(access, 'admin.external-contacts', 'edit') &&
            c.isActive &&
            c.activatedAt === null && {
              label: t('contacts.activate'),
              run: () => setActivating(c),
            },
        ]}
      />
      {activating && (
        <AccessChangeDialog
          open
          onOpenChange={(open) => {
            if (!open) setActivating(null);
          }}
          title={t('contacts.activateTitle', { name: activating.displayName })}
          body={t('contacts.activateBody')}
          confirmLabel={t('contacts.activate')}
          requireReason={false}
          onConfirm={async ({ referenceId }) => {
            await activateContact(activating, referenceId);
            await queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
          }}
        />
      )}
    </>
  );
}
