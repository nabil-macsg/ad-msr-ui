import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { Delivery, NotificationRule, RuleDetail, Triggers } from './engine-api';

const TRIGGERS: Triggers = {
  triggers: [
    {
      key: 'adm.access.expiring',
      module: 'administration',
      label: 'Access expiring',
      category: 'access',
      mandatory: true,
      phase: 1,
      live: true,
      fields: [
        { key: 'role', label: 'Role', type: 'text', sample: 'Site In-charge' },
        { key: 'validTo', label: 'Ends', type: 'datetime', sample: '15 Oct 2026, 07:00 GST' },
        { key: 'daysLeft', label: 'Days left', type: 'number', sample: '7' },
      ],
      filterFields: [
        { key: 'role', label: 'Role', type: 'values', options: null, unit: null },
        { key: 'daysLeft', label: 'Days left', type: 'amount', options: null, unit: 'days' },
      ],
      recipients: [
        { key: 'user', label: 'The user' },
        { key: 'line-manager', label: 'Their line manager' },
      ],
    },
    {
      key: 'pl.booking.confirmed',
      module: 'people-logistics',
      label: 'Booking confirmed with itinerary',
      category: 'booking',
      mandatory: true,
      phase: 4,
      live: false,
      fields: [
        { key: 'bookingRef', label: 'Booking reference', type: 'text', sample: 'BK-2026-0142' },
      ],
      filterFields: [],
      recipients: [{ key: 'passenger', label: 'Passenger' }],
    },
  ],
  roles: [{ code: 'aviation-team', name: 'Aviation Team' }],
};

const expiring: NotificationRule = {
  id: '00000000-0000-4000-8000-000000000a01',
  code: 'access-expiring',
  name: 'Access expiring',
  module: 'administration',
  trigger: 'adm.access.expiring',
  triggerLabel: 'Access expiring',
  category: 'access',
  mandatory: true,
  live: true,
  phase: 1,
  filter: { daysLeft: { max: 14 } },
  frequency: 'recurring',
  everyDays: 7,
  channels: ['in_app', 'email'],
  recipients: { roles: [], people: ['user'], users: [], emails: [] },
  recipientsSummary: 'The user',
  severity: 'warning',
  templates: {
    in_app: {
      subject: null,
      title: 'Your access as {{role}} ends on {{validTo}}',
      body: 'Ends in {{daysLeft}} days.',
    },
    email: {
      subject: 'Your access as {{role}} ends on {{validTo}}',
      title: null,
      body: 'Ends in {{daysLeft}} days.',
    },
  },
  isActive: true,
  deactivatedReason: null,
  version: 3,
  updatedAt: '2026-10-14T06:00:00Z',
};
const confirmed: NotificationRule = {
  ...expiring,
  id: '00000000-0000-4000-8000-000000000a02',
  code: 'booking-confirmed',
  name: 'Booking confirmed with itinerary',
  module: 'people-logistics',
  trigger: 'pl.booking.confirmed',
  triggerLabel: 'Booking confirmed with itinerary',
  category: 'booking',
  live: false,
  phase: 4,
  filter: {},
  frequency: 'immediate',
  everyDays: null,
  channels: ['in_app', 'email', 'sms', 'push'],
  recipientsSummary: 'Passenger, Requester',
};
const expiringDetail: RuleDetail = { ...expiring, namedUsers: [] };
const failed: Delivery = {
  id: '00000000-0000-4000-8000-000000000b01',
  channel: 'email',
  recipient: 'Ahmed Al Mansoori',
  address: 'a.almansoori@masar.example',
  subject: 'Your access as Focal Point ends on 25 Oct 2026, 00:00 GST',
  text: 'Ends in 10 days.',
  status: 'failed',
  attempts: 5,
  providerRef: null,
  error: 'Mailbox full',
  category: 'access',
  module: 'administration',
  rule: { id: expiring.id, name: 'Access expiring' },
  record: null,
  retriable: true,
  queuedAt: '2026-10-14T06:00:00Z',
  sentAt: null,
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

function stubEngine() {
  const sent: Sent[] = [];
  stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .json()
        .catch(() => null)
        .then((body: unknown) => {
          if (path !== '/api/v1/notification-rules/preview') {
            sent.push({
              method: request.method,
              path,
              body,
              ifMatch: request.headers.get('if-match'),
            });
          }
        });
      if (path === '/api/v1/notification-rules/preview') {
        return json({
          rendered: {
            in_app: {
              title: 'Your access as Site In-charge ends on 15 Oct 2026, 07:00 GST',
              body: '',
            },
          },
          problems: ['The in-app text is missing.'],
        });
      }
      if (path.endsWith('/retry'))
        return json({ ...failed, status: 'queued', retriable: false, attempts: 0 });
      return json(expiringDetail, 201);
    }
    if (path === '/api/v1/notification-rules') {
      return json({ items: [expiring, confirmed], total: 2, page: 1, pageSize: 20 });
    }
    if (path === '/api/v1/notification-rules/triggers') return json(TRIGGERS);
    if (path === `/api/v1/notification-rules/${expiring.id}`) return json(expiringDetail);
    if (path === '/api/v1/notification-deliveries')
      return json({ items: [failed], total: 1, page: 1, pageSize: 20 });
    return undefined;
  });
  return sent;
}

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];
const renderEngine = (rights: Right[] = EDITOR) =>
  renderApp('/admin/notification-engine', {
    access: accessWith({ 'admin.notification-engine': rights }),
  });

afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.2.3-MST the Notification Engine page (spec 10 §3.3)', () => {
  it('BRD-D.2.2.3-MST lists rules: trigger, filter, frequency, channels, recipients', async () => {
    stubEngine();
    renderEngine();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notification Engine' }),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Notification Engine' });
    expect(await within(table).findByText('Days left: ≤ 14 days')).toBeInTheDocument();
    expect(within(table).getByText('Every 7 days')).toBeInTheDocument();
    expect(within(table).getByText('In-app, Email')).toBeInTheDocument();
    expect(within(table).getByText('From phase 4')).toBeInTheDocument();
    expect(within(table).getByText('Passenger, Requester')).toBeInTheDocument();
    expect(within(table).getByText('access-expiring · Mandatory')).toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-D.2.2.3-MST creates a rule: trigger, filter, recipients and templates, with a live preview', async () => {
    const sent = stubEngine();
    renderEngine();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New rule' }));
    const form = await screen.findByRole('dialog', { name: 'New notification rule' });
    await user.selectOptions(within(form).getByLabelText('Trigger'), 'adm.access.expiring');
    expect(
      within(form).getByRole('option', { name: 'Booking confirmed with itinerary (from phase 4)' }),
    ).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Name'), 'Line managers: access ending');
    await user.type(within(form).getByLabelText('Code'), 'access-expiring-managers');
    await user.type(within(form).getByLabelText('Days left up to (days)'), '3');
    await user.click(within(form).getByLabelText('Their line manager'));
    await user.click(within(form).getByLabelText('Aviation Team'));
    await user.type(
      within(form).getByLabelText('In-app title'),
      'Access as {{{{role}} ends on {{{{validTo}}',
    );
    expect(
      await within(form).findByText('Your access as Site In-charge ends on 15 Oct 2026, 07:00 GST'),
    ).toBeInTheDocument();
    expect(within(form).getByText('The in-app text is missing.')).toBeInTheDocument();
    await user.type(within(form).getByLabelText('In-app text'), 'Ends in {{{{daysLeft}} days.');
    await user.type(within(form).getByLabelText('Email subject'), 'Access ending');
    await user.type(within(form).getByLabelText('Email text'), 'See MASAR.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/notification-rules',
        ifMatch: null,
        body: {
          code: 'access-expiring-managers',
          trigger: 'adm.access.expiring',
          name: 'Line managers: access ending',
          filter: { daysLeft: { max: 3 } },
          frequency: 'immediate',
          everyDays: null,
          channels: ['in_app', 'email'],
          recipients: { people: ['line-manager'], roles: ['aviation-team'], users: [], emails: [] },
          severity: 'info',
          templates: {
            in_app: {
              title: 'Access as {{role}} ends on {{validTo}}',
              body: 'Ends in {{daysLeft}} days.',
            },
            email: { subject: 'Access ending', body: 'See MASAR.' },
          },
        },
      });
    });
  });

  it('BRD-D.2.2.3-MST a change saves the whole rule with its version', async () => {
    const sent = stubEngine();
    renderEngine();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Actions for Access expiring' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Access expiring' });
    const every = await within(form).findByLabelText('At most once every (days)');
    await user.clear(every);
    await user.type(every, '3');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toEqual([
        expect.objectContaining({
          method: 'PUT',
          path: `/api/v1/notification-rules/${expiring.id}`,
          ifMatch: '3',
          body: expect.objectContaining({
            frequency: 'recurring',
            everyDays: 3,
            filter: { daysLeft: { max: 14 } },
          }) as unknown,
        }),
      ]);
    });
  });

  it('P-48 the delivery log tab lists deliveries and retries a failed one', async () => {
    const sent = stubEngine();
    renderEngine();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Delivery log' }));
    const log = await screen.findByRole('table', { name: 'Delivery log' });
    expect(await within(log).findByText('Mailbox full')).toBeInTheDocument();
    expect(within(log).getByText('Attempts: 5')).toBeInTheDocument();
    await expectAccessible();
    await user.click(
      within(log).getByRole('button', { name: 'Retry the message to Ahmed Al Mansoori' }),
    );
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: `/api/v1/notification-deliveries/${failed.id}/retry`,
        }),
      );
    });
  });

  it('PROMPT-2.7 a viewer sees rules and deliveries without New, edit or Retry', async () => {
    stubEngine();
    renderEngine(['view']);
    const user = userEvent.setup();
    expect(await screen.findByText('Every 7 days')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New rule' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Delivery log' }));
    expect(await screen.findByText('Mailbox full')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });
});
