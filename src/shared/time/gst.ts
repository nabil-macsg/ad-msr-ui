import { TZDate } from '@date-fns/tz';

/** Gulf Standard Time: every time MASAR shows is in GST (PROMPT §2.15). */
export const GST = 'Asia/Dubai';

export type DayPart = 'morning' | 'afternoon' | 'evening';

export function dayPart(now: Date = new Date()): DayPart {
  const hour = new TZDate(now, GST).getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** The given name for a greeting: the first word of the display name. */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}
