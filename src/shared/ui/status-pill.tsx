import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { TONE_PILL, type Tone } from './tone';

/** A status in its fixed colour (PROMPT §4.1). The label always carries the meaning, not only the colour. */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill border px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap',
        TONE_PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
