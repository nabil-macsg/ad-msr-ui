import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { accessWith, renderApp, stubFetch } from '../../../test/render-app';

describe('PROMPT-4.2 full-screen layouts have no sidebar', () => {
  beforeEach(() => {
    stubFetch();
  });

  it('PROMPT-4.2 the staff check-in kiosk', async () => {
    renderApp('/dispatch/kiosk', { access: accessWith({ 'terminal.kiosk': ['view'] }) });
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('main')).toHaveClass('bg-kiosk-background');
  });

  it('PROMPT-4.2 the FIDS board shows a live GST clock', async () => {
    renderApp('/dispatch/fids', { access: accessWith({ 'terminal.fids': ['view'] }) });
    expect(await screen.findByText(/\d{2}:\d{2}:\d{2} GST/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('PROMPT-4.2 print layouts, with route parameters', async () => {
    renderApp('/dispatch/boarding-pass/leg-1', {
      access: accessWith({ 'terminal.boarding-pass': ['view'] }),
    });
    expect(await screen.findByText('In scope, not built yet')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
