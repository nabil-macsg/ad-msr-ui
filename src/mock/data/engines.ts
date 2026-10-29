import type { components } from '../../api/schema';
import { gstDate, idFor, SEEDED_AT } from './ids';
import locationSeeds from './seeds/locations.json';
import personaSeeds from './seeds/personas.json';
import demoReasonSeeds from './seeds/reason-codes.json';

type S = components['schemas'];
export type ModuleKey = S['ApprovalWorkflow']['module'];
export type Conditions = S['ApprovalWorkflow']['conditions'];
type Option = { value: string; label: string };

/** A GST wall-clock moment `offsetDays` from today, as an ISO timestamp. */
export const gstAt = (offsetDays: number, time = '08:00'): string =>
  new Date(`${gstDate(offsetDays)}T${time}:00+04:00`).toISOString();

// ── Shared reference ────────────────────────────────────────────────────────

/** The role catalogue an approver, an escalation or a notification can name. */
export const ROLES: readonly { code: string; name: string }[] = [
  { code: 'super-admin', name: 'Super Admin' },
  { code: 'master-data-power-user', name: 'Master Data Power User' },
  { code: 'admin-user', name: 'Admin User' },
  { code: 'pl-power-user', name: 'People Logistics Power User' },
  { code: 'aviation-team', name: 'Aviation Team' },
  { code: 'line-manager', name: 'Line Manager' },
  { code: 'site-in-charge', name: 'Site In-charge' },
  { code: 'focal-point', name: 'Focal Point' },
  { code: 'dispatch-team', name: 'Dispatch Team' },
  { code: 'checkin-staff', name: 'Check-in Staff' },
  { code: 'muster-coordinator', name: 'Muster Coordinator' },
  { code: 'pob-master-data-power-user', name: 'POB Master Data Power User' },
  { code: 'executive', name: 'Executive' },
  { code: 'site-focal-point-helideck', name: 'Site Focal Point (Helideck)' },
  { code: 'inspection-team-poc', name: 'Inspection Team POC' },
  { code: 'tl-ats', name: 'TL ATS' },
  { code: 'mosa', name: 'MOSA' },
  { code: 'aviation-technical-team', name: 'Aviation Technical Team' },
  { code: 'compliance-admin', name: 'Compliance Admin' },
  { code: 'department-focal-point', name: 'Department Focal Point' },
  { code: 'logistics-vp', name: 'Logistics VP' },
  { code: 'aviation-compliance-team', name: 'Aviation Compliance Team' },
];
export const roleName = (code: string): string => ROLES.find((r) => r.code === code)?.name ?? code;

export const PASSENGER_CATEGORIES: readonly Option[] = [
  { value: 'VIP', label: 'VIP' },
  { value: 'EP', label: 'Essential Personnel' },
  { value: 'DH', label: 'Direct Hire' },
  { value: 'EST-POS', label: 'Essential Position' },
  { value: 'CON', label: 'Contractor' },
  { value: 'VIS', label: 'Visitor' },
  { value: 'GEN', label: 'General' },
];

/** Every demo location, as a condition option (value: its id). */
export const LOCATION_OPTIONS: readonly Option[] = (
  locationSeeds as { code: string; name: string }[]
).map((l) => ({ value: idFor('location', l.code), label: l.name }));

/** The people the seeded data names (MASAR's demo personas), by user id. */
export const PEOPLE: readonly { userId: string; name: string; email: string }[] = (
  personaSeeds as { name: string; email: string }[]
).map((p) => ({ userId: idFor('user', p.email), name: p.name, email: p.email }));
const person = (email: string) => PEOPLE.find((p) => p.email === email);

// ── Reason Codes ────────────────────────────────────────────────────────────

export type ContextKey = S['ReasonContext']['key'];

export interface ContextDef {
  readonly key: ContextKey;
  readonly label: string;
  readonly module: ModuleKey;
  /** Its codes may count as a crew change (Reason for Travel only). */
  readonly crewChange: boolean;
  /** A rejection always carries a reason: never optional. */
  readonly alwaysRequired: boolean;
}

const ctx = (
  key: ContextKey,
  label: string,
  module: ModuleKey,
  flags: { crewChange?: boolean; alwaysRequired?: boolean } = {},
): ContextDef => ({
  key,
  label,
  module,
  crewChange: flags.crewChange ?? false,
  alwaysRequired: flags.alwaysRequired ?? false,
});

export const REASON_CONTEXTS: readonly ContextDef[] = [
  ctx('travel', 'Reason for Travel', 'people-logistics', { crewChange: true }),
  ctx('booking-cancellation', 'Booking Cancellation', 'people-logistics'),
  ctx('approver-rejection', 'Approver Rejection', 'administration', { alwaysRequired: true }),
  ctx('offload', 'Passenger Offload', 'people-logistics'),
  ctx('no-show', 'No-Show', 'people-logistics'),
  ctx('journey-delay', 'Journey Delay', 'people-logistics'),
  ctx('journey-cancellation', 'Journey Cancellation', 'people-logistics'),
  ctx('manifest-reopen', 'Manifest / Trip Reopen', 'people-logistics'),
  ctx('non-serviceable', 'Resource / Location Non-Serviceable', 'administration'),
  ctx('integration-override', 'Integration Data Override', 'administration'),
  ctx('quota-override', 'Quota Override', 'people-logistics'),
  ctx('vip-seat', 'VIP Seat Reservation', 'people-logistics'),
  ctx('freight-rejection', 'Freight Rejection', 'people-logistics', { alwaysRequired: true }),
  ctx('dispensation', 'Dispensation Request', 'helideck'),
  ctx('reschedule', 'Reschedule', 'helideck'),
  ctx('helideck-return', 'Return / Rejection (helideck)', 'helideck', { alwaysRequired: true }),
  ctx('target-date-override', 'Target Date Override', 'helideck'),
  ctx('record-reopen', 'Record Reopen', 'administration'),
  ctx('muster-unavailability', 'Muster Point Unavailability', 'pob'),
];
export const findContext = (key: string): ContextDef | undefined =>
  REASON_CONTEXTS.find((c) => c.key === key);

/** Whether a context asks for a reason is data; the rest of the context is code. */
export interface ReasonContextRow {
  id: string;
  key: ContextKey;
  mandatory: boolean;
  version: number;
}

/** A stored code; its context's label and "mandatory" are read from the context. */
export type ReasonCodeRow = Omit<S['ReasonCode'], 'contextLabel' | 'mandatory'> & {
  /** A code the platform relies on: it can't be deactivated or deleted. */
  system: boolean;
};
export type ReasonRequestRow = S['ReasonCodeRequest'];

interface CodeSeed {
  readonly code: string;
  readonly description: string;
  readonly commentRequired?: boolean;
  readonly crewChange?: boolean;
  readonly system?: boolean;
  readonly deactivatedReason?: string;
}
const lines = (text: string): CodeSeed[] =>
  text
    .trim()
    .split('\n')
    .map((line) => {
      const [code = '', ...rest] = line.trim().split(' ');
      return { code, description: rest.join(' ') };
    });

/** MASAR's reference reason codes (BRD A.2.3.1), plus the demo's additions. */
const REASON_CODE_SEEDS: Partial<Record<ContextKey, readonly CodeSeed[]>> = {
  travel: [
    ...lines(`
      TRV-DUTY Duty
      TRV-LEAVE Leave
      TRV-MEDICAL Medical
      TRV-FIELDBREAK Field Break
      TRV-MISSION Mission
      TRV-RSD RSD
      TRV-EMERGENCY Emergency
      TRV-VISITOR Visitor
      TRV-VIP VIP
      TRV-EVACUATION Evacuation`),
    { code: 'TRV-SHUTDOWN', description: 'Shutdown', crewChange: true },
    { code: 'TRV-DEMOB', description: 'Demobilization', crewChange: true },
    { code: 'TRV-REMOB', description: 'Remobilization', crewChange: true },
    { code: 'TRV-PLANNED', description: 'Planned (rotation)', crewChange: true, system: true },
  ],
  offload: lines(`
    OFF-NOSHOW No-show at check-in
    OFF-WEIGHT Weight / payload restriction
    OFF-CERT Certificate expired at check-in
    OFF-MEDICAL Medically unfit to travel
    OFF-PRIORITY Displaced by higher-priority passenger
    OFF-SECURITY Security pass invalid
    OFF-CREWCHANGE Seat needed for a crew change
    OFF-VOLUNTARY Voluntary withdrawal
    OFF-OPSHOLD Operational hold
    OFF-DOCS Visa / document issue`),
  'non-serviceable': lines(`
    NOP-MAINT Planned maintenance
    NOP-DEFECT Unplanned defect
    NOP-WEATHER Weather / sea state
    NOP-INSPECTION Failed or overdue inspection
    NOP-CONSTRUCTION Construction / crane operations`),
  'booking-cancellation': [
    ...lines(`
      CAN-OPS Operational requirement changed
      CAN-PAX Passenger request
      CAN-RESOURCE Resource unavailable
      CAN-WEATHER Weather cancellation`),
    {
      code: 'CAN-DUPLICATE',
      description: 'Duplicate booking',
      deactivatedReason: 'Duplicates are now blocked at submission; no longer needed.',
    },
  ],
  dispensation: lines(`
    DIS-OBSTACLE Obstacle clearance infringement
    DIS-FRICTION Friction test failed or expired
    DIS-MARKING Deck marking non-compliance
    DIS-EQUIPMENT Equipment defect pending repair`),
  'muster-unavailability': lines(`
    MUS-MAINT Muster point under maintenance
    MUS-ACCESS Access route blocked
    MUS-LIFEBOAT Lifeboat out of service`),
  'journey-delay': [
    ...lines(`
      DLY-WX Weather below minima
      DLY-TECH Technical — aircraft or vessel
      DLY-CREW Crew duty limitation
      DLY-PAX Awaiting passengers
      DLY-CARGO Awaiting cargo
      DLY-ATC Air traffic / port control`),
    { code: 'DLY-OTHER', description: 'Other', commentRequired: true },
  ],
  'journey-cancellation': lines(`
    JCN-SEA Weather — sea state above limits
    JCN-WX Weather below minima
    JCN-US Aircraft unserviceable, no replacement available
    JCN-DEMAND Insufficient demand — passengers moved to a later departure`),
  'approver-rejection': lines(`
    REJ-ROTATION Travel outside rotation
    REJ-UNAVAILABLE Passenger unavailable
    REJ-NOJUST Insufficient justification
    REJ-CERT Certificates not valid`),
  'no-show': lines(`
    NOS-CHECKIN Not checked in at close
    NOS-LATE Late cancellation after cut-off
    NOS-TRANSPORT Ground transport delay to the heliport`),
  'manifest-reopen': [
    ...lines(`
      RPN-CORRECTION Data correction
      RPN-RETURN Aircraft returned`),
    { code: 'RPN-OTHER', description: 'Other', commentRequired: true },
  ],
  'integration-override': lines(`
    IDO-UNAVAILABLE Source system unavailable
    IDO-PENDING Record pending in source`),
  'quota-override': lines(`
    QOV-OPS Operational need
    QOV-VIP VIP movement`),
  'vip-seat': lines(`
    VSR-VIP VIP visit
    VSR-MGMT Management visit`),
  'freight-rejection': lines(`
    FRJ-NOTURGENT Not urgent — use marine
    FRJ-DOCS Documents missing`),
  'helideck-return': lines(`
    HDR-READINESS Site not ready
    HDR-DOCS Documents incomplete
    HDR-DATE Date not feasible`),
  'target-date-override': lines(`
    TDO-CONTRACTOR Contractor lead time
    TDO-PARTS Parts lead time`),
  'record-reopen': lines(`
    RRO-ERROR Entered in error
    RRO-AUDIT Audit request`),
};

export const reasonCodeId = (context: string, code: string) =>
  idFor('reason-code', `${context}:${code}`);

export function reasonCodeSeeds(): ReasonCodeRow[] {
  const rows: ReasonCodeRow[] = [];
  for (const context of REASON_CONTEXTS) {
    const seeds = [...(REASON_CODE_SEEDS[context.key] ?? [])];
    for (const extra of demoReasonSeeds as {
      context: string;
      code: string;
      description: string;
    }[]) {
      if (extra.context === context.key && !seeds.some((s) => s.code === extra.code)) {
        seeds.push({ code: extra.code, description: extra.description });
      }
    }
    seeds.forEach((s, index) => {
      rows.push({
        id: reasonCodeId(context.key, s.code),
        context: context.key,
        code: s.code,
        description: s.description,
        commentRequired: s.commentRequired ?? false,
        crewChange: s.crewChange ?? false,
        sortOrder: (index + 1) * 10,
        isActive: s.deactivatedReason === undefined,
        deactivatedReason: s.deactivatedReason ?? null,
        version: s.deactivatedReason === undefined ? 1 : 2,
        updatedAt: SEEDED_AT,
        system: s.system ?? false,
      });
    });
  }
  return rows;
}

/** Every context asks for a reason, except the two the demo administrators made optional. */
export const reasonContextSeeds = (): ReasonContextRow[] =>
  REASON_CONTEXTS.map((c) => ({
    id: c.key,
    key: c.key,
    mandatory: !['vip-seat', 'reschedule'].includes(c.key),
    version: ['vip-seat', 'reschedule'].includes(c.key) ? 2 : 1,
  }));

const request = (
  context: ContextKey,
  code: string,
  description: string,
  why: string,
  requestedBy: string,
  daysAgo: number,
  decision?: { status: 'added' | 'declined'; by: string; note: string; daysAgo: number },
): ReasonRequestRow => ({
  id: idFor('reason-code-request', `${context}:${code}`),
  context,
  contextLabel: findContext(context)?.label ?? context,
  code,
  description,
  why,
  status: decision?.status ?? 'open',
  requestedBy,
  requestedAt: gstAt(-daysAgo, '09:20'),
  decidedBy: decision?.by ?? null,
  decidedAt: decision ? gstAt(-decision.daysAgo, '13:45') : null,
  decisionNote: decision?.note ?? null,
  version: decision ? 2 : 1,
});

export const reasonRequestSeeds = (): ReasonRequestRow[] => [
  request(
    'journey-delay',
    'DLY-BIRD',
    'Bird strike inspection',
    'Two bird-strike inspections at Das Island this month were logged as "Other" because no code fits.',
    'Dispatch Power User',
    1,
  ),
  request(
    'offload',
    'OFF-BAGGAGE',
    'Excess baggage not cleared',
    'Passengers offloaded at AUH for undeclared excess baggage have no matching code; we use OFF-WEIGHT today.',
    'Check-in Desk 1',
    2,
  ),
  request(
    'muster-unavailability',
    'MUS-WEATHER',
    'Shelter in place: weather',
    'During the shamal last week the Upper Zakum open-deck muster point was closed for high winds.',
    'Faisal Al Nuaimi',
    4,
  ),
  request(
    'no-show',
    'NOS-TRANSPORT',
    'Ground transport delay to the heliport',
    'Contractor buses from Mussafah arrived after check-in closed twice this rotation.',
    'Rashed Al Marri',
    12,
    { status: 'added', by: 'Reem Al Kindi', note: 'Added as NOS-TRANSPORT.', daysAgo: 11 },
  ),
  request(
    'travel',
    'TRV-TRAINING',
    'Onshore training course',
    'Staff travelling to the Ruwais training centre need a distinct reason for reporting.',
    'Saeed Al Kaabi',
    20,
    {
      status: 'declined',
      by: 'Reem Al Kindi',
      note: 'Training is duty travel: use TRV-DUTY and name the course in the comment.',
      daysAgo: 18,
    },
  ),
];

// ── Approval Engine ─────────────────────────────────────────────────────────

export type WorkflowRow = S['ApprovalWorkflowDetail'];
type StageInput = S['ApprovalWorkflowVersionInput']['stages'][number];
type StageView = WorkflowRow['versions'][number]['stages'][number];
export type ApproverRuleKey = S['ApprovalProcesses']['rules'][number]['key'];
export type ConditionField = S['ApprovalProcesses']['processes'][number]['conditionFields'][number];

export const APPROVER_RULES: readonly { key: ApproverRuleKey; label: string }[] = [
  { key: 'line-manager-of-passenger', label: 'Line Manager of passenger' },
  { key: 'line-manager-of-requester', label: 'Line Manager of requester' },
  { key: 'site-in-charge-of-destination', label: 'Site In-charge of destination' },
  { key: 'focal-point-of-origin', label: 'Focal Point of origin' },
  { key: 'focal-point-of-destination', label: 'Focal Point of destination' },
  { key: 'poc-of-installation-zone', label: 'POC of installation’s zone' },
  { key: 'department-focal-point', label: 'Department Focal Point' },
];

/** Which condition fields a process offers. */
export type ProcessFields = 'booking' | 'freight' | 'helideck' | 'none';

export const APPROVAL_PROCESSES: readonly {
  key: string;
  label: string;
  module: ModuleKey;
  fields: ProcessFields;
}[] = [
  {
    key: 'general-passenger-booking',
    label: 'General Passenger Booking',
    module: 'people-logistics',
    fields: 'booking',
  },
  { key: 'bulk-booking', label: 'Bulk Booking', module: 'people-logistics', fields: 'booking' },
  {
    key: 'unscheduled-route-request',
    label: 'Unscheduled Route Request',
    module: 'people-logistics',
    fields: 'booking',
  },
  { key: 'quota-override', label: 'Quota Override', module: 'people-logistics', fields: 'booking' },
  { key: 'freight-auh', label: 'Freight — AUH', module: 'people-logistics', fields: 'freight' },
  {
    key: 'freight-inter-field',
    label: 'Freight — Inter-field',
    module: 'people-logistics',
    fields: 'freight',
  },
  {
    key: 'freight-intra-field',
    label: 'Freight — Intra-field',
    module: 'people-logistics',
    fields: 'freight',
  },
  {
    key: 'helideck-request',
    label: 'Helideck Request (inspection / test / crew assessment)',
    module: 'helideck',
    fields: 'helideck',
  },
  {
    key: 'dispensation',
    label: 'Dispensation / Partial Acceptance',
    module: 'helideck',
    fields: 'none',
  },
  {
    key: 'asp-audit-review',
    label: 'ASP Audit Review',
    module: 'aviation-compliance',
    fields: 'none',
  },
  {
    key: 'asp-cap',
    label: 'Corrective Action Plan (ASP)',
    module: 'aviation-compliance',
    fields: 'none',
  },
  {
    key: 'gcaa-internal-audit-review',
    label: 'GCAA Internal Audit Review',
    module: 'aviation-compliance',
    fields: 'none',
  },
  {
    key: 'extension-request',
    label: 'Extension Request',
    module: 'aviation-compliance',
    fields: 'none',
  },
  { key: 'pob-master-change', label: 'POB Master Change', module: 'pob', fields: 'none' },
  { key: 'hll-publication', label: 'HLL Publication', module: 'helideck', fields: 'none' },
  {
    key: 'business-rule',
    label: 'Business Rule (high impact)',
    module: 'administration',
    fields: 'none',
  },
];
export const findProcess = (key: string) => APPROVAL_PROCESSES.find((p) => p.key === key);

const cf = (
  key: string,
  label: string,
  type: ConditionField['type'],
  options: readonly Option[] | null = null,
  unit: string | null = null,
): ConditionField => ({ key, label, type, options: options ? [...options] : null, unit });

/** A process's condition fields; Reason for Travel lists the live travel codes. */
export function processFields(
  fields: ProcessFields,
  travelReasons: readonly Option[],
): ConditionField[] {
  switch (fields) {
    case 'booking':
      return [
        cf('reasonForTravel', 'Reason for Travel', 'choice', travelReasons),
        cf('passengerCategory', 'Passenger Category', 'choice', PASSENGER_CATEGORIES),
        cf('destinationLocationId', 'Destination', 'choice', LOCATION_OPTIONS),
      ];
    case 'freight':
      return [
        cf('destinationLocationId', 'Destination', 'choice', LOCATION_OPTIONS),
        cf('weightKg', 'Gross weight', 'amount', null, 'kg'),
        cf('dangerousGoods', 'Dangerous goods', 'flag'),
      ];
    case 'helideck':
      return [
        cf('requestType', 'Request type', 'choice', [
          { value: 'inspection', label: 'Inspection' },
          { value: 'test', label: 'Test' },
          { value: 'crew-assessment', label: 'Crew assessment' },
        ]),
        cf('destinationLocationId', 'Installation location', 'choice', LOCATION_OPTIONS),
      ];
    default:
      return [];
  }
}

/** The stage as the API shows it, from what a form sends. */
export function stageView(
  input: StageInput,
  position: number,
  userName: (id: string) => string,
): StageView {
  const a = input.approver;
  const approver: StageView['approver'] =
    a.kind === 'role'
      ? {
          kind: 'role',
          roleCode: a.roleCode,
          userId: null,
          rule: null,
          label: roleName(a.roleCode),
        }
      : a.kind === 'user'
        ? { kind: 'user', roleCode: null, userId: a.userId, rule: null, label: userName(a.userId) }
        : {
            kind: 'rule',
            roleCode: null,
            userId: null,
            rule: a.rule,
            label: APPROVER_RULES.find((r) => r.key === a.rule)?.label ?? a.rule,
          };
  const e = input.escalation;
  return {
    position,
    name: input.name,
    approver,
    mode: input.mode,
    slaHours: input.slaHours,
    reminderHours: input.reminderHours,
    escalation:
      e === null
        ? null
        : e.kind === 'line_manager'
          ? { kind: 'line_manager', roleCode: null, label: 'Line Manager' }
          : { kind: 'role', roleCode: e.roleCode, label: roleName(e.roleCode) },
    skipCondition: input.skipCondition,
  };
}

export const personName = (id: string): string =>
  PEOPLE.find((p) => p.userId === id)?.name ?? 'Named approver';

type SeedStage = Pick<StageInput, 'name' | 'approver'> &
  Partial<Omit<StageInput, 'name' | 'approver'>>;
const st = (stage: SeedStage): StageInput => ({
  mode: 'any',
  slaHours: 24,
  reminderHours: null,
  escalation: null,
  skipCondition: null,
  ...stage,
});
const byRule = (name: string, rule: ApproverRuleKey, extra: Partial<StageInput> = {}) =>
  st({ name, approver: { kind: 'rule', rule }, ...extra });
const byRole = (name: string, roleCode: string, extra: Partial<StageInput> = {}) =>
  st({ name, approver: { kind: 'role', roleCode }, ...extra });

const LM = byRule('Line Manager', 'line-manager-of-passenger', {
  reminderHours: 12,
  escalation: { kind: 'line_manager' },
});
const RLM = byRule('Requester’s Line Manager', 'line-manager-of-requester');
const SIC = byRule('Site In-charge', 'site-in-charge-of-destination', { reminderHours: 12 });
const AVT = byRole('Aviation Team', 'aviation-team', { slaHours: 12 });
const FPO = byRule('Focal Point (origin)', 'focal-point-of-origin');
const ZPOC = byRule('Zone POC', 'poc-of-installation-zone', { slaHours: 48 });
const DFP = byRule('Department Focal Point', 'department-focal-point', { slaHours: 72 });

interface SeedVersion {
  readonly conditions?: Conditions;
  readonly stages: readonly StageInput[];
  readonly daysAgo: number;
  readonly by?: string;
}

function workflow(
  code: string,
  name: string,
  processKey: string,
  versions: readonly SeedVersion[],
  extra: { requests: number; deactivatedReason?: string },
): WorkflowRow {
  const process = findProcess(processKey);
  const shown = versions.map((v, i): WorkflowRow['versions'][number] => ({
    versionNo: i + 1,
    status: i === versions.length - 1 ? 'active' : 'retired',
    conditions: v.conditions ?? {},
    createdAt: gstAt(-v.daysAgo, '10:30'),
    createdBy: v.by ?? null,
    stages: v.stages.map((s, n) => stageView(s, n + 1, personName)),
  }));
  const active = shown[shown.length - 1];
  const deactivated = extra.deactivatedReason !== undefined;
  return {
    id: idFor('approval-workflow', code),
    code,
    name,
    module: process?.module ?? 'administration',
    process: processKey,
    processLabel: process?.label ?? processKey,
    conditions: active?.conditions ?? {},
    stages: active?.stages.length ?? 0,
    activeVersionNo: active?.versionNo ?? null,
    isActive: !deactivated,
    deactivatedReason: extra.deactivatedReason ?? null,
    version: versions.length + (deactivated ? 1 : 0),
    updatedAt: active?.createdAt ?? SEEDED_AT,
    requests: extra.requests,
    versions: [...shown].reverse(),
  };
}

const REF = 90; // the reference chains were seeded 90 days ago

export const workflowSeeds = (): WorkflowRow[] => [
  workflow(
    'general-passenger-booking',
    'General Passenger Booking',
    'general-passenger-booking',
    [
      { stages: [LM], daysAgo: REF },
      { stages: [LM, SIC], daysAgo: 41, by: 'Mariam Al Hammadi' },
    ],
    { requests: 1248 },
  ),
  workflow(
    'gpb-vip-travel',
    'General Passenger Booking — VIP travel',
    'general-passenger-booking',
    [
      {
        conditions: { passengerCategory: ['VIP'] },
        stages: [LM, SIC],
        daysAgo: 60,
        by: 'Mariam Al Hammadi',
      },
      {
        conditions: { passengerCategory: ['VIP', 'EP'] },
        stages: [
          LM,
          SIC,
          byRole('Aviation Team', 'aviation-team', {
            slaHours: 8,
            reminderHours: 4,
            escalation: { kind: 'role', roleCode: 'logistics-vp' },
          }),
        ],
        daysAgo: 9,
        by: 'Mariam Al Hammadi',
      },
    ],
    { requests: 86 },
  ),
  workflow(
    'gpb-emergency-medical',
    'Emergency & medical travel',
    'general-passenger-booking',
    [
      {
        conditions: { reasonForTravel: ['TRV-EMERGENCY', 'TRV-MEDICAL', 'TRV-EVACUATION'] },
        stages: [
          byRule('Site In-charge', 'site-in-charge-of-destination', {
            slaHours: 2,
            reminderHours: 1,
            escalation: { kind: 'role', roleCode: 'aviation-team' },
          }),
        ],
        daysAgo: 52,
        by: 'Khalid Al Mazrouei',
      },
    ],
    { requests: 37 },
  ),
  workflow(
    'gpb-zirku',
    'General Passenger Booking — Zirku Island',
    'general-passenger-booking',
    [
      {
        conditions: { destinationLocationId: [idFor('location', 'ZRK')] },
        stages: [LM, SIC, AVT],
        daysAgo: 75,
        by: 'Khalid Al Mazrouei',
      },
    ],
    {
      requests: 214,
      deactivatedReason: 'Zirku travel follows the general chain since the 2026 rotation review.',
    },
  ),
  workflow('bulk-booking', 'Bulk Booking', 'bulk-booking', [{ stages: [LM], daysAgo: REF }], {
    requests: 162,
  }),
  workflow(
    'unscheduled-route-request',
    'Unscheduled Route Request',
    'unscheduled-route-request',
    [{ stages: [LM, SIC, AVT], daysAgo: REF }],
    { requests: 58 },
  ),
  workflow(
    'quota-override',
    'Quota Override',
    'quota-override',
    [{ stages: [AVT], daysAgo: REF }],
    { requests: 23 },
  ),
  workflow('freight-auh', 'Freight — AUH', 'freight-auh', [{ stages: [RLM, FPO], daysAgo: REF }], {
    requests: 311,
  }),
  workflow(
    'freight-auh-dangerous-goods',
    'Freight — AUH, dangerous goods',
    'freight-auh',
    [
      {
        conditions: { dangerousGoods: true },
        stages: [
          RLM,
          FPO,
          byRole('HSE review', 'department-focal-point', { slaHours: 12, mode: 'all' }),
        ],
        daysAgo: 33,
        by: 'Mariam Al Hammadi',
      },
    ],
    { requests: 12 },
  ),
  workflow(
    'freight-inter-field',
    'Freight — Inter-field',
    'freight-inter-field',
    [
      {
        stages: [RLM, FPO, byRule('Focal Point (destination)', 'focal-point-of-destination')],
        daysAgo: REF,
      },
    ],
    { requests: 147 },
  ),
  workflow(
    'freight-intra-field',
    'Freight — Intra-field',
    'freight-intra-field',
    [{ stages: [FPO], daysAgo: REF }],
    {
      requests: 96,
    },
  ),
  workflow(
    'helideck-request',
    'Helideck Request',
    'helideck-request',
    [
      {
        stages: [
          byRole('Site Focal Point (Helideck)', 'site-focal-point-helideck', { slaHours: 48 }),
          ZPOC,
          byRole('TL ATS', 'tl-ats', { slaHours: 48 }),
          byRole('MOSA', 'mosa', { slaHours: 72 }),
        ],
        daysAgo: REF,
      },
    ],
    { requests: 44 },
  ),
  workflow(
    'dispensation',
    'Dispensation / Partial Acceptance',
    'dispensation',
    [{ stages: [ZPOC], daysAgo: REF }],
    {
      requests: 9,
    },
  ),
  workflow(
    'asp-audit-review',
    'ASP Audit Review',
    'asp-audit-review',
    [{ stages: [DFP, byRole('Logistics VP', 'logistics-vp', { slaHours: 72 })], daysAgo: REF }],
    { requests: 6 },
  ),
  workflow(
    'asp-cap',
    'Corrective Action Plan (ASP)',
    'asp-cap',
    [{ stages: [DFP], daysAgo: REF }],
    { requests: 14 },
  ),
  workflow(
    'gcaa-internal-audit-review',
    'GCAA Internal Audit Review',
    'gcaa-internal-audit-review',
    [{ stages: [RLM], daysAgo: REF }],
    { requests: 4 },
  ),
  workflow(
    'extension-request',
    'Extension Request',
    'extension-request',
    [{ stages: [RLM], daysAgo: REF }],
    {
      requests: 11,
    },
  ),
  workflow(
    'pob-master-change',
    'POB Master Change',
    'pob-master-change',
    [
      {
        stages: [byRole('POB Master Data Power User', 'pob-master-data-power-user')],
        daysAgo: REF,
      },
    ],
    { requests: 27 },
  ),
  workflow(
    'hll-publication',
    'HLL Publication',
    'hll-publication',
    [
      {
        stages: [byRole('Aviation Technical Team', 'aviation-technical-team', { slaHours: 48 })],
        daysAgo: REF,
      },
    ],
    { requests: 18 },
  ),
  workflow(
    'business-rule-high-impact',
    'Business Rule (high impact)',
    'business-rule',
    [{ stages: [byRole('Super Admin', 'super-admin')], daysAgo: REF }],
    { requests: 7 },
  ),
];

/** An approval task the demo's engine holds (business-rule versions awaiting approval). */
export interface ApprovalTaskRow {
  id: string;
  version: number;
  instanceId: string;
  status: S['ApprovalTask']['status'];
  subject: { kind: 'business-rule'; id: string; versionNo: number };
}

// ── Business Rules ──────────────────────────────────────────────────────────

type TypeView = S['BusinessRuleTypes']['types'][number];
export type RuleTypeKey = TypeView['key'];
export type ParamField = S['RuleParameterField'];
type Params = Record<string, unknown>;

export type RuleTypeDef = Omit<TypeView, 'live'> & {
  /** The value in words, for the list. */
  readonly summary: (p: Params) => string;
  /** Problems no single field shows. */
  readonly check?: (p: Params) => string[];
};

const pf = (
  kind: ParamField['kind'],
  key: string,
  label: string,
  extra: Partial<ParamField> = {},
): ParamField => ({
  kind,
  key,
  label,
  min: null,
  max: null,
  step: null,
  unit: null,
  nullable: false,
  options: null,
  columns: null,
  minRows: null,
  maxRows: null,
  ...extra,
});
const int = (
  key: string,
  label: string,
  min: number,
  max: number,
  unit: string | null,
  nullable = false,
) => pf('integer', key, label, { min, max, unit, nullable });

const CATEGORIES: readonly Option[] = [
  { value: 'FIXED-WING', label: 'Fixed-wing' },
  { value: 'ROTARY-WING', label: 'Rotary-wing' },
  { value: 'MARINE', label: 'Marine' },
];
const CATEGORY = cf('category', 'Resource category', 'choice', CATEGORIES);
const RESOURCE_TYPE = cf('resourceType', 'Resource type', 'values');
const CRITICALITY = cf('criticality', 'Criticality', 'choice', [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]);
const ROUTE_TYPE = cf('routeType', 'Route type', 'choice', [
  { value: 'auh', label: 'AUH (onshore) dispatch' },
  { value: 'inter-field', label: 'Inter-field' },
  { value: 'intra-field', label: 'Intra-field' },
]);

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v));
const plural = (count: unknown, unit: string) => `${n(count)} ${unit}${n(count) === 1 ? '' : 's'}`;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const cutoff = (p: Params) =>
  `${n(p.daysBefore) === 0 ? 'Same day' : `D-${n(p.daysBefore)}`} at ${String(p.time)} GST`;
const cutoffFields = [
  int('daysBefore', 'Days before departure (D-n)', 0, 30, 'days'),
  pf('time', 'time', 'Time (GST)'),
];

const type = (
  key: RuleTypeKey,
  module: ModuleKey,
  label: string,
  description: string,
  highImpact: boolean,
  conditionFields: ConditionField[],
  parameterFields: ParamField[],
  summary: RuleTypeDef['summary'],
  check?: RuleTypeDef['check'],
): RuleTypeDef => ({
  key,
  module,
  label,
  description,
  highImpact,
  ready: true,
  conditionFields,
  parameterFields,
  summary,
  ...(check ? { check } : {}),
});

const PRIORITY_ORDER: readonly Option[] = [
  { value: 'crew-change', label: 'Crew change' },
  { value: 'vip', label: 'VIP' },
  { value: 'category-priority', label: 'Other categories, by their priority' },
];

export const RULE_TYPES: readonly RuleTypeDef[] = [
  type(
    'HSE_MIN_VALIDITY_DAYS',
    'people-logistics',
    'HSE passport validity beyond travel',
    'How long an HSE passport must stay valid after the travel date, per leg.',
    true,
    [CATEGORY],
    [int('days', 'Valid for at least (days after the travel date)', 0, 365, 'days')],
    (p) => `${plural(p.days, 'day')} beyond the travel date`,
  ),
  type(
    'MODE_CERTS',
    'people-logistics',
    'Certificates per mode of travel',
    'Certificates a passenger needs for the mode, valid on the travel date; any one of them will do.',
    true,
    [CATEGORY, RESOURCE_TYPE],
    [pf('codes', 'anyOf', 'Certificate types (any one of)')],
    (p) => `Any of ${list(p.anyOf).join(', ')}`,
  ),
  type(
    'ADVANCE_NOTICE',
    'people-logistics',
    'Advance notice',
    'How many days ahead a booking must be made.',
    true,
    [CRITICALITY, CATEGORY],
    [int('days', 'Book at least (days ahead)', 0, 365, 'days')],
    (p) => `${plural(p.days, 'day')} ahead`,
  ),
  type(
    'CRITICAL_CUTOFF',
    'people-logistics',
    'Critical cut-off',
    'When a booking must be approved by, before departure.',
    true,
    [ROUTE_TYPE],
    cutoffFields,
    (p) => `Approved by ${cutoff(p)}`,
  ),
  type(
    'PAX_CANCELLATION_CUTOFF',
    'people-logistics',
    'Passenger cancellation cut-off',
    'After it, a no-show is recorded and only an authorised cancellation is possible.',
    true,
    [ROUTE_TYPE],
    cutoffFields,
    cutoff,
  ),
  type(
    'WAITLIST_CAP_PCT',
    'people-logistics',
    'Waitlist cap',
    'The most a waitlist may hold, as a share of seating capacity.',
    true,
    [CATEGORY],
    [int('percent', 'Share of seats', 0, 100, '%')],
    (p) => `${n(p.percent)} % of seating capacity`,
  ),
  type(
    'MANIFEST_PRIORITY',
    'people-logistics',
    'Manifest priority',
    'Who is manifested first when seats are short; first come, first served breaks ties.',
    true,
    [CATEGORY],
    [pf('order', 'order', 'Order', { options: [...PRIORITY_ORDER] })],
    (p) =>
      `${list(p.order)
        .map((o) => PRIORITY_ORDER.find((x) => x.value === o)?.label ?? String(o))
        .join(' → ')}; first come, first served`,
  ),
  type(
    'PREMANIFEST_LEAD_HOURS',
    'people-logistics',
    'Pre-manifest lead time',
    'How long before departure the pre-manifest is suggested; it can be refreshed until published.',
    false,
    [],
    [int('hours', 'Hours before departure', 1, 240, 'hours')],
    (p) => `${plural(p.hours, 'hour')} before departure`,
  ),
  type(
    'ON_TIME_TOLERANCE_MIN',
    'people-logistics',
    'On-time tolerance',
    'A departure or arrival this late still counts as on time.',
    false,
    [],
    [int('minutes', 'Minutes', 0, 240, 'minutes')],
    (p) => plural(p.minutes, 'minute'),
  ),
  type(
    'CHECKIN_REMINDER_HOURS',
    'people-logistics',
    'Check-in reminder',
    'How long before departure passengers are reminded to check in.',
    false,
    [],
    [int('hours', 'Hours before departure', 1, 72, 'hours')],
    (p) => `${plural(p.hours, 'hour')} before departure`,
  ),
  type(
    'STAY_MIN_HOURS',
    'pob',
    'Minimum stay',
    'Shorter visits are re-attributed rather than counted as stays.',
    false,
    [],
    [int('hours', 'Hours', 1, 168, 'hours')],
    (p) => plural(p.hours, 'hour'),
  ),
  type(
    'RESIDENCY_COOLDOWN_DAYS',
    'pob',
    'Residency cool-down',
    'Days off site before a new residency period starts.',
    false,
    [],
    [int('days', 'Days', 0, 365, 'days')],
    (p) => (n(p.days) === 0 ? 'None' : plural(p.days, 'day')),
  ),
  type(
    'OVERSTAY_LIMIT',
    'pob',
    'Overstay limit',
    'The longest stay on site, and when it is flagged as approaching.',
    true,
    [],
    [
      int('limitDays', 'Limit', 1, 365, 'days'),
      int('warnAtDays', 'Approaching from', 1, 365, 'days'),
    ],
    (p) => `${plural(p.limitDays, 'day')} (approaching at ${n(p.warnAtDays)})`,
    (p) => (n(p.warnAtDays) < n(p.limitDays) ? [] : ['The warning must come before the limit.']),
  ),
  type(
    'UTILISATION_BANDS',
    'reporting',
    'Utilisation bands',
    'Green below amber; amber up to red; red above.',
    false,
    [],
    [int('amberFromPct', 'Amber from', 0, 100, '%'), int('redAbovePct', 'Red above', 0, 100, '%')],
    (p) =>
      `< ${n(p.amberFromPct)} % green, ${n(p.amberFromPct)}–${n(p.redAbovePct)} % amber, > ${n(p.redAbovePct)} % red`,
    (p) => (n(p.amberFromPct) < n(p.redAbovePct) ? [] : ['Amber must start below red.']),
  ),
  type(
    'FINDING_TARGET_DAYS',
    'helideck',
    'Finding target dates',
    'Days to close a finding, by severity.',
    true,
    [],
    [
      int('critical', 'Critical', 1, 365, 'days'),
      int('high', 'High', 1, 365, 'days'),
      int('medium', 'Medium', 1, 365, 'days'),
      int('ofi', 'OFI (empty: no target)', 1, 365, 'days', true),
    ],
    (p) =>
      `Critical ${n(p.critical)} · High ${n(p.high)} · Medium ${n(p.medium)} · OFI ${p.ofi === null ? 'none' : n(p.ofi)}`,
    (p) =>
      n(p.critical) <= n(p.high) && n(p.high) <= n(p.medium)
        ? []
        : ['A more severe finding can’t have a later target.'],
  ),
  type(
    'HELIDECK_LEAD_TIME_DAYS',
    'helideck',
    'Helideck request lead time',
    'The minimum lead time for an ad hoc helideck request.',
    false,
    [],
    [int('days', 'Days', 0, 180, 'days')],
    (p) => plural(p.days, 'day'),
  ),
  type(
    'EXPIRY_REMINDER_DAYS',
    'helideck',
    'Expiry reminders',
    'When reminders go out before something expires.',
    false,
    [],
    [
      pf('integers', 'daysBefore', 'Days before expiry', { min: 1, max: 365, unit: 'days' }),
      int('dailyFinalDays', 'Then daily for the last', 0, 60, 'days'),
    ],
    (p) =>
      `${list(p.daysBefore)
        .map(n)
        .sort((a, b) => b - a)
        .join(
          ', ',
        )} days${n(p.dailyFinalDays) > 0 ? `, then daily for the last ${n(p.dailyFinalDays)}` : ''}`,
  ),
];
export const findRuleType = (key: string) => RULE_TYPES.find((t) => t.key === key);

export type RuleRow = Omit<S['BusinessRuleDetail'], 'myTask'>;
type RuleVersion = RuleRow['versions'][number];

interface SeedRuleVersion {
  readonly parameters: Params;
  readonly condition?: Conditions;
  readonly fromDays: number;
  readonly status?: RuleVersion['status'];
  readonly note?: string;
  readonly by?: string;
  readonly priority?: number;
}

/** Fills a rule's list fields from its versions: the one in effect, and any awaiting approval. */
export function deriveRule(row: RuleRow, at = Date.now()): RuleRow {
  const def = findRuleType(row.type);
  // Newest first: the version in force is the newest approved one that has started.
  const approved = row.versions
    .filter((v) => v.status === 'approved')
    .sort((a, b) => b.versionNo - a.versionNo);
  const inForce = approved.find((v) => Date.parse(v.startsAt) <= at);
  const upcoming = approved.find((v) => Date.parse(v.startsAt) > at);
  const versions = row.versions.map((v) => ({ ...v, inEffect: v === inForce && row.isActive }));
  const pending = row.versions.find((v) => v.status === 'pending');
  const shown = inForce ?? upcoming ?? pending ?? row.versions[0];
  const state: RuleRow['state'] = !row.isActive
    ? 'ended'
    : inForce
      ? 'active'
      : upcoming
        ? 'scheduled'
        : pending
          ? 'pending'
          : 'draft';
  return {
    ...row,
    typeLabel: def?.label ?? row.type,
    highImpact: def?.highImpact ?? false,
    module: def?.module ?? row.module,
    state,
    versionNo: shown?.versionNo ?? 1,
    condition: shown?.condition ?? {},
    parameters: shown?.parameters ?? {},
    summary: shown?.summary ?? '',
    priority: shown?.priority ?? 100,
    startsAt: shown?.startsAt ?? row.startsAt,
    effectiveTo: shown?.effectiveTo ?? null,
    pendingVersionNo: pending?.versionNo ?? null,
    versions,
  };
}

function rule(
  code: string,
  name: string,
  key: RuleTypeKey,
  history: readonly SeedRuleVersion[],
  ended?: string,
): RuleRow {
  const def = findRuleType(key);
  const versions: RuleVersion[] = history.map((h, i) => {
    const from = gstAt(-h.fromDays, '00:00');
    const status = h.status ?? 'approved';
    return {
      versionNo: i + 1,
      status,
      inEffect: false,
      condition: h.condition ?? {},
      parameters: h.parameters,
      summary: def?.summary(h.parameters) ?? '',
      priority: h.priority ?? 100,
      effectiveFrom: from,
      effectiveTo: null,
      startsAt: from,
      note: h.note ?? null,
      createdBy: h.by ?? null,
      createdAt: gstAt(-Math.max(h.fromDays, 0) - 2, '11:00'),
      decidedAt: status === 'pending' ? null : gstAt(-Math.max(h.fromDays, 0) - 1, '09:00'),
      decidedReason: null,
      approvalId:
        def?.highImpact && status !== 'pending'
          ? idFor('approval-instance', `${code}:${i + 1}`)
          : null,
    };
  });
  // An earlier approved version ends where the next one starts.
  for (let i = 0; i < versions.length; i += 1) {
    const v = versions[i];
    const next = versions.slice(i + 1).find((x) => x.status === 'approved');
    if (v && v.status === 'approved' && next)
      versions[i] = { ...v, effectiveTo: next.effectiveFrom };
  }
  if (ended) {
    const last = versions.findLast((v) => v.status === 'approved');
    if (last) versions[versions.indexOf(last)] = { ...last, effectiveTo: gstAt(-3, '00:00') };
  }
  const first = versions[0];
  return deriveRule({
    id: idFor('business-rule', code),
    code,
    name,
    module: def?.module ?? 'administration',
    type: key,
    typeLabel: '',
    highImpact: false,
    state: 'active',
    isActive: ended === undefined,
    deactivatedReason: ended ?? null,
    versionNo: 1,
    condition: {},
    parameters: {},
    summary: '',
    priority: 100,
    startsAt: first?.startsAt ?? SEEDED_AT,
    effectiveTo: null,
    pendingVersionNo: null,
    version: history.length + (ended ? 1 : 0),
    updatedAt: versions[versions.length - 1]?.createdAt ?? SEEDED_AT,
    versions: versions.reverse(),
  });
}

const PLACEHOLDER = 'Placeholder values, pending Aviation Technical confirmation.';

export const ruleSeeds = (): RuleRow[] => [
  rule('hse-min-validity', 'HSE passport valid beyond travel', 'HSE_MIN_VALIDITY_DAYS', [
    { parameters: { days: 15 }, fromDays: 120 },
  ]),
  rule('mode-certs-rotary-wing', 'Rotary-wing certificates', 'MODE_CERTS', [
    {
      parameters: { anyOf: ['T-BOSIT', 'T-HUET'] },
      condition: { category: ['ROTARY-WING'] },
      fromDays: 120,
    },
  ]),
  rule('mode-certs-crew-boat', 'Crew boat certificates', 'MODE_CERTS', [
    { parameters: { anyOf: ['OPITO'] }, condition: { resourceType: ['CREW-BOAT'] }, fromDays: 120 },
  ]),
  rule('advance-notice-normal', 'Advance notice (normal)', 'ADVANCE_NOTICE', [
    { parameters: { days: 14 }, condition: { criticality: ['normal'] }, fromDays: 120 },
    {
      parameters: { days: 10 },
      condition: { criticality: ['normal'] },
      fromDays: -7,
      status: 'pending',
      note: 'Shorter notice for the Das Island crew-change trial agreed at the October logistics review.',
      by: 'Khalid Al Mazrouei',
    },
  ]),
  rule('critical-cutoff-auh', 'Critical cut-off (AUH dispatch)', 'CRITICAL_CUTOFF', [
    {
      parameters: { daysBefore: 1, time: '10:00' },
      condition: { routeType: ['auh'] },
      fromDays: 120,
    },
  ]),
  rule('critical-cutoff-inter-field', 'Critical cut-off (inter-field)', 'CRITICAL_CUTOFF', [
    {
      parameters: { daysBefore: 1, time: '12:00' },
      condition: { routeType: ['inter-field'] },
      fromDays: 120,
    },
    {
      parameters: { daysBefore: 1, time: '14:00' },
      condition: { routeType: ['inter-field'] },
      fromDays: 30,
      note: 'Field requests come in after the morning planning call.',
      by: 'Mariam Al Hammadi',
    },
  ]),
  rule('pax-cancellation-cutoff', 'Passenger cancellation cut-off', 'PAX_CANCELLATION_CUTOFF', [
    { parameters: { daysBefore: 1, time: '10:00' }, fromDays: 120 },
  ]),
  rule('waitlist-cap', 'Waitlist cap', 'WAITLIST_CAP_PCT', [
    { parameters: { percent: 10 }, fromDays: 120 },
  ]),
  rule('waitlist-cap-rotary-wing', 'Waitlist cap (helicopters)', 'WAITLIST_CAP_PCT', [
    {
      parameters: { percent: 5 },
      condition: { category: ['ROTARY-WING'] },
      fromDays: -10,
      note: 'Smaller waitlists on AW139 shuttles from the winter schedule.',
      by: 'Khalid Al Mazrouei',
    },
  ]),
  rule('manifest-priority', 'Manifest priority', 'MANIFEST_PRIORITY', [
    { parameters: { order: ['crew-change', 'vip', 'category-priority'] }, fromDays: 120 },
  ]),
  rule('premanifest-lead-hours', 'Pre-manifest lead time', 'PREMANIFEST_LEAD_HOURS', [
    { parameters: { hours: 48 }, fromDays: 120 },
  ]),
  rule('on-time-tolerance', 'On-time tolerance', 'ON_TIME_TOLERANCE_MIN', [
    { parameters: { minutes: 15 }, fromDays: 120 },
    {
      parameters: { minutes: 10 },
      fromDays: -5,
      note: 'Aligns with the 2027 ASP contract KPI.',
      by: 'Mariam Al Hammadi',
    },
  ]),
  rule('checkin-reminder', 'Check-in reminder', 'CHECKIN_REMINDER_HOURS', [
    { parameters: { hours: 3 }, fromDays: 120 },
  ]),
  rule('stay-min-hours', 'Minimum stay', 'STAY_MIN_HOURS', [
    { parameters: { hours: 24 }, fromDays: 120 },
  ]),
  rule(
    'residency-cooldown',
    'Residency cool-down',
    'RESIDENCY_COOLDOWN_DAYS',
    [{ parameters: { days: 0 }, fromDays: 120 }],
    'Residency now resets on every return to Abu Dhabi.',
  ),
  rule('overstay-limit', 'Overstay limit', 'OVERSTAY_LIMIT', [
    { parameters: { limitDays: 90, warnAtDays: 75 }, fromDays: 120 },
  ]),
  rule('utilisation-bands', 'Utilisation bands', 'UTILISATION_BANDS', [
    { parameters: { amberFromPct: 70, redAbovePct: 90 }, fromDays: 120 },
  ]),
  rule('finding-target-days', 'Finding target dates', 'FINDING_TARGET_DAYS', [
    { parameters: { critical: 7, high: 30, medium: 60, ofi: null }, fromDays: 120 },
  ]),
  rule('helideck-lead-time', 'Helideck request lead time', 'HELIDECK_LEAD_TIME_DAYS', [
    { parameters: { days: 14 }, fromDays: 120, note: PLACEHOLDER },
  ]),
  rule('expiry-reminders', 'Expiry reminders', 'EXPIRY_REMINDER_DAYS', [
    { parameters: { daysBefore: [60, 30, 14], dailyFinalDays: 14 }, fromDays: 120 },
  ]),
];

/** The open task for the seeded pending version (Advance notice v2), held by the Super Admin chain. */
export const approvalTaskSeeds = (): ApprovalTaskRow[] => [
  {
    id: idFor('approval-task', 'advance-notice-normal:2'),
    version: 1,
    instanceId: idFor('approval-instance', 'advance-notice-normal:2'),
    status: 'open',
    subject: {
      kind: 'business-rule',
      id: idFor('business-rule', 'advance-notice-normal'),
      versionNo: 2,
    },
  },
];

// ── Notification Engine ─────────────────────────────────────────────────────

type TriggerView = S['NotificationTriggers']['triggers'][number];
export type TriggerKey = TriggerView['key'];
export type Category = TriggerView['category'];
type TriggerField = TriggerView['fields'][number];

/** A payload field, and (for choices) the values a rule may filter on. */
export type TriggerDef = Omit<TriggerView, 'mandatory' | 'live' | 'fields' | 'filterFields'> & {
  readonly fields: readonly (TriggerField & { options?: readonly Option[]; unit?: string })[];
};

/** The phase being built: later triggers wait for their module. */
export const CURRENT_PHASE = 2;
export const MANDATORY_CATEGORIES: readonly Category[] = [
  'security',
  'access',
  'approvals',
  'booking',
  'travel',
  'muster',
];

const text = (key: string, label: string, sample: string) => ({
  key,
  label,
  type: 'text' as const,
  sample,
});
const at = (key: string, label: string, sample = '15 Oct 2026, 07:00 GST') => ({
  key,
  label,
  type: 'datetime' as const,
  sample,
});
const day = (key: string, label: string, sample = '15 Oct 2026') => ({
  key,
  label,
  type: 'date' as const,
  sample,
});
const link = (sample: string) => ({
  key: 'link',
  label: 'Link',
  type: 'link' as const,
  sample: `https://masar.adnoc.ae${sample}`,
});
const choice = (key: string, label: string, options: readonly Option[], sample: string) => ({
  key,
  label,
  type: 'choice' as const,
  options,
  sample,
});
const num = (key: string, label: string, sample: number, unit?: string) => ({
  key,
  label,
  type: 'number' as const,
  sample: String(sample),
  ...(unit ? { unit } : {}),
});

const PROCESS_FIELD = choice(
  'process',
  'Process',
  APPROVAL_PROCESSES.map((p) => ({ value: p.key, label: p.label })),
  'general-passenger-booking',
);
const APPROVAL_FIELDS = [
  PROCESS_FIELD,
  text('processLabel', 'Process name', 'General Passenger Booking'),
  text('recordRef', 'Reference', 'BK-2026-0142'),
  text('recordLabel', 'What it is', 'Das Island · 16 Oct 2026'),
  text('requesterName', 'Requester', 'Ahmed Al Mansoori'),
  link('/booking/BK-2026-0142'),
];
const BOOKING_FIELDS = [
  text('bookingRef', 'Booking reference', 'BK-2026-0142'),
  text('passengerName', 'Passenger', 'Ahmed Al Mansoori'),
  text('requesterName', 'Requester', 'Saeed Al Kaabi'),
  text('flightNo', 'Flight', 'FL-DAS-0715'),
  text('origin', 'From', 'Abu Dhabi (AUH)'),
  text('destination', 'To', 'Das Island'),
  at('departure', 'Departure'),
  day('travelDate', 'Travel date'),
  text('seat', 'Seat', '4C'),
  choice(
    'criticality',
    'Criticality',
    [
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ],
    'normal',
  ),
  text('reason', 'Reason', 'Weather below minima'),
  link('/booking/BK-2026-0142'),
];
const JOURNEY_FIELDS = [
  text('flightNo', 'Flight', 'FL-DAS-0715'),
  text('origin', 'From', 'Abu Dhabi (AUH)'),
  text('destination', 'To', 'Das Island'),
  at('departure', 'Departure'),
  at('newDeparture', 'New departure', '15 Oct 2026, 09:30 GST'),
  text('reason', 'Reason', 'Weather below minima'),
  link('/travel'),
];
const HELIDECK_FIELDS = [
  text('installation', 'Installation', 'Das Island Helideck 1'),
  text('location', 'Location', 'Das Island'),
  text('requestRef', 'Reference', 'HR-2026-0012'),
  link('/helideck/requests/HR-2026-0012'),
];
const MUSTER_FIELDS = [
  text('location', 'Location', 'Das Island'),
  text('musterRef', 'Muster reference', 'MU-2026-0004'),
  at('declaredAt', 'Declared at'),
  text('reason', 'Reason', 'Drill'),
  num('headcount', 'Headcount', 214),
  link('/pob/muster/MU-2026-0004'),
];

const passenger = { key: 'passenger', label: 'Passenger' };
const requester = { key: 'requester', label: 'Requester' };
const BOOKING_RECIPIENTS = [
  passenger,
  requester,
  { key: 'passenger-line-manager', label: 'Line manager of the passenger' },
];
const trig = (
  key: TriggerKey,
  module: ModuleKey,
  label: string,
  category: Category,
  phase: number,
  fields: TriggerDef['fields'],
  recipients: TriggerDef['recipients'],
): TriggerDef => ({ key, module, label, category, phase, fields, recipients });
const booking = (key: TriggerKey, label: string, phase = 3, category: Category = 'booking') =>
  trig(key, 'people-logistics', label, category, phase, BOOKING_FIELDS, BOOKING_RECIPIENTS);

export const TRIGGERS: readonly TriggerDef[] = [
  trig(
    'adm.approval.task-assigned',
    'administration',
    'Approval task assigned (new, reminder or escalated)',
    'approvals',
    1,
    [
      ...APPROVAL_FIELDS,
      choice(
        'kind',
        'Why',
        [
          { value: 'new', label: 'New task' },
          { value: 'reminder', label: 'Reminder' },
          { value: 'escalated', label: 'Escalated' },
        ],
        'new',
      ),
      text('stageName', 'Stage', 'Line Manager'),
      at('dueAt', 'Due'),
    ],
    [{ key: 'approvers', label: 'Approvers' }],
  ),
  trig(
    'adm.approval.approved',
    'administration',
    'Approval request approved',
    'approvals',
    1,
    APPROVAL_FIELDS,
    [requester, { key: 'raised-by', label: 'Who raised it' }],
  ),
  trig(
    'adm.approval.rejected',
    'administration',
    'Approval request returned for changes',
    'approvals',
    1,
    [
      ...APPROVAL_FIELDS,
      text('reasonCode', 'Reason code', 'REJ-NOJUST'),
      text('reasonDescription', 'Reason', 'Insufficient justification'),
      text('comment', 'Approver’s comment', 'Add the work order number.'),
    ],
    [requester, { key: 'raised-by', label: 'Who raised it' }],
  ),
  trig(
    'adm.access.expiring',
    'administration',
    'Access expiring',
    'access',
    1,
    [
      text('userName', 'User', 'Ahmed Al Mansoori'),
      text('role', 'Role', 'Site In-charge'),
      at('validTo', 'Ends'),
      num('daysLeft', 'Days left', 7, 'days'),
      link('/account'),
    ],
    [
      { key: 'user', label: 'The user' },
      { key: 'line-manager', label: 'Their line manager' },
    ],
  ),
  trig(
    'adm.access.expired',
    'administration',
    'Access ended',
    'access',
    1,
    [
      text('userName', 'User', 'Ahmed Al Mansoori'),
      text('role', 'Role', 'Site In-charge'),
      at('validTo', 'Ended'),
      link('/account'),
    ],
    [
      { key: 'user', label: 'The user' },
      { key: 'line-manager', label: 'Their line manager' },
    ],
  ),
  trig(
    'adm.reason-code.requested',
    'administration',
    'Reason code requested',
    'admin',
    1,
    [
      text('contextLabel', 'Context', 'Journey Delay'),
      text('code', 'Code', 'DLY-BIRD'),
      text('description', 'Description', 'Bird strike inspection'),
      text('why', 'Why it is needed', 'Two bird-strike inspections this month had no code.'),
      text('requesterName', 'Requested by', 'Dispatch Power User'),
      link('/admin/reason-codes'),
    ],
    [{ key: 'master-data-power-user', label: 'Master Data Power Users' }],
  ),
  trig(
    'adm.reason-code.request-decided',
    'administration',
    'Reason code request decided',
    'admin',
    1,
    [
      text('contextLabel', 'Context', 'Journey Delay'),
      text('code', 'Code', 'DLY-BIRD'),
      choice(
        'decision',
        'Decision',
        [
          { value: 'added', label: 'Added' },
          { value: 'declined', label: 'Declined' },
        ],
        'added',
      ),
      text('note', 'Note', 'Added as DLY-BIRD.'),
      link('/admin/reason-codes'),
    ],
    [requester],
  ),
  booking('pl.booking.submitted', 'Booking submitted'),
  booking('pl.booking.approved', 'Booking approved (awaiting manifest)'),
  booking('pl.booking.returned', 'Booking returned for changes'),
  booking('pl.booking.confirmed', 'Booking confirmed with itinerary', 4),
  booking('pl.booking.cancelled', 'Booking cancelled'),
  booking('pl.checkin.reminder', 'Check-in reminder', 4, 'travel'),
  trig(
    'pl.location.journeys-cancelled',
    'people-logistics',
    'Journeys cancelled: location out of service',
    'travel',
    2,
    [
      text('location', 'Location', 'Upper Zakum'),
      text('reason', 'Reason', 'Helideck under repair'),
      num('count', 'Journeys cancelled', 6),
      text('journeys', 'The journeys', 'ADA201 on 23 Oct, FAL203 on 24 Oct'),
      link('/'),
    ],
    [{ key: 'aviation-team', label: 'Aviation Team' }],
  ),
  trig('pl.journey.delayed', 'people-logistics', 'Journey delayed', 'travel', 4, JOURNEY_FIELDS, [
    { key: 'passengers', label: 'Passengers' },
  ]),
  trig(
    'pl.freight.dispatched',
    'people-logistics',
    'Freight dispatched',
    'freight',
    4,
    [
      text('freightRef', 'Freight reference', 'FR-2026-0031'),
      text('description', 'Contents', 'Spare pump seals (2 crates)'),
      text('origin', 'From', 'Abu Dhabi (AUH)'),
      text('destination', 'To', 'Das Island'),
      at('departure', 'Departure'),
      link('/freight/FR-2026-0031'),
    ],
    [
      { key: 'receiver', label: 'Receiver' },
      { key: 'sender', label: 'Sender' },
    ],
  ),
  trig('pob.muster.declared', 'pob', 'Muster declared', 'muster', 5, MUSTER_FIELDS, [
    { key: 'focal-point', label: 'Focal Points of the location' },
    { key: 'muster-coordinator', label: 'Muster Coordinators of the location' },
    { key: 'executive', label: 'Executives' },
  ]),
  trig(
    'hd.document.expiring',
    'helideck',
    'Certificate or acceptance expiring',
    'helideck',
    7,
    [
      ...HELIDECK_FIELDS,
      text('document', 'Document', 'Helideck acceptance letter'),
      day('expiresOn', 'Expires on'),
      num('daysLeft', 'Days left', 30, 'days'),
    ],
    [
      { key: 'site-focal-point-helideck', label: 'Site Focal Point (Helideck)' },
      { key: 'aviation-technical-team', label: 'Aviation Technical Team' },
    ],
  ),
  trig(
    'ac.gcaa.task-due',
    'aviation-compliance',
    'GCAA task due or overdue',
    'compliance',
    8,
    [
      text('taskRef', 'Task', 'F-01'),
      text('title', 'Title', 'Circulate the revised exposition'),
      day('dueDate', 'Due'),
      { key: 'overdue', label: 'Overdue', type: 'flag', sample: 'No' },
      link('/aviation/gcaa'),
    ],
    [{ key: 'owner', label: 'Task owner' }],
  ),
];
export const findTrigger = (key: string) => TRIGGERS.find((t) => t.key === key);

/** A stored rule; the trigger's label, category and phase are read from the trigger. */
export type NotificationRuleRow = Omit<
  S['NotificationRule'],
  'triggerLabel' | 'module' | 'category' | 'mandatory' | 'live' | 'phase' | 'recipientsSummary'
>;
type Channel = NotificationRuleRow['channels'][number];
type Templates = S['NotificationTemplates'];

/** One wording for every channel: the bell, the email, the SMS and the push title. */
function templates(channels: readonly Channel[], t: { title: string; body: string }): Templates {
  const all: Templates = {
    in_app: { title: t.title, body: t.body },
    email: { subject: t.title, body: `${t.body}\n\nOpen it in MASAR: {{link}}` },
    sms: { body: `MASAR: ${t.title}. ${t.body}` },
    push: { title: t.title },
  };
  return Object.fromEntries(channels.map((c) => [c, all[c]]));
}

const ALL: readonly Channel[] = ['in_app', 'email', 'sms', 'push'];
const APPROVALS: readonly Channel[] = ['in_app', 'email', 'push'];
const MAIL: readonly Channel[] = ['in_app', 'email'];
const ITEM = '{{recordRef}} · {{recordLabel}}';

function notificationRule(
  code: string,
  trigger: TriggerKey,
  name: string,
  opts: {
    people?: string[];
    roles?: string[];
    users?: string[];
    emails?: string[];
    channels: readonly Channel[];
    filter?: Conditions;
    severity?: NotificationRuleRow['severity'];
    frequency?: NotificationRuleRow['frequency'];
    everyDays?: number;
    text: { title: string; body: string };
    deactivatedReason?: string;
  },
): NotificationRuleRow {
  return {
    id: idFor('notification-rule', code),
    code,
    name,
    trigger,
    filter: opts.filter ?? {},
    frequency: opts.frequency ?? 'immediate',
    everyDays: opts.everyDays ?? null,
    channels: [...opts.channels],
    recipients: {
      roles: opts.roles ?? [],
      people: opts.people ?? [],
      users: opts.users ?? [],
      emails: opts.emails ?? [],
    },
    severity: opts.severity ?? 'info',
    templates: templates(opts.channels, opts.text),
    isActive: opts.deactivatedReason === undefined,
    deactivatedReason: opts.deactivatedReason ?? null,
    version: opts.deactivatedReason === undefined ? 1 : 2,
    updatedAt: SEEDED_AT,
  };
}

const BOOKING_PROCESSES = [
  'general-passenger-booking',
  'bulk-booking',
  'unscheduled-route-request',
];
const PASSENGER = ['passenger', 'requester'];

export const notificationRuleSeeds = (): NotificationRuleRow[] => [
  notificationRule('approval-required', 'adm.approval.task-assigned', 'Approval required', {
    people: ['approvers'],
    channels: APPROVALS,
    filter: { kind: ['new'] },
    text: {
      title: 'Approval needed · {{processLabel}} {{recordRef}}',
      body: `${ITEM} · {{stageName}}, due {{dueAt}} · requested by {{requesterName}}`,
    },
  }),
  notificationRule(
    'booking-approval-required',
    'adm.approval.task-assigned',
    'Booking approval required',
    {
      people: ['approvers'],
      channels: APPROVALS,
      filter: { kind: ['new'], process: BOOKING_PROCESSES },
      text: {
        title: 'Booking {{recordRef}} needs your approval',
        body: '{{recordLabel}} · requested by {{requesterName}} · {{stageName}}, due {{dueAt}}',
      },
    },
  ),
  notificationRule('approval-escalated', 'adm.approval.task-assigned', 'Approval escalated', {
    people: ['approvers'],
    roles: ['aviation-team'],
    channels: ALL,
    filter: { kind: ['escalated'] },
    severity: 'warning',
    text: {
      title: 'Escalated to you: {{processLabel}} {{recordRef}}',
      body: `${ITEM} passed its SLA · {{stageName}}, due {{dueAt}} · requested by {{requesterName}}`,
    },
  }),
  notificationRule('approval-approved', 'adm.approval.approved', 'Approval request approved', {
    people: ['requester', 'raised-by'],
    channels: APPROVALS,
    text: {
      title: '{{processLabel}} {{recordRef}} approved',
      body: `${ITEM} is approved at every stage.`,
    },
  }),
  notificationRule('approval-returned', 'adm.approval.rejected', 'Approval request returned', {
    people: ['requester', 'raised-by'],
    channels: APPROVALS,
    severity: 'warning',
    text: {
      title: '{{processLabel}} {{recordRef}} returned for changes',
      body: `${ITEM} · {{reasonCode}}: {{comment}}. Change it and submit it again.`,
    },
  }),
  notificationRule('access-expiring', 'adm.access.expiring', 'Access expiring', {
    people: ['user', 'line-manager'],
    channels: MAIL,
    filter: { daysLeft: { max: 14 } },
    frequency: 'recurring',
    everyDays: 7,
    severity: 'warning',
    text: {
      title: 'Your access as {{role}} ends on {{validTo}}',
      body: 'Your MASAR access as {{role}} ends in {{daysLeft}} days. If you still need it, ask your administrator to extend it.',
    },
  }),
  notificationRule('access-expired', 'adm.access.expired', 'Access ended', {
    people: ['user'],
    channels: MAIL,
    severity: 'warning',
    text: {
      title: 'Your access as {{role}} has ended',
      body: 'Your MASAR access as {{role}} ended on {{validTo}}. Ask your administrator if you still need it.',
    },
  }),
  notificationRule('reason-code-requested', 'adm.reason-code.requested', 'Reason code requested', {
    people: ['master-data-power-user'],
    channels: MAIL,
    text: {
      title: 'New reason code requested: {{code}}',
      body: '{{requesterName}} asks for {{code}} ({{description}}) under {{contextLabel}}: {{why}}',
    },
  }),
  notificationRule(
    'reason-code-request-decided',
    'adm.reason-code.request-decided',
    'Reason code request decided',
    {
      people: ['requester'],
      channels: MAIL,
      text: {
        title: 'Reason code {{code}}: {{decision}}',
        body: 'Your request for {{code}} under {{contextLabel}} was {{decision}}. {{note}}',
      },
    },
  ),
  notificationRule(
    'journeys-cancelled-out-of-service',
    'pl.location.journeys-cancelled',
    'Journeys cancelled: location out of service',
    {
      roles: ['aviation-team'],
      emails: ['aviation.ops@adnocoffshore.example'],
      channels: MAIL,
      severity: 'warning',
      text: {
        title: '{{count}} journeys cancelled: {{location}} out of service',
        body: '{{location}} is out of service ({{reason}}). Cancelled: {{journeys}}.',
      },
    },
  ),
  notificationRule('booking-submitted', 'pl.booking.submitted', 'Booking submitted', {
    people: PASSENGER,
    channels: ALL,
    text: {
      title: 'Booking {{bookingRef}} submitted',
      body: '{{passengerName}} · {{origin}} to {{destination}} on {{travelDate}}. It goes for approval now.',
    },
  }),
  notificationRule(
    'booking-confirmed',
    'pl.booking.confirmed',
    'Booking confirmed with itinerary',
    {
      people: PASSENGER,
      channels: ALL,
      text: {
        title: 'Booking {{bookingRef}} confirmed',
        body: '{{passengerName}} · {{flightNo}} {{origin}} to {{destination}}, departs {{departure}} · seat {{seat}}.',
      },
    },
  ),
  notificationRule('booking-cancelled', 'pl.booking.cancelled', 'Booking cancelled', {
    people: PASSENGER,
    channels: ALL,
    severity: 'warning',
    text: {
      title: 'Booking {{bookingRef}} cancelled',
      body: '{{origin}} to {{destination}} on {{travelDate}} is cancelled: {{reason}}.',
    },
  }),
  notificationRule('checkin-reminder', 'pl.checkin.reminder', 'Check-in reminder', {
    people: ['passenger'],
    channels: ['in_app', 'sms', 'push'],
    text: {
      title: 'Check in for {{flightNo}}',
      body: '{{flightNo}} {{origin}} to {{destination}} departs {{departure}}.',
    },
  }),
  notificationRule('freight-dispatched', 'pl.freight.dispatched', 'Freight dispatched', {
    people: ['receiver', 'sender'],
    channels: MAIL,
    text: {
      title: 'Freight {{freightRef}} dispatched',
      body: '{{description}} left {{origin}} for {{destination}} at {{departure}}.',
    },
    deactivatedReason: 'Freight notices go out from the dispatch desk while the trial runs.',
  }),
  notificationRule('muster-declared', 'pob.muster.declared', 'Muster declared', {
    people: ['focal-point', 'muster-coordinator', 'executive'],
    users: PEOPLE.filter((p) => p.email === 'ops.centre@masar.example').map((p) => p.userId),
    channels: ALL,
    severity: 'critical',
    text: {
      title: 'MUSTER at {{location}} · {{musterRef}}',
      body: 'Muster declared at {{declaredAt}} ({{reason}}). Headcount on board: {{headcount}}.',
    },
  }),
  notificationRule(
    'helideck-document-expiring',
    'hd.document.expiring',
    'Helideck document expiring',
    {
      people: ['site-focal-point-helideck', 'aviation-technical-team'],
      channels: MAIL,
      filter: { daysLeft: { max: 60 } },
      frequency: 'recurring',
      everyDays: 7,
      severity: 'warning',
      text: {
        title: '{{document}} for {{installation}} expires on {{expiresOn}}',
        body: '{{document}} for {{installation}} ({{location}}) expires in {{daysLeft}} days.',
      },
    },
  ),
];

export type DeliveryRow = S['NotificationDelivery'];
const SEEDED_RULES = notificationRuleSeeds();

const delivery = (
  key: string,
  ruleCode: string,
  channel: DeliveryRow['channel'],
  email: string,
  status: DeliveryRow['status'],
  minutesAgo: number,
  content: {
    subject?: string;
    text: string;
    error?: string;
    record?: { type: string; id: string };
  },
): DeliveryRow => {
  const r = SEEDED_RULES.find((x) => x.code === ruleCode);
  const t = r ? findTrigger(r.trigger) : undefined;
  const who = person(email);
  const queuedAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id: idFor('notification-delivery', key),
    channel,
    recipient: who?.name ?? email,
    address:
      channel === 'sms'
        ? `+971 50 ${idFor('phone', key).replace(/\D/g, '').slice(0, 7)}`
        : channel === 'push'
          ? 'MASAR app · iPhone'
          : email,
    subject: channel === 'email' ? (content.subject ?? null) : null,
    text: content.text,
    status,
    attempts: status === 'failed' ? 3 : status === 'queued' ? 0 : 1,
    providerRef:
      status === 'sent' ? `${channel.toUpperCase()}-${idFor('provider', key).slice(0, 8)}` : null,
    error: content.error ?? null,
    category: t?.category ?? 'admin',
    module: t?.module ?? 'administration',
    rule: r ? { id: r.id, name: r.name } : null,
    record: content.record ?? null,
    retriable: status === 'failed',
    queuedAt,
    sentAt:
      status === 'sent' ? new Date(Date.now() - minutesAgo * 60_000 + 4_000).toISOString() : null,
  };
};

export const deliverySeeds = (): DeliveryRow[] => [
  delivery('d01', 'approval-required', 'email', 's.alkaabi@masar.example', 'sent', 18, {
    subject: 'Approval needed · General Passenger Booking BK-2026-0418',
    text: 'BK-2026-0418 · Das Island · Line Manager, due tomorrow 07:00 · requested by Ahmed Al Mansoori',
    record: { type: 'booking', id: idFor('booking', 'BK-2026-0418') },
  }),
  delivery('d02', 'approval-required', 'push', 's.alkaabi@masar.example', 'sent', 18, {
    text: 'Approval needed · General Passenger Booking BK-2026-0418',
    record: { type: 'booking', id: idFor('booking', 'BK-2026-0418') },
  }),
  delivery('d03', 'booking-approval-required', 'email', 'h.alsuwaidi@masar.example', 'sent', 42, {
    subject: 'Booking BK-2026-0417 needs your approval',
    text: 'Upper Zakum · 30 Oct · requested by Saeed Al Kaabi · Site In-charge, due today 18:00',
    record: { type: 'booking', id: idFor('booking', 'BK-2026-0417') },
  }),
  delivery('d04', 'approval-escalated', 'sms', 'aviation.control@masar.example', 'failed', 95, {
    text: 'MASAR: Escalated to you: Unscheduled Route Request URR-2026-0031. Passed its SLA.',
    error: 'Carrier rejected the message: number unreachable (code 30003).',
    record: { type: 'unscheduled-route-request', id: idFor('urr', 'URR-2026-0031') },
  }),
  delivery('d05', 'approval-escalated', 'email', 'aviation.control@masar.example', 'sent', 95, {
    subject: 'Escalated to you: Unscheduled Route Request URR-2026-0031',
    text: 'URR-2026-0031 · AUH to Ghasha · passed its SLA · Aviation Team, due today 12:00',
    record: { type: 'unscheduled-route-request', id: idFor('urr', 'URR-2026-0031') },
  }),
  delivery('d06', 'approval-returned', 'email', 'a.almansoori@masar.example', 'sent', 180, {
    subject: 'General Passenger Booking BK-2026-0409 returned for changes',
    text: 'BK-2026-0409 · Zirku Island · REJ-NOJUST: Add the work order number. Change it and submit it again.',
  }),
  delivery('d07', 'access-expiring', 'email', 'y.alhammadi@masar.example', 'sent', 600, {
    subject: 'Your access as Site In-charge ends on 4 Nov 2026',
    text: 'Your MASAR access as Site In-charge ends in 7 days.',
  }),
  delivery('d08', 'access-expiring', 'email', 'j.santos@masar.example', 'failed', 610, {
    subject: 'Your access as Vessel Focal Point ends on 5 Nov 2026',
    text: 'Your MASAR access as Vessel Focal Point ends in 8 days.',
    error: 'Mailbox full: 552 5.2.2 quota exceeded.',
  }),
  delivery('d09', 'reason-code-requested', 'email', 'r.alkindi@masar.example', 'sent', 1440, {
    subject: 'New reason code requested: DLY-BIRD',
    text: 'Dispatch Power User asks for DLY-BIRD (Bird strike inspection) under Journey Delay.',
  }),
  delivery(
    'd10',
    'journeys-cancelled-out-of-service',
    'email',
    'aviation.control@masar.example',
    'sent',
    2880,
    {
      subject: '6 journeys cancelled: Upper Zakum out of service',
      text: 'Upper Zakum is out of service (Helideck under repair). Cancelled: ADA201 on 23 Oct, FAL203 on 24 Oct.',
    },
  ),
  delivery('d11', 'approval-approved', 'email', 'k.aldhaheri@masar.example', 'queued', 1, {
    subject: 'Freight — AUH FR-2026-0044 approved',
    text: 'FR-2026-0044 · Spare pump seals is approved at every stage.',
  }),
  delivery('d12', 'approval-required', 'email', 'p.nair@masar.example', 'sending', 0, {
    subject: 'Approval needed · ASP Audit Review ASP-2026-003',
    text: 'ASP-2026-003 · Falcon Aviation · Department Focal Point, due in 3 days',
  }),
  delivery('d13', 'approval-escalated', 'push', 'm.alfalasi@masar.example', 'failed', 300, {
    text: 'Escalated to you: General Passenger Booking BK-2026-0399',
    error: 'Device token expired; the user must sign in to the app again.',
  }),
];
