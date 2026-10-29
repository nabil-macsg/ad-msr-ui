import { describe, expect, it } from 'vitest';
import {
  type ConditionField,
  conditionsDraft,
  conditionsOf,
  describeConditions,
  newStage,
  type Process,
  stageDraft,
  stageInput,
} from './workflow-draft';

const FIELDS: ConditionField[] = [
  {
    key: 'criticality',
    label: 'Criticality',
    type: 'choice',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'critical', label: 'Critical' },
    ],
    unit: null,
  },
  { key: 'destination', label: 'Destination', type: 'values', options: null, unit: null },
  { key: 'unscheduled', label: 'Unscheduled', type: 'flag', options: null, unit: null },
  { key: 'weightKg', label: 'Weight', type: 'amount', options: null, unit: 'kg' },
];
const PROCESS: Process = {
  key: 'freight-auh',
  label: 'Freight — AUH',
  module: 'people-logistics',
  conditionFields: FIELDS,
};
const WORDS = { yes: 'Yes', no: 'No', fallback: 'Any request (fallback)' };

describe('BRD-D.2.2.1-MST workflow conditions and stages in the form', () => {
  it('BRD-D.2.2.1-MST turns the controls into conditions, and back', () => {
    const conditions = conditionsOf(FIELDS, {
      criticality: { list: ['critical'], text: '', flag: '', min: '', max: '' },
      destination: { list: [], text: ' DAS, ZRK,, DAS ', flag: '', min: '', max: '' },
      unscheduled: { list: [], text: '', flag: 'no', min: '', max: '' },
      weightKg: { list: [], text: '', flag: '', min: '', max: '100' },
    });
    expect(conditions).toEqual({
      criticality: ['critical'],
      destination: ['DAS', 'ZRK'],
      unscheduled: false,
      weightKg: { max: 100 },
    });
    expect(conditionsOf(FIELDS, conditionsDraft(conditions))).toEqual(conditions);
    // Empty controls set nothing: a fallback workflow.
    expect(conditionsOf(FIELDS, {})).toEqual({});
  });

  it('BRD-D.2.2.1-MST describes conditions in words for the list', () => {
    expect(
      describeConditions(
        PROCESS,
        { criticality: ['critical'], unscheduled: true, weightKg: { min: 10, max: 100 } },
        WORDS,
      ),
    ).toBe('Criticality: Critical · Unscheduled: Yes · Weight: 10–100 kg');
    expect(describeConditions(PROCESS, {}, WORDS)).toBe('Any request (fallback)');
  });

  it('SPEC-10-3.1 a stage round-trips: approver, timing, escalation and skip condition', () => {
    const input = stageInput(FIELDS, {
      ...newStage(),
      name: ' Site In-charge ',
      approverKind: 'rule',
      rule: 'site-in-charge-of-destination',
      slaHours: '8',
      reminderHours: '2',
      escalation: 'role',
      escalationRole: 'aviation-team',
      skip: true,
      skipCondition: { unscheduled: { list: [], text: '', flag: 'no', min: '', max: '' } },
    });
    expect(input).toEqual({
      name: 'Site In-charge',
      approver: { kind: 'rule', rule: 'site-in-charge-of-destination' },
      mode: 'any',
      slaHours: 8,
      reminderHours: 2,
      escalation: { kind: 'role', roleCode: 'aviation-team' },
      skipCondition: { unscheduled: false },
    });
    // A ticked skip with no conditions skips nothing.
    expect(
      stageInput(FIELDS, { ...newStage(), roleCode: 'mosa', skip: true }).skipCondition,
    ).toBeNull();

    const draft = stageDraft({
      position: 1,
      name: 'Approver',
      approver: { kind: 'user', roleCode: null, userId: 'u-1', rule: null, label: 'Reem Al Kindi' },
      mode: 'all',
      slaHours: 24,
      reminderHours: null,
      escalation: { kind: 'line_manager', roleCode: null, label: 'Line manager' },
      skipCondition: null,
    });
    expect(draft).toMatchObject({
      approverKind: 'user',
      user: { userId: 'u-1', name: 'Reem Al Kindi' },
      mode: 'all',
      reminderHours: '',
      escalation: 'line_manager',
      skip: false,
    });
    expect(stageInput(FIELDS, draft)).toMatchObject({
      approver: { kind: 'user', userId: 'u-1' },
      escalation: { kind: 'line_manager' },
      skipCondition: null,
    });
  });
});
