import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { Processes } from './workflow-draft';
import type { Workflow, WorkflowDetail } from './workflows-api';

const PROCESSES: Processes = {
  processes: [
    {
      key: 'general-passenger-booking',
      label: 'General Passenger Booking',
      module: 'people-logistics',
      conditionFields: [
        { key: 'destination', label: 'Destination', type: 'values', options: null, unit: null },
        { key: 'unscheduled', label: 'Unscheduled', type: 'flag', options: null, unit: null },
      ],
    },
    { key: 'hll-publication', label: 'HLL Publication', module: 'helideck', conditionFields: [] },
  ],
  rules: [
    { key: 'line-manager-of-passenger', label: 'Line Manager of passenger' },
    { key: 'site-in-charge-of-destination', label: 'Site In-charge of destination' },
  ],
  roles: [
    { code: 'aviation-team', name: 'Aviation Team' },
    { code: 'site-in-charge', name: 'Site In-charge' },
  ],
};

const booking: Workflow = {
  id: '00000000-0000-4000-8000-000000000601',
  code: 'general-passenger-booking',
  name: 'General Passenger Booking',
  module: 'people-logistics',
  process: 'general-passenger-booking',
  processLabel: 'General Passenger Booking',
  conditions: {},
  stages: 2,
  activeVersionNo: 1,
  isActive: true,
  deactivatedReason: null,
  version: 3,
  updatedAt: '2026-10-14T06:00:00Z',
};
const das: Workflow = {
  ...booking,
  id: '00000000-0000-4000-8000-000000000602',
  code: 'das-unscheduled',
  name: 'Das Island — unscheduled',
  conditions: { destination: ['DAS'], unscheduled: true },
  stages: 1,
  activeVersionNo: 2,
  version: 5,
};
const bookingDetail: WorkflowDetail = {
  ...booking,
  requests: 4,
  versions: [
    {
      versionNo: 1,
      status: 'active',
      conditions: {},
      createdAt: '2026-10-14T06:00:00Z',
      createdBy: null,
      stages: [
        {
          position: 1,
          name: 'Line Manager',
          approver: {
            kind: 'rule',
            roleCode: null,
            userId: null,
            rule: 'line-manager-of-passenger',
            label: 'Line Manager of passenger',
          },
          mode: 'any',
          slaHours: 24,
          reminderHours: null,
          escalation: null,
          skipCondition: null,
        },
        {
          position: 2,
          name: 'Site In-charge',
          approver: {
            kind: 'rule',
            roleCode: null,
            userId: null,
            rule: 'site-in-charge-of-destination',
            label: 'Site In-charge of destination',
          },
          mode: 'any',
          slaHours: 24,
          reminderHours: null,
          escalation: null,
          skipCondition: null,
        },
      ],
    },
  ],
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

function stubWorkflows() {
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
      if (request.method === 'PATCH') return json({ ...bookingDetail, version: 4 });
      return json(bookingDetail, 201);
    }
    if (path === '/api/v1/approval-workflows') {
      return json({ items: [booking, das], total: 2, page: 1, pageSize: 20 });
    }
    if (path === '/api/v1/approval-workflows/processes') return json(PROCESSES);
    if (path === `/api/v1/approval-workflows/${booking.id}`) return json(bookingDetail);
    return undefined;
  });
  return sent;
}

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'delete', 'export'];
const stageItem = (n: number) => {
  const item = screen.getByRole('heading', { name: `Stage ${n}` }).closest('li');
  if (!item) throw new Error(`No stage ${n}`);
  return within(item);
};

afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.2.1-MST the Approval Engine page (spec 10 §3.1)', () => {
  it('BRD-D.2.2.1-MST lists workflows with their process, conditions, stages and version', async () => {
    stubWorkflows();
    renderApp('/admin/approval-engine', {
      access: accessWith({ 'admin.approval-engine': EDITOR }),
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Approval Engine' }),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Approval Engine' });
    expect(await within(table).findByText('Das Island — unscheduled')).toBeInTheDocument();
    expect(
      await within(table).findByText('Destination: DAS · Unscheduled: Yes'),
    ).toBeInTheDocument();
    expect(within(table).getByText('Any request (fallback)')).toBeInTheDocument();
    expect(within(table).getByText('v2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New workflow' })).toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-D.2.2.1-MST creates a workflow: process, conditions and ordered stages, validated', async () => {
    const sent = stubWorkflows();
    renderApp('/admin/approval-engine', {
      access: accessWith({ 'admin.approval-engine': EDITOR }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New workflow' }));
    const form = await screen.findByRole('dialog', { name: 'New approval workflow' });
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Choose the process this workflow is for'),
    ).toBeInTheDocument();
    expect(within(form).getByText('Name the stage')).toBeInTheDocument();

    await user.type(within(form).getByLabelText('Name'), 'Das unscheduled');
    await user.type(within(form).getByLabelText('Code'), 'das-unscheduled');
    await user.selectOptions(within(form).getByLabelText('Process'), 'general-passenger-booking');
    await user.type(await within(form).findByLabelText('Destination'), 'DAS, ZRK');
    await user.selectOptions(within(form).getByLabelText('Unscheduled'), 'yes');

    await user.type(stageItem(1).getByLabelText('Stage name'), 'Site In-charge');
    await user.selectOptions(stageItem(1).getByLabelText('Approver'), 'rule');
    await user.selectOptions(stageItem(1).getByLabelText('Rule'), 'site-in-charge-of-destination');
    await user.click(within(form).getByRole('button', { name: 'Add stage' }));
    await user.type(stageItem(2).getByLabelText('Stage name'), 'Aviation Team');
    await user.selectOptions(stageItem(2).getByLabelText('Role'), 'aviation-team');
    await user.selectOptions(stageItem(2).getByLabelText('After the SLA'), 'line_manager');
    // Order matters: the Aviation Team goes first.
    await user.click(within(form).getByRole('button', { name: 'Move stage 2 up' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/approval-workflows',
        ifMatch: null,
        body: {
          code: 'das-unscheduled',
          name: 'Das unscheduled',
          process: 'general-passenger-booking',
          conditions: { destination: ['DAS', 'ZRK'], unscheduled: true },
          stages: [
            {
              name: 'Aviation Team',
              approver: { kind: 'role', roleCode: 'aviation-team' },
              mode: 'any',
              slaHours: 24,
              reminderHours: null,
              escalation: { kind: 'line_manager' },
              skipCondition: null,
            },
            {
              name: 'Site In-charge',
              approver: { kind: 'rule', rule: 'site-in-charge-of-destination' },
              mode: 'any',
              slaHours: 24,
              reminderHours: null,
              escalation: null,
              skipCondition: null,
            },
          ],
        },
      });
    });
  });

  it('BRD-D.2.2.1-MST a changed chain is saved as a new version, after any rename', async () => {
    const sent = stubWorkflows();
    renderApp('/admin/approval-engine', {
      access: accessWith({ 'admin.approval-engine': EDITOR }),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for General Passenger Booking' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit General Passenger Booking' });
    expect(
      await within(form).findByText('Requests that have used this workflow: 4'),
    ).toBeInTheDocument();
    expect(
      within(form).getByText('Line Manager of passenger → Site In-charge of destination'),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText('Process')).toBeDisabled();
    await expectAccessible();

    await user.clear(within(form).getByLabelText('Name'));
    await user.type(within(form).getByLabelText('Name'), 'Passenger booking');
    await user.clear(stageItem(2).getByLabelText('SLA (hours)'));
    await user.type(stageItem(2).getByLabelText('SLA (hours)'), '8');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(sent.map((s) => [s.method, s.path, s.ifMatch])).toEqual([
        ['PATCH', `/api/v1/approval-workflows/${booking.id}`, '3'],
        ['POST', `/api/v1/approval-workflows/${booking.id}/versions`, '4'],
      ]);
    });
    expect(sent[1]?.body).toMatchObject({
      conditions: {},
      stages: [{ slaHours: 24 }, { slaHours: 8 }],
    });
  });

  it('BRD-D.2.2.1-MST a rename alone makes no new version', async () => {
    const sent = stubWorkflows();
    renderApp('/admin/approval-engine', {
      access: accessWith({ 'admin.approval-engine': EDITOR }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByText('General Passenger Booking', { selector: 'p' }));
    const form = await screen.findByRole('dialog', { name: 'Edit General Passenger Booking' });
    await user.clear(await within(form).findByLabelText('Name'));
    await user.type(within(form).getByLabelText('Name'), 'Passenger booking');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent.map((s) => s.method)).toEqual(['PATCH']);
    });
  });

  it('PROMPT-2.7 a viewer sees the list without New or edit', async () => {
    stubWorkflows();
    renderApp('/admin/approval-engine', {
      access: accessWith({ 'admin.approval-engine': ['view'] }),
    });
    expect(await screen.findByText('Das Island — unscheduled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New workflow' })).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Actions for General Passenger Booking' }));
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'History' })).toBeInTheDocument();
  });
});
