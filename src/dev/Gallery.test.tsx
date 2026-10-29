import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import Gallery from './Gallery';

describe('ADR-0034 the component gallery (local dev server only)', () => {
  it('ADR-0034 shows every component group', () => {
    render(
      <MemoryRouter>
        <Gallery />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Component gallery' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(7);
    expect(screen.getByRole('table', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Zones' })).toBeInTheDocument();
  });
});
