import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { UnscheduledRequest } from './scheduling-api';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });

const noMovement: UnscheduledRequest = {
  id: id(1),
  ref: 'BK-2026-0042',
  person: { id: id(2), name: 'Rajesh Nair', personnelNo: 'DH-20012' },
  category: ref(3, 'DH', 'Direct Hire'),
  origin: ref(4, 'DAS', 'Das Island'),
  destination: ref(5, 'LZ', 'Lower Zakum'),
  travelDate: '2026-10-25',
  requestedTime: '08:00',
  criticality: 'urgent',
  status: 'pending',
  reason: { code: 'TRV-DUTY', description: 'Duty' },
  kind: 'no-movement',
  route: {
    id: id(6),
    code: 'DAS-LZ-RW',
    name: 'Das Island → Lower Zakum',
    category: 'ROTARY-WING',
  },
  submittedAt: '2026-10-19T08:00:00.000Z',
};
const noRoute: UnscheduledRequest = {
  ...noMovement,
  id: id(7),
  ref: 'BK-2026-0043',
  person: { id: id(9), name: 'Joel Santos', personnelNo: 'CW-20101' },
  destination: ref(8, 'GHF', 'Ghasha Field'),
  criticality: 'normal',
  kind: 'no-route',
  route: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('BRD-A.2.3.2-10 Unscheduled Requests', () => {
  it('lists what each request lacks, with the way to set it up; the tabs filter', async () => {
    const asked: string[] = [];
    stubFetch((path, request) => {
      if (path === '/api/v1/scheduling/unscheduled-requests') {
        asked.push(new URL(request.url).search);
        return json({ items: [noMovement, noRoute], total: 2, page: 1, pageSize: 20 });
      }
      return undefined;
    });
    renderApp('/scheduling/requests', {
      access: accessWith({
        'scheduling.requests': ['view'],
        'scheduling.recurring': ['view', 'create'],
        'scheduling.adhoc': ['view', 'create'],
      }),
    });
    const table = await screen.findByRole('table', { name: 'Unscheduled requests' });
    await within(table).findByText('Rajesh Nair');
    const [, first, second] = within(table).getAllByRole('row');
    expect(first).toHaveTextContent('Rajesh Nair');
    expect(within(first as HTMLElement).getByText('No movement that day')).toBeInTheDocument();
    expect(
      within(first as HTMLElement).getByRole('link', { name: 'Set up schedule' }),
    ).toHaveAttribute('href', `/scheduling/recurring?new=1&route=${id(6)}&from=2026-10-25`);
    expect(
      within(first as HTMLElement).getByRole('link', { name: 'Create ad hoc' }),
    ).toHaveAttribute('href', `/scheduling/adhoc?requests=${id(1)}`);
    expect(within(second as HTMLElement).getByText('No route')).toBeInTheDocument();
    expect(within(second as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    expect(asked[0]).toContain('filter[from]=');

    await userEvent.setup().click(screen.getByRole('button', { name: 'No route' }));
    await waitFor(() => expect(asked.at(-1)).toContain('filter[kind]=no-route'));
    await expectAccessible();
  });
});

describe('SPEC-20-2.1 choosing requests to consolidate', () => {
  it('links the chosen requests to a new ad hoc movement', async () => {
    stubFetch((path) =>
      path === '/api/v1/scheduling/unscheduled-requests'
        ? json({ items: [noMovement, noRoute], total: 2, page: 1, pageSize: 20 })
        : undefined,
    );
    renderApp('/scheduling/requests', {
      access: accessWith({
        'scheduling.requests': ['view'],
        'scheduling.adhoc': ['view', 'create'],
      }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: 'Choose BK-2026-0042' }));
    await user.click(screen.getByRole('checkbox', { name: 'Choose BK-2026-0043' }));
    expect(screen.getByRole('link', { name: 'Create ad hoc from 2 chosen' })).toHaveAttribute(
      'href',
      `/scheduling/adhoc?requests=${id(1)},${id(7)}`,
    );
  });
});
