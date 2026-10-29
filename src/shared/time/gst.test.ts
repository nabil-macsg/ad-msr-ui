import { describe, expect, it } from 'vitest';
import { dayPart, firstName } from './gst';

describe('PROMPT-2.15 times are in Gulf Standard Time', () => {
  it('PROMPT-4.2 greets by the time of day in GST, not the browser zone', () => {
    expect(dayPart(new Date('2026-10-13T04:00:00Z'))).toBe('morning'); // 08:00 GST
    expect(dayPart(new Date('2026-10-13T07:59:00Z'))).toBe('morning'); // 11:59 GST
    expect(dayPart(new Date('2026-10-13T08:00:00Z'))).toBe('afternoon'); // 12:00 GST
    expect(dayPart(new Date('2026-10-13T13:00:00Z'))).toBe('evening'); // 17:00 GST
    expect(dayPart(new Date('2026-10-13T21:00:00Z'))).toBe('morning'); // 01:00 GST next day
  });

  it('PROMPT-4.2 uses the given name', () => {
    expect(firstName('Ahmed Al Mansoori')).toBe('Ahmed');
    expect(firstName('  Fatima ')).toBe('Fatima');
  });
});
