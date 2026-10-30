import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accessWith, json, renderApp } from '../../test/render-app';
import { routeOf } from '../app/access/registry';
import { dispatch } from '../mock/core/router';
import { registerServices } from '../mock/services';

/** Answers every call from the demo's mock services, as the running demo does. */
beforeEach(() => {
  registerServices();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), window.location.origin), init);
    const text = ['GET', 'HEAD'].includes(request.method) ? '' : await request.text();
    const body: unknown = text ? JSON.parse(text) : undefined;
    const answer = await dispatch(request.method, new URL(request.url), request.headers, body);
    return answer ?? json({ error: { code: 'NOT_FOUND', message: 'Not in demo' } }, 404);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('the demo dashboards’ attention panels', () => {
  it('Booking Dashboard shows its tiles, recent bookings, departures and approvals', async () => {
    renderApp(routeOf('booking.dashboard'), {
      access: accessWith({ 'booking.dashboard': ['view'] }),
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Booking' })).toBeInTheDocument();
    expect(await screen.findByText('Pending Approvals', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recently Raised' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: "Today's departures" })).toBeInTheDocument();
  });

  it('POB Dashboard flags sites near their limit or short of lifeboat seats', async () => {
    renderApp(routeOf('pob.dashboard'), { access: accessWith({ 'pob.dashboard': ['view'] }) });
    const toggle = await screen.findByRole('button', { name: /Sites needing attention/ });
    const panel = toggle.closest('section');
    if (!panel) throw new Error('no panel');
    const links = await within(panel).findAllByRole('link');
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('/pob/asset?location='));

    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel).queryAllByRole('link')).toHaveLength(0);
  });
});
