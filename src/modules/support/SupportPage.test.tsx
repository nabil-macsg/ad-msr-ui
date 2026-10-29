import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../test/render-app';
import type { Support } from './support-api';

const SUPPORT: Support = {
  portalUrl: 'https://itsm.masar.example/masar',
  contacts: [
    {
      code: 'DAS',
      location: 'Das Island',
      name: 'Khalid Al Hosani',
      email: 'k.alhosani@masar.example',
    },
  ],
  faqs: [
    {
      id: '00000000-0000-4000-8000-000000000e01',
      title: 'My booking is approved. Do I have a seat?',
      body: 'Not yet. Your **seat is confirmed when the manifest is confirmed**.',
    },
  ],
  guides: [
    {
      id: '00000000-0000-4000-8000-000000000e02',
      title: 'Approve or return a request',
      body: '1. Open the request.\n2. Choose **Approve**.',
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('SPEC-10-1.4 the Support page', () => {
  it('SPEC-10-1.4 shows technical support, operational contacts, questions and guides', async () => {
    stubFetch((path) => (path === '/api/v1/support' ? json(SUPPORT) : undefined));
    renderApp('/support');
    expect(await screen.findByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open the IT service portal' })).toHaveAttribute(
      'href',
      'https://itsm.masar.example/masar',
    );
    const contacts = screen.getByRole('table', { name: 'Operational contacts' });
    expect(
      within(contacts).getByRole('link', { name: 'k.alhosani@masar.example' }),
    ).toHaveAttribute('href', 'mailto:k.alhosani@masar.example');
    await userEvent.setup().click(screen.getByText('My booking is approved. Do I have a seat?'));
    expect(screen.getByText('seat is confirmed when the manifest is confirmed').tagName).toBe(
      'STRONG',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await expectAccessible();
  });

  it('SPEC-10-1.4 without a configured portal, says whom to ask', async () => {
    stubFetch((path) =>
      path === '/api/v1/support' ? json({ ...SUPPORT, portalUrl: null }) : undefined,
    );
    renderApp('/support');
    expect(
      await screen.findByText('Ask your administrator how to raise a ticket.'),
    ).toBeInTheDocument();
  });
});

describe('SPEC-10-1.4 the Support Articles page', () => {
  it('SPEC-10-1.4 adds an article, previewing its markdown', async () => {
    const sent: unknown[] = [];
    stubFetch((path, request) => {
      if (request.method === 'POST') {
        void request
          .clone()
          .json()
          .then((body: unknown) => sent.push(body));
        return json({}, 201);
      }
      if (path === '/api/v1/support-articles')
        return json({ items: [], total: 0, page: 1, pageSize: 20 });
      return undefined;
    });
    renderApp('/admin/support-articles', {
      access: accessWith({ 'admin.support-articles': ['view', 'create', 'edit'] }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New article' }));
    const form = await screen.findByRole('dialog', { name: 'New support article' });
    await user.type(within(form).getByLabelText('Code'), 'faq-terminal');
    await user.type(within(form).getByLabelText('Title'), 'Where is the terminal?');
    await user.type(within(form).getByLabelText('Text'), 'Gate **3**.');
    expect(within(form).getByText('3').tagName).toBe('STRONG');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toEqual([
        {
          code: 'faq-terminal',
          kind: 'faq',
          title: 'Where is the terminal?',
          body: 'Gate **3**.',
          sortOrder: 100,
        },
      ]);
    });
  });
});
