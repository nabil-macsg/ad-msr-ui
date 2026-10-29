import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { AuditEvent } from '../../../shared/audit/audit-trail';

const event = (n: number, extra: Partial<AuditEvent> = {}): AuditEvent => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  occurredAt: '2026-10-14T06:00:00Z',
  module: 'administration',
  actionType: 'reason-code.changed',
  actionLabel: `Reason code changed · DLY-${n}`,
  reason: null,
  referenceId: null,
  outcome: 'success',
  record: { type: 'reason-code', id: String(n), ref: `DLY-${n}`, label: 'Delay' },
  actor: { userId: null, role: 'Master Data Power User', label: 'Reem Al Kindi', onBehalfOf: null },
  before: { commentRequired: true },
  after: { commentRequired: false },
  source: { ip: '10.0.0.7', device: null, userAgent: null },
  correlationId: null,
  highRisk: false,
  ...extra,
});

function stubAudit() {
  const lists: URLSearchParams[] = [];
  stubFetch((path, request) => {
    const url = new URL(request.url);
    if (path === '/api/v1/audit-log') {
      lists.push(url.searchParams);
      return url.searchParams.get('cursor')
        ? json({ items: [event(3)], nextCursor: null })
        : json({
            items: [
              event(1, {
                outcome: 'denied',
                reason: 'Not your module',
                actor: {
                  userId: null,
                  role: null,
                  label: 'Saeed Al Kaabi',
                  onBehalfOf: { userId: 'x', label: 'Hamad Al Suwaidi' },
                },
              }),
              event(2),
            ],
            nextCursor: 'next',
          });
    }
    if (path === '/api/v1/audit-log/summary') {
      return json({
        entries: 3,
        held: 1200,
        people: 2,
        modules: 1,
        withChange: 3,
        retentionYears: 7,
      });
    }
    if (path === '/api/v1/audit-log/facets') {
      return json({
        modules: ['administration', 'people-logistics'],
        actionTypes: [
          { key: 'reason-code.changed', label: 'Reason code changed', module: 'administration' },
        ],
      });
    }
    if (path === '/api/v1/audit-log/retention') {
      return json({ auditYears: 7, recordsKept: true, outboxDays: 30, syncKeyDays: 30 });
    }
    return undefined;
  });
  return lists;
}

afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.3.1-MST the Audit Log page (spec 10 §4)', () => {
  it('BRD-D.2.3.1-MST shows the KPIs, each entry’s change and who, and more on request', async () => {
    const lists = stubAudit();
    renderApp('/admin/audit-log', { access: accessWith({ 'admin.audit-log': ['view'] }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Audit Log' })).toBeInTheDocument();
    expect(await screen.findByText('of 1200 held')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Audit Log' });
    expect(within(table).getAllByText('Comment required')[0]?.parentElement).toHaveTextContent(
      'Comment required: Yes → No',
    );
    expect(within(table).getByText('Refused')).toBeInTheDocument();
    expect(within(table).getByText('Not your module')).toBeInTheDocument();
    expect(within(table).getByText('on behalf of Hamad Al Suwaidi')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('7 years; never purged automatically')).toBeInTheDocument();
    // Export is for Admin only: offered with the export right.
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    await expectAccessible();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Show more' }));
    expect(await within(table).findByText('Reason code changed · DLY-3')).toBeInTheDocument();
    expect(lists.at(-1)?.get('cursor')).toBe('next');
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('BRD-D.2.3.1-MST filters by module and action, and by GST days', async () => {
    const lists = stubAudit();
    renderApp('/admin/audit-log', {
      access: accessWith({ 'admin.audit-log': ['view', 'export'] }),
    });
    const user = userEvent.setup();
    await screen.findByRole('table', { name: 'Audit Log' });
    await user.selectOptions(screen.getByLabelText('Module'), 'administration');
    await user.selectOptions(screen.getByLabelText('Action'), 'reason-code.changed');
    await user.type(screen.getByLabelText('From (GST)'), '2026-10-14');
    await waitFor(() => {
      const last = lists.at(-1);
      expect(last?.get('module')).toBe('administration');
      expect(last?.get('actionType')).toBe('reason-code.changed');
      expect(last?.get('from')).toBe('2026-10-13T20:00:00.000Z');
    });
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });
});
