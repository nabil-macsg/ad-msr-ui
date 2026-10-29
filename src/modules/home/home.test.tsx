import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import { accessWith, json, ME, renderApp, stubFetch } from '../../../test/render-app';
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

describe('SPEC-10-1.1 home', () => {
  it('greets the user with today and their role, and shows the widgets their roles see', async () => {
    stubFetch((path) => (path === '/api/v1/home' ? json(HOME) : undefined));
    const [passengerRole] = ME.roles;
    if (!passengerRole) throw new Error('ME has no role');
    renderApp('/dashboard', {
      me: {
        ...ME,
        roles: [
          passengerRole,
          { ...passengerRole, code: 'pob-master-data-power-user', name: 'POB Master Data' },
        ],
      },
    });
    expect(
      await screen.findByRole('heading', { name: 'Hello, Ahmed', level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Thursday 15 October 2026 · What is happening today, as Passenger (and 1 more)',
      ),
    ).toBeInTheDocument();

    const approvals = await screen.findByRole('region', { name: 'Awaiting your approval' });
    expect(within(approvals).getByText('Overdue: 1')).toBeInTheDocument();
    const overdue = within(approvals).getByRole('link', {
      name: /PMC-2026-0001 · Change muster point NASR-MB/,
    });
    expect(overdue).toHaveAttribute('href', '/admin/pending-changes');
    expect(within(overdue).getByText('Overdue')).toBeInTheDocument();
    expect(within(overdue).getByText('Due 14 Oct 2026, 10:00')).toBeInTheDocument();
    // A task with nowhere to open is listed, not linked.
    expect(within(approvals).getByText('critical-cutoff-auh').closest('a')).toBeNull();

    const delegations = screen.getByRole('link', { name: /Acting for others/ });
    expect(delegations).toHaveAttribute('href', '/account');
    expect(
      within(delegations).getByText('You delegate to others: 0 · Scheduled: 2'),
    ).toBeInTheDocument();
    // A widget that failed says so; one this app doesn't know is not shown.
    expect(screen.getByText('Could not load just now.')).toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
    await expectAccessible();
  });

  it("lists today's flights and voyages, departure first, each opening on the dashboard", async () => {
    const today: Home = {
      today: '2026-10-15',
      widgets: [
        widget({
          key: 'scheduling.today',
          kind: 'list',
          value: 2,
          params: { withoutTime: 1 },
          tone: 'warning',
          link: '/scheduling',
          items: [
            {
              id: 'j1',
              title: 'ADA101 · Abu Dhabi → Das Island',
              detail: 'Dash 8-300 · 23 / 50',
              at: '2026-10-15T03:00:00Z',
              tone: 'info',
              status: 'scheduled',
              link: '/scheduling?q=ADA101&filter[from]=2026-10-15&filter[to]=2026-10-15',
            },
            {
              id: 'j2',
              title: 'FAL203 · Das Island → Lower Zakum',
              detail: 'Bell 412 · 0 / 12',
              at: null,
              tone: 'danger',
              status: 'cancelled',
              link: '/scheduling?q=FAL203&filter[from]=2026-10-15&filter[to]=2026-10-15',
            },
          ],
        }),
      ],
    };
    stubFetch((path) => (path === '/api/v1/home' ? json(today) : undefined));
    renderApp('/dashboard');
    const list = await screen.findByRole('region', { name: "Today's flights and voyages" });
    expect(within(list).getByText(/^Without a departure time: 1/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/scheduling');
    const [first, second] = within(list).getAllByRole('listitem');
    if (!first || !second) throw new Error('Two journeys expected');
    // Departure first, in GST.
    expect(first.textContent).toMatch(/^07:00ADA101 · Abu Dhabi → Das Island/);
    expect(within(first).getByText('Scheduled')).toBeInTheDocument();
    expect(within(first).getByRole('link')).toHaveAttribute(
      'href',
      '/scheduling?q=ADA101&filter[from]=2026-10-15&filter[to]=2026-10-15',
    );
    expect(second.textContent).toMatch(/^No timeFAL203/);
    expect(within(second).getByText('Cancelled')).toBeInTheDocument();
    await expectAccessible();
  });

  it('says so when the home page cannot be loaded', async () => {
    stubFetch((path) =>
      path === '/api/v1/home'
        ? json({ error: { code: 'INTERNAL', message: 'Down', correlationId: 'x' } }, 500)
        : undefined,
    );
    renderApp('/dashboard');
    expect(
      await screen.findByText('Your home page could not be loaded. Try again.'),
    ).toBeInTheDocument();
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
