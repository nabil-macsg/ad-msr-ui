/**
 * Status colours with fixed meanings (PROMPT §4.1): success = done, accepted, on time, arrived;
 * info = scheduled, in progress, check-in; warning = pending, expiring, delayed, awaiting;
 * danger = cancelled, expired, overdue, missing, critical; neutral = not recorded, deactivated;
 * accent = visitors and crew types in charts.
 */
export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'accent';

export const TONE_PILL: Record<Tone, string> = {
  success: 'border-success-border bg-success-bg text-success-fg',
  info: 'border-info-border bg-info-bg text-info-fg',
  warning: 'border-warning-border bg-warning-bg text-warning-fg',
  danger: 'border-danger-border bg-danger-bg text-danger-fg',
  neutral: 'border-neutral-border bg-neutral-bg text-neutral-fg',
  accent: 'border-accent-border bg-accent-bg text-accent-fg',
};

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success-fg',
  info: 'text-info-fg',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  neutral: 'text-neutral-fg',
  accent: 'text-accent-fg',
};

export const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success-fg',
  info: 'bg-info-fg',
  warning: 'bg-warning-fg',
  danger: 'bg-danger-fg',
  neutral: 'bg-neutral-fg',
  accent: 'bg-accent-fg',
};
