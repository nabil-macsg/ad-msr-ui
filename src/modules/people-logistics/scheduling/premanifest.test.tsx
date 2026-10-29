import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Journey, Premanifest, PremanifestLine } from './scheduling-api';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });
const das = ref(3, 'DAS', 'Das Island');
const uz = ref(4, 'UZ', 'Upper Zakum');

const journey: Journey = {
  id: id(1),
  flightNumber: 'FAL291',
  serviceDate: '2026-10-25',
  departureAt: '2026-10-25T04:00:00.000Z',
  arrivalAt: null,
  departureAssigned: false,
  route: {
    ...ref(2, 'DAS-UZ-RW', 'Das Island → Upper Zakum'),
    stops: [das, uz],
    type: 'inter-field',
  },
  mode: 'rotary-wing',
  category: 'ROTARY-WING',
  resourceType: ref(5, 'AW139', 'AW139'),
  fleet: null,
  serviceProvider: ref(6, 'FAL', 'Falcon Aviation'),
  source: { kind: 'recurring', id: id(7), ref: 'RS-005' },
  status: 'scheduled',
  gate: null,
  seats: { capacity: 12, booked: 13, pending: 0, waitlisted: 0, quota: null },
  compatibility: null,
  cutoffAt: null,
  flags: [],
  weather: null,
  version: 2,
};
const line = (
  n: number,
  decision: PremanifestLine['decision'],
  more: Partial<PremanifestLine> = {},
) =>
  ({
    id: id(100 + n),
    rank: n,
    decision,
    reason: decision === 'manifest' ? null : 'no-seat',
    manual: false,
    note: null,
    booking: { id: id(200 + n), ref: `BK-2026-01${n}`, status: 'approved' },
    person: { id: id(300 + n), name: `Passenger ${n}`, personnelNo: `DH-200${n}`, gender: 'M' },
    category: ref(9, 'DH', 'Direct Hire'),
    crewChange: false,
    vip: false,
    submittedAt: '2026-10-20T08:00:00.000Z',
    origin: das,
    destination: uz,
    reassignment: null,
    ...more,
  }) satisfies PremanifestLine;
const premanifest: Premanifest = {
  journey,
  dueAt: '2026-10-23T04:00:00.000Z',
  run: {
    id: id(50),
    runNo: 1,
    trigger: 'lead-time',
    status: 'draft',
    capacity: 12,
    reserveSeats: 0,
    waitlistCap: 1,
    generatedAt: '2026-10-23T04:00:00.000Z',
    publishedAt: null,
    counts: { manifest: 1, waitlist: 1, overCap: 0, excluded: 0 },
    version: 4,
  },
  lines: [line(10, 'manifest', { crewChange: true }), line(11, 'waitlist')],
  nonTimed: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('BRD-A.3.3-14 the Pre-manifest page', () => {
  it('shows the order and seats, and seats or publishes on request', async () => {
    const sent: { path: string; ifMatch: string | null; body: unknown }[] = [];
    stubFetch((path, request) => {
      if (request.method === 'POST') {
        void request
          .clone()
          .text()
          .then((text) =>
            sent.push({
              path,
              ifMatch: request.headers.get('If-Match'),
              body: text ? JSON.parse(text) : null,
            }),
          );
        return json(premanifest);
      }
      if (path === '/api/v1/scheduling/premanifest')
        return json({
          date: '2026-10-25',
          items: [{ journey, dueAt: premanifest.dueAt, run: premanifest.run }],
        });
      if (path === `/api/v1/scheduling/premanifest/${id(1)}`) return json(premanifest);
      return undefined;
    });
    renderApp(`/scheduling/premanifest?date=2026-10-25&journey=${id(1)}`, {
      access: accessWith({ 'scheduling.premanifest': ['view', 'create', 'edit'] }),
    });
    const table = await screen.findByRole('table', { name: 'Pre-manifest lines' });
    const [, first, second] = within(table).getAllByRole('row');
    expect(first).toHaveTextContent('Passenger 10');
    expect(within(first as HTMLElement).getByText('Crew change')).toBeInTheDocument();
    expect(within(first as HTMLElement).getByText('Seated')).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText('Waitlisted')).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText('No seat free')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FAL291/ })).toHaveTextContent('Seated 1 of 12');
    // Reserve seats are the Aviation Team's (booking.reserve-waitlist).
    expect(screen.queryByLabelText('Reserve seats for no-show backfill')).not.toBeInTheDocument();
    await expectAccessible();

    const user = userEvent.setup();
    await user.click(within(second as HTMLElement).getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      path: `/api/v1/scheduling/premanifest/${id(1)}/adjust`,
      ifMatch: '4',
      body: { action: 'manifest', lineId: id(111) },
    });

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish the pre-manifest?' });
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.path).toBe(`/api/v1/scheduling/premanifest/${id(1)}/publish`);
  });

  it('BRD-A.3.3-19 offers the reserve seats to holders of the capability only', async () => {
    stubFetch((path) => {
      if (path === '/api/v1/scheduling/premanifest') return json({ date: '2026-10-25', items: [] });
      if (path === `/api/v1/scheduling/premanifest/${id(1)}`) return json(premanifest);
      return undefined;
    });
    renderApp(`/scheduling/premanifest?date=2026-10-25&journey=${id(1)}`, {
      access: {
        ...accessWith({ 'scheduling.premanifest': ['view', 'edit'] }),
        capabilities: [{ key: 'booking.reserve-waitlist', restrictedTo: null }],
      },
    });
    expect(await screen.findByLabelText('Reserve seats for no-show backfill')).toHaveValue(0);
  });
});
