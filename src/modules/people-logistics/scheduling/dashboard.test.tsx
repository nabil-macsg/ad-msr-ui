import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Journey, SchedulingDashboard } from './scheduling-api';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });

const journey: Journey = {
  id: id(1),
  flightNumber: 'ADA101',
  serviceDate: '2026-10-18',
  departureAt: '2026-10-18T03:00:00.000Z',
  arrivalAt: '2026-10-18T04:15:00.000Z',
  route: {
    ...ref(2, 'AUH-DAS-FW', 'Abu Dhabi → Das Island'),
    stops: [ref(3, 'AUH', 'Abu Dhabi'), ref(4, 'DAS', 'Das Island')],
    type: 'auh',
  },
  mode: 'fixed-wing',
  category: 'FIXED-WING',
  resourceType: ref(5, 'DASH8-300', 'Dash 8-300'),
  fleet: { id: id(6), registration: 'A6-ADA' },
  serviceProvider: ref(7, 'ADA', 'Abu Dhabi Aviation'),
  source: { kind: 'recurring', id: id(8), ref: 'RS-001' },
  status: 'scheduled',
  gate: null,
  seats: { capacity: 50, booked: 31, pending: 4, waitlisted: 2, quota: 2 },
  cutoffAt: '2026-10-17T06:00:00.000Z',
  flags: ['resource-overlap'],
  compatibility: null,
  departureAssigned: false,
  weather: null,
  version: 1,
};
const rotation: Journey = {
  ...journey,
  id: id(10),
  flightNumber: 'FAL201',
  mode: 'rotary-wing',
  category: 'ROTARY-WING',
  seats: { capacity: 12, booked: 0, pending: 0, waitlisted: 0, quota: null },
  flags: [],
  compatibility: {
    outcome: 'flag',
    reasons: [
      {
        location: ref(4, 'DAS', 'Das Island'),
        code: 'T_NOT_MET',
        message: "Das Island Helideck: T 7 t is less than the AW189's 8.6 t.",
      },
    ],
  },
  weather: {
    level: 'adverse',
    location: ref(4, 'DAS', 'Das Island'),
    summary: 'Sea state above limits; strong north-westerly winds',
    recommendation: null,
  },
};
const dashboard: SchedulingDashboard = {
  date: '2026-10-15',
  kpis: {
    activeRecurringSchedules: 17,
    activeAdhocMovements: 5,
    unassignedFleetResources: 3,
    movementsPublished: 1820,
    journeysWithoutDepartureTime: 52,
    compatibilityFlags: 4,
    requestsNeedingRoute: 3,
  },
  categories: [
    { code: 'FIXED-WING', name: 'Fixed wing', baseMode: 'fixed-wing' },
    { code: 'HOVERCRAFT', name: 'Hovercraft', baseMode: 'marine' },
    { code: 'MARINE', name: 'Marine', baseMode: 'marine' },
    { code: 'ROTARY-WING', name: 'Rotary wing', baseMode: 'rotary-wing' },
  ],
  conflicts: [
    {
      kind: 'overlap',
      fleet: { id: id(6), registration: 'A6-ADA' },
      serviceDate: '2026-10-18',
      journeys: [
        { id: id(1), flightNumber: 'ADA101' },
        { id: id(9), flightNumber: 'ADA103' },
      ],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('SPEC-20-2.1 the Scheduling Dashboard', () => {
  it('shows the cards, the conflicts and the day’s departures; the mode tabs filter', async () => {
    const asked: string[] = [];
    stubFetch((path, request) => {
      if (path === '/api/v1/scheduling/dashboard') return json(dashboard);
      if (path === '/api/v1/scheduling/journeys') {
        asked.push(new URL(request.url).search);
        return json({ items: [journey, rotation], total: 2, page: 1, pageSize: 20 });
      }
      return undefined;
    });
    renderApp('/scheduling?filter[from]=2026-10-18&filter[to]=2026-10-18', {
      access: accessWith({ 'scheduling.dashboard': ['view'] }),
    });
    expect(await screen.findByText('1820')).toBeInTheDocument();
    expect(screen.getByText('Journeys Without a Departure Time')).toBeInTheDocument();
    expect(
      screen.getByText('A6-ADA on 18 Oct 2026: ADA101, ADA103 at the same time'),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Departures on 18 Oct 2026' });
    expect(await within(table).findByText('ADA101')).toBeInTheDocument();
    expect(within(table).getAllByText('07:00')).toHaveLength(2);
    expect(within(table).getByText('Resource double-booked')).toBeInTheDocument();
    expect(within(table).getByText('Quota held: 2')).toBeInTheDocument();
    expect(within(table).getByText('31 / 50')).toBeInTheDocument();
    expect(within(table).getByText('Pending 4 · waitlisted 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Requests needing a route/ })).toHaveAttribute(
      'href',
      '/scheduling/requests?filter[kind]=no-route',
    );
    expect(within(table).getAllByText('17 Oct 2026, 10:00')).toHaveLength(2);
    // SCH-R3: a helideck flag shows with its reason (P-61).
    expect(within(table).getByText('Helideck flag')).toBeInTheDocument();
    expect(
      within(table).getByText("Das Island Helideck: T 7 t is less than the AW189's 8.6 t."),
    ).toBeInTheDocument();
    expect(screen.getByText('Compatibility flags')).toBeInTheDocument();
    // SCH-R7: the NCM advisory shows on the journey, as advice.
    expect(within(table).getByText('Adverse weather at DAS')).toBeInTheDocument();
    expect(
      within(table).getByText('Sea state above limits; strong north-westerly winds'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Journeys Without a Departure Time/ })).toHaveAttribute(
      'href',
      '/scheduling/board',
    );

    // The tabs are the master's active categories by name, All first; one with no journeys too.
    const tabs = within(screen.getByRole('group', { name: 'Modes' }));
    expect(tabs.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All',
      'Fixed wing',
      'Hovercraft',
      'Marine',
      'Rotary wing',
    ]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rotary wing' }));
    expect(screen.getByRole('button', { name: 'Rotary wing' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => {
      expect(asked.at(-1)).toContain('filter[category]=ROTARY-WING');
    });
    await user.click(screen.getByRole('button', { name: 'Hovercraft' }));
    await waitFor(() => {
      expect(asked.at(-1)).toContain('filter[category]=HOVERCRAFT');
    });
    await expectAccessible();
  });
});
