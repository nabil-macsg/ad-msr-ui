import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

export type SeatState = 'free' | 'taken' | 'blocked' | 'selected';

export interface SeatLayout {
  readonly rows: number;
  /** Seat letters left to right; an empty string is the aisle. */
  readonly columns: readonly string[];
}

const SEAT: Record<SeatState, string> = {
  free: 'border-success-fg/50 bg-success-bg text-success-fg hover:border-success-fg',
  taken: 'border-border bg-surface-muted text-ink-muted',
  blocked: 'border-danger-fg/40 bg-danger-bg text-danger-fg',
  selected: 'border-primary bg-primary text-on-primary',
};

/** The aircraft's seats from its layout (PROMPT §4.2; spec 20 §5). Free seats can be chosen. */
export function SeatMap({
  layout,
  seats,
  onSelect,
  readOnly = false,
}: {
  layout: SeatLayout;
  seats: Readonly<Record<string, SeatState>>;
  onSelect?: (seat: string) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('ui.seat.map')}
      className="inline-block rounded-lg border border-border bg-card p-4"
    >
      <p className="mb-3 text-center text-xs font-semibold tracking-wider text-ink-muted uppercase">
        {t('ui.seat.front')}
      </p>
      <div className="space-y-2">
        {Array.from({ length: layout.rows }, (_, i) => i + 1).map((row) => (
          <div key={row} className="flex items-center gap-2">
            <span className="w-5 text-right text-xs text-ink-muted" aria-hidden>
              {row}
            </span>
            {layout.columns.map((column, index) => {
              if (column === '') return <span key={`aisle-${index}`} className="w-6" aria-hidden />;
              const seat = `${row}${column}`;
              const state = seats[seat] ?? 'free';
              const choosable = !readOnly && (state === 'free' || state === 'selected');
              return (
                <button
                  key={seat}
                  type="button"
                  disabled={!choosable}
                  aria-pressed={state === 'selected'}
                  aria-label={t('ui.seat.label', { seat, state: t(`ui.seat.${state}`) })}
                  onClick={() => onSelect?.(seat)}
                  className={cn(
                    'size-touch rounded-md border text-xs font-semibold disabled:cursor-not-allowed',
                    SEAT[state],
                  )}
                >
                  {column}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
