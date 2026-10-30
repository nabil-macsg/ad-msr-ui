import { json, MockError, text } from '../core/http';
import { masterCrud } from '../core/masters';
import { route } from '../core/router';
import { all, seed } from '../core/store';
import {
  ASSET_TYPES,
  DOCUMENT_REQUIREMENTS,
  type DocumentRequirementRow,
  INSPECTION_ACTIVITIES,
  INSPECTION_TYPES,
  type InspectionTypeRow,
} from '../data/demo-admin';

const BASE = '/api/v1/demo/admin';
const INSPECTION_STORE = 'demo-admin:inspection-types';
const DOCUMENT_STORE = 'demo-admin:documentation-matrix';

const assetTypesOf = (value: unknown): string[] =>
  Array.isArray(value) ? ASSET_TYPES.filter((type) => value.includes(type)) : [];

function nameOf(body: Record<string, unknown>, label: string): string {
  const name = text(body.name).trim();
  if (!name) {
    throw new MockError(422, 'VALIDATION_FAILED', `${label} is required.`, {
      fields: { name: 'Required' },
    });
  }
  return name;
}

function inspectionFields(body: Record<string, unknown>) {
  const validity = Number(body.validityMonths);
  if (!Number.isInteger(validity) || validity < 1) {
    throw new MockError(422, 'VALIDATION_FAILED', 'Validity period must be at least 1 month.', {
      fields: { validityMonths: 'At least 1 month' },
    });
  }
  const activity = text(body.activity);
  return {
    name: nameOf(body, 'Inspection / Test Type'),
    activity: (INSPECTION_ACTIVITIES as readonly string[]).includes(activity)
      ? activity
      : INSPECTION_ACTIVITIES[0],
    validityMonths: validity,
    assetTypes: assetTypesOf(body.assetTypes),
  };
}

function documentFields(body: Record<string, unknown>) {
  return {
    name: nameOf(body, 'Document name'),
    category: text(body.category).trim(),
    assetTypes: assetTypesOf(body.assetTypes),
    mandatory: body.mandatory === true,
  };
}

const hasAssetType = (row: { assetTypes: string[] }, value: string) =>
  row.assetTypes.includes(value);

/** Mock API for the demo admin screens (src/demo/admin). */
export function registerDemoAdmin(): void {
  seed(INSPECTION_STORE, () => INSPECTION_TYPES);
  seed(DOCUMENT_STORE, () => DOCUMENT_REQUIREMENTS);

  // Documents required per asset type: the counts the matrix configures (active rows only).
  route('GET', `${BASE}/documentation-matrix/summary`, () =>
    json(
      ASSET_TYPES.map((assetType) => {
        const rows = all<DocumentRequirementRow>(DOCUMENT_STORE).filter(
          (r) => r.isActive && r.assetTypes.includes(assetType),
        );
        return {
          assetType,
          required: rows.length,
          mandatory: rows.filter((r) => r.mandatory).length,
        };
      }),
    ),
  );

  masterCrud<InspectionTypeRow>(`${BASE}/inspection-types`, INSPECTION_STORE, 'inspection type', {
    recordType: 'inspection-type',
    unique: 'name',
    search: (r) => [r.name, r.activity, ...r.assetTypes],
    filters: { assetType: hasAssetType },
    sorts: { validity: (r) => r.validityMonths },
    describe: (r) => ({ ref: r.name, label: r.name }),
    create: (body) => ({ ...inspectionFields(body), references: 0 }),
    update: (current, body) => ({ ...current, ...inspectionFields(body) }),
  });

  masterCrud<DocumentRequirementRow>(`${BASE}/documentation-matrix`, DOCUMENT_STORE, 'document', {
    recordType: 'document-requirement',
    unique: 'name',
    search: (r) => [r.name, r.category, ...r.assetTypes],
    filters: {
      assetType: hasAssetType,
      mandatory: (r, v) => String(r.mandatory) === v,
    },
    describe: (r) => ({ ref: r.name, label: r.name }),
    create: (body) => documentFields(body),
    update: (current, body) => ({ ...current, ...documentFields(body) }),
  });
}
