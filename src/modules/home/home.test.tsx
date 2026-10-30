import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../test/render-app';
import { routeOf } from '../../app/access/registry';
import type { CoreDashboard } from '../../demo/core/core-api';
import type { Home, HomeWidget, SearchResults } from './home-api';

const widget = (partial: Partial<HomeWidget> & Pick<HomeWidget, 'key' | 'kind'>): HomeWidget => ({
  value: 0,
  params: {},
  tone: null,
  link: null,
  items: [],
  failed: false,
  ...partial,
});

const HOME: Home = {
  today: '2026-10-15',
  widgets: [
    widget({
      key: 'approvals.waiting',
      kind: 'list',
      value: 2,
      params: { overdue: 1 },
      tone: 'danger',
      items: [
        {
          id: 't1',
          title: 'PMC-2026-0001 · Change muster point NASR-MB',
          detail: 'POB Master Change · MASAR Administrator',
          at: '2026-10-14T06:00:00Z',
          tone: 'danger',
          status: 'overdue',
          link: '/admin/pending-changes',
        },
        {
          id: 't2',
          title: 'critical-cutoff-auh',
          detail: 'Business Rule',
          at: '2026-10-16T06:00:00Z',
          tone: null,
          status: null,
          link: null,
        },
      ],
    }),
    widget({
      key: 'delegations.mine',
      kind: 'stat',
      value: 1,
      params: { given: 0, scheduled: 2 },
      tone: 'info',
      link: '/account',
    }),
    widget({ key: 'access.expiring', kind: 'stat', value: null, failed: true }),
    widget({ key: 'pob.musters', kind: 'stat', value: 9 }),
  ],
};

const RESULTS: SearchResults = {
  q: 'maz',
  groups: [
    {
      key: 'people',
      items: [
        {
          id: 'u1',
          title: 'Latifa Al Mazrouei',
          detail: 'OPT-90043 · POB Master Data Officer',
          link: '/admin/users?q=l.almazrouei%40masar.example',
        },
      ],
      more: true,
      link: '/admin/users?q=maz',
    },
  ],
};

beforeEach(() => {
  window.__MASAR_CONFIG__ = { features: { ai: false } };
});
afterEach(() => vi.unstubAllGlobals());

// The Dashboard route now shows the original demo's dashboard (src/demo/core/DashboardPage):
// these tests were aligned with its content (KPIs, today's flights, approvals, notifications).
const DASHBOARD: CoreDashboard = {
  today: '2026-10-15',
  kpis: { approvals: 215, departures: 2, gone: 1, toGo: 1, boarding: 0, waitlisted: 7 },
  flights: [
    {
      id: 'f1',
      time: '07:00',
      flightNumber: 'ADA101',
      from: 'Abu Dhabi',
      to: 'Das Island',
      mode: 'Fixed Wing',
      resource: 'Dash 8-300',
      booked: 17,
      capacity: 50,
      status: 'Closed for Dispatch',
    },
    {
      id: 'f2',
      time: '08:00',
      flightNumber: 'ADA201',
      from: 'Das Island',
      to: 'Upper Zakum',
      mode: 'Rotary Wing',
      resource: 'AW139',
      booked: 4,
      capacity: 12,
      status: 'Cancelled',
    },
  ],
  approvals: {
    total: 215,
    items: [
      {
        id: 'a1',
        passenger: 'Priya Sharma',
        reference: 'BK-2026-0012',
        from: 'Abu Dhabi',
        to: 'Das Island',
        dayOffset: 1,
        overQuota: true,
        stage: 'Aviation Team',
        date: '2026-10-16',
      },
    ],
  },
  notices: [
    { id: 'n1', text: '9 people are past 90 continuous days offshore', tone: 'info', page: 'pob.overstay' },
  ],
};
const DASHBOARD_PATH = '/api/v1/demo/core/dashboard';

describe('SPEC-10-1.1 home', () => {
  it('greets the user with today and their role, and shows the day at a glance', async () => {
    stubFetch((path) => (path === DASHBOARD_PATH ? json(DASHBOARD) : undefined));
    renderApp('/dashboard');
    expect(
      await screen.findByRole('heading', { name: 'Hello, Ahmed', level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Thursday 15 October 2026 · what is happening today, as Passenger/),
    ).toBeInTheDocument();
    const approvals = screen.getByRole('link', { name: /Awaiting your approval/ });
    expect(within(approvals).getByText('215')).toBeInTheDocument();
    expect(approvals).toHaveAttribute('href', routeOf('booking.approvals'));
    expect(screen.getByText('1 gone · 1 still to go')).toBeInTheDocument();
    const pending = screen.getByRole('region', { name: /Pending approvals/ });
    expect(within(pending).getByText('Over quota')).toBeInTheDocument();
    const notices = screen.getByRole('region', { name: /Notifications/ });
    expect(
      within(notices).getByRole('link', { name: /past 90 continuous days/ }),
    ).toHaveAttribute('href', routeOf('pob.overstay'));
    await expectAccessible();
  });

  it("lists today's flights and voyages, departure first, with seats and status", async () => {
    stubFetch((path) => (path === DASHBOARD_PATH ? json(DASHBOARD) : undefined));
    renderApp('/dashboard');
    const list = await screen.findByRole('region', { name: /Today's flights and voyages/ });
    expect(within(list).getByText('2 published')).toBeInTheDocument();
    const [first, second] = within(list).getAllByRole('listitem');
    if (!first || !second) throw new Error('Two journeys expected');
    expect(first.textContent).toMatch(/^07:00ADA101 · Abu Dhabi → Das Island/);
    expect(within(first).getByText('17/50')).toBeInTheDocument();
    expect(within(second).getByText('Cancelled')).toBeInTheDocument();
  });

  it('says so when the home page cannot be loaded', async () => {
    stubFetch((path) =>
      path === DASHBOARD_PATH
        ? json({ error: { code: 'INTERNAL', message: 'Down', correlationId: 'x' } }, 500)
        : undefined,
    );
    renderApp('/dashboard');
    expect(await screen.findByText('The dashboard could not be loaded.')).toBeInTheDocument();
  });
});

describe('SPEC-10-1.3 global search', () => {
  it('P-59 finds what the user may see, grouped, and opens it', async () => {
    const asked: string[] = [];
    stubFetch((path, request) => {
      if (path === '/api/v1/home') return json(HOME);
      if (path === '/api/v1/search') {
        const q = new URL(request.url).searchParams.get('q') ?? '';
        asked.push(q);
        return json(q === 'maz' ? RESULTS : { q, groups: [] });
      }
      return undefined;
    });
    renderApp('/dashboard', { access: accessWith({ 'admin.users': ['view'] }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Search passengers/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Global search' });
    await user.type(within(dialog).getByLabelText('Global search'), 'zz');
    expect(await within(dialog).findByText('Nothing found for “zz”.')).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Global search'));
    await user.type(within(dialog).getByLabelText('Global search'), 'maz');
    const people = await within(dialog).findByRole('region', { name: 'People' });
    expect(within(people).getByText('OPT-90043 · POB Master Data Officer')).toBeInTheDocument();
    expect(within(people).getByRole('link', { name: 'See all People' })).toHaveAttribute(
      'href',
      '/admin/users?q=maz',
    );
    expect(asked).not.toContain('m');
    await user.click(within(people).getByRole('link', { name: /Latifa Al Mazrouei/ }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument();
    });
  });
});
