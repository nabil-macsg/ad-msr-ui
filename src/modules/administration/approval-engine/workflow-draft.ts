import type { components } from '../../../api/schema';
import type { Person } from '../delegations/delegations-api';

export type Processes = components['schemas']['ApprovalProcesses'];
export type Process = Processes['processes'][number];
export type ConditionField = Process['conditionFields'][number];
type StageView =
  components['schemas']['ApprovalWorkflowDetail']['versions'][number]['stages'][number];
type StageInput = components['schemas']['ApprovalWorkflowVersionInput']['stages'][number];

/** One of these values, a range, or a yes/no (spec 10 §3.1). */
export type Condition = string[] | { min?: number; max?: number } | boolean;
export type Conditions = Record<string, Condition>;

/** A condition as the form holds it: every control's text, whatever the field's type. */
export interface ConditionDraft {
  readonly list: string[];
  readonly text: string;
  readonly flag: '' | 'yes' | 'no';
  readonly min: string;
  readonly max: string;
}
export type ConditionsDraft = Record<string, ConditionDraft>;

export const EMPTY_CONDITION: ConditionDraft = { list: [], text: '', flag: '', min: '', max: '' };

export interface StageDraft {
  readonly name: string;
  readonly approverKind: 'role' | 'user' | 'rule';
  readonly roleCode: string;
  readonly user: Person | null;
  readonly rule: string;
  readonly mode: 'any' | 'all';
  readonly slaHours: string;
  readonly reminderHours: string;
  readonly escalation: 'none' | 'line_manager' | 'role';
  readonly escalationRole: string;
  readonly skip: boolean;
  readonly skipCondition: ConditionsDraft;
}

export const newStage = (): StageDraft => ({
  name: '',
  approverKind: 'role',
  roleCode: '',
  user: null,
  rule: '',
  mode: 'any',
  slaHours: '24',
  reminderHours: '',
  escalation: 'none',
  escalationRole: '',
  skip: false,
  skipCondition: {},
});

const isList = (c: Condition): c is string[] => Array.isArray(c);

export function conditionsDraft(conditions: Conditions | null | undefined): ConditionsDraft {
  return Object.fromEntries(
    Object.entries(conditions ?? {}).map(([key, c]) => {
      if (isList(c)) return [key, { ...EMPTY_CONDITION, list: [...c], text: c.join(', ') }];
      if (typeof c === 'boolean') return [key, { ...EMPTY_CONDITION, flag: c ? 'yes' : 'no' }];
      return [
        key,
        { ...EMPTY_CONDITION, min: c.min?.toString() ?? '', max: c.max?.toString() ?? '' },
      ];
    }),
  );
}

const number = (text: string): number | undefined =>
  text.trim() === '' ? undefined : Number(text.trim());

/** The conditions the draft sets, for the fields the process has; empty controls set none. */
export function conditionsOf(
  fields: readonly ConditionField[],
  draft: ConditionsDraft,
): Conditions {
  const out: Record<string, Condition> = {};
  for (const field of fields) {
    const d = draft[field.key] ?? EMPTY_CONDITION;
    if (field.type === 'choice' && d.list.length > 0) out[field.key] = [...d.list];
    if (field.type === 'values') {
      const values = [
        ...new Set(
          d.text
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ];
      if (values.length > 0) out[field.key] = values;
    }
    if (field.type === 'flag' && d.flag !== '') out[field.key] = d.flag === 'yes';
    if (field.type === 'amount') {
      const min = number(d.min);
      const max = number(d.max);
      if (min !== undefined || max !== undefined) {
        out[field.key] = {
          ...(min !== undefined ? { min } : {}),
          ...(max !== undefined ? { max } : {}),
        };
      }
    }
  }
  return out;
}

/** What's wrong with an amount range, if anything. */
export function amountProblem(d: ConditionDraft): 'number' | 'order' | null {
  const min = number(d.min);
  const max = number(d.max);
  if (
    (min !== undefined && !Number.isFinite(min)) ||
    (max !== undefined && !Number.isFinite(max))
  ) {
    return 'number';
  }
  return min !== undefined && max !== undefined && min > max ? 'order' : null;
}

export function stageDraft(stage: StageView): StageDraft {
  const { approver, escalation } = stage;
  return {
    name: stage.name,
    approverKind: approver.kind,
    roleCode: approver.roleCode ?? '',
    // The stage names the user; their email isn't part of the chain.
    user: approver.userId
      ? { userId: approver.userId, name: approver.label, email: '', organisation: null }
      : null,
    rule: approver.rule ?? '',
    mode: stage.mode,
    slaHours: String(stage.slaHours),
    reminderHours: stage.reminderHours === null ? '' : String(stage.reminderHours),
    escalation: escalation?.kind ?? 'none',
    escalationRole: escalation?.roleCode ?? '',
    skip: stage.skipCondition !== null,
    skipCondition: conditionsDraft(stage.skipCondition),
  };
}

export function stageInput(fields: readonly ConditionField[], d: StageDraft): StageInput {
  const approver: StageInput['approver'] =
    d.approverKind === 'role'
      ? { kind: 'role', roleCode: d.roleCode }
      : d.approverKind === 'user'
        ? { kind: 'user', userId: d.user?.userId ?? '' }
        : {
            kind: 'rule',
            rule: d.rule as Extract<StageInput['approver'], { kind: 'rule' }>['rule'],
          };
  const skip = d.skip ? conditionsOf(fields, d.skipCondition) : {};
  return {
    name: d.name.trim(),
    approver,
    mode: d.mode,
    slaHours: Number(d.slaHours),
    reminderHours: d.reminderHours.trim() === '' ? null : Number(d.reminderHours),
    escalation:
      d.escalation === 'none'
        ? null
        : d.escalation === 'line_manager'
          ? { kind: 'line_manager' }
          : { kind: 'role', roleCode: d.escalationRole },
    skipCondition: Object.keys(skip).length > 0 ? skip : null,
  };
}

interface Words {
  readonly yes: string;
  readonly no: string;
  readonly fallback: string;
}

/** "Destination: DAS, ZRK · Unscheduled: Yes · Weight: 10–100 kg". */
export function describeConditions(
  process: Pick<Process, 'conditionFields'> | undefined,
  conditions: Conditions | null | undefined,
  words: Words,
): string {
  const entries = Object.entries(conditions ?? {});
  if (entries.length === 0) return words.fallback;
  return entries
    .map(([key, c]) => {
      const field = process?.conditionFields.find((f) => f.key === key);
      const label = field?.label ?? key;
      if (isList(c)) {
        const named = c.map((v) => field?.options?.find((o) => o.value === v)?.label ?? v);
        return `${label}: ${named.join(', ')}`;
      }
      if (typeof c === 'boolean') return `${label}: ${c ? words.yes : words.no}`;
      const unit = field?.unit ? ` ${field.unit}` : '';
      if (c.min !== undefined && c.max !== undefined) return `${label}: ${c.min}–${c.max}${unit}`;
      return c.min !== undefined ? `${label}: ≥ ${c.min}${unit}` : `${label}: ≤ ${c.max}${unit}`;
    })
    .join(' · ');
}
