/** One field that changed, for the audit trail: "Capacity: 2 → 3". */
export interface FieldChange {
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

function label(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.map(show).join(', ');
  return JSON.stringify(value);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The fields whose values differ between an entry's before and after. */
export function changesOf(before: unknown, after: unknown): FieldChange[] {
  if (!isRecord(before) || !isRecord(after)) return [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ field: label(key), from: show(before[key]), to: show(after[key]) }));
}
