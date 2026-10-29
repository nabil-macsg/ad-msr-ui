import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { ParamField, Rule, RuleDetail, RuleTypes } from './rules-api';

const field = (
  f: Partial<ParamField> & Pick<ParamField, 'kind' | 'key' | 'label'>,
): ParamField => ({
  min: null,
  max: null,
  step: null,
  unit: null,
  nullable: false,
  options: null,
  columns: null,
  minRows: null,
  maxRows: null,
  ...f,
});

const TYPES: RuleTypes = {
  types: [
    {
      key: 'CHECKIN_REMINDER_HOURS',
      module: 'people-logistics',
      label: 'Check-in reminder',
      description: 'How long before departure passengers are reminded to check in.',
      highImpact: false,
      ready: true,
      live: true,
      conditionFields: [],
      parameterFields: [
        field({
          kind: 'integer',
          key: 'hours',
          label: 'Hours before departure',
          min: 1,
          max: 72,
          unit: 'hours',
        }),
      ],
    },
    {
      key: 'CRITICAL_CUTOFF',
      module: 'people-logistics',
      label: 'Critical cut-off',
      description: 'When a booking must be approved by, before departure.',
      highImpact: true,
      ready: true,
      live: true,
      conditionFields: [
        {
          key: 'routeType',
          label: 'Route type',
          type: 'choice',
          options: [
            { value: 'auh', label: 'AUH (onshore) dispatch' },
            { value: 'inter-field', label: 'Inter-field' },
          ],
          unit: null,
        },
      ],
      parameterFields: [
        field({
          kind: 'integer',
          key: 'daysBefore',
          label: 'Days before departure (D-n)',
          min: 0,
          max: 30,
          unit: 'days',
        }),
        field({ kind: 'time', key: 'time', label: 'Time (GST)' }),
      ],
    },
    {
      key: 'STAY_MIN_HOURS',
      module: 'pob',
      label: 'Minimum stay',
      description: 'Shorter visits are re-attributed.',
      highImpact: false,
      ready: true,
      live: false,
      conditionFields: [],
      parameterFields: [field({ kind: 'integer', key: 'hours', label: 'Hours', min: 1, max: 168 })],
    },
    {
      key: 'ASP_SCORING',
      module: 'aviation-compliance',
      label: 'ASP response scoring',
      description: 'Defined in Phase 8.',
      highImpact: false,
      ready: false,
      live: false,
      conditionFields: [],
      parameterFields: [],
    },
  ],
};

const auh: Rule = {
  id: '00000000-0000-4000-8000-000000000701',
  code: 'critical-cutoff-auh',
  name: 'Critical cut-off (AUH dispatch)',
  module: 'people-logistics',
  type: 'CRITICAL_CUTOFF',
  typeLabel: 'Critical cut-off',
  highImpact: true,
  state: 'active',
  isActive: true,
  deactivatedReason: null,
  versionNo: 1,
  condition: { routeType: ['auh'] },
  parameters: { daysBefore: 1, time: '10:00' },
  summary: 'Approved by D-1 at 10:00 GST',
  priority: 100,
  startsAt: '2026-10-14T06:00:00Z',
  effectiveTo: null,
  pendingVersionNo: 2,
  version: 4,
  updatedAt: '2026-10-14T06:00:00Z',
};
const checkin: Rule = {
  ...auh,
  id: '00000000-0000-4000-8000-000000000702',
  code: 'checkin-reminder',
  name: 'Check-in reminder',
  type: 'CHECKIN_REMINDER_HOURS',
  typeLabel: 'Check-in reminder',
  highImpact: false,
  condition: {},
  parameters: { hours: 3 },
  summary: '3 hours before departure',
  pendingVersionNo: null,
  version: 2,
};
const version = (
  no: number,
  status: RuleDetail['versions'][number]['status'],
  inEffect: boolean,
  summary: string,
) => ({
  versionNo: no,
  status,
  inEffect,
  condition: {},
  parameters: {},
  summary,
  priority: 100,
  effectiveFrom: '2026-10-14T06:00:00Z',
  effectiveTo: null,
  startsAt: '2026-10-14T06:00:00Z',
  note: null,
  createdBy: no === 1 ? null : 'Dispatch Power User',
  createdAt: '2026-10-14T06:00:00Z',
  decidedAt: status === 'pending' ? null : '2026-10-14T06:00:00Z',
  decidedReason: null,
  approvalId: status === 'pending' ? '00000000-0000-4000-8000-000000000801' : null,
});
const TASK = { id: '00000000-0000-4000-8000-000000000901', version: 1 };
const auhDetail: RuleDetail = {
  ...auh,
  versions: [
    version(2, 'pending', false, 'Approved by D-1 at 09:00 GST'),
    version(1, 'approved', true, 'Approved by D-1 at 10:00 GST'),
  ],
  myTask: TASK,
};
const checkinDetail: RuleDetail = {
  ...checkin,
  versions: [version(1, 'approved', true, '3 hours before departure')],
  myTask: null,
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

function stubRules() {
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
      return json(
        path.startsWith('/api/v1/approvals')
          ? { instanceId: TASK.id, status: 'pending' }
          : checkinDetail,
        201,
      );
    }
    if (path === '/api/v1/business-rules')
      return json({ items: [auh, checkin], total: 2, page: 1, pageSize: 20 });
    if (path === '/api/v1/business-rules/types') return json(TYPES);
    if (path === '/api/v1/reason-codes/options') {
      return json({
        context: 'approver-rejection',
        mandatory: true,
        options: [
          {
            code: 'REJ-NOJUST',
            description: 'Insufficient justification',
            commentRequired: false,
            crewChange: false,
          },
        ],
      });
    }
    if (path === `/api/v1/business-rules/${auh.id}`) return json(auhDetail);
    if (path === `/api/v1/business-rules/${checkin.id}`) return json(checkinDetail);
    return undefined;
  });
  return sent;
}

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];
const renderRules = (rights: Right[] = EDITOR) =>
  renderApp('/admin/business-rules', { access: accessWith({ 'admin.business-rules': rights }) });

afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.2.2-MST the Business Rules page (spec 10 §3.2)', () => {
  it('BRD-D.2.2.2-MST lists rules with their condition, value, priority, version and state', async () => {
    stubRules();
    renderRules();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Business Rules' }),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Business Rules' });
    expect(await within(table).findByText('Approved by D-1 at 10:00 GST')).toBeInTheDocument();
    expect(
      await within(table).findByText('Route type: AUH (onshore) dispatch'),
    ).toBeInTheDocument();
    expect(within(table).getByText('Any case')).toBeInTheDocument();
    expect(within(table).getByText('v1 (v2 awaiting approval)')).toBeInTheDocument();
    expect(within(table).getAllByText('In effect')).toHaveLength(2);
    expect(await screen.findByText(/No rule in force for: Minimum stay\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New rule' })).toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-D.2.2.2-MST creates a rule with its type’s own parameters, validated', async () => {
    const sent = stubRules();
    renderRules();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New rule' }));
    const form = await screen.findByRole('dialog', { name: 'New business rule' });
    // Types not ready yet aren't offered.
    expect(
      within(form).queryByRole('option', { name: 'ASP response scoring' }),
    ).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Rule type'), 'CRITICAL_CUTOFF');
    expect(
      within(form).getByText(/High impact: this rule changes only once a Super Admin approves/),
    ).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Rule type'), 'CHECKIN_REMINDER_HOURS');
    await user.type(within(form).getByLabelText('Name'), 'Earlier check-in reminder');
    await user.type(within(form).getByLabelText('Code'), 'checkin-earlier');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByText('Enter a value')).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Hours before departure (hours)'), '2');
    await user.clear(within(form).getByLabelText('Priority'));
    await user.type(within(form).getByLabelText('Priority'), '10');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/business-rules',
        ifMatch: null,
        body: {
          code: 'checkin-earlier',
          name: 'Earlier check-in reminder',
          type: 'CHECKIN_REMINDER_HOURS',
          condition: {},
          parameters: { hours: 2 },
          priority: 10,
          effectiveTo: null,
        },
      });
    });
  });

  it('BRD-D.2.2.2-MST a change is a new version, from a later date if chosen', async () => {
    const sent = stubRules();
    renderRules();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Actions for Check-in reminder' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Check-in reminder' });
    expect(await within(form).findByText(/v1 · In effect · Reference seed/)).toBeInTheDocument();
    await expectAccessible();
    const hours = within(form).getByLabelText('Hours before departure (hours)');
    await user.clear(hours);
    await user.type(hours, '4');
    await user.click(within(form).getByLabelText('From a later date'));
    await user.type(within(form).getByLabelText('Date'), '2026-11-01');
    await user.type(within(form).getByLabelText('Time (GST)'), '06:00');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toEqual([
        {
          method: 'POST',
          path: `/api/v1/business-rules/${checkin.id}/versions`,
          ifMatch: '2',
          body: {
            condition: {},
            parameters: { hours: 4 },
            priority: 100,
            effectiveFrom: '2026-11-01T06:00:00+04:00',
            effectiveTo: null,
          },
        },
      ]);
    });
  });

  it('ADR-0043 a version awaiting approval is decided beside the rule; nothing else changes meanwhile', async () => {
    const sent = stubRules();
    renderRules();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Critical cut-off (AUH dispatch)' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', {
      name: 'Edit Critical cut-off (AUH dispatch)',
    });
    expect(await within(form).findByText('Version 2 awaits approval')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
    await user.click(within(form).getByRole('button', { name: 'Approve' }));
    await waitFor(() => {
      expect(sent).toEqual([
        {
          method: 'POST',
          path: `/api/v1/approvals/tasks/${TASK.id}/approve`,
          ifMatch: '1',
          body: {},
        },
      ]);
    });
  });

  it('BRD-D.2.2.1-MST the approver returns a version with a reason; an editor can withdraw it', async () => {
    const sent = stubRules();
    renderRules();
    const user = userEvent.setup();
    const open = async () => {
      await user.click(
        await screen.findByRole('button', { name: 'Actions for Critical cut-off (AUH dispatch)' }),
      );
      await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
      return screen.findByRole('dialog', { name: 'Edit Critical cut-off (AUH dispatch)' });
    };
    let form = await open();
    await user.click(await within(form).findByRole('button', { name: 'Return for changes' }));
    const confirmReturn = within(form).getByRole('button', { name: 'Return' });
    expect(confirmReturn).toBeDisabled();
    await user.selectOptions(
      await within(form).findByRole('combobox', { name: 'Reason code' }),
      'REJ-NOJUST',
    );
    await user.type(within(form).getByLabelText('Comment'), 'Say why 09:00.');
    await user.click(confirmReturn);
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/approvals/tasks/${TASK.id}/reject`,
        ifMatch: '1',
        body: { reasonCode: 'REJ-NOJUST', comment: 'Say why 09:00.' },
      });
    });

    form = await open();
    await user.click(await within(form).findByRole('button', { name: 'Withdraw' }));
    await user.type(within(form).getByLabelText('Why withdraw it'), 'Raised by mistake');
    await user.click(within(form).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/business-rules/${auh.id}/versions/2/withdraw`,
        ifMatch: '4',
        body: { reason: 'Raised by mistake' },
      });
    });
  });

  it('P-46 ending a high-impact rule says it needs approval', async () => {
    const sent = stubRules();
    renderRules();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Critical cut-off (AUH dispatch)' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'End' }));
    const dialog = screen.getByRole('dialog', { name: 'End Critical cut-off (AUH dispatch)?' });
    expect(within(dialog).getByText(/a Super Admin must approve the end/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Reason'), 'Cut-off moves to 09:00');
    await user.click(within(dialog).getByRole('button', { name: 'End' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/business-rules/${auh.id}/deactivate`,
        ifMatch: '4',
        body: { reason: 'Cut-off moves to 09:00' },
      });
    });
  });

  it('PROMPT-2.7 a viewer sees the rules without New, edit or End', async () => {
    stubRules();
    renderRules(['view']);
    expect(await screen.findByText('Approved by D-1 at 10:00 GST')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New rule' })).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Actions for Check-in reminder' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['History']);
  });
});
