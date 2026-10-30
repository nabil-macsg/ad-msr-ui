import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/errors';
import type { DocumentRequirementRow, InspectionTypeRow } from '../../mock/data/demo-admin';
import { masterResource } from '../../modules/administration/masters/master-api';
import type { MasterRecord } from '../../modules/administration/masters/master-resource';

export type { DocumentRequirementRow, InspectionTypeRow };
export { ASSET_TYPES, INSPECTION_ACTIVITIES } from '../../mock/data/demo-admin';

const BASE = '/api/v1/demo/admin';
export const INSPECTION_TYPES_PATH = `${BASE}/inspection-types`;
export const DOCUMENTS_PATH = `${BASE}/documentation-matrix`;

/** The demo admin screens' own calls: through `fetch`, which the mock layer answers. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body: unknown = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw ApiError.from(response.status, body);
  return body as T;
}

export const inspectionTypes = masterResource<InspectionTypeRow>(
  'inspection-types',
  'admin.inspection-types',
  { path: INSPECTION_TYPES_PATH, deletable: false },
);

export const documentRequirements = masterResource<DocumentRequirementRow>(
  'documentation-matrix',
  'admin.documentation-matrix',
  { path: DOCUMENTS_PATH, deletable: false },
);

/** Creates (no record) or edits (with If-Match) a record of one of these lists. */
export function saveRecord<T>(path: string, record: MasterRecord | null, body: object) {
  return call<T>(record ? `${path}/${record.id}` : path, {
    method: record ? 'PATCH' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(record ? { 'If-Match': String(record.version) } : {}),
    },
    body: JSON.stringify(body),
  });
}

export interface AssetTypeCount {
  readonly assetType: string;
  readonly required: number;
  readonly mandatory: number;
}

/** Documents required per asset type (active documents only). */
export function useDocumentCounts() {
  return useQuery({
    queryKey: [DOCUMENTS_PATH, 'summary'],
    queryFn: () => call<AssetTypeCount[]>(`${DOCUMENTS_PATH}/summary`),
  });
}
