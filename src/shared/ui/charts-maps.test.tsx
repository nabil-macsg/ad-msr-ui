import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import { DonutChart } from './donut-chart';
import { MapView } from './map-view';
import { SeatMap } from './seat-map';

describe('PROMPT-4.2 DonutChart', () => {
  it('PROMPT-4.2 states its numbers in text, not only in colour', async () => {
    const { container } = render(
      <DonutChart
        title="Decks"
        slices={[
          { label: 'Current', value: 18, tone: 'success' },
          { label: 'Expired', value: 2, tone: 'danger' },
          { label: 'None', value: 0, tone: 'neutral' },
        ]}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Decks: Current 18, Expired 2, None 0' }),
    ).toBeInTheDocument();
    const legend = screen.getByRole('list');
    expect(within(legend).getByText('Current').closest('li')).toHaveTextContent('18');
    expect(screen.getByText('20')).toBeInTheDocument();
    await expectAccessible(container);
  });
});

describe('PROMPT-4.2 SeatMap', () => {
  it('spec-20-5 free seats can be chosen; taken and blocked ones cannot', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(
      <SeatMap
        layout={{ rows: 2, columns: ['A', '', 'B'] }}
        seats={{ '1A': 'taken', '2B': 'blocked', '2A': 'selected' }}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('button', { name: 'Seat 1A, taken' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Seat 2B, blocked' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Seat 2A, selected' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Seat 1B, free' }));
    expect(onSelect).toHaveBeenCalledWith('1B');
    await expectAccessible(container);
  });

  it('spec-20-5 a read-only map chooses nothing', () => {
    render(<SeatMap layout={{ rows: 1, columns: ['A'] }} seats={{}} readOnly />);
    expect(screen.getByRole('button', { name: 'Seat 1A, free' })).toBeDisabled();
  });
});

describe('ADR-0011 MapView', () => {
  it('ADR-0011 draws markers on Leaflet and lists them for screen readers', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <MapView
        tiles={{ url: '', attribution: '' }}
        markers={[
          { id: 'das', lat: 25.15, lng: 52.87, label: 'Das Island', tone: 'success' },
          { id: 'zirku', lat: 24.88, lng: 53.07, label: 'Zirku Island' },
        ]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('region', { name: 'Map' })).toBeInTheDocument();
    expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(2);
    expect(container.querySelector('.leaflet-tile-pane')?.children).toHaveLength(0);
    await user.click(screen.getByTitle('Das Island'));
    expect(onSelect).toHaveBeenCalledWith('das');

    rerender(
      <MapView
        tiles={{ url: '', attribution: '' }}
        markers={[{ id: 'das', lat: 25.15, lng: 52.87, label: 'Das Island' }]}
      />,
    );
    expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1);
    expect(screen.getByText('Das Island', { selector: 'li' })).toBeInTheDocument();
  });

  it('ADR-0011 takes its tiles from runtime config', () => {
    const { container } = render(
      <MapView
        tiles={{ url: 'https://tiles.masar.example/{z}/{x}/{y}.png', attribution: 'Tiles' }}
        markers={[]}
      />,
    );
    expect(container.querySelector('.leaflet-tile-pane')?.children.length).toBeGreaterThan(0);
  });
});
