import { describe, expect, it } from 'vitest';
import { gstMoment, paramsDraft, paramsOf } from './param-draft';
import type { ParamField } from './rules-api';

const base = {
  min: null,
  max: null,
  step: null,
  unit: null,
  nullable: false,
  options: null,
  columns: null,
  minRows: null,
  maxRows: null,
};
const field = (f: Partial<ParamField> & Pick<ParamField, 'kind' | 'key'>): ParamField => ({
  ...base,
  label: f.key,
  ...f,
});
const result = { value: 'pass', label: 'Pass' };
const FIELDS: ParamField[] = [
  field({ kind: 'integer', key: 'critical', min: 1, max: 365 }),
  field({ kind: 'integer', key: 'ofi', min: 1, max: 365, nullable: true }),
  field({ kind: 'time', key: 'time' }),
  field({ kind: 'boolean', key: 'enabled' }),
  field({ kind: 'codes', key: 'anyOf' }),
  field({ kind: 'integers', key: 'daysBefore' }),
  field({
    kind: 'order',
    key: 'order',
    options: [
      { value: 'crew-change', label: 'Crew change' },
      { value: 'vip', label: 'VIP' },
      { value: 'category-priority', label: 'Categories' },
    ],
  }),
  field({
    kind: 'table',
    key: 'bands',
    minRows: 1,
    maxRows: 10,
    columns: [
      { ...base, kind: 'decimal', key: 'minMu', label: 'μ from', step: 0.01 },
      { ...base, kind: 'choice', key: 'result', label: 'Result', options: [result] },
      { ...base, kind: 'integer', key: 'validityMonths', label: 'Validity', nullable: true },
    ],
  }),
];

describe('SPEC-10-3.2 rule parameters in the form', () => {
  it('SPEC-10-3.2 round-trips every kind of parameter', () => {
    const params = {
      critical: 7,
      ofi: null,
      time: '10:00',
      enabled: true,
      anyOf: ['T-BOSIT', 'T-HUET'],
      daysBefore: [60, 30, 14],
      order: ['vip', 'crew-change', 'category-priority'],
      bands: [
        { minMu: 0.65, result: 'pass', validityMonths: 24 },
        { minMu: 0, result: 'pass', validityMonths: null },
      ],
    };
    const draft = paramsDraft(FIELDS, params);
    expect(draft).toMatchObject({
      critical: '7',
      ofi: '',
      anyOf: 'T-BOSIT, T-HUET',
      daysBefore: '60, 30, 14',
      bands: [
        { minMu: '0.65', result: 'pass', validityMonths: '24' },
        { minMu: '0', result: 'pass', validityMonths: '' },
      ],
    });
    expect(paramsOf(FIELDS, draft)).toEqual({ value: params, problems: {} });
  });

  it('SPEC-10-3.2 a new rule starts empty, with every option of an order listed', () => {
    const draft = paramsDraft(FIELDS, null);
    expect(draft.order).toEqual(['crew-change', 'vip', 'category-priority']);
    expect(draft.bands).toEqual([{ minMu: '', result: '', validityMonths: '' }]);
    expect(paramsOf(FIELDS, draft).problems).toEqual({
      critical: 'required',
      time: 'time',
      anyOf: 'required',
      daysBefore: 'required',
      'bands.0.minMu': 'required',
      'bands.0.result': 'required',
    });
  });

  it('SPEC-10-3.2 names what can’t be read', () => {
    const draft = { ...paramsDraft(FIELDS, null), critical: '7.5', daysBefore: '60, soon' };
    expect(paramsOf(FIELDS, draft).problems).toMatchObject({
      critical: 'whole',
      daysBefore: 'whole',
    });
  });

  it('PROMPT-2.15 a GST date and time is sent with its offset', () => {
    expect(gstMoment('2026-10-20', '06:30')).toBe('2026-10-20T06:30:00+04:00');
  });
});
