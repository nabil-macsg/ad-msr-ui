/** Sample records for the demo admin screens (src/demo/admin), as the original demo shows them. */

/** The asset types an inspection or a document applies to. */
export const ASSET_TYPES = ['Helideck', 'Helipad', 'Runway', 'Port / Jetty'] as const;

/** What an inspection / test type records (Activity choices). */
export const INSPECTION_ACTIVITIES = [
  'Helideck Inspection',
  'Friction Test',
  'Drop Test',
  'Crew Assessment',
] as const;

export interface InspectionTypeRow {
  id: string;
  version: number;
  isActive: boolean;
  deactivatedReason: string | null;
  name: string;
  activity: string;
  validityMonths: number;
  /** Empty: assessed per site rather than per installation. */
  assetTypes: string[];
  /** Inspections and tests that point at this type. */
  references: number;
  [key: string]: unknown;
}

export interface DocumentRequirementRow {
  id: string;
  version: number;
  isActive: boolean;
  deactivatedReason: string | null;
  name: string;
  category: string;
  assetTypes: string[];
  mandatory: boolean;
  [key: string]: unknown;
}

const base = { version: 1, isActive: true, deactivatedReason: null };

export const INSPECTION_TYPES: InspectionTypeRow[] = [
  {
    ...base,
    id: 'it-helideck',
    name: 'Helideck Inspection',
    activity: 'Helideck Inspection',
    validityMonths: 12,
    assetTypes: ['Helideck', 'Helipad'],
    references: 70,
  },
  {
    ...base,
    id: 'it-friction',
    name: 'Friction Test',
    activity: 'Friction Test',
    validityMonths: 12,
    assetTypes: ['Helideck', 'Helipad'],
    references: 41,
  },
  {
    ...base,
    id: 'it-drop',
    name: 'Drop Test',
    activity: 'Drop Test',
    validityMonths: 24,
    assetTypes: ['Helideck'],
    references: 21,
  },
  {
    ...base,
    id: 'it-crew',
    name: 'Crew Assessment',
    activity: 'Crew Assessment',
    validityMonths: 12,
    assetTypes: [],
    references: 19,
  },
];

const HD = ['Helideck'];
const HD_HP = ['Helideck', 'Helipad'];

const docs: [string, string, string[], boolean][] = [
  ['Previous acceptance document', 'Acceptance', HD_HP, true],
  ['Fire Risk Assessment (FRA)', 'Safety case', HD_HP, true],
  ['Friction test report', 'Test', HD_HP, true],
  ['Firefighting equipment inventory', 'Firefighting', HD_HP, true],
  ['Marking and signage record', 'Markings', HD_HP, false],
  ['HLO / HDA / HRO training certificates', 'Personnel', HD_HP, true],
  ['Radio licence and frequency allocation', 'Operations', HD_HP, true],
  ['Calibration certificates', 'Test equipment', HD, true],
  ['Equipment manuals', 'Reference', HD, false],
  ['Structural integrity certificate', 'Structure', HD, true],
  ['Helideck general arrangement drawing', 'Structure', HD, true],
  ['Obstacle environment survey', 'Structure', HD, true],
  ['Drop test report', 'Test', HD, true],
  ['Landing net certificate', 'Structure', HD, false],
  ['Deck load calculation', 'Structure', HD, true],
  ['Foam concentrate test certificate', 'Firefighting', HD, true],
  ['Firefighting equipment service records', 'Firefighting', HD, true],
  ['Rescue equipment inventory', 'Firefighting', HD, false],
  ['Helideck emergency response plan', 'Safety case', HD, true],
  ['Perimeter and status lighting certificate', 'Lighting', HD, true],
  ['Runway pavement condition report', 'Structure', ['Runway'], true],
  ['Aerodrome licence', 'Operations', ['Runway'], true],
  ['Berth structural survey', 'Structure', ['Port / Jetty'], true],
  ['Port facility security plan (ISPS)', 'Safety case', ['Port / Jetty'], true],
];

export const DOCUMENT_REQUIREMENTS: DocumentRequirementRow[] = docs.map(
  ([name, category, assetTypes, mandatory], i) => ({
    ...base,
    id: `doc-${String(i + 1).padStart(2, '0')}`,
    name,
    category,
    assetTypes: [...assetTypes],
    mandatory,
    // The original lists the ISPS plan as deactivated (23 of 24).
    ...(name.startsWith('Port facility')
      ? { isActive: false, deactivatedReason: 'Covered by the port authority audit' }
      : {}),
  }),
);
