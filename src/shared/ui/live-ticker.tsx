import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { TONE_DOT, type Tone } from './tone';

export interface TickerItem {
  readonly id: string;
  readonly text: string;
  readonly tone?: Tone;
}

/**
 * The dashboards' LIVE strip (spec 40 §1). It scrolls, pauses on hover or focus, and stands still
 * for users who ask for reduced motion. Screen readers get the list, not the motion.
 */
export function LiveTicker({ items }: { items: readonly TickerItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  const list = (hidden: boolean) =>
    items.map((item) => (
      <li
        key={`${hidden ? 'b' : 'a'}-${item.id}`}
        className="flex shrink-0 items-center gap-2 pr-10"
        aria-hidden={hidden || undefined}
      >
        <span className={cn('size-2 rounded-pill', TONE_DOT[item.tone ?? 'info'])} aria-hidden />
        {item.text}
      </li>
    ));
  return (
    <section
      aria-label={t('ui.ticker.region')}
      className="flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink shadow-card"
    >
      <span className="flex shrink-0 items-center gap-1.5 rounded-sm bg-danger-fg px-2 py-0.5 text-xs font-bold tracking-wider text-on-primary">
        <span
          className="size-1.5 animate-pulse rounded-pill bg-on-primary motion-reduce:animate-none"
          aria-hidden
        />
        {t('ui.ticker.live')}
      </span>
      <div className="group min-w-0 flex-1 overflow-hidden" tabIndex={0}>
        <ul className="ticker-track flex w-max group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
          {list(false)}
          {list(true)}
        </ul>
      </div>
    </section>
  );
}
