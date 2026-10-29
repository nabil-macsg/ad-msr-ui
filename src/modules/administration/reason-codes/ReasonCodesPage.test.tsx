import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { ReasonCode, ReasonContext, ReasonRequest } from './reason-codes-api';

const CONTEXTS: ReasonContext[] = [
  {
    key: 'travel',
    label: 'Reason for Travel',
    module: 'people-logistics',
    mandatory: true,
    crewChange: true,
    activeCodes: 14,
    version: 1,
  },
  {
    key: 'journey-delay',
    label: 'Journey Delay',
    module: 'people-logistics',
    mandatory: true,
    crewChange: false,
    activeCodes: 7,
    version: 2,
  },
];
const other: ReasonCode = {
  id: '00000000-0000-4000-8000-000000000c01',
  context: 'journey-delay',
  contextLabel: 'Journey Delay',
  code: 'DLY-OTHER',
  description: 'Other',
  mandatory: true,
  commentRequired: true,
  crewChange: false,
  sortOrder: 70,
  isActive: true,
  deactivatedReason: null,
  version: 1,
  updatedAt: '2026-10-14T06:00:00Z',
};
const demob: ReasonCode = {
  ...other,
  id: '00000000-0000-4000-8000-000000000c02',
  context: 'travel',
  contextLabel: 'Reason for Travel',
  code: 'TRV-DEMOB',
  description: 'Demobilization',
  commentRequired: false,
  crewChange: true,
  sortOrder: 120,
};
const open: ReasonRequest = {
  id: '00000000-0000-4000-8000-000000000d01',
  context: 'journey-delay',
  contextLabel: 'Journey Delay',
  code: 'DLY-BIRD',
  description: 'Bird strike inspection',
  why: 'Two bird-strike inspections this month had no code.',
  status: 'open',
  requestedBy: 'Dispatch Power User',
  requestedAt: '2026-10-14T06:00:00Z',
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  version: 1,
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

function stubReasons() {
  const sent: Sent[] = [];
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
      if (path.includes('/contexts/'))
        return json({ ...CONTEXTS[1], mandatory: false, version: 3 });
      if (path.includes('/requests')) return json({ ...open, status: 'added' }, 201);
      return json(other, 201);
    }
    if (path === '/api/v1/reason-codes')
      return json({ items: [other, demob], total: 2, page: 1, pageSize: 20 });
    if (path === '/api/v1/reason-codes/contexts') return json({ items: CONTEXTS });
    if (path === '/api/v1/reason-codes/requests')
      return json({ items: [open], total: 1, page: 1, pageSize: 100 });
    return undefined;
  });
  return sent;
}

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];
const renderReasons = (rights: Right[] = EDITOR) =>
  renderApp('/admin/reason-codes', { access: accessWith({ 'admin.reason-codes': rights }) });

afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.2.4-MST the Reason Codes page (spec 10 §3.4)', () => {
  it('BRD-D.2.2.4-MST lists codes with their context and flags', async () => {
    stubReasons();
    renderReasons();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reason Codes' }),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Reason Codes' });
    expect(
      await within(table).findByText('Reason required · Comment required'),
    ).toBeInTheDocument();
    expect(within(table).getByText('Reason required · Crew change')).toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-D.2.2.4-MST adds a code; crew change is offered for travel reasons only', async () => {
    const sent = stubReasons();
    renderReasons();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New code' }));
    const form = await screen.findByRole('dialog', { name: 'New reason code' });
    await user.selectOptions(await within(form).findByLabelText('Context'), 'journey-delay');
    expect(within(form).queryByLabelText('Counts as a crew change')).not.toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('Context'), 'travel');
    await user.click(within(form).getByLabelText('Counts as a crew change'));
    await user.type(within(form).getByLabelText('Code'), 'trv-rotation');
    await user.type(within(form).getByLabelText('Description'), 'Rotation change');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/reason-codes',
        ifMatch: null,
        body: {
          context: 'travel',
          code: 'TRV-ROTATION',
          description: 'Rotation change',
          commentRequired: false,
          crewChange: true,
          sortOrder: 100,
        },
      });
    });
  });

  it('BRD-D.2.2.4-MST a context is made optional with a reason', async () => {
    const sent = stubReasons();
    renderReasons();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Contexts' }));
    await user.click(await screen.findByRole('button', { name: 'Make optional: Journey Delay' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Let Journey Delay complete without a reason?',
    });
    await user.type(within(dialog).getByLabelText('Reason'), 'Delays always say why');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'PATCH',
        path: '/api/v1/reason-codes/contexts/journey-delay',
        ifMatch: '2',
        body: { mandatory: false, reason: 'Delays always say why' },
      });
    });
    await expectAccessible();
  });

  it('P-51 a Module Power User requests a code; those who add codes decide', async () => {
    const sent = stubReasons();
    renderReasons(['view']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Requests' }));
    expect(
      await screen.findByText('Two bird-strike inspections this month had no code.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add DLY-BIRD' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Request a code' }));
    const form = await screen.findByRole('dialog', { name: 'Request a reason code' });
    await user.selectOptions(await within(form).findByLabelText('Context'), 'journey-delay');
    await user.type(within(form).getByLabelText('Suggested code'), 'dly-fuel');
    await user.type(within(form).getByLabelText('Description'), 'Awaiting fuel');
    await user.type(
      within(form).getByLabelText('Why it is needed'),
      'Fuel trucks were late twice.',
    );
    await user.click(within(form).getByRole('button', { name: 'Send request' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/reason-codes/requests',
        ifMatch: null,
        body: {
          context: 'journey-delay',
          code: 'DLY-FUEL',
          description: 'Awaiting fuel',
          why: 'Fuel trucks were late twice.',
        },
      });
    });
  });

  it('P-51 adds a requested code as amended', async () => {
    const sent = stubReasons();
    renderReasons();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Requests' }));
    await user.click(await screen.findByRole('button', { name: 'Add DLY-BIRD' }));
    const form = await screen.findByRole('dialog', { name: 'Add DLY-BIRD to Journey Delay' });
    await user.clear(within(form).getByLabelText('Description'));
    await user.type(within(form).getByLabelText('Description'), 'Bird strike');
    await user.click(within(form).getByRole('button', { name: 'Add code' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/reason-codes/requests/${open.id}/accept`,
        ifMatch: '1',
        body: {
          code: 'DLY-BIRD',
          description: 'Bird strike',
          commentRequired: false,
          crewChange: false,
          sortOrder: 100,
        },
      });
    });
  });
});
