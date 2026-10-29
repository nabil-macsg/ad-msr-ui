import { cn } from '../lib/cn';
import { formatGst } from '../time/format';
import { TONE_DOT, type Tone } from './tone';

export interface TimelineEntry {
  readonly id: string;
  readonly at: string;
  readonly title: string;
  readonly description?: string;
  /** Who did it: a person and role, or "System". */
  readonly actor?: string;
  readonly tone?: Tone;
}

/** "What has happened": the record's events, newest first, times in GST. */
export function Timeline({ title, entries }: { title: string; entries: readonly TimelineEntry[] }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>
      <ol className="relative space-y-4 border-l border-border pl-5">
        {entries.map((entry) => (
          <li key={entry.id} className="relative">
            <span
              className={cn(
                'absolute top-1.5 -left-[25px] size-2.5 rounded-pill ring-4 ring-card',
                TONE_DOT[entry.tone ?? 'neutral'],
              )}
              aria-hidden
            />
            <p className="text-sm font-medium text-ink">{entry.title}</p>
            <p className="text-xs text-ink-secondary">
              <time dateTime={entry.at}>{formatGst(entry.at)}</time>
              {entry.actor && <> · {entry.actor}</>}
            </p>
            {entry.description && (
              <p className="mt-1 text-sm text-ink-secondary">{entry.description}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
