import { z } from 'zod';

/** A value as an input's text: blank for none. */
export const toText = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/** An input's text as a number, or null when blank. */
export const toNumber = (text: string): number | null =>
  text.trim() === '' ? null : Number(text.trim());

/** An input's text, or null when blank. */
export const toNullable = (text: string): string | null => text.trim() || null;

/** Text that is blank or a whole number of at least `min`. */
export const wholeText = (message: string, min = 0) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= min), message);

/** Text that is blank or a number of at least `min` (exclusive when `above`). */
export const decimalText = (message: string, min = 0, above = false) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (v === '') return true;
      const n = Number(v);
      return Number.isFinite(n) && (above ? n > min : n >= min);
    }, message);
