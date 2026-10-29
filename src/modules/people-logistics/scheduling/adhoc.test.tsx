import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { AdhocMovement, ScheduleOptions, Suggestion } from './scheduling-api';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });
const auh = ref(1, 'AUH', 'Abu Dhabi');
const uz = ref(2, 'UZ', 'Upper Zakum');
const lz = ref(3, 'LZ', 'Lower Zakum');
const acpt = ref(4, 'ACPT', 'ACPT');

const multiStop = {
  ...ref(10, 'AUH-ACPT-MAR', 'Abu Dhabi → ACPT'),
  revision: 1,
  category: 'MARINE',
  baseMode: 'marine' as const,
  stops: [auh, uz, lz, acpt],
};
const options: ScheduleOptions = {
  routes: [
    multiStop,
    {
      ...ref(11, 'AUH-DAS-FW', 'Abu Dhabi → Das Island'),
      revision: 1,
      category: 'FIXED-WING',
      baseMode: 'fixed-wing',
      stops: [auh, ref(5, 'DAS', 'Das Island')],
    },
  ],
  resourceTypes: [
    { ...ref(20, 'SUPPLY-VESSEL', 'Supply Vessel'), category: 'MARINE', baseMode: 'marine' },
    { ...ref(21, 'DASH8-300', 'Dash 8-300'), category: 'FIXED-WING', baseMode: 'fixed-wing' },
  ],
  fleet: [],
  serviceProviders: [ref(40, 'AML', 'ADNOC Marine Logistics')],
};
const suggestion: Suggestion = {
  groups: [
    {
      date: '2026-10-25',
      route: multiStop,
      requestIds: [id(91), id(92), id(93)],
      distanceKm: 182.4,
      resourceType: { ...ref(20, 'SUPPLY-VESSEL', 'Supply Vessel'), capacity: 40 },
    },
  ],
  unplaced: [{ requestId: id(94), reason: 'no-route' }],
};
const created: AdhocMovement = {
  id: id(60),
  ref: 'AH-006',
  flightNumber: 'AML951',
  serviceProvider: ref(40, 'AML', 'ADNOC Marine Logistics'),
  route: {
    ...ref(10, 'AUH-ACPT-MAR', 'Abu Dhabi → ACPT'),
    revision: 1,
    stops: [auh, uz, lz, acpt],
  },
  mode: 'ferry',
  resourceType: ref(20, 'SUPPLY-VESSEL', 'Supply Vessel'),
  fleet: null,
  serviceDate: '2026-10-25',
  departureTime: '05:00',
  arrivalTime: null,
  purpose: 'Unscheduled requests',
  journey: { id: id(61), status: 'scheduled', booked: 0 },
  requests: 3,
  warnings: [],
  isActive: true,
  deactivatedReason: null,
  version: 1,
  updatedAt: '2026-10-21T08:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('BRD-A.3.3-05 an ad hoc movement for unscheduled requests', () => {
  it('opens with the movement that carries them, and takes them up on saving', async () => {
    const sent: { path: string; body: unknown }[] = [];
    stubFetch((path, request) => {
      if (request.method === 'POST') {
        void request
          .clone()
          .json()
          .then((body: unknown) => sent.push({ path, body }));
        if (path.endsWith('/suggest')) return json(suggestion);
        return json(created, 201);
      }
      if (path === '/api/v1/scheduling/adhoc-movements')
        return json({ items: [], total: 0, page: 1, pageSize: 20 });
      if (path === '/api/v1/scheduling/adhoc-movements/options') return json(options);
      return undefined;
    });
    renderApp(`/scheduling/adhoc?requests=${id(91)},${id(92)},${id(93)},${id(94)}`, {
      access: accessWith({ 'scheduling.adhoc': ['view', 'create', 'edit', 'deactivate'] }),
    });
    const form = await screen.findByRole('dialog', { name: 'New ad hoc movement' });
    const choice = await within(form).findByRole('radio', { name: /AUH-ACPT-MAR/ });
    expect(choice).toBeChecked();
    expect(within(form).getByText(/3 requests along AUH → UZ → LZ → ACPT/)).toBeInTheDocument();
    expect(within(form).getByText(/1 of the requests have no master route/)).toBeInTheDocument();
    await waitFor(() => expect(within(form).getByLabelText('Route')).toHaveValue(id(10)));
    expect(within(form).getByLabelText('Mode')).toHaveValue('ferry');
    expect(within(form).getByLabelText('Date')).toHaveValue('2026-10-25');
    await waitFor(() => expect(within(form).getByLabelText('Resource type')).toHaveValue(id(20)));
    await expectAccessible();

    const user = userEvent.setup();
    await user.type(within(form).getByLabelText('Flight / voyage no.'), 'aml951');
    await user.type(within(form).getByLabelText('Departure (GST)'), '05:00');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(sent.find((s) => s.path === '/api/v1/scheduling/adhoc-movements')).toBeDefined(),
    );
    expect(sent.find((s) => s.path === '/api/v1/scheduling/adhoc-movements')?.body).toEqual({
      flightNumber: 'AML951',
      routeId: id(10),
      mode: 'ferry',
      resourceTypeId: id(20),
      fleetId: null,
      serviceDate: '2026-10-25',
      departureTime: '05:00',
      arrivalTime: null,
      purpose: 'Unscheduled requests',
      requestIds: [id(91), id(92), id(93)],
    });
  });
});
