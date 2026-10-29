import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { Contact } from './contacts-api';

const FALCON = { id: '00000000-0000-4000-8000-0000000000f1', code: 'FAL', name: 'Falcon Aviation' };
const base: Contact = {
  id: '00000000-0000-4000-8000-000000000401',
  personnelNo: 'EXT-90010',
  displayName: 'Falcon Operations',
  email: 'ops@fal.masar.example',
  serviceProvider: FALCON,
  designation: 'Operations desk',
  phone: null,
  gender: null,
  nationality: null,
  hsePassportNo: null,
  activatedAt: '2026-10-01T06:00:00Z',
  user: { id: '00000000-0000-4000-8000-000000000501', status: 'invited' },
  isActive: true,
  deactivatedReason: null,
  version: 2,
  updatedAt: '2026-10-01T06:00:00Z',
};
const pending: Contact = {
  ...base,
  id: '00000000-0000-4000-8000-000000000402',
  personnelNo: 'EXT-10001',
  displayName: 'Layla Haddad',
  email: 'l.haddad@fal.masar.example',
  activatedAt: null,
  user: null,
  version: 1,
};

function stubContacts() {
  const sent: { method: string; path: string; body: unknown; ifMatch: string | null }[] = [];
  stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .json()
        .then((body: unknown) => {
          sent.push({
            method: request.method,
            path,
            body,
            ifMatch: request.headers.get('if-match'),
          });
        });
      if (path.endsWith('/activate')) {
        return json({
          ...pending,
          activatedAt: '2026-10-13T06:00:00Z',
          user: base.user,
          version: 2,
        });
      }
      return json(pending, 201);
    }
    if (path === '/api/v1/masters/external-contacts') {
      return json({ items: [base, pending], total: 2, page: 1, pageSize: 20 });
    }
    if (path === '/api/v1/masters/external-contacts/providers') return json({ items: [FALCON] });
    return undefined;
  });
  return sent;
}

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];

afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.1.1-MST the External Organisation Contacts page (spec 10 §2.1)', () => {
  it('BRD-D.2.1.1-MST lists contacts with their sign-in access', async () => {
    stubContacts();
    renderApp('/admin/external-contacts', {
      access: accessWith({ 'admin.external-contacts': EDITOR }),
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'External Organisation Contacts' }),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'External Organisation Contacts' });
    expect(await within(table).findByText('Falcon Operations')).toBeInTheDocument();
    expect(within(table).getByText('Invited')).toBeInTheDocument();
    expect(within(table).getByText('Not activated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New contact' })).toBeInTheDocument();
    await expectAccessible();
  });

  it('ADR-0030 activating access needs the reference ID and the version', async () => {
    const sent = stubContacts();
    renderApp('/admin/external-contacts', {
      access: accessWith({ 'admin.external-contacts': EDITOR }),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for EXT-10001 · Layla Haddad' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Activate access' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Give Layla Haddad a MASAR sign-in?',
    });
    await user.type(within(dialog).getByLabelText('Access-request reference ID'), 'RITM-77');
    await user.click(within(dialog).getByRole('button', { name: 'Activate access' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/masters/external-contacts/${pending.id}/activate`,
        body: { referenceId: 'RITM-77' },
        ifMatch: '1',
      });
    });
  });

  it('ADR-0030 offers activation only for contacts not yet activated', async () => {
    stubContacts();
    renderApp('/admin/external-contacts', {
      access: accessWith({ 'admin.external-contacts': EDITOR }),
    });
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: 'Actions for EXT-90010 · Falcon Operations' }),
      );
    expect(screen.queryByRole('menuitem', { name: 'Activate access' })).not.toBeInTheDocument();
  });

  it('PROMPT-4.2 adds a contact through the form, validated', async () => {
    const sent = stubContacts();
    renderApp('/admin/external-contacts', {
      access: accessWith({ 'admin.external-contacts': EDITOR }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New contact' }));
    const form = await screen.findByRole('dialog', { name: 'New contact' });
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByText('Enter the contact’s name')).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Full name'), 'Layla Haddad');
    await user.type(within(form).getByLabelText('Email'), 'l.haddad@fal.masar.example');
    await within(form).findByRole('option', { name: 'Falcon Aviation (FAL)' });
    await user.selectOptions(within(form).getByLabelText('Service provider'), FALCON.id);
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/external-contacts',
          body: expect.objectContaining({
            displayName: 'Layla Haddad',
            email: 'l.haddad@fal.masar.example',
            serviceProviderId: FALCON.id,
            phone: null,
          }) as unknown,
        }),
      );
    });
  });
});
