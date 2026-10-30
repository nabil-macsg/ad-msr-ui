import { useState } from 'react';
import type { DemoRow } from '../mock/data/modules';
import { cn } from '../shared/lib/cn';
import { gstDayKey } from '../shared/time/format';
import { CONTROL } from '../shared/ui/control-styles';
import { PageHeader } from '../shared/ui/page-header';
import { useDataset } from './demo-api';

type Day = 'offshore' | 'onshore' | 'travel';
const DAY_CLASS: Record<Day, string> = {
  offshore: 'bg-primary text-on-primary',
  onshore: 'bg-success-bg text-success-fg',
  travel: 'bg-brand-bright-yellow text-brand-charcoal',
};
const LEGEND: readonly { day: Day; label: string }[] = [
  { day: 'offshore', label: 'Offshore' },
  { day: 'onshore', label: 'Onshore / Leave' },
  { day: 'travel', label: 'Travel Day (booking)' },
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = 6;
const DAY_MS = 86_400_000;
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

/**
 * The day's state in an N/N rotation: N days offshore, then N onshore. Each swing starts with a
 * travel day (the crew-change flight, which is booked). Office staff stay onshore.
 */
function dayState(pattern: string, anchor: number, date: Date): Day {
  const days = Number(pattern.split('/')[0]);
  if (!days) return 'onshore';
  const cycle = days * 2;
  const n = (((Math.floor(date.getTime() / DAY_MS) - anchor) % cycle) + cycle) % cycle;
  if (n === 0 || n === days) return 'travel';
  return n < days ? 'offshore' : 'onshore';
}

function Month({
  year,
  month,
  pattern,
  anchor,
  today,
}: {
  year: number;
  month: number;
  pattern: string;
  anchor: number;
  today: string;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const title = first.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4">
      <h2 className="mb-4 text-base font-semibold text-ink">{title}</h2>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="pb-1 text-2xs font-semibold text-ink-muted" aria-hidden>
            {w}
          </span>
        ))}
        {Array.from({ length: first.getUTCDay() }, (_, i) => (
          <span key={`gap-${String(i)}`} aria-hidden />
        ))}
        {Array.from({ length }, (_, i) => {
          const date = new Date(Date.UTC(year, month, i + 1));
          const key = date.toISOString().slice(0, 10);
          const state = dayState(pattern, anchor, date);
          return (
            <span
              key={key}
              title={`${key}: ${LEGEND.find((l) => l.day === state)?.label ?? ''}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md text-xs font-semibold tabular-nums',
                DAY_CLASS[state],
                key === today && 'ring-2 ring-ink ring-offset-2 ring-offset-card',
              )}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** Rotation Template: a direct hire's offshore, onshore and travel days, six months ahead. */
export default function RotationTemplatePage() {
  const people =
    useDataset('passengers', {
      page: 1,
      pageSize: 500,
      sort: 'name:asc',
      'filter[category]': 'Direct Hire',
    }).data?.items ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const person: DemoRow | undefined =
    people.find((p) => p.id === picked) ??
    people.find((p) => str(p.rotation) !== 'Office') ??
    people[0];
  const pattern = str(person?.rotation) || '14/14';
  // Each person's swing starts on a different day, so the calendars differ between people.
  const anchor = person ? parseInt(person.id.replace(/[^0-9a-f]/gi, '').slice(-6), 16) : 0;
  const now = new Date();
  const today = gstDayKey(now);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rotation Template"
        subtitle="Automated rotation schedule for direct hire employees"
      />
      <div className="grid gap-5 xl:grid-cols-[20rem_1fr]">
        <aside className="h-fit space-y-5 rounded-xl border border-border bg-card p-5">
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-secondary">Select Employee</span>
            <select
              className={`${CONTROL} min-h-touch w-full px-3`}
              value={person?.id ?? ''}
              onChange={(e) => setPicked(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {str(p.name)}
                </option>
              ))}
            </select>
          </label>
          <dl className="space-y-3 text-sm">
            {[
              ['Optima', str(person?.optima)],
              ['Company', str(person?.employer)],
              ['Department', str(person?.department)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-ink-secondary">{label}</dt>
                <dd className="text-end font-medium text-ink">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-secondary">Pattern</dt>
              <dd className="font-semibold text-primary">{pattern}</dd>
            </div>
          </dl>
          <ul className="space-y-2.5 border-t border-border pt-4 text-sm text-ink">
            {LEGEND.map((l) => (
              <li key={l.day} className="flex items-center gap-2.5">
                <span className={cn('size-4 rounded', DAY_CLASS[l.day])} aria-hidden />
                {l.label}
              </li>
            ))}
            <li className="flex items-center gap-2.5 text-ink-secondary">
              <span className="size-4 rounded ring-2 ring-ink ring-offset-1" aria-hidden />
              Today
            </li>
          </ul>
        </aside>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: MONTHS }, (_, i) => {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
            return (
              <Month
                key={i}
                year={d.getUTCFullYear()}
                month={d.getUTCMonth()}
                pattern={pattern}
                anchor={anchor}
                today={today}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
