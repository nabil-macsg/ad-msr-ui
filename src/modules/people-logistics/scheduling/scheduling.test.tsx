import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { RecurringSchedule, ScheduleOptions } from './scheduling-api';

const PLANNER: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });
const auh = ref(1, 'AUH', 'Abu Dhabi');
const das = ref(2, 'DAS', 'Das Island');

const options: ScheduleOptions = {
  routes: [
    {
      ...ref(10, 'AUH-DAS-FW', 'Abu Dhabi → Das Island'),
      revision: 1,
      category: 'FIXED-WING',
      baseMode: 'fixed-wing',
      stops: [auh, das],
    },
    {
      ...ref(11, 'AUH-DAS-MAR', 'Abu Dhabi → Das Island'),
      revision: 1,
      category: 'MARINE',
      baseMode: 'marine',
      stops: [auh, das],
    },
  ],
  resourceTypes: [
    { ...ref(20, 'DASH8-300', 'Dash 8-300'), category: 'FIXED-WING', baseMode: 'fixed-wing' },
    { ...ref(21, 'FERRY', 'Ferry'), category: 'MARINE', baseMode: 'marine' },
  ],
  fleet: [
    {
      id: id(30),
      registration: 'A6-ADA',
      resourceTypeId: id(20),
      serviceProviderId: id(40),
      availability: 'available',
    },
    {
      id: id(31),
      registration: 'A6-FLA',
      resourceTypeId: id(20),
      serviceProviderId: id(41),
      availability: 'available',
    },
  ],
  serviceProviders: [ref(40, 'ADA', 'Abu Dhabi Aviation'), ref(41, 'FAL', 'Falcon Aviation')],
};

const shuttle: RecurringSchedule = {
  id: id(50),
  ref: 'RS-001',
  name: 'Abu Dhabi – Das Island Morning Shuttle',
  displayName: 'Abu Dhabi – Das Island Morning Shuttle',
  flightNumber: 'ADA101',
  serviceProvider: ref(40, 'ADA', 'Abu Dhabi Aviation'),
  route: { ...ref(10, 'AUH-DAS-FW', 'Abu Dhabi → Das Island'), revision: 1, stops: [auh, das] },
  mode: 'fixed-wing',
  resourceType: ref(20, 'DASH8-300', 'Dash 8-300'),
  fleet: null,
  days: [1, 2, 3, 4, 5, 6, 7],
  departureTime: '07:00',
  arrivalTime: '08:15',
  validFrom: '2026-08-24',
  validTo: '2026-12-22',
  journeys: { upcoming: 69, needingReassignment: 2 },
  warnings: [],
  isActive: true,
  deactivatedReason: null,
  version: 3,
  updatedAt: '2026-10-15T06:00:00Z',
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
}

function stub(): Sent[] {
  const sent: Sent[] = [];
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
          });
        });
      if (path.endsWith('/preview')) {
        return json({
          movements: 13,
          first: '2026-10-16',
          last: '2026-11-13',
          conflicts: [{ date: '2026-10-19', ref: 'RS-004' }],
          conflictCount: 1,
          warnings: ['Outbound numbers are usually odd; this route runs outbound.'],
        });
      }
      return json(shuttle, 201);
    }
    switch (path) {
      case '/api/v1/scheduling/recurring-schedules':
        return json({ items: [shuttle], total: 1, page: 1, pageSize: 20 });
      case '/api/v1/scheduling/recurring-schedules/options':
        return json(options);
      case `/api/v1/scheduling/recurring-schedules/${shuttle.id}/reassignment`:
        return json({
          items: [
            {
              id: id(60),
              flightNumber: 'ADA101',
              serviceDate: '2026-10-20',
              reason: 'Made by version 2; RS-001 has changed since.',
            },
          ],
        });
      default:
        return undefined;
    }
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe('BRD-A.3.3-02 recurring schedules on the web', () => {
  it('lists schedules with their pattern, unassigned resource and journeys to reassign', async () => {
    stub();
    renderApp('/scheduling/recurring', { access: accessWith({ 'scheduling.recurring': PLANNER }) });
    const table = await screen.findByRole('table', { name: 'Recurring Schedules' });
    expect(await within(table).findByText('ADA101')).toBeInTheDocument();
    expect(within(table).getByText('Daily')).toBeInTheDocument();
    expect(within(table).getByText('07:00 → 08:15 GST')).toBeInTheDocument();
    expect(within(table).getByText('Resource not assigned')).toBeInTheDocument();
    expect(within(table).getByText('To reassign: 2')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', {
        name: 'Actions for ADA101 · Abu Dhabi – Das Island Morning Shuttle',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Journeys to reassign' }));
    const drawer = await screen.findByRole('dialog', {
      name: 'Journeys to reassign · ADA101 · RS-001',
    });
    expect(
      await within(drawer).findByText('Made by version 2; RS-001 has changed since.'),
    ).toBeInTheDocument();
    await expectAccessible();
  });

  it('SPEC-20-2.1 the form previews what it makes, offers only matching choices, and saves', async () => {
    const sent = stub();
    renderApp('/scheduling/recurring', { access: accessWith({ 'scheduling.recurring': PLANNER }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New recurring schedule' }));
    const form = await screen.findByRole('dialog', { name: 'New recurring schedule' });
    await within(form).findByRole('option', { name: 'AUH-DAS-FW · Abu Dhabi → Das Island' });

    // A marine route offers ferry and crew boat, and marine types only.
    await user.selectOptions(within(form).getByLabelText('Route'), id(11));
    expect(within(form).getByLabelText('Mode')).toHaveValue('ferry');
    const types = within(form).getByLabelText('Resource type');
    expect(within(types).getByRole('option', { name: 'Ferry' })).toBeInTheDocument();
    expect(within(types).queryByRole('option', { name: 'Dash 8-300' })).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Route'), id(10));
    await user.type(within(form).getByLabelText('Flight / voyage no.'), 'ada102');
    await user.selectOptions(within(form).getByLabelText('Resource type'), id(20));
    // Only the operator's fleet is offered.
    expect(within(form).getByRole('option', { name: 'A6-ADA' })).toBeInTheDocument();
    expect(within(form).queryByRole('option', { name: 'A6-FLA' })).not.toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('Fleet resource'), id(30));
    await user.type(within(form).getByLabelText('Departure (GST)'), '07:00');
    await user.type(within(form).getByLabelText('Valid from'), '2026-10-16');
    await user.click(within(form).getByRole('checkbox', { name: 'Saturday' }));

    expect(
      await within(form).findByText('Movements from today: 13, 16 Oct 2026 – 13 Nov 2026.'),
    ).toBeInTheDocument();
    expect(
      within(form).getByText('Already running on 1 of these days: 19 Oct 2026 (RS-004).'),
    ).toBeInTheDocument();
    expect(
      within(form).getByText('Outbound numbers are usually odd; this route runs outbound.'),
    ).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/scheduling/recurring-schedules',
        body: {
          name: null,
          flightNumber: 'ADA102',
          routeId: id(10),
          mode: 'fixed-wing',
          resourceTypeId: id(20),
          fleetId: id(30),
          days: [1, 2, 3, 4, 5, 6],
          departureTime: '07:00',
          arrivalTime: null,
          validFrom: '2026-10-16',
          validTo: null,
        },
      });
    });
  });
});

describe('BRD-A.3.3-05 set up a schedule from an unscheduled request', () => {
  it('opens the New form with the request’s route and day, the mode following the route', async () => {
    stub();
    renderApp(`/scheduling/recurring?new=1&route=${id(11)}&from=2026-10-25`, {
      access: accessWith({ 'scheduling.recurring': PLANNER }),
    });
    const form = await screen.findByRole('dialog', { name: 'New recurring schedule' });
    await waitFor(() => expect(within(form).getByLabelText('Route')).toHaveValue(id(11)));
    expect(within(form).getByLabelText('Mode')).toHaveValue('ferry');
    expect(within(form).getByLabelText('Valid from')).toHaveValue('2026-10-25');
  });
});
