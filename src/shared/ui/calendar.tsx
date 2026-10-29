import { TZDate } from '@date-fns/tz';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { GST } from '../time/gst';
import { formatGstTime, gstDayKey } from '../time/format';
import { Button } from './button';
import { TONE_PILL, type Tone } from './tone';

export interface CalendarEvent {
  readonly id: string;
  /** An instant on the event's GST day; for an untimed event, any time that day. */
  readonly start: string;
  readonly title: string;
  readonly tone?: Tone;
  /** No time yet: listed after the day's timed events, labelled instead of a time. */
  readonly untimed?: boolean;
}

/** The UAE week runs Monday to Sunday. */
const WEEK = { weekStartsOn: 1 } as const;

function byDay(events: readonly CalendarEvent[]): Map<string, CalendarEvent[]> {
  const days = new Map<string, CalendarEvent[]>();
  const ordered = [...events].sort(
    (a, b) =>
      Number(a.untimed ?? false) - Number(b.untimed ?? false) || a.start.localeCompare(b.start),
  );
  for (const event of ordered) {
    const key = gstDayKey(event.start);
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return days;
}

function Navigation({
  label,
  onPrevious,
  onNext,
  onToday,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="mr-auto text-lg font-semibold text-ink" aria-live="polite">
        {label}
      </h2>
      <Button variant="secondary" onClick={onToday}>
        {t('ui.calendar.today')}
      </Button>
      <Button variant="ghost" aria-label={t('ui.calendar.previous')} onClick={onPrevious}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <Button variant="ghost" aria-label={t('ui.calendar.next')} onClick={onNext}>
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function EventChip({ event, onSelect }: { event: CalendarEvent; onSelect?: (id: string) => void }) {
  const { t } = useTranslation();
  const time = event.untimed ? t('ui.calendar.noTime') : formatGstTime(event.start);
  return (
    <button
      type="button"
      // The chip truncates in a month cell: the whole text on hover.
      title={`${time} ${event.title}`}
      onClick={() => onSelect?.(event.id)}
      className={cn(
        'block w-full truncate rounded-sm border px-1.5 py-0.5 text-left text-xs',
        TONE_PILL[event.tone ?? 'info'],
      )}
    >
      <span className="font-semibold">{time}</span> {event.title}
    </button>
  );
}

/** A month in GST: weeks Monday to Sunday, events per day (spec 20 §2, spec 40 calendars). */
export function CalendarMonth({
  month,
  events,
  onMonthChange,
  onSelect,
  onMore,
  maxPerDay = 3,
  now = new Date(),
}: {
  /** Any instant in the month to show. */
  month: Date;
  events: readonly CalendarEvent[];
  onMonthChange: (month: Date) => void;
  onSelect?: (id: string) => void;
  /** A day's "+n more", as a button: e.g. to open that day's week. */
  onMore?: (day: Date) => void;
  maxPerDay?: number;
  now?: Date;
}) {
  const { t } = useTranslation();
  const anchor = new TZDate(month, GST);
  const first = startOfMonth(anchor);
  const days = eachDayOfInterval({
    start: startOfWeek(first, WEEK),
    end: endOfWeek(endOfMonth(anchor), WEEK),
  });
  const events_ = byDay(events);
  const today = gstDayKey(now);
  const weekdays = days.slice(0, 7).map((d) => format(d, 'EEE'));

  return (
    <section>
      <Navigation
        label={format(anchor, 'MMMM yyyy')}
        onPrevious={() => onMonthChange(addMonths(first, -1))}
        onNext={() => onMonthChange(addMonths(first, 1))}
        onToday={() => onMonthChange(now)}
      />
      <table className="w-full table-fixed border-collapse rounded-lg bg-card text-sm shadow-card">
        <caption className="sr-only">{format(anchor, 'MMMM yyyy')}</caption>
        <thead>
          <tr>
            {weekdays.map((d) => (
              <th
                key={d}
                scope="col"
                className="border-b border-border py-2 text-xs font-semibold text-ink-secondary"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7)).map(
            (week) => (
              <tr key={format(week[0] ?? anchor, 'yyyy-MM-dd')}>
                {week.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const list = events_.get(key) ?? [];
                  const inMonth = day.getMonth() === anchor.getMonth();
                  return (
                    <td
                      key={key}
                      className={cn(
                        'h-28 border border-border p-1 align-top',
                        !inMonth && 'bg-surface-muted/60',
                      )}
                    >
                      <p
                        className={cn(
                          'mb-1 text-xs',
                          inMonth ? 'text-ink' : 'text-ink-muted',
                          key === today &&
                            'inline-flex size-6 items-center justify-center rounded-pill bg-primary font-semibold text-on-primary',
                        )}
                      >
                        <time dateTime={key}>{format(day, 'd')}</time>
                      </p>
                      <div className="space-y-0.5">
                        {list.slice(0, maxPerDay).map((event) => (
                          <EventChip
                            key={event.id}
                            event={event}
                            {...(onSelect ? { onSelect } : {})}
                          />
                        ))}
                        {list.length > maxPerDay &&
                          (onMore ? (
                            <button
                              type="button"
                              onClick={() => onMore(day)}
                              className="px-1 text-xs font-semibold text-primary hover:underline"
                            >
                              {t('ui.calendar.more', { count: list.length - maxPerDay })}
                            </button>
                          ) : (
                            <p className="px-1 text-xs text-ink-secondary">
                              {t('ui.calendar.more', { count: list.length - maxPerDay })}
                            </p>
                          ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </section>
  );
}

/** A week in GST, Monday to Sunday, events listed by time. */
export function CalendarWeek({
  week,
  events,
  onWeekChange,
  onSelect,
  now = new Date(),
}: {
  /** Any instant in the week to show. */
  week: Date;
  events: readonly CalendarEvent[];
  onWeekChange: (week: Date) => void;
  onSelect?: (id: string) => void;
  now?: Date;
}) {
  const start = startOfWeek(new TZDate(week, GST), WEEK);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const events_ = byDay(events);
  const today = gstDayKey(now);
  const label = `${format(start, 'd MMM')} – ${format(addDays(start, 6), 'd MMM yyyy')}`;
  return (
    <section>
      <Navigation
        label={label}
        onPrevious={() => onWeekChange(addWeeks(start, -1))}
        onNext={() => onWeekChange(addWeeks(start, 1))}
        onToday={() => onWeekChange(now)}
      />
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-card">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          return (
            <section
              key={key}
              aria-label={format(day, 'EEEE d MMMM')}
              className="min-h-48 bg-card p-2"
            >
              <p
                className={cn(
                  'mb-2 text-xs font-semibold',
                  key === today ? 'text-primary' : 'text-ink-secondary',
                )}
              >
                {format(day, 'EEE d')}
              </p>
              <div className="space-y-1">
                {(events_.get(key) ?? []).map((event) => (
                  <EventChip key={event.id} event={event} {...(onSelect ? { onSelect } : {})} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
