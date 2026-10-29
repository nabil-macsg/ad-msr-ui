import { describe, expect, it } from 'vitest';
import { KG_PER_LB, kgToLb, lbToKg, roundKg, toKg } from './weight';

describe('PROMPT-2.15 weights are stored in kg', () => {
  it('PROMPT-2.15 uses the exact international pound', () => {
    expect(KG_PER_LB).toBe(0.45359237);
    expect(lbToKg(1)).toBe(0.454);
    expect(lbToKg(100)).toBe(45.359);
    expect(lbToKg(220)).toBe(99.79);
  });

  it('PROMPT-2.15 converts back for display, to two decimals', () => {
    expect(kgToLb(45.359)).toBe(100);
    expect(kgToLb(1)).toBe(2.2);
  });

  it('PROMPT-2.15 keeps kg as entered, to the gram', () => {
    expect(toKg(12.3456, 'kg')).toBe(12.346);
    expect(toKg(10, 'lb')).toBe(4.536);
    expect(roundKg(0.0004)).toBe(0);
  });
});
