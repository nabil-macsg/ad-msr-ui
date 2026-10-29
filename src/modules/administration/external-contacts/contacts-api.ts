import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import type { MasterResource } from '../masters/master-resource';

export type Contact = components['schemas']['ExternalContact'];
export type ContactInput = components['schemas']['ExternalContactInput'];

export const CONTACTS_KEY = ['masters', 'external-contacts'] as const;
const ifMatch = (version: number) => ({ 'If-Match': String(version) });

/** The External Organisation Contacts API, as the master page uses it. */
export const contactsResource: MasterResource<Contact> = {
  pageKey: 'admin.external-contacts',
  queryKey: [...CONTACTS_KEY],
  path: '/api/v1/masters/external-contacts',
  list: async (query) =>
    unwrap(await api.GET('/api/v1/masters/external-contacts', { params: { query } })),
  deactivate: async (contact, reason) =>
    unwrap(
      await api.POST('/api/v1/masters/external-contacts/{id}/deactivate', {
        params: { path: { id: contact.id }, header: ifMatch(contact.version) },
        body: { reason },
      }),
    ),
  reactivate: async (contact, reason) =>
    unwrap(
      await api.POST('/api/v1/masters/external-contacts/{id}/reactivate', {
        params: { path: { id: contact.id }, header: ifMatch(contact.version) },
        body: { reason },
      }),
    ),
  remove: async (contact, reason) => {
    unwrap(
      await api.DELETE('/api/v1/masters/external-contacts/{id}', {
        params: { path: { id: contact.id }, header: ifMatch(contact.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/masters/external-contacts/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

export async function saveContact(contact: Contact | null, body: ContactInput): Promise<Contact> {
  if (contact) {
    return unwrap(
      await api.PATCH('/api/v1/masters/external-contacts/{id}', {
        params: { path: { id: contact.id }, header: ifMatch(contact.version) },
        body,
      }),
    );
  }
  return unwrap(await api.POST('/api/v1/masters/external-contacts', { body }));
}

export async function activateContact(contact: Contact, referenceId: string): Promise<Contact> {
  return unwrap(
    await api.POST('/api/v1/masters/external-contacts/{id}/activate', {
      params: { path: { id: contact.id }, header: ifMatch(contact.version) },
      body: { referenceId },
    }),
  );
}

export function useContactProviders() {
  return useQuery({
    queryKey: [...CONTACTS_KEY, 'providers'],
    queryFn: async () => unwrap(await api.GET('/api/v1/masters/external-contacts/providers')).items,
    staleTime: 5 * 60_000,
  });
}
