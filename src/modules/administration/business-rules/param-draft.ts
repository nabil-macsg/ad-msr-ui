import type { ColumnField, ParamField } from './rules-api';

/** A row of a table parameter, each cell as typed. */
export type RowDraft = Record<string, string>;
/** A parameter as the form holds it: text for numbers and lists, the value otherwise. */
export type ParamDraft = string | boolean | string[] | RowDraft[];
export type ParamsDraft = Record<string, ParamDraft>;

/** Why a value can't be read; the form names it in words. */
export type ParamProblem = 'required' | 'whole' | 'number' | 'time';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(text) : []);

export function emptyRow(columns: readonly ColumnField[]): RowDraft {
  return Object.fromEntries(columns.map((c) => [c.key, '']));
}

/** The draft of a rule's parameters; empty controls for a new rule. */
export function paramsDraft(
  fields: readonly ParamField[],
  params: Record<string, unknown> | null,
): ParamsDraft {
  return Object.fromEntries(
    fields.map((f): [string, ParamDraft] => {
      const value = params?.[f.key];
      switch (f.kind) {
        case 'boolean':
          return [f.key, value === true];
        case 'choices':
          return [f.key, list(value)];
        case 'order': {
          const options = (f.options ?? []).map((o) => o.value);
          const current = list(value).filter((v) => options.includes(v));
          return [f.key, [...current, ...options.filter((o) => !current.includes(o))]];
        }
        case 'codes':
        case 'integers':
          return [f.key, list(value).join(', ')];
        case 'table': {
          const columns = f.columns ?? [];
          const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
          return [
            f.key,
            rows.length > 0
              ? rows.map((row) => Object.fromEntries(columns.map((c) => [c.key, text(row[c.key])])))
              : [emptyRow(columns)],
          ];
        }
        default:
          return [f.key, text(value)];
      }
    }),
  );
}

const WHOLE = /^-?\d+$/;
const TIME = /^\d{2}:\d{2}$/;

function scalar(
  field: ParamField | ColumnField,
  raw: string,
): { value: unknown } | { problem: ParamProblem } {
  const t = raw.trim();
  switch (field.kind) {
    case 'integer':
      if (t === '') return field.nullable ? { value: null } : { problem: 'required' };
      return WHOLE.test(t) ? { value: Number(t) } : { problem: 'whole' };
    case 'decimal':
      if (t === '') return { problem: 'required' };
      return Number.isFinite(Number(t)) ? { value: Number(t) } : { problem: 'number' };
    case 'time':
      return TIME.test(t) ? { value: t } : { problem: 'time' };
    default:
      return t === '' ? { problem: 'required' } : { value: t };
  }
}

const split = (raw: string) =>
  raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * The parameters to send, and what can't be read (by field key; a table cell by
 * `key.row.column`). The server checks ranges and the type's own rules.
 */
export function paramsOf(
  fields: readonly ParamField[],
  draft: ParamsDraft,
): { value: Record<string, unknown>; problems: Record<string, ParamProblem> } {
  const value: Record<string, unknown> = {};
  const problems: Record<string, ParamProblem> = {};
  for (const f of fields) {
    const d = draft[f.key];
    switch (f.kind) {
      case 'boolean':
        value[f.key] = d === true;
        break;
      case 'choices':
      case 'order':
        value[f.key] = Array.isArray(d) ? d : [];
        break;
      case 'codes': {
        const codes = split(typeof d === 'string' ? d : '');
        if (codes.length === 0) problems[f.key] = 'required';
        value[f.key] = codes;
        break;
      }
      case 'integers': {
        const items = split(typeof d === 'string' ? d : '');
        if (items.length === 0) problems[f.key] = 'required';
        else if (!items.every((i) => WHOLE.test(i))) problems[f.key] = 'whole';
        value[f.key] = items.map(Number);
        break;
      }
      case 'table': {
        const rows = (Array.isArray(d) ? d : []) as RowDraft[];
        value[f.key] = rows.map((row, index) =>
          Object.fromEntries(
            (f.columns ?? []).map((c) => {
              const read = scalar(c, row[c.key] ?? '');
              if ('problem' in read) problems[`${f.key}.${index}.${c.key}`] = read.problem;
              return [c.key, 'value' in read ? read.value : null];
            }),
          ),
        );
        break;
      }
      default: {
        const read = scalar(f, typeof d === 'string' ? d : '');
        if ('problem' in read) problems[f.key] = read.problem;
        else value[f.key] = read.value;
      }
    }
  }
  return { value, problems };
}

/** A GST date and time as the API's moment (GST is UTC+4, no daylight saving). */
export const gstMoment = (date: string, time: string): string => `${date}T${time}:00+04:00`;
