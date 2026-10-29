import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type {
  EssentialPosition,
  Lifeboat,
  LifeboatCapacity,
  MusterPoint,
  PendingChange,
} from './pob-api';

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });
const meta = { isActive: true, deactivatedReason: null, updatedAt: '2026-10-01T00:00:00Z' };
const das = ref(1, 'DAS', 'Das Island');
const zrk = ref(2, 'ZRK', 'Zirku Island');

const helideck: MusterPoint = {
  ...ref(10, 'DAS-MA', 'Muster A — Helideck'),
  location: das,
  installation: null,
  role: 'primary',
  capacity: 86,
  evacuationModes: ['helicopter'],
  isOperational: true,
  unavailableReasonCode: null,
  unavailableReason: null,
  unavailableSince: null,
  pendingChange: null,
  ...meta,
  version: 2,
};
const camp: MusterPoint = {
  ...helideck,
  ...ref(11, 'DAS-MC', 'Muster C — Camp'),
  role: 'alternate',
  evacuationModes: [],
  isOperational: false,
  unavailableReasonCode: 'MUS-MAINT',
  unavailableReason: 'Camp refurbishment',
  unavailableSince: '2026-10-01T00:00:00Z',
  pendingChange: { id: id(90), ref: 'PMC-2026-0007', action: 'return-to-use' },
};
const boat1: Lifeboat = {
  ...ref(20, 'DAS-LB1', 'Boat 1'),
  location: das,
  craftType: 'lifeboat',
  station: 'Lifeboat station 1',
  ratedCapacity: 70,
  certificateExpiresOn: '2026-01-31',
  isInService: true,
  outOfServiceReason: null,
  outOfServiceSince: null,
  pendingChange: null,
  ...meta,
  version: 1,
};
const capacity: LifeboatCapacity = {
  holdBackLargest: true,
  items: [
    {
      location: das,
      craft: 5,
      inService: 4,
      inServiceCapacity: 280,
      heldBack: 70,
      countedCapacity: 210,
    },
  ],
};
const cook: EssentialPosition = {
  id: id(30),
  designation: 'Cook',
  location: zrk,
  classification: 'non-essential',
  minCount: null,
  criticality: null,
  notes: null,
  effectiveFrom: '2026-01-01',
  inForce: true,
  pendingChange: null,
  ...meta,
  version: 1,
};
const change: PendingChange = {
  id: id(90),
  ref: 'PMC-2026-0001',
  master: 'muster-points',
  action: 'update',
  record: ref(11, 'DAS-MC', 'Muster C — Camp'),
  location: das,
  batchId: null,
  summary: 'Change muster point DAS-MC · Muster C — Camp',
  reason: null,
  before: { capacity: 86, evacuationModes: [] },
  after: { capacity: 100, evacuationModes: ['boat'] },
  status: 'pending',
  requestedBy: { id: id(70), name: 'MASAR Administrator' },
  requestedAt: '2026-10-14T06:00:00Z',
  decidedAt: null,
  decisionNote: null,
  approvalId: id(80),
  myTask: { id: id(81), version: 1 },
  canWithdraw: false,
  version: 1,
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

function stubPob(): Sent[] {
  const sent: Sent[] = [];
  const page = (items: unknown[]) => json({ items, total: items.length, page: 1, pageSize: 50 });
  stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .text()
        .then((text) => {
          sent.push({
            method: request.method,
            path,
            body: text ? (JSON.parse(text) as unknown) : undefined,
            ifMatch: request.headers.get('if-match'),
          });
        });
      if (path.startsWith('/api/v1/approvals/')) return json({}, 200);
      if (path.endsWith('/unavailable') || path.endsWith('/out-of-service')) return json({}, 200);
      return json({ items: [{ ...change, ref: 'PMC-2026-0042' }] }, 202);
    }
    switch (path) {
      case '/api/v1/masters/muster-points':
        return page([helideck, camp]);
      case '/api/v1/masters/muster-points/options':
        return json({ locations: [das, zrk], installations: [] });
      case '/api/v1/masters/lifeboats':
        return page([boat1]);
      case '/api/v1/masters/lifeboats/options':
        return json({ locations: [das] });
      case '/api/v1/masters/lifeboats/capacity':
        return json(capacity);
      case '/api/v1/masters/essential-positions':
        return page([cook]);
      case '/api/v1/masters/essential-positions/options':
        return json({ locations: [das, zrk], designations: ['Cook', 'Radar Technician'] });
      case '/api/v1/masters/essential-positions/unmapped':
        return json({
          location: zrk,
          items: [{ designation: 'Radar Technician', sitesMapped: 18 }],
        });
      case `/api/v1/masters/essential-positions/${cook.id}/timeline`:
        return json({
          items: [
            {
              id: id(31),
              classification: 'essential',
              minCount: 1,
              criticality: null,
              notes: null,
              effectiveFrom: '2026-11-01',
              effectiveTo: null,
              isActive: true,
            },
            {
              id: id(30),
              classification: 'non-essential',
              minCount: null,
              criticality: null,
              notes: null,
              effectiveFrom: '2026-01-01',
              effectiveTo: '2026-11-01',
              isActive: true,
            },
          ],
        });
      case '/api/v1/masters/pending-changes':
        return page([change]);
      case `/api/v1/masters/pending-changes/${change.id}`:
        return json(change);
      case '/api/v1/reason-codes/options':
        return json({
          mandatory: true,
          options: [{ code: 'REJ-NOJUST', description: 'Not justified' }],
        });
      default:
        return undefined;
    }
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe('SPEC-10-5.3 POB masters on the web: every change goes to a second person', () => {
  it('BRD-D.3.3.1 muster points show primary, unavailable and waiting; a change sends only what changed', async () => {
    const sent = stubPob();
    renderApp('/admin/muster-points', {
      access: accessWith({ 'admin.muster-points': EDITOR, 'admin.pending-changes': ['view'] }),
    });
    const table = await screen.findByRole('table', { name: 'Muster Points' });
    expect(await within(table).findByText('Primary')).toBeInTheDocument();
    expect(within(table).getByText('Unavailable')).toBeInTheDocument();
    expect(within(table).getByText('Muster only')).toBeInTheDocument();
    expect(
      within(table).getByText('Awaiting approval · Back in use · PMC-2026-0007'),
    ).toBeInTheDocument();
    expect(screen.getByText('Waiting for approval: 1 · View')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Actions for DAS-MA · Muster A — Helideck' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Change Muster A — Helideck' });
    expect(
      within(form).getByText(
        'This goes to a second person for approval; nothing changes until they approve it.',
      ),
    ).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('Capacity'));
    await user.type(within(form).getByLabelText('Capacity'), '90');
    await user.click(within(form).getByRole('checkbox', { name: 'Boat' }));
    await user.click(within(form).getByRole('button', { name: 'Send for approval' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'PATCH',
        path: `/api/v1/masters/muster-points/${helideck.id}`,
        body: { capacity: 90, evacuationModes: ['helicopter', 'boat'] },
        ifMatch: '2',
      });
    });
    expect(
      await screen.findByText(
        'Sent for a second person’s approval as PMC-2026-0042. It applies once approved.',
      ),
    ).toBeInTheDocument();
    await expectAccessible();
  });

  it('P-57 a point goes out of use at once, with a reason; a waiting record is not edited', async () => {
    const sent = stubPob();
    renderApp('/admin/muster-points', { access: accessWith({ 'admin.muster-points': EDITOR }) });
    await screen.findByRole('table', { name: 'Muster Points' });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for DAS-MC · Muster C — Camp' }),
    );
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Return to use' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(
      screen.getByRole('button', { name: 'Actions for DAS-MA · Muster A — Helideck' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Make unavailable' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Make DAS-MA · Muster A — Helideck unavailable?',
    });
    await within(dialog).findByRole('option', { name: 'REJ-NOJUST · Not justified' });
    await user.click(within(dialog).getByRole('button', { name: 'Make unavailable' }));
    expect(
      await within(dialog).findByText('Say why, in at least 3 characters'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Reason'), 'Helideck net damaged');
    await user.click(within(dialog).getByRole('button', { name: 'Make unavailable' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/masters/muster-points/${helideck.id}/unavailable`,
        body: { reason: 'Helideck net damaged' },
        ifMatch: '2',
      });
    });
  });

  it('BRD-D.3.3.2 lifeboats show counted capacity with the largest held back, and expired certificates', async () => {
    const sent = stubPob();
    renderApp('/admin/lifeboats', { access: accessWith({ 'admin.lifeboats': EDITOR }) });
    expect(await screen.findByText('210')).toBeInTheDocument();
    expect(screen.getByText('70 seats held back (largest craft per location)')).toBeInTheDocument();
    expect(screen.getByText('4 / 5')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Lifeboats' });
    expect(await within(table).findByText('Expired')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Actions for DAS-LB1 · Boat 1 · Das Island' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Take out of service' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Take DAS-LB1 · Boat 1 out of service?',
    });
    await user.type(within(dialog).getByRole('textbox'), 'Davit winch fault');
    await user.click(within(dialog).getByRole('button', { name: 'Take out of service' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/masters/lifeboats/${boat1.id}/out-of-service`,
        body: { reason: 'Davit winch fault' },
        ifMatch: '1',
      });
    });
    await expectAccessible();
  });

  it('P-58 a designation is classified at several sites at once; unmapped ones are flagged', async () => {
    const sent = stubPob();
    renderApp('/admin/essential-positions', {
      access: accessWith({ 'admin.essential-positions': EDITOR }),
    });
    const table = await screen.findByRole('table', { name: 'Essential Positions' });
    expect(await within(table).findByText('Cook')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New classification' }));
    const form = await screen.findByRole('dialog', { name: 'Classify a designation' });
    await user.type(within(form).getByLabelText('Designation'), 'Marine Pilot');
    await user.click(await within(form).findByRole('checkbox', { name: 'Das Island' }));
    await user.click(within(form).getByRole('checkbox', { name: 'Zirku Island' }));
    await user.type(within(form).getByLabelText('Effective from (blank: today)'), '2020-01-01');
    await user.click(within(form).getByRole('button', { name: 'Send for approval' }));
    expect(await within(form).findByText('Choose today or a later day')).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('Effective from (blank: today)'));
    await user.click(within(form).getByRole('button', { name: 'Send for approval' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/essential-positions',
          body: {
            designation: 'Marine Pilot',
            locationIds: [das.id, zrk.id],
            classification: 'essential',
            minCount: null,
            criticality: null,
            notes: null,
          },
        }),
      );
    });

    await user.click(screen.getByRole('tab', { name: 'Unmapped' }));
    await user.selectOptions(screen.getByLabelText('Location'), zrk.id);
    expect(await screen.findByText('Radar Technician')).toBeInTheDocument();
    expect(screen.getByText('Unmapped — flagged for review')).toBeInTheDocument();
    expect(screen.getByText('Classified at 18 sites')).toBeInTheDocument();
  });

  it('BRD-B.3.7-09 a classification’s timeline keeps what was in force', async () => {
    stubPob();
    renderApp('/admin/essential-positions', {
      access: accessWith({ 'admin.essential-positions': ['view'] }),
    });
    await screen.findByRole('table', { name: 'Essential Positions' });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Cook · Zirku Island' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Timeline' }));
    const drawer = await screen.findByRole('dialog', { name: 'Timeline of Cook · Zirku Island' });
    expect(await within(drawer).findByText('Since 1 Nov 2026')).toBeInTheDocument();
    expect(within(drawer).getByText('1 Jan 2026 – 1 Nov 2026')).toBeInTheDocument();
    expect(within(drawer).getByText('Minimum 1')).toBeInTheDocument();
  });

  it('SPEC-10-5.3 the second person sees before and after, and approves or returns with a reason', async () => {
    const sent = stubPob();
    renderApp('/admin/pending-changes', {
      access: accessWith({ 'admin.pending-changes': ['view', 'edit'] }),
    });
    const table = await screen.findByRole('table', { name: 'Pending Changes' });
    expect(await within(table).findByText('PMC-2026-0001')).toBeInTheDocument();
    expect(within(table).getByText('Your approval')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(table).getByText('PMC-2026-0001'));
    const drawer = await screen.findByRole('dialog', {
      name: 'PMC-2026-0001 · Change muster point DAS-MC · Muster C — Camp',
    });
    const values = within(drawer).getByRole('table', { name: 'Values before and after' });
    expect(within(values).getByRole('rowheader', { name: 'Capacity' })).toBeInTheDocument();
    expect(within(values).getByText('86')).toBeInTheDocument();
    expect(within(values).getByText('100')).toBeInTheDocument();
    expect(within(values).getByText('boat')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: 'Return' }));
    const confirm = within(drawer).getByRole('button', { name: 'Return change' });
    expect(confirm).toBeDisabled();
    await within(drawer).findByRole('option', { name: 'REJ-NOJUST · Not justified' });
    await user.selectOptions(within(drawer).getByLabelText('Reason code'), 'REJ-NOJUST');
    await user.type(within(drawer).getByLabelText('Comment'), 'Capacity not surveyed');
    await user.click(confirm);
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/approvals/tasks/${id(81)}/reject`,
        body: { reasonCode: 'REJ-NOJUST', comment: 'Capacity not surveyed' },
        ifMatch: '1',
      });
    });
    expect(
      await within(drawer).findByText('Returned to its maker. Nothing changes.'),
    ).toBeInTheDocument();
    await expectAccessible();
  });

  it('SPEC-10-5.3 an approval says so while the change is still being applied', async () => {
    let approved = false;
    stubFetch((path, request) => {
      if (path === `/api/v1/approvals/tasks/${id(81)}/approve` && request.method === 'POST') {
        approved = true;
        return json({}, 200);
      }
      if (path === '/api/v1/masters/pending-changes') {
        return json({ items: [change], total: 1, page: 1, pageSize: 20 });
      }
      // Approved, the task is gone; the worker hasn't applied it yet.
      if (path === `/api/v1/masters/pending-changes/${change.id}`) {
        return json(approved ? { ...change, myTask: null } : change);
      }
      return undefined;
    });
    renderApp('/admin/pending-changes', {
      access: accessWith({ 'admin.pending-changes': ['view', 'edit'] }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByText('PMC-2026-0001'));
    const drawer = await screen.findByRole('dialog', { name: /^PMC-2026-0001/ });
    await user.click(within(drawer).getByRole('button', { name: 'Approve' }));
    expect(
      await within(drawer).findByText('Approved. The change applies in a moment.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(approved).toBe(true);
    });
    expect(
      within(drawer).queryByText(
        'Waiting for a second person who holds the approval right at this location.',
      ),
    ).not.toBeInTheDocument();
  });
});
