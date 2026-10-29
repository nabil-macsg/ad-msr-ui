import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import { gstDayKey } from '../../../shared/time/format';
import { boardRange, canGiveTime, journeyEvent, journeyTone } from './planning-board';
import type { Journey, PlanningBoard } from './scheduling-api';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });
const today = gstDayKey(new Date());
const at = (time: string) => new Date(`${today}T${time}:00+04:00`).toISOString();

const timed: Journey = {
  id: id(1),
  flightNumber: 'ADA101',
  serviceDate: today,
  departureAt: at('07:00'),
  arrivalAt: at('08:15'),
  departureAssigned: false,
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
  seats: { capacity: 50, booked: 0, pending: 0, waitlisted: 0, quota: 2 },
  compatibility: null,
  cutoffAt: null,
  flags: [],
  weather: null,
  version: 3,
};
const caution: NonNullable<Journey['weather']> = {
  level: 'caution',
  location: ref(12, 'UZ', 'Upper Zakum'),
  summary: 'Wind gusting 25 kt; reduced visibility in haze',
  recommendation: null,
};
const untimed: Journey = {
  ...timed,
  id: id(10),
  flightNumber: 'FAL251',
  departureAt: null,
  arrivalAt: null,
  route: {
    ...ref(11, 'DAS-UZ-RW', 'Das Island → Upper Zakum'),
    stops: [ref(4, 'DAS', 'Das Island'), ref(12, 'UZ', 'Upper Zakum')],
    type: 'inter-field',
  },
  mode: 'rotary-wing',
  category: 'ROTARY-WING',
  fleet: null,
  source: { kind: 'recurring', id: id(13), ref: 'RS-004' },
  flags: ['no-time', 'no-resource'],
  weather: caution,
  version: 1,
};
const board = (available = true): PlanningBoard => ({
  from: today,
  to: today,
  journeys: [timed, untimed],
  categories: [
    { code: 'FIXED-WING', name: 'Fixed Wing', baseMode: 'fixed-wing' },
    { code: 'ROTARY-WING', name: 'Rotary Wing', baseMode: 'rotary-wing' },
    { code: 'MARINE', name: 'Marine', baseMode: 'marine' },
  ],
  weather: { available, from: today, to: today },
});

afterEach(() => vi.unstubAllGlobals());

describe('SPEC-20-2.1 the Planning Board', () => {
  it('shows a month as its full weeks, and a week Monday to Sunday', () => {
    const thursday = new Date('2026-10-15T08:00:00Z');
    expect(boardRange('month', thursday)).toEqual({ from: '2026-09-28', to: '2026-11-01' });
    expect(boardRange('week', thursday)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    // 23:00 UTC on Sunday 18 Oct is Monday 19 Oct in GST.
    expect(boardRange('week', new Date('2026-10-18T23:00:00Z'))).toEqual({
      from: '2026-10-19',
      to: '2026-10-25',
    });
  });

  it('SPEC-20-SCH-R7 marks weather and missing times in words and colour', () => {
    expect(journeyTone(timed)).toBe('info');
    expect(journeyTone(untimed)).toBe('warning');
    expect(journeyTone({ ...timed, weather: { ...caution, level: 'adverse' } })).toBe('danger');
    expect(journeyTone({ ...untimed, status: 'cancelled' })).toBe('neutral');
    expect(journeyEvent(untimed, (level) => `[${level}]`)).toMatchObject({
      title: 'FAL251 DAS → UZ · [caution]',
      untimed: true,
      start: `${today}T12:00:00+04:00`,
    });
  });

  it('BRD-A.3.3-03 gives a time only where the schedule leaves it open', () => {
    expect(canGiveTime(untimed, today)).toBe(true);
    expect(
      canGiveTime({ ...untimed, departureAt: at('09:00'), departureAssigned: true }, today),
    ).toBe(true);
    expect(canGiveTime(timed, today)).toBe(false);
    expect(canGiveTime({ ...untimed, status: 'cancelled' }, today)).toBe(false);
    expect(canGiveTime({ ...untimed, serviceDate: '2000-01-01' }, today)).toBe(false);
  });

  it('BRD-A.3.3-03 shows the calendar and gives an untimed journey its departure time', async () => {
    const sent: { ifMatch: string | null; body: unknown }[] = [];
    let given: Journey | null = null;
    stubFetch((path, request) => {
      if (path === '/api/v1/scheduling/planning-board') return json(board());
      if (path === '/api/v1/scheduling/journeys') {
        const items = given ? [] : [untimed];
        return json({ items, total: items.length, page: 1, pageSize: 8 });
      }
      if (path === `/api/v1/scheduling/journeys/${untimed.id}/departure-time`) {
        void request
          .clone()
          .json()
          .then((body) => sent.push({ ifMatch: request.headers.get('If-Match'), body }));
        given = {
          ...untimed,
          departureAt: at('08:30'),
          arrivalAt: at('09:10'),
          departureAssigned: true,
          flags: ['no-resource'],
          version: 2,
        };
        return json(given);
      }
      return undefined;
    });
    renderApp('/scheduling/board', {
      access: accessWith({ 'scheduling.board': ['view', 'edit'] }),
    });
    expect(await screen.findByRole('heading', { name: 'Planning Board' })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'No time FAL251 DAS → UZ · Weather caution' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '07:00 ADA101 AUH → DAS' })).toBeInTheDocument();
    const panel = screen.getByRole('region', { name: 'Departure times to give: 1' });
    await expectAccessible();

    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: 'Give time' }));
    const drawer = await screen.findByRole('dialog', { name: /FAL251/ });
    expect(within(drawer).getByText('Weather caution at Upper Zakum')).toBeInTheDocument();
    await user.type(within(drawer).getByLabelText('Departure (GST)'), '08:30');
    await user.type(within(drawer).getByLabelText('Arrival (GST, optional)'), '09:10');
    await user.click(within(drawer).getByRole('button', { name: 'Save time' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      ifMatch: '1',
      body: { departureTime: '08:30', arrivalTime: '09:10' },
    });
    expect(await within(drawer).findByText('Given on the Planning Board')).toBeInTheDocument();
    expect(
      within(drawer).getByRole('heading', { name: 'Change the departure time' }),
    ).toBeInTheDocument();
  });

  it("leaves a schedule's times to the schedule, and viewers without edit rights only look", async () => {
    stubFetch((path) => {
      if (path === '/api/v1/scheduling/planning-board') return json(board(false));
      if (path === '/api/v1/scheduling/journeys')
        return json({ items: [untimed], total: 1, page: 1, pageSize: 8 });
      return undefined;
    });
    renderApp('/scheduling/board', { access: accessWith({ 'scheduling.board': ['view'] }) });
    expect(await screen.findByText(/NCM weather is unavailable just now/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '07:00 ADA101 AUH → DAS' }));
    const drawer = await screen.findByRole('dialog', { name: /ADA101/ });
    expect(within(drawer).getByText(/RS-001 sets this journey’s time/)).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Save time' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    const panel = screen.getByRole('region', { name: 'Departure times to give: 1' });
    await user.click(within(panel).getByRole('button', { name: 'Details' }));
    expect(
      within(await screen.findByRole('dialog', { name: /FAL251/ })).queryByRole('button', {
        name: 'Save time',
      }),
    ).not.toBeInTheDocument();
  });
});
