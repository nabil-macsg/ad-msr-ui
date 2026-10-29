import { decidePobTask } from './places';
import type { components } from '../../api/schema';
import { audit, trail } from '../core/audit';
import {
  bodyOf,
  json,
  MockError,
  type MockRequest,
  noContent,
  notFound,
  required,
} from '../core/http';
import { listRows, type ListSpec } from '../core/list';
import { route } from '../core/router';
import { all, find, insert, newId, now, removeRow, replace, seed } from '../core/store';
import {
  APPROVAL_PROCESSES,
  APPROVER_RULES,
  type ApprovalTaskRow,
  approvalTaskSeeds,
  type Conditions,
  type ConditionField,
  CURRENT_PHASE,
  deliverySeeds,
  type DeliveryRow,
  deriveRule,
  findContext,
  findProcess,
  findRuleType,
  findTrigger,
  MANDATORY_CATEGORIES,
  notificationRuleSeeds,
  type NotificationRuleRow,
  PEOPLE,
  personName,
  processFields,
  type ReasonCodeRow,
  reasonCodeSeeds,
  type ReasonContextRow,
  reasonContextSeeds,
  type ReasonRequestRow,
  reasonRequestSeeds,
  ROLES,
  roleName,
  type RuleRow,
  ruleSeeds,
  RULE_TYPES,
  type RuleTypeDef,
  stageView,
  TRIGGERS,
  type TriggerDef,
  type WorkflowRow,
  workflowSeeds,
} from '../data/engines';
import { currentPersona, PERSONAS } from '../demo-auth';

type S = components['schemas'];
type Body = Record<string, unknown>;

const CODES = 'engines:reason-codes';
const CONTEXTS = 'engines:reason-contexts';
const REQUESTS = 'engines:reason-code-requests';
const WORKFLOWS = 'engines:approval-workflows';
const TASKS = 'engines:approval-tasks';
const RULES = 'engines:business-rules';
const NOTIFY = 'engines:notification-rules';
const DELIVERIES = 'engines:notification-deliveries';

/** The Approval Engine, Reason Codes, Business Rules and the Notification Engine. */
export function registerEngines(): void {
  seed(CODES, reasonCodeSeeds);
  seed(CONTEXTS, reasonContextSeeds);
  seed(REQUESTS, reasonRequestSeeds);
  seed(WORKFLOWS, workflowSeeds);
  seed(TASKS, approvalTaskSeeds);
  seed(RULES, ruleSeeds);
  seed(NOTIFY, notificationRuleSeeds);
  seed(DELIVERIES, deliverySeeds);
  registerReasonCodes();
  registerApprovalWorkflows();
  registerBusinessRules();
  registerNotifications();
}

// ── Shared helpers ──────────────────────────────────────────────────────────

const actor = () => currentPersona()?.me.displayName ?? 'Demo user';

const invalid = (fields: Record<string, string>, message = 'Some fields need attention.') =>
  new MockError(422, 'VALIDATION_FAILED', message, { fields });

/** A rule the API checks beyond single fields (422 with the problems listed). */
function refuseProblems(code: string, problems: readonly string[]): void {
  if (problems.length > 0) throw new MockError(422, code, problems.join(' '), { problems });
}

/** The record by `:id`, checked against `If-Match` when the page sends it. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the row type
function current<T extends { id: string; version: number }>(
  req: MockRequest,
  rows: string,
  noun: string,
): T {
  const row = find<T>(rows, req.params.id ?? '');
  if (!row) throw new MockError(404, 'NOT_FOUND', `The ${noun} was not found.`);
  matchVersion(req, row.version);
  return row;
}

function matchVersion(req: MockRequest, version: number): void {
  const header = req.headers.get('If-Match');
  if (header !== null && Number(header) !== version) {
    throw new MockError(
      409,
      'VERSION_CONFLICT',
      'Someone else changed this record. Reload and try again.',
    );
  }
}

/** A copy of the record without the named fields (a list row from its detail view). */
function without<T extends object, K extends keyof T>(record: T, ...keys: K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !keys.includes(key as K)),
  ) as Omit<T, K>;
}

/** A CSV cell's text. */
function plain(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return v === null || v === undefined ? '' : JSON.stringify(v);
}

const reasonOf = (req: MockRequest) => required(bodyOf(req).reason, 'reason');
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function sameState(active: boolean, isActive: boolean, noun: string): void {
  if (isActive === active) {
    throw new MockError(
      409,
      active ? 'NOT_DEACTIVATED' : 'ALREADY_DEACTIVATED',
      active ? `This ${noun} is already active.` : `This ${noun} is already deactivated.`,
    );
  }
}

/** `GET …/export`: the filtered list as CSV, every page. */
function exportCsv<T>(
  req: MockRequest,
  file: string,
  rows: readonly T[],
  spec: ListSpec<T>,
  columns: readonly (readonly [string, (row: T) => unknown])[],
): Response {
  const query = new URLSearchParams(req.query);
  query.delete('page');
  query.delete('pageSize');
  const { items } = listRows(rows, query, spec);
  const cell = (v: unknown) => `"${plain(v).replace(/"/g, '""')}"`;
  const body = [
    columns.map(([h]) => cell(h)).join(','),
    ...items.map((r) => columns.map(([, value]) => cell(value(r))).join(',')),
  ].join('\n');
  return new Response(body, {
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="${file}-demo.csv"`,
    },
  });
}

/** Checks conditions against the fields a process / type / trigger offers. */
function conditionProblems(
  fields: readonly ConditionField[],
  conditions: unknown,
  what: string,
): string[] {
  if (conditions === undefined || conditions === null) return [];
  if (typeof conditions !== 'object' || Array.isArray(conditions))
    return [`The ${what} must be a set of fields.`];
  const problems: string[] = [];
  for (const [key, value] of Object.entries(conditions)) {
    const field = fields.find((f) => f.key === key);
    if (!field) {
      problems.push(`${key} is not a ${what} field here.`);
      continue;
    }
    if (field.type === 'choice' || field.type === 'values') {
      if (!Array.isArray(value) || value.length === 0)
        problems.push(`${field.label}: choose at least one value.`);
      else if (field.type === 'choice') {
        const unknown = value.filter((v) => !field.options?.some((o) => o.value === v));
        if (unknown.length > 0)
          problems.push(`${field.label}: ${unknown.join(', ')} is not an option.`);
      }
    } else if (field.type === 'flag') {
      if (typeof value !== 'boolean') problems.push(`${field.label}: answer yes or no.`);
    } else {
      const range = value as { min?: unknown; max?: unknown };
      const min = range.min;
      const max = range.max;
      if (
        (min !== undefined && typeof min !== 'number') ||
        (max !== undefined && typeof max !== 'number')
      ) {
        problems.push(`${field.label}: the range must be numbers.`);
      } else if (min === undefined && max === undefined) {
        problems.push(`${field.label}: give a minimum or a maximum.`);
      } else if (typeof min === 'number' && typeof max === 'number' && min > max) {
        problems.push(`${field.label}: the minimum is above the maximum.`);
      }
    }
  }
  return problems;
}

const conditionsOf = (v: unknown): Conditions =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Conditions) : {};

// ── Reason Codes ────────────────────────────────────────────────────────────

type ReasonCode = S['ReasonCode'];
type ContextKey = ReasonCode['context'];

const contextRow = (key: string) => all<ReasonContextRow>(CONTEXTS).find((c) => c.key === key);

function presentCode(row: ReasonCodeRow): ReasonCode {
  return {
    id: row.id,
    context: row.context,
    contextLabel: findContext(row.context)?.label ?? row.context,
    code: row.code,
    description: row.description,
    mandatory: contextRow(row.context)?.mandatory ?? true,
    commentRequired: row.commentRequired,
    crewChange: row.crewChange,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    deactivatedReason: row.deactivatedReason,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function presentContext(row: ReasonContextRow): S['ReasonContext'] {
  const def = findContext(row.key);
  return {
    key: row.key,
    label: def?.label ?? row.key,
    module: def?.module ?? 'administration',
    mandatory: row.mandatory,
    crewChange: def?.crewChange ?? false,
    activeCodes: all<ReasonCodeRow>(CODES).filter((c) => c.context === row.key && c.isActive)
      .length,
    version: row.version,
  };
}

const describeCode = (r: { id: string; code: string; description: string }) => ({
  id: r.id,
  ref: r.code,
  label: r.description,
});

const CODE_SPEC: ListSpec<ReasonCode> = {
  search: (r) => [r.code, r.description, r.contextLabel],
  sorts: { context: (r) => `${r.contextLabel}|${String(r.sortOrder).padStart(5, '0')}` },
  defaultSort: 'context:asc',
};

const CODE_FORMAT = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;

function knownContext(value: unknown): ContextKey {
  const key = required(value, 'context');
  if (!findContext(key)) throw invalid({ context: 'Choose a reason context.' });
  return key as ContextKey;
}

/** The editable part of a code: description, flags and order. */
function codeFields(body: Body, context: ContextKey) {
  const description = required(body.description, 'description');
  if (description.length > 200) throw invalid({ description: 'At most 200 characters.' });
  const crewChange = body.crewChange === true;
  if (crewChange && !findContext(context)?.crewChange) {
    throw invalid({ crewChange: 'Only Reason for Travel codes can count as a crew change.' });
  }
  const sortOrder = body.sortOrder ?? 0;
  if (!isInt(sortOrder, 0, 9999)) throw invalid({ sortOrder: 'A whole number from 0 to 9999.' });
  return { description, commentRequired: body.commentRequired === true, crewChange, sortOrder };
}

function addCode(context: ContextKey, rawCode: unknown, body: Body): ReasonCodeRow {
  const code = required(rawCode, 'code').toUpperCase();
  if (!CODE_FORMAT.test(code) || code.length > 30) {
    throw invalid({ code: 'Capital letters and digits in hyphenated parts, e.g. DLY-BIRD.' });
  }
  if (all<ReasonCodeRow>(CODES).some((c) => c.context === context && c.code === code)) {
    throw new MockError(
      409,
      'CODE_EXISTS',
      `${code} already exists under ${findContext(context)?.label}.`,
      {
        fields: { code: 'Already used in this context' },
      },
    );
  }
  const row = insert<ReasonCodeRow>(CODES, {
    id: newId(),
    context,
    code,
    ...codeFields(body, context),
    isActive: true,
    deactivatedReason: null,
    version: 1,
    updatedAt: now(),
    system: false,
  });
  audit('reason-code', describeCode(row), 'created', 'Reason code added', {
    after: presentCode(row),
  });
  return row;
}

function registerReasonCodes(): void {
  const base = '/api/v1/reason-codes';
  const codes = () => all<ReasonCodeRow>(CODES).map(presentCode);

  route('GET', base, (req) => json(listRows(codes(), req.query, CODE_SPEC)));
  route('GET', `${base}/:id`, (req) => {
    const row = find<ReasonCodeRow>(CODES, req.params.id ?? '');
    return row ? json(presentCode(row)) : notFound('reason code');
  });
  route('GET', `${base}/:id/history`, (req) => json(trail(req.params.id ?? '')));

  route('POST', base, (req) => {
    const body = bodyOf(req);
    return json(presentCode(addCode(knownContext(body.context), body.code, body)), 201);
  });

  route('PUT', `${base}/:id`, (req) => {
    const before = current<ReasonCodeRow>(req, CODES, 'reason code');
    const row = replace<ReasonCodeRow>(CODES, {
      ...before,
      ...codeFields(bodyOf(req), before.context),
      version: before.version + 1,
      updatedAt: now(),
    });
    audit('reason-code', describeCode(row), 'changed', 'Reason code changed', {
      before: presentCode(before),
      after: presentCode(row),
    });
    return json(presentCode(row));
  });

  for (const [action, active] of [
    ['deactivate', false],
    ['reactivate', true],
  ] as const) {
    route('POST', `${base}/:id/${action}`, (req) => {
      const before = current<ReasonCodeRow>(req, CODES, 'reason code');
      const reason = reasonOf(req);
      if (!active && before.system) {
        throw new MockError(
          409,
          'SYSTEM_CODE',
          `${before.code} is a system reason code the platform relies on; it can’t be deactivated.`,
        );
      }
      sameState(active, before.isActive, 'code');
      const row = replace<ReasonCodeRow>(CODES, {
        ...before,
        isActive: active,
        deactivatedReason: active ? null : reason,
        version: before.version + 1,
        updatedAt: now(),
      });
      const verb = active ? 'reactivated' : 'deactivated';
      audit('reason-code', describeCode(row), verb, `Reason code ${verb}`, { reason });
      return json(presentCode(row));
    });
  }

  route('DELETE', `${base}/:id`, (req) => {
    const row = current<ReasonCodeRow>(req, CODES, 'reason code');
    const reason = reasonOf(req);
    if (row.system) {
      throw new MockError(
        409,
        'SYSTEM_CODE',
        `${row.code} is a system reason code the platform relies on; it can’t be deleted.`,
      );
    }
    removeRow(CODES, row.id);
    audit('reason-code', describeCode(row), 'deleted', 'Reason code deleted', { reason });
    return noContent();
  });

  route('GET', `${base}/export`, (req) =>
    exportCsv(req, 'reason-codes', codes(), CODE_SPEC, [
      ['Context', (r) => r.contextLabel],
      ['Code', (r) => r.code],
      ['Description', (r) => r.description],
      ['Comment required', (r) => (r.commentRequired ? 'Yes' : 'No')],
      ['Crew change', (r) => (r.crewChange ? 'Yes' : 'No')],
      ['Order', (r) => r.sortOrder],
      ['Status', (r) => (r.isActive ? 'Active' : 'Deactivated')],
    ]),
  );

  route('GET', `${base}/contexts`, () =>
    json({ items: all<ReasonContextRow>(CONTEXTS).map(presentContext) }),
  );

  route('PATCH', `${base}/contexts/:context`, (req) => {
    const before = contextRow(req.params.context ?? '');
    const def = findContext(req.params.context ?? '');
    if (!before || !def) throw new MockError(404, 'NOT_FOUND', 'There is no such reason context.');
    matchVersion(req, before.version);
    const body = bodyOf(req);
    if (typeof body.mandatory !== 'boolean') throw invalid({ mandatory: 'Required' });
    const reason = reasonOf(req);
    if (!body.mandatory && def.alwaysRequired) {
      throw new MockError(
        422,
        'REASON_ALWAYS_REQUIRED',
        `${def.label} always asks for a reason; it can’t be optional.`,
      );
    }
    const row = replace<ReasonContextRow>(CONTEXTS, {
      ...before,
      mandatory: body.mandatory,
      version: before.version + 1,
    });
    audit(
      'reason-context',
      { id: row.id, ref: row.key, label: def.label },
      'changed',
      body.mandatory ? 'Reason made required' : 'Reason made optional',
      { reason, before: { mandatory: before.mandatory }, after: { mandatory: row.mandatory } },
    );
    return json(presentContext(row));
  });

  route('GET', `${base}/options`, (req) => {
    const context = knownContext(req.query.get('context'));
    const options = all<ReasonCodeRow>(CODES)
      .filter((c) => c.context === context && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
      .map((c) => ({
        code: c.code,
        description: c.description,
        commentRequired: c.commentRequired,
        crewChange: c.crewChange,
      }));
    const result: S['ReasonOptions'] = {
      context,
      mandatory: contextRow(context)?.mandatory ?? true,
      options,
    };
    return json(result);
  });

  // Requests for a new code (spec 10 §3.4): anyone asks, Master Data decides.
  route('GET', `${base}/requests`, (req) => {
    const status = req.query.get('status') ?? req.query.get('filter[status]');
    const rows = all<ReasonRequestRow>(REQUESTS).filter((r) => !status || r.status === status);
    return json(
      listRows(rows, req.query, {
        hasActive: false,
        search: (r) => [r.code, r.description, r.contextLabel, r.requestedBy],
        filters: { status: () => true },
        defaultSort: 'requestedAt:desc',
      }),
    );
  });

  route('POST', `${base}/requests`, (req) => {
    const body = bodyOf(req);
    const context = knownContext(body.context);
    const code = required(body.code, 'code').toUpperCase();
    if (!CODE_FORMAT.test(code))
      throw invalid({ code: 'Capital letters and digits in hyphenated parts, e.g. DLY-BIRD.' });
    const description = required(body.description, 'description');
    const why = required(body.why, 'why');
    if (why.length < 3) throw invalid({ why: 'Say why the code is needed.' });
    if (all<ReasonCodeRow>(CODES).some((c) => c.context === context && c.code === code)) {
      throw new MockError(
        409,
        'CODE_EXISTS',
        `${code} already exists under ${findContext(context)?.label}.`,
      );
    }
    if (
      all<ReasonRequestRow>(REQUESTS).some(
        (r) => r.status === 'open' && r.context === context && r.code === code,
      )
    ) {
      throw new MockError(
        409,
        'REQUEST_EXISTS',
        `${code} has already been requested and is waiting for a decision.`,
      );
    }
    const row = insert<ReasonRequestRow>(REQUESTS, {
      id: newId(),
      context,
      contextLabel: findContext(context)?.label ?? context,
      code,
      description,
      why,
      status: 'open',
      requestedBy: actor(),
      requestedAt: now(),
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      version: 1,
    });
    audit('reason-code-request', describeCode(row), 'created', 'Reason code requested', {
      after: row,
    });
    return json(row, 201);
  });

  const decide = (req: MockRequest) => {
    const request = current<ReasonRequestRow>(req, REQUESTS, 'request');
    if (request.status !== 'open') {
      throw new MockError(409, 'REQUEST_DECIDED', 'This request has already been decided.');
    }
    return request;
  };

  route('POST', `${base}/requests/:id/accept`, (req) => {
    const request = decide(req);
    const body = bodyOf(req);
    const added = addCode(request.context, body.code ?? request.code, body);
    const row = replace<ReasonRequestRow>(REQUESTS, {
      ...request,
      status: 'added',
      decidedBy: actor(),
      decidedAt: now(),
      decisionNote: text(body.note) || `Added as ${added.code}.`,
      version: request.version + 1,
    });
    audit('reason-code-request', describeCode(row), 'accepted', 'Reason code request accepted', {
      after: row,
    });
    return json(row);
  });

  route('POST', `${base}/requests/:id/decline`, (req) => {
    const request = decide(req);
    const note = required(bodyOf(req).note, 'note');
    const row = replace<ReasonRequestRow>(REQUESTS, {
      ...request,
      status: 'declined',
      decidedBy: actor(),
      decidedAt: now(),
      decisionNote: note,
      version: request.version + 1,
    });
    audit('reason-code-request', describeCode(row), 'declined', 'Reason code request declined', {
      reason: note,
    });
    return json(row);
  });
}

// ── Approval Engine ─────────────────────────────────────────────────────────

type StageInput = S['ApprovalWorkflowVersionInput']['stages'][number];

function travelReasons() {
  return all<ReasonCodeRow>(CODES)
    .filter((c) => c.context === 'travel' && c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ value: c.code, label: c.description }));
}

function processesView(): S['ApprovalProcesses'] {
  const reasons = travelReasons();
  return {
    processes: APPROVAL_PROCESSES.map((p) => ({
      key: p.key,
      label: p.label,
      module: p.module,
      conditionFields: processFields(p.fields, reasons),
    })),
    rules: APPROVER_RULES.map((r) => ({ ...r })),
    roles: ROLES.map((r) => ({ ...r })),
  };
}

/** The demo's people, with whoever is signed in. */
function userName(id: string): string {
  return PERSONAS.find((p) => p.me.id === id)?.me.displayName ?? personName(id);
}

function workflowSummary(row: WorkflowRow): S['ApprovalWorkflow'] {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    module: row.module,
    process: row.process,
    processLabel: row.processLabel,
    conditions: row.conditions,
    stages: row.stages,
    activeVersionNo: row.activeVersionNo,
    isActive: row.isActive,
    deactivatedReason: row.deactivatedReason,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

const describeWorkflow = (r: WorkflowRow) => ({ id: r.id, ref: r.code, label: r.name });

const WORKFLOW_SPEC: ListSpec<S['ApprovalWorkflow']> = {
  search: (r) => [r.code, r.name, r.processLabel],
  defaultSort: 'name:asc',
};

/** Checks a chain (conditions and stages) the way the engine does, and returns its stages. */
function checkChain(body: Body, processKey: string) {
  const process = findProcess(processKey);
  if (!process)
    throw new MockError(422, 'PROCESS_UNKNOWN', `There is no approval process ${processKey}.`);
  const fields = processFields(process.fields, travelReasons());
  const problems = conditionProblems(fields, body.conditions, 'condition');
  if (!Array.isArray(body.stages) || body.stages.length === 0)
    throw invalid({ stages: 'Add at least one stage.' });
  if (body.stages.length > 8) problems.push('A chain has at most 8 stages.');
  const stages = body.stages as StageInput[];
  stages.forEach((stage, i) => {
    const n = `Stage ${i + 1}`;
    if (!text(stage.name)) problems.push(`${n}: give it a name.`);
    const a = stage.approver as
      Partial<{ kind: string; roleCode: string; userId: string; rule: string }> | undefined;
    if (a?.kind === 'role') {
      if (!ROLES.some((r) => r.code === a.roleCode))
        problems.push(`${n}: there is no active role ${a.roleCode ?? ''}.`);
    } else if (a?.kind === 'user') {
      if (!text(a.userId)) problems.push(`${n}: choose the named approver.`);
    } else if (a?.kind === 'rule') {
      if (!APPROVER_RULES.some((r) => r.key === a.rule))
        problems.push(`${n}: choose an approver rule.`);
    } else {
      problems.push(`${n}: choose who approves.`);
    }
    if (!isInt(stage.slaHours, 1, 720)) problems.push(`${n}: the SLA is 1 to 720 hours.`);
    if ((stage.reminderHours as unknown) != null && !isInt(stage.reminderHours, 1, 720)) {
      problems.push(`${n}: the reminder is 1 to 720 hours.`);
    }
    const e = stage.escalation as Partial<{ kind: string; roleCode: string }> | null | undefined;
    if (e?.kind === 'role' && !ROLES.some((r) => r.code === e.roleCode)) {
      problems.push(`${n}: there is no active role ${e.roleCode ?? ''} to escalate to.`);
    }
    if (
      typeof stage.reminderHours === 'number' &&
      typeof stage.slaHours === 'number' &&
      stage.reminderHours >= stage.slaHours &&
      e
    ) {
      problems.push(`${n}: the reminder must come before the SLA ends.`);
    }
    problems.push(
      ...conditionProblems(fields, stage.skipCondition, 'skip condition').map((p) => `${n}: ${p}`),
    );
  });
  refuseProblems('WORKFLOW_INVALID', problems);
  return {
    conditions: conditionsOf(body.conditions),
    stages: stages.map((s, i) =>
      stageView(
        {
          name: text(s.name),
          approver: s.approver,
          mode: s.mode === 'all' ? 'all' : 'any',
          slaHours: s.slaHours,
          reminderHours: s.reminderHours ?? null,
          escalation: s.escalation ?? null,
          skipCondition:
            s.skipCondition && Object.keys(s.skipCondition).length > 0 ? s.skipCondition : null,
        },
        i + 1,
        userName,
      ),
    ),
  };
}

function registerApprovalWorkflows(): void {
  const base = '/api/v1/approval-workflows';
  const summaries = () => all<WorkflowRow>(WORKFLOWS).map(workflowSummary);

  route('GET', base, (req) => json(listRows(summaries(), req.query, WORKFLOW_SPEC)));
  route('GET', `${base}/:id`, (req) => {
    const row = find<WorkflowRow>(WORKFLOWS, req.params.id ?? '');
    return row ? json(row) : notFound('workflow');
  });
  route('GET', `${base}/:id/history`, (req) => json(trail(req.params.id ?? '')));

  route('POST', base, (req) => {
    const body = bodyOf(req);
    const code = required(body.code, 'code');
    const name = required(body.name, 'name');
    const processKey = required(body.process, 'process');
    const chain = checkChain(body, processKey);
    if (all<WorkflowRow>(WORKFLOWS).some((w) => w.code.toLowerCase() === code.toLowerCase())) {
      throw new MockError(409, 'WORKFLOW_EXISTS', 'A workflow with this code already exists.', {
        fields: { code: 'Already used' },
      });
    }
    const process = findProcess(processKey);
    const at = now();
    const row = insert<WorkflowRow>(WORKFLOWS, {
      id: newId(),
      code,
      name,
      module: process?.module ?? 'administration',
      process: processKey,
      processLabel: process?.label ?? processKey,
      conditions: chain.conditions,
      stages: chain.stages.length,
      activeVersionNo: 1,
      isActive: true,
      deactivatedReason: null,
      version: 1,
      updatedAt: at,
      requests: 0,
      versions: [
        {
          versionNo: 1,
          status: 'active',
          conditions: chain.conditions,
          createdAt: at,
          createdBy: actor(),
          stages: chain.stages,
        },
      ],
    });
    audit(
      'approval-workflow',
      describeWorkflow(row),
      'created',
      `Approval workflow created · ${name} v1`,
      {
        after: { process: row.processLabel, stages: chain.stages.map((s) => s.approver.label) },
      },
    );
    return json(row, 201);
  });

  route('PATCH', `${base}/:id`, (req) => {
    const before = current<WorkflowRow>(req, WORKFLOWS, 'workflow');
    const name = required(bodyOf(req).name, 'name');
    const row = replace<WorkflowRow>(WORKFLOWS, {
      ...before,
      name,
      version: before.version + 1,
      updatedAt: now(),
    });
    audit(
      'approval-workflow',
      describeWorkflow(row),
      'renamed',
      `Approval workflow renamed · ${name}`,
      {
        before: { name: before.name },
        after: { name },
      },
    );
    return json(row);
  });

  route('POST', `${base}/:id/versions`, (req) => {
    const before = current<WorkflowRow>(req, WORKFLOWS, 'workflow');
    const chain = checkChain(bodyOf(req), before.process);
    const versionNo = Math.max(0, ...before.versions.map((v) => v.versionNo)) + 1;
    const at = now();
    const row = replace<WorkflowRow>(WORKFLOWS, {
      ...before,
      conditions: chain.conditions,
      stages: chain.stages.length,
      activeVersionNo: versionNo,
      version: before.version + 1,
      updatedAt: at,
      versions: [
        {
          versionNo,
          status: 'active',
          conditions: chain.conditions,
          createdAt: at,
          createdBy: actor(),
          stages: chain.stages,
        },
        ...before.versions.map((v) => ({ ...v, status: 'retired' as const })),
      ],
    });
    const chainOf = (w: WorkflowRow) => ({
      conditions: w.conditions,
      stages:
        w.versions.find((v) => v.status === 'active')?.stages.map((s) => s.approver.label) ?? [],
    });
    audit(
      'approval-workflow',
      describeWorkflow(row),
      'versioned',
      `Approval workflow changed · ${row.name} v${versionNo}`,
      {
        before: chainOf(before),
        after: chainOf(row),
      },
    );
    return json(row, 201);
  });

  for (const [action, active] of [
    ['deactivate', false],
    ['reactivate', true],
  ] as const) {
    route('POST', `${base}/:id/${action}`, (req) => {
      const before = current<WorkflowRow>(req, WORKFLOWS, 'workflow');
      const reason = reasonOf(req);
      sameState(active, before.isActive, 'workflow');
      const row = replace<WorkflowRow>(WORKFLOWS, {
        ...before,
        isActive: active,
        deactivatedReason: active ? null : reason,
        version: before.version + 1,
        updatedAt: now(),
      });
      const verb = active ? 'reactivated' : 'deactivated';
      audit(
        'approval-workflow',
        describeWorkflow(row),
        verb,
        `Approval workflow ${verb} · ${row.name}`,
        { reason },
      );
      return json(row);
    });
  }

  route('DELETE', `${base}/:id`, (req) => {
    const row = current<WorkflowRow>(req, WORKFLOWS, 'workflow');
    const reason = reasonOf(req);
    if (row.requests > 0) {
      throw new MockError(
        409,
        'WORKFLOW_IN_USE',
        'Requests have used this workflow; deactivate it instead.',
      );
    }
    removeRow(WORKFLOWS, row.id);
    audit(
      'approval-workflow',
      describeWorkflow(row),
      'deleted',
      `Approval workflow deleted · ${row.name}`,
      { reason },
    );
    return noContent();
  });

  route('GET', `${base}/processes`, () => json(processesView()));

  route('GET', `${base}/export`, (req) =>
    exportCsv(req, 'approval-workflows', summaries(), WORKFLOW_SPEC, [
      ['Workflow', (r) => r.name],
      ['Code', (r) => r.code],
      ['Process', (r) => r.processLabel],
      [
        'Stages',
        (r) =>
          find<WorkflowRow>(WORKFLOWS, r.id)
            ?.versions.find((v) => v.status === 'active')
            ?.stages.map((s) => s.approver.label)
            .join(' → '),
      ],
      ['Version', (r) => (r.activeVersionNo === null ? '' : `v${r.activeVersionNo}`)],
      ['Status', (r) => (r.isActive ? 'Active' : 'Deactivated')],
    ]),
  );
}

// ── Business Rules ──────────────────────────────────────────────────────────

type RuleDetail = S['BusinessRuleDetail'];
type RuleVersion = RuleRow['versions'][number];

function presentRule(row: RuleRow): RuleDetail {
  const shown = deriveRule(row);
  const task = all<ApprovalTaskRow>(TASKS).find(
    (t) =>
      t.status === 'open' &&
      t.subject.id === row.id &&
      t.subject.versionNo === shown.pendingVersionNo,
  );
  return { ...shown, myTask: task ? { id: task.id, version: task.version } : null };
}

function ruleSummary(row: RuleRow): S['BusinessRule'] {
  return without(presentRule(row), 'versions', 'myTask');
}

const describeRule = (r: RuleRow) => ({ id: r.id, ref: r.code, label: r.name });

const RULE_SPEC: ListSpec<S['BusinessRule']> = {
  search: (r) => [r.code, r.name, r.typeLabel, r.summary],
  sorts: { type: (r) => r.typeLabel },
  defaultSort: 'module:asc',
};

/** Checks a version's parameters against its type, field by field. */
function checkParameters(def: RuleTypeDef, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw invalid({ parameters: 'Required' });
  const params = value as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const f of def.parameterFields) {
    const v = params[f.key];
    const at = `parameters.${f.key}`;
    const range = `${f.min ?? 0} to ${f.max ?? '∞'}${f.unit ? ` ${f.unit}` : ''}`;
    switch (f.kind) {
      case 'integer':
        if (!(v === null && f.nullable) && !isInt(v, f.min ?? -Infinity, f.max ?? Infinity)) {
          fields[at] = `A whole number from ${range}.`;
        }
        break;
      case 'decimal':
        if (typeof v !== 'number' || v < (f.min ?? -Infinity) || v > (f.max ?? Infinity))
          fields[at] = `A number from ${range}.`;
        break;
      case 'time':
        if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
          fields[at] = 'A time as HH:MM.';
        break;
      case 'boolean':
        if (typeof v !== 'boolean') fields[at] = 'Yes or no.';
        break;
      case 'choice':
        if (!f.options?.some((o) => o.value === v)) fields[at] = 'Choose one of the options.';
        break;
      case 'choices':
      case 'order': {
        const values = Array.isArray(v) ? v : [];
        const known = values.every((x) => f.options?.some((o) => o.value === x));
        if (values.length === 0 || !known) fields[at] = 'Choose at least one of the options.';
        else if (f.kind === 'order' && values.length !== (f.options?.length ?? 0))
          fields[at] = 'Put every option in order.';
        break;
      }
      case 'codes':
        if (
          !Array.isArray(v) ||
          v.length === 0 ||
          v.some((x) => typeof x !== 'string' || x.trim() === '')
        ) {
          fields[at] = 'Give at least one code.';
        }
        break;
      case 'integers':
        if (
          !Array.isArray(v) ||
          v.length === 0 ||
          v.some((x) => !isInt(x, f.min ?? -Infinity, f.max ?? Infinity))
        ) {
          fields[at] = `Whole numbers from ${range}.`;
        }
        break;
      case 'table':
        if (!Array.isArray(v) || v.length < (f.minRows ?? 1) || v.length > (f.maxRows ?? 50))
          fields[at] = 'Check the rows.';
        break;
    }
  }
  if (Object.keys(fields).length > 0) throw invalid(fields);
  refuseProblems('RULE_INVALID', def.check?.(params) ?? []);
  return Object.fromEntries(def.parameterFields.map((f) => [f.key, params[f.key] ?? null]));
}

/** A new version from a form body: pending when the type is high impact, else approved at once. */
function newRuleVersion(def: RuleTypeDef, body: Body, versionNo: number): RuleVersion {
  const parameters = checkParameters(def, body.parameters);
  refuseProblems(
    'RULE_INVALID',
    conditionProblems(def.conditionFields, body.condition, 'condition'),
  );
  const priority = body.priority ?? 100;
  if (!isInt(priority, 1, 1000)) throw invalid({ priority: 'A whole number from 1 to 1000.' });
  const at = now();
  const from =
    typeof body.effectiveFrom === 'string' && !Number.isNaN(Date.parse(body.effectiveFrom))
      ? new Date(body.effectiveFrom).toISOString()
      : at;
  const to =
    typeof body.effectiveTo === 'string' && body.effectiveTo
      ? new Date(body.effectiveTo).toISOString()
      : null;
  if (to && Date.parse(to) <= Date.parse(from))
    throw invalid({ effectiveTo: 'The end must come after the start.' });
  const pending = def.highImpact;
  return {
    versionNo,
    status: pending ? 'pending' : 'approved',
    inEffect: false,
    condition: conditionsOf(body.condition),
    parameters,
    summary: def.summary(parameters),
    priority,
    effectiveFrom: from,
    effectiveTo: to,
    startsAt: from,
    note: text(body.note) || null,
    createdBy: actor(),
    createdAt: at,
    decidedAt: pending ? null : at,
    decidedReason: null,
    approvalId: null,
  };
}

/** Puts an approved version in effect: the one before it ends where it starts. */
function approveVersion(row: RuleRow, versionNo: number, approvalId: string | null): RuleRow {
  const target = row.versions.find((v) => v.versionNo === versionNo);
  const versions = row.versions.map((v): RuleVersion => {
    if (v.versionNo === versionNo)
      return { ...v, status: 'approved', decidedAt: now(), approvalId };
    if (v.status === 'approved' && v.effectiveTo === null && target)
      return { ...v, effectiveTo: target.effectiveFrom };
    return v;
  });
  return { ...row, versions };
}

/** Opens the Super Admin's approval task for a high-impact version (ADR-0043). */
function openTask(ruleId: string, versionNo: number): ApprovalTaskRow {
  return insert<ApprovalTaskRow>(TASKS, {
    id: newId(),
    version: 1,
    instanceId: newId(),
    status: 'open',
    subject: { kind: 'business-rule', id: ruleId, versionNo },
  });
}

function saveRule(before: RuleRow | null, next: RuleRow): RuleRow {
  const row = deriveRule({ ...next, version: (before?.version ?? 0) + 1, updatedAt: now() });
  return before ? replace<RuleRow>(RULES, row) : insert<RuleRow>(RULES, row);
}

function registerBusinessRules(): void {
  const base = '/api/v1/business-rules';
  const summaries = () => all<RuleRow>(RULES).map(ruleSummary);

  route('GET', base, (req) => json(listRows(summaries(), req.query, RULE_SPEC)));
  route('GET', `${base}/:id`, (req) => {
    const row = find<RuleRow>(RULES, req.params.id ?? '');
    return row ? json(presentRule(row)) : notFound('business rule');
  });
  route('GET', `${base}/:id/history`, (req) => json(trail(req.params.id ?? '')));

  route('POST', base, (req) => {
    const body = bodyOf(req);
    const code = required(body.code, 'code');
    const name = required(body.name, 'name');
    const def = findRuleType(required(body.type, 'type'));
    if (!def?.ready) throw invalid({ type: 'Choose a rule type.' });
    if (all<RuleRow>(RULES).some((r) => r.code.toLowerCase() === code.toLowerCase())) {
      throw new MockError(409, 'RULE_EXISTS', 'A business rule with this code already exists.', {
        fields: { code: 'Already used' },
      });
    }
    const version = newRuleVersion(def, body, 1);
    const id = newId();
    const row = saveRule(null, {
      id,
      code,
      name,
      module: def.module,
      type: def.key,
      typeLabel: def.label,
      highImpact: def.highImpact,
      state: 'draft',
      isActive: true,
      deactivatedReason: null,
      versionNo: 1,
      condition: version.condition,
      parameters: version.parameters,
      summary: version.summary,
      priority: version.priority,
      startsAt: version.startsAt,
      effectiveTo: version.effectiveTo,
      pendingVersionNo: null,
      version: 0,
      updatedAt: now(),
      versions: [version],
    });
    if (version.status === 'pending') openTask(id, 1);
    audit('business-rule', describeRule(row), 'created', `Business rule created · ${name} v1`, {
      after: version,
    });
    return json(presentRule(row), 201);
  });

  route('PATCH', `${base}/:id`, (req) => {
    const before = current<RuleRow>(req, RULES, 'business rule');
    const name = required(bodyOf(req).name, 'name');
    const row = saveRule(before, { ...before, name });
    audit('business-rule', describeRule(row), 'renamed', `Business rule renamed · ${name}`, {
      before: { name: before.name },
      after: { name },
    });
    return json(presentRule(row));
  });

  route('POST', `${base}/:id/versions`, (req) => {
    const before = current<RuleRow>(req, RULES, 'business rule');
    const def = findRuleType(before.type);
    if (!def)
      throw new MockError(422, 'RULE_TYPE_UNKNOWN', 'This rule’s type is no longer offered.');
    const pending = before.versions.find((v) => v.status === 'pending');
    if (pending) {
      throw new MockError(
        409,
        'VERSION_PENDING',
        `Version ${pending.versionNo} is awaiting approval; withdraw it first.`,
      );
    }
    const versionNo = Math.max(0, ...before.versions.map((v) => v.versionNo)) + 1;
    const version = newRuleVersion(def, bodyOf(req), versionNo);
    let next: RuleRow = { ...before, versions: [version, ...before.versions] };
    if (version.status === 'approved') next = approveVersion(next, versionNo, null);
    const row = saveRule(before, next);
    if (version.status === 'pending') openTask(row.id, versionNo);
    audit(
      'business-rule',
      describeRule(row),
      'versioned',
      version.status === 'pending'
        ? `Business rule v${versionNo} sent for approval · ${row.name}`
        : `Business rule changed · ${row.name} v${versionNo}`,
      { before: { summary: before.summary }, after: { summary: version.summary } },
    );
    return json(presentRule(row), 201);
  });

  route('POST', `${base}/:id/versions/:versionNo/withdraw`, (req) => {
    const before = current<RuleRow>(req, RULES, 'business rule');
    const versionNo = Number(req.params.versionNo);
    const reason = reasonOf(req);
    const target = before.versions.find((v) => v.versionNo === versionNo);
    if (!target) throw new MockError(404, 'NOT_FOUND', 'The version was not found.');
    if (target.status !== 'pending')
      throw new MockError(409, 'NOT_PENDING', `Version ${versionNo} is not awaiting approval.`);
    for (const task of all<ApprovalTaskRow>(TASKS)) {
      if (
        task.status === 'open' &&
        task.subject.id === before.id &&
        task.subject.versionNo === versionNo
      ) {
        replace<ApprovalTaskRow>(TASKS, {
          ...task,
          status: 'cancelled',
          version: task.version + 1,
        });
      }
    }
    const row = saveRule(before, {
      ...before,
      versions: before.versions.map((v) =>
        v.versionNo === versionNo
          ? { ...v, status: 'withdrawn', decidedAt: now(), decidedReason: reason }
          : v,
      ),
    });
    audit(
      'business-rule',
      describeRule(row),
      'withdrawn',
      `Business rule v${versionNo} withdrawn · ${row.name}`,
      { reason },
    );
    return json(presentRule(row));
  });

  for (const [action, active] of [
    ['deactivate', false],
    ['reactivate', true],
  ] as const) {
    route('POST', `${base}/:id/${action}`, (req) => {
      const before = current<RuleRow>(req, RULES, 'business rule');
      const reason = reasonOf(req);
      sameState(active, before.isActive, 'rule');
      const inEffect = deriveRule(before).versions.find((v) => v.inEffect)?.versionNo;
      const latest = before.versions.find((v) => v.status === 'approved')?.versionNo;
      const row = saveRule(before, {
        ...before,
        isActive: active,
        deactivatedReason: active ? null : reason,
        versions: before.versions.map((v) =>
          !active && v.versionNo === inEffect
            ? { ...v, effectiveTo: now() }
            : active && v.versionNo === latest
              ? { ...v, effectiveTo: null }
              : v,
        ),
      });
      const verb = active ? 'reinstated' : 'ended';
      audit('business-rule', describeRule(row), verb, `Business rule ${verb} · ${row.name}`, {
        reason,
      });
      return json(presentRule(row));
    });
  }

  route('DELETE', `${base}/:id`, (req) => {
    const row = current<RuleRow>(req, RULES, 'business rule');
    const reason = reasonOf(req);
    for (const task of all<ApprovalTaskRow>(TASKS)) {
      if (task.status === 'open' && task.subject.id === row.id) {
        replace<ApprovalTaskRow>(TASKS, {
          ...task,
          status: 'cancelled',
          version: task.version + 1,
        });
      }
    }
    removeRow(RULES, row.id);
    audit('business-rule', describeRule(row), 'deleted', `Business rule deleted · ${row.name}`, {
      reason,
    });
    return noContent();
  });

  route('GET', `${base}/types`, () => {
    const rules = all<RuleRow>(RULES).map((r) => deriveRule(r));
    const types: S['BusinessRuleTypes']['types'] = RULE_TYPES.map((def) => ({
      ...without(def, 'summary', 'check'),
      live: rules.some(
        (r) => r.type === def.key && (r.state === 'active' || r.state === 'scheduled'),
      ),
    }));
    return json({ types });
  });

  route('GET', `${base}/export`, (req) =>
    exportCsv(req, 'business-rules', summaries(), RULE_SPEC, [
      ['Rule', (r) => r.name],
      ['Code', (r) => r.code],
      ['Type', (r) => r.typeLabel],
      ['Value', (r) => r.summary],
      ['Priority', (r) => r.priority],
      ['Version', (r) => `v${r.versionNo}`],
      ['State', (r) => r.state],
    ]),
  );

  // The Approval Engine's task actions, for the tasks this demo holds (business-rule versions).
  const task = (req: MockRequest) => {
    const row = current<ApprovalTaskRow>(req, TASKS, 'approval task');
    if (row.status !== 'open')
      throw new MockError(409, 'TASK_CLOSED', 'This task has already been acted on.');
    const rule = find<RuleRow>(RULES, row.subject.id);
    if (!rule) throw new MockError(404, 'NOT_FOUND', 'The business rule was not found.');
    return { row, rule };
  };

  route('POST', '/api/v1/approvals/tasks/:id/approve', (req) => {
    // POB master changes are decided by the Places service; its tasks aren't business rules.
    const pob = decidePobTask(req.params.id ?? '', 'approve', req.headers.get('If-Match'));
    if (pob) return json(pob);
    const { row, rule } = task(req);
    replace<ApprovalTaskRow>(TASKS, { ...row, status: 'approved', version: row.version + 1 });
    const saved = saveRule(rule, approveVersion(rule, row.subject.versionNo, row.instanceId));
    audit(
      'business-rule',
      describeRule(saved),
      'approved',
      `Business rule v${row.subject.versionNo} approved · ${saved.name}`,
    );
    const outcome: S['ApprovalOutcome'] = { instanceId: row.instanceId, status: 'approved' };
    return json(outcome);
  });

  route('POST', '/api/v1/approvals/tasks/:id/reject', (req) => {
    const body = bodyOf(req);
    const note =
      typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : null;
    const pob = decidePobTask(req.params.id ?? '', 'reject', req.headers.get('If-Match'), note);
    if (pob) return json(pob);
    const { row, rule } = task(req);
    const reasonCode = required(body.reasonCode, 'reasonCode');
    const comment = required(body.comment, 'comment');
    const known = all<ReasonCodeRow>(CODES).some(
      (c) => c.context === 'approver-rejection' && c.code === reasonCode && c.isActive,
    );
    if (!known) throw invalid({ reasonCode: 'Choose an Approver Rejection reason.' });
    replace<ApprovalTaskRow>(TASKS, { ...row, status: 'rejected', version: row.version + 1 });
    const saved = saveRule(rule, {
      ...rule,
      versions: rule.versions.map((v) =>
        v.versionNo === row.subject.versionNo
          ? {
              ...v,
              status: 'returned',
              decidedAt: now(),
              decidedReason: `${reasonCode}: ${comment}`,
              approvalId: row.instanceId,
            }
          : v,
      ),
    });
    audit(
      'business-rule',
      describeRule(saved),
      'returned',
      `Business rule v${row.subject.versionNo} returned · ${saved.name}`,
      {
        reason: `${reasonCode}: ${comment}`,
      },
    );
    const outcome: S['ApprovalOutcome'] = { instanceId: row.instanceId, status: 'rejected' };
    return json(outcome);
  });
}

// ── Notification Engine ─────────────────────────────────────────────────────

type NotificationRule = S['NotificationRule'];
type Channel = NotificationRule['channels'][number];
type Templates = S['NotificationTemplates'];
type FilterField = S['NotificationTriggers']['triggers'][number]['filterFields'][number];

const CHANNELS: readonly Channel[] = ['in_app', 'email', 'sms', 'push'];
const CHANNEL_LABEL: Record<Channel, string> = {
  in_app: 'In-app',
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
};
/** The parts each channel must have. */
const CHANNEL_PARTS: Record<Channel, readonly ('subject' | 'title' | 'body')[]> = {
  in_app: ['title', 'body'],
  email: ['subject', 'body'],
  sms: ['body'],
  push: ['title'],
};

/** The payload fields a rule can filter on. */
function filterFields(trigger: TriggerDef): FilterField[] {
  return trigger.fields.flatMap((f): FilterField[] => {
    switch (f.type) {
      case 'choice':
        return [
          {
            key: f.key,
            label: f.label,
            type: 'choice',
            options: [...(f.options ?? [])],
            unit: null,
          },
        ];
      case 'text':
        return [{ key: f.key, label: f.label, type: 'values', options: null, unit: null }];
      case 'flag':
        return [{ key: f.key, label: f.label, type: 'flag', options: null, unit: null }];
      case 'number':
        return [{ key: f.key, label: f.label, type: 'amount', options: null, unit: f.unit ?? '' }];
      default:
        return [];
    }
  });
}

function namedPerson(id: string) {
  const persona = PERSONAS.find((p) => p.me.id === id);
  if (persona) return { userId: id, name: persona.me.displayName, email: persona.me.email };
  return PEOPLE.find((p) => p.userId === id) ?? { userId: id, name: 'Named user', email: '' };
}

function presentNotification(row: NotificationRuleRow): S['NotificationRuleDetail'] {
  const trigger = findTrigger(row.trigger);
  const people = row.recipients.people.map(
    (k) => trigger?.recipients.find((r) => r.key === k)?.label ?? k,
  );
  const count = (n: number, one: string, many: string) =>
    n > 0 ? `${n} ${n === 1 ? one : many}` : '';
  const recipientsSummary = [
    people.join(', '),
    row.recipients.roles.map(roleName).join(', '),
    count(row.recipients.users.length, 'user', 'users'),
    count(row.recipients.emails.length, 'address', 'addresses'),
  ]
    .filter(Boolean)
    .join(' · ');
  const category = trigger?.category ?? 'admin';
  return {
    ...row,
    module: trigger?.module ?? 'administration',
    triggerLabel: trigger?.label ?? row.trigger,
    category,
    mandatory: MANDATORY_CATEGORIES.includes(category),
    live: (trigger?.phase ?? 99) <= CURRENT_PHASE,
    phase: trigger?.phase ?? 99,
    recipientsSummary,
    namedUsers: row.recipients.users.map(namedPerson),
  };
}

function notificationSummary(row: NotificationRuleRow): NotificationRule {
  return without(presentNotification(row), 'namedUsers');
}

const describeNotification = (r: { id: string; code: string; name: string }) => ({
  id: r.id,
  ref: r.code,
  label: r.name,
});

const NOTIFY_SPEC: ListSpec<NotificationRule> = {
  search: (r) => [r.code, r.name, r.triggerLabel],
  sorts: { trigger: (r) => r.triggerLabel },
  defaultSort: 'module:asc',
};

const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

/** Fills a template from the trigger's samples; unknown placeholders are problems. */
function render(trigger: TriggerDef, channels: readonly Channel[], templates: Templates) {
  const problems: string[] = [];
  const rendered: Templates = {};
  for (const channel of channels) {
    const template = templates[channel] ?? {};
    const out: { subject?: string | null; title?: string | null; body?: string | null } = {};
    for (const part of CHANNEL_PARTS[channel]) {
      const source = text(template[part]);
      if (!source) {
        problems.push(`${CHANNEL_LABEL[channel]}: the ${part} is empty.`);
        continue;
      }
      out[part] = source.replace(PLACEHOLDER, (whole, key: string) => {
        const field = trigger.fields.find((f) => f.key === key);
        if (!field) {
          problems.push(
            `${CHANNEL_LABEL[channel]}: {{${key}}} is not a field of “${trigger.label}”.`,
          );
          return whole;
        }
        return field.sample;
      });
    }
    if (channel === 'sms' && (out.body?.length ?? 0) > 320)
      problems.push('SMS: keep the message within 320 characters.');
    rendered[channel] = out;
  }
  return { rendered, problems };
}

/** Checks a rule's content (everything but its code and trigger). */
function checkNotification(body: Body, trigger: TriggerDef) {
  const name = required(body.name, 'name');
  const channels = Array.isArray(body.channels)
    ? [...new Set(body.channels)].filter((c): c is Channel => CHANNELS.includes(c as Channel))
    : [];
  if (channels.length === 0) throw invalid({ channels: 'Choose at least one channel.' });
  const frequency = body.frequency ?? 'immediate';
  if (frequency !== 'immediate' && frequency !== 'digest' && frequency !== 'recurring') {
    throw invalid({ frequency: 'Choose how often it sends.' });
  }
  const everyDays = frequency === 'recurring' ? body.everyDays : null;
  if (frequency === 'recurring' && !isInt(everyDays, 1, 90))
    throw invalid({ everyDays: 'Every 1 to 90 days.' });
  const severity = body.severity ?? 'info';
  if (severity !== 'info' && severity !== 'warning' && severity !== 'critical')
    throw invalid({ severity: 'Choose a severity.' });
  const r = (body.recipients ?? {}) as Partial<
    Record<'roles' | 'people' | 'users' | 'emails', unknown>
  >;
  const strings = (v: unknown) =>
    Array.isArray(v)
      ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim() !== ''))]
      : [];
  const recipients = {
    roles: strings(r.roles),
    people: strings(r.people),
    users: strings(r.users),
    emails: strings(r.emails).map((e) => e.toLowerCase()),
  };
  const problems: string[] = [];
  if (Object.values(recipients).every((list) => list.length === 0))
    throw invalid({ recipients: 'Choose who receives it.' });
  for (const key of recipients.people) {
    if (!trigger.recipients.some((x) => x.key === key))
      problems.push(`${key} is not someone this trigger can reach.`);
  }
  for (const code of recipients.roles)
    if (!ROLES.some((x) => x.code === code)) problems.push(`There is no active role ${code}.`);
  for (const email of recipients.emails)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      problems.push(`${email} is not an email address.`);
  if (recipients.emails.length > 0 && currentPersona()?.me.roles[0]?.code !== 'super-admin') {
    throw new MockError(
      403,
      'EMAILS_ADMIN_ONLY',
      'Only a Super Admin can send rules to email addresses.',
    );
  }
  problems.push(...conditionProblems(filterFields(trigger), body.filter, 'filter'));
  const templates = (body.templates ?? {}) as Templates;
  problems.push(...render(trigger, channels, templates).problems);
  refuseProblems('RULE_INVALID', problems);
  return {
    name,
    filter: conditionsOf(body.filter),
    frequency,
    everyDays: typeof everyDays === 'number' ? everyDays : null,
    channels,
    recipients,
    severity,
    templates: Object.fromEntries(channels.map((c) => [c, templates[c] ?? {}])) as Templates,
  } satisfies Partial<NotificationRuleRow>;
}

function registerNotifications(): void {
  const base = '/api/v1/notification-rules';
  const summaries = () => all<NotificationRuleRow>(NOTIFY).map(notificationSummary);

  route('GET', base, (req) => json(listRows(summaries(), req.query, NOTIFY_SPEC)));
  route('GET', `${base}/:id`, (req) => {
    const row = find<NotificationRuleRow>(NOTIFY, req.params.id ?? '');
    return row ? json(presentNotification(row)) : notFound('notification rule');
  });
  route('GET', `${base}/:id/history`, (req) => json(trail(req.params.id ?? '')));

  route('POST', base, (req) => {
    const body = bodyOf(req);
    const code = required(body.code, 'code');
    const trigger = findTrigger(required(body.trigger, 'trigger'));
    if (!trigger) throw invalid({ trigger: 'Choose a trigger.' });
    if (all<NotificationRuleRow>(NOTIFY).some((r) => r.code.toLowerCase() === code.toLowerCase())) {
      throw new MockError(
        409,
        'RULE_EXISTS',
        'A notification rule with this code already exists.',
        { fields: { code: 'Already used' } },
      );
    }
    const row = insert<NotificationRuleRow>(NOTIFY, {
      id: newId(),
      code,
      trigger: trigger.key,
      ...checkNotification(body, trigger),
      isActive: true,
      deactivatedReason: null,
      version: 1,
      updatedAt: now(),
    });
    audit(
      'notification-rule',
      describeNotification(row),
      'created',
      `Notification rule created · ${row.name}`,
      { after: row },
    );
    return json(presentNotification(row), 201);
  });

  route('PUT', `${base}/:id`, (req) => {
    const before = current<NotificationRuleRow>(req, NOTIFY, 'notification rule');
    const trigger = findTrigger(before.trigger);
    if (!trigger)
      throw new MockError(422, 'TRIGGER_UNKNOWN', 'This rule’s trigger is no longer offered.');
    const row = replace<NotificationRuleRow>(NOTIFY, {
      ...before,
      ...checkNotification(bodyOf(req), trigger),
      version: before.version + 1,
      updatedAt: now(),
    });
    audit(
      'notification-rule',
      describeNotification(row),
      'changed',
      `Notification rule changed · ${row.name}`,
      {
        before,
        after: row,
      },
    );
    return json(presentNotification(row));
  });

  for (const [action, active] of [
    ['deactivate', false],
    ['reactivate', true],
  ] as const) {
    route('POST', `${base}/:id/${action}`, (req) => {
      const before = current<NotificationRuleRow>(req, NOTIFY, 'notification rule');
      const reason = reasonOf(req);
      sameState(active, before.isActive, 'rule');
      if (
        !active &&
        presentNotification(before).mandatory &&
        currentPersona()?.me.roles[0]?.code !== 'super-admin'
      ) {
        throw new MockError(
          403,
          'MANDATORY_ADMIN_ONLY',
          'Only a Super Admin can switch off a rule of a mandatory category.',
        );
      }
      const row = replace<NotificationRuleRow>(NOTIFY, {
        ...before,
        isActive: active,
        deactivatedReason: active ? null : reason,
        version: before.version + 1,
        updatedAt: now(),
      });
      const verb = active ? 'reactivated' : 'deactivated';
      audit(
        'notification-rule',
        describeNotification(row),
        verb,
        `Notification rule ${verb} · ${row.name}`,
        { reason },
      );
      return json(presentNotification(row));
    });
  }

  route('DELETE', `${base}/:id`, (req) => {
    const row = current<NotificationRuleRow>(req, NOTIFY, 'notification rule');
    const reason = reasonOf(req);
    removeRow(NOTIFY, row.id);
    audit(
      'notification-rule',
      describeNotification(row),
      'deleted',
      `Notification rule deleted · ${row.name}`,
      { reason },
    );
    return noContent();
  });

  route('GET', `${base}/triggers`, () => {
    const result: S['NotificationTriggers'] = {
      triggers: TRIGGERS.map((t) => ({
        key: t.key,
        module: t.module,
        label: t.label,
        category: t.category,
        mandatory: MANDATORY_CATEGORIES.includes(t.category),
        phase: t.phase,
        live: t.phase <= CURRENT_PHASE,
        fields: t.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          sample: f.sample,
        })),
        filterFields: filterFields(t),
        recipients: t.recipients.map((r) => ({ ...r })),
      })),
      roles: ROLES.map((r) => ({ ...r })),
    };
    return json(result);
  });

  route('POST', `${base}/preview`, (req) => {
    const body = bodyOf(req);
    const trigger = findTrigger(required(body.trigger, 'trigger'));
    if (!trigger) throw invalid({ trigger: 'Choose a trigger.' });
    const channels = Array.isArray(body.channels)
      ? body.channels.filter((c): c is Channel => CHANNELS.includes(c as Channel))
      : [];
    const result: S['NotificationPreview'] = render(trigger, channels, body.templates ?? {});
    return json(result);
  });

  route('GET', `${base}/export`, (req) =>
    exportCsv(req, 'notification-rules', summaries(), NOTIFY_SPEC, [
      ['Rule', (r) => r.name],
      ['Code', (r) => r.code],
      ['Trigger', (r) => r.triggerLabel],
      ['Channels', (r) => r.channels.map((c) => CHANNEL_LABEL[c]).join(', ')],
      ['Recipients', (r) => r.recipientsSummary],
      ['Severity', (r) => r.severity],
      ['Status', (r) => (r.isActive ? 'Active' : 'Deactivated')],
    ]),
  );

  // The delivery log (P-48): every message the engine sent, and a retry for the failed ones.
  route('GET', '/api/v1/notification-deliveries', (req) =>
    json(
      listRows(all<DeliveryRow>(DELIVERIES), req.query, {
        hasActive: false,
        search: (d) => [d.recipient, d.address, d.subject, d.text, d.rule?.name],
        filters: { rule: (d, v) => d.rule?.id === v },
        defaultSort: 'queuedAt:desc',
      }),
    ),
  );

  route('POST', '/api/v1/notification-deliveries/:id/retry', (req) => {
    const before = find<DeliveryRow>(DELIVERIES, req.params.id ?? '');
    if (!before) throw new MockError(404, 'NOT_FOUND', 'The delivery was not found.');
    if (before.status !== 'failed')
      throw new MockError(409, 'NOT_RETRIABLE', 'Only a failed message can be sent again.');
    const at = now();
    const row = replace<DeliveryRow>(DELIVERIES, {
      ...before,
      status: 'sent',
      attempts: before.attempts + 1,
      error: null,
      providerRef: `${before.channel.toUpperCase()}-${newId().slice(0, 8)}`,
      retriable: false,
      sentAt: at,
    });
    audit(
      'notification-delivery',
      { id: row.id, ref: row.channel, label: row.recipient },
      'retried',
      `Delivery retried · ${row.channel} to ${row.recipient}`,
    );
    return json(row);
  });
}
