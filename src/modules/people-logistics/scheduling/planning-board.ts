import { TZDate } from '@date-fns/tz';
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import type { CalendarEvent } from '../../../shared/ui/calendar';
import type { Tone } from '../../../shared/ui/tone';
import { GST } from '../../../shared/time/gst';
import type { Journey } from './scheduling-api';

export type BoardView = 'month' | 'week';

/** The UAE week runs Monday to Sunday, as the calendar shows it. */
const WEEK = { weekStartsOn: 1 } as const;
const key = (day: Date) => format(day, 'yyyy-MM-dd');

/** The GST days a view shows around an instant: a month's full weeks, or one week. */
export function boardRange(view: BoardView, anchor: Date): { from: string; to: string } {
  const at = new TZDate(anchor, GST);
  if (view === 'week') {
    const start = startOfWeek(at, WEEK);
    return { from: key(start), to: key(addDays(start, 6)) };
  }
  return {
    from: key(startOfWeek(startOfMonth(at), WEEK)),
    to: key(endOfWeek(endOfMonth(at), WEEK)),
  };
}

/** Weather first, then a missing time; a cancelled journey is greyed whatever else (PROMPT §4.1). */
export function journeyTone(j: Journey): Tone {
  if (j.status === 'cancelled') return 'neutral';
  if (j.weather?.level === 'adverse') return 'danger';
  if (j.weather || j.departureAt === null) return 'warning';
  return 'info';
}

/** A journey on the calendar: its number and stops, with the weather level in words. */
export function journeyEvent(
  j: Journey,
  weatherLabel: (level: NonNullable<Journey['weather']>['level']) => string,
): CalendarEvent {
  const stops = j.route.stops.map((s) => s.code).join(' → ');
  return {
    id: j.id,
    // An untimed journey sits at noon GST on its day: never across midnight.
    start: j.departureAt ?? `${j.serviceDate}T12:00:00+04:00`,
    title: `${j.flightNumber} ${stops}${j.weather ? ` · ${weatherLabel(j.weather.level)}` : ''}`,
    tone: journeyTone(j),
    untimed: j.departureAt === null,
  };
}

/**
 * A departure time may be given (A.3.3-03) to a planned journey from today on, when its schedule
 * gives none or the time was given here before. The server checks again.
 */
export const canGiveTime = (j: Journey, today: string): boolean =>
  j.status === 'scheduled' &&
  j.serviceDate >= today &&
  (j.departureAt === null || j.departureAssigned);
