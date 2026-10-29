import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import { CalendarMonth, CalendarWeek } from './calendar';

const NOW = new Date('2026-10-13T06:00:00Z');
const EVENTS = [
  { id: 'a', start: '2026-10-13T03:30:00Z', title: 'AH-001 Das Island' },
  // 01:30 GST on 14 Oct, though still 13 Oct in UTC.
  { id: 'b', start: '2026-10-13T21:30:00Z', title: 'Night transfer', tone: 'warning' as const },
  { id: 'c', start: '2026-10-16T05:00:00Z', title: 'Drill 1' },
  { id: 'd', start: '2026-10-16T06:00:00Z', title: 'Drill 2' },
  { id: 'e', start: '2026-10-16T07:00:00Z', title: 'Drill 3' },
  { id: 'f', start: '2026-10-16T08:00:00Z', title: 'Drill 4' },
];

const cellFor = (day: string) =>
  document.querySelector(`time[datetime="${day}"]`)?.closest('td') as HTMLElement;
const instant = (fn: { mock: { lastCall?: unknown[] | undefined } }) =>
  (fn.mock.lastCall?.[0] as Date).getTime();

describe('PROMPT-2.15 CalendarMonth', () => {
  it('PROMPT-2.15 lays the month out Monday to Sunday, with events on their GST day', async () => {
    const { container } = render(
      <CalendarMonth month={NOW} events={EVENTS} onMonthChange={() => undefined} now={NOW} />,
    );
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(within(cellFor('2026-10-13')).getByText(/AH-001 Das Island/)).toHaveTextContent('07:30');
    expect(within(cellFor('2026-10-14')).getByText(/Night transfer/)).toHaveTextContent('01:30');
    expect(within(cellFor('2026-10-16')).getByText('+1 more')).toBeInTheDocument();
    const days = [...container.querySelectorAll('td time')].map((t) => t.getAttribute('datetime'));
    expect([days[0], days.at(-1), days.length]).toEqual(['2026-09-28', '2026-11-01', 35]);
    await expectAccessible(container);
  });

  it('PROMPT-4.2 moves by month and back to today; events open', async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <CalendarMonth
        month={NOW}
        events={EVENTS}
        onMonthChange={onMonthChange}
        onSelect={onSelect}
        now={NOW}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(instant(onMonthChange)).toBe(Date.parse('2026-10-31T20:00:00Z')); // 1 Nov 00:00 GST
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(instant(onMonthChange)).toBe(Date.parse('2026-08-31T20:00:00Z')); // 1 Sep 00:00 GST
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(onMonthChange).toHaveBeenLastCalledWith(NOW);
    await user.click(screen.getByRole('button', { name: /Night transfer/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('SPEC-20-2.1 lists untimed events after the timed ones, and opens a busy day', async () => {
    const user = userEvent.setup();
    const onMore = vi.fn();
    render(
      <CalendarMonth
        month={NOW}
        events={[
          // Untimed: any instant that day; it still sorts after 07:30.
          { id: 'u', start: '2026-10-13T00:00:00Z', title: 'FAL251 DAS → UZ', untimed: true },
          ...EVENTS,
        ]}
        onMonthChange={() => undefined}
        onMore={onMore}
        now={NOW}
      />,
    );
    const chips = within(cellFor('2026-10-13')).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual([
      '07:30 AH-001 Das Island',
      'No time FAL251 DAS → UZ',
    ]);
    await user.click(within(cellFor('2026-10-16')).getByRole('button', { name: '+1 more' }));
    expect(instant(onMore)).toBe(Date.parse('2026-10-15T20:00:00Z')); // 16 Oct 00:00 GST
  });
});

describe('PROMPT-2.15 CalendarWeek', () => {
  it('PROMPT-2.15 shows Monday to Sunday with the day’s events', async () => {
    const user = userEvent.setup();
    const onWeekChange = vi.fn();
    const { container } = render(
      <CalendarWeek week={NOW} events={EVENTS} onWeekChange={onWeekChange} now={NOW} />,
    );
    expect(screen.getByRole('heading', { name: '12 Oct – 18 Oct 2026' })).toBeInTheDocument();
    const tuesday = screen.getByRole('region', { name: 'Tuesday 13 October' });
    expect(within(tuesday).getByText(/AH-001/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Friday 16 October' })).getAllByRole('button'),
    ).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(instant(onWeekChange)).toBe(Date.parse('2026-10-18T20:00:00Z')); // Mon 19 Oct GST
    await expectAccessible(container);
  });
});
