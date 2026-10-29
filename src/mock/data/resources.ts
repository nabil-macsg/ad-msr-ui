import type { components } from '../../api/schema';
import { idFor, ref, SEEDED_AT } from './ids';
import aircraftModelSeeds from './seeds/aircraft-models.json';
import cargoSeeds from './seeds/cargo-types.json';
import fleetSeeds from './seeds/fleet.json';
import fuelSeeds from './seeds/fuel-stations.json';
import locationSeeds from './seeds/locations.json';
import quotaSeeds from './seeds/quotas.json';
import typeSeeds from './seeds/resource-types.json';

type Schemas = components['schemas'];
export type BaseMode = Schemas['ResourceCategoryOption']['baseMode'];
type WeightUnit = 'kg' | 'lb';

/** Stored rows: what the mock keeps; the services derive the API's views from them. */
export interface CategoryRow {
  id: string;
  code: string;
  name: string;
  weightUnit: WeightUnit;
  baseMode: BaseMode;
  isActive: boolean;
  deactivatedReason: string | null;
  version: number;
  updatedAt: string;
  [key: string]: unknown;
}

export interface TypeRow {
  id: string;
  code: string;
  name: string;
  category: string;
  aircraftModelId: string | null;
  passengerCapacity: number | null;
  seatMap: Schemas['ResourceType']['seatMap'];
  baggageAllowanceKg: number | null;
  payloadKg: number | null;
  openSeating: boolean;
  loadsheetRequired: boolean;
  isActive: boolean;
  deactivatedReason: string | null;
  version: number;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ModelRow {
  id: string;
  code: string;
  name: string;
  category: string;
  requiredDM: number | null;
  requiredTT: number | null;
  performanceClass: string | null;
  weightUnit: WeightUnit;
  unconfirmedFields: ('requiredDM' | 'requiredTT')[];
  isActive: boolean;
  deactivatedReason: string | null;
  version: number;
  updatedAt: string;
  [key: string]: unknown;
}

export interface FleetRow {
  id: string;
  registration: string;
  resourceTypeId: string;
  serviceProviderId: string;
  availability: Schemas['FleetUnit']['availability'];
  isBookable: boolean;
  capacityOverride: number | null;
  isActive: boolean;
  deactivatedReason: string | null;
  version: number;
  updatedAt: string;
  [key: string]: unknown;
}

const active = {
  isActive: true,
  deactivatedReason: null,
  version: 1,
  updatedAt: SEEDED_AT,
} as const;

export const CATEGORY_SEED: CategoryRow[] = [
  {
    id: idFor('resource-category', 'FIXED-WING'),
    code: 'FIXED-WING',
    name: 'Fixed Wing',
    weightUnit: 'kg',
    baseMode: 'fixed-wing',
    ...active,
  },
  {
    id: idFor('resource-category', 'ROTARY-WING'),
    code: 'ROTARY-WING',
    name: 'Rotary Wing',
    weightUnit: 'kg',
    baseMode: 'rotary-wing',
    ...active,
  },
  {
    id: idFor('resource-category', 'MARINE'),
    code: 'MARINE',
    name: 'Vessel / Boat',
    weightUnit: 'kg',
    baseMode: 'marine',
    ...active,
  },
];

const MODEL_NAMES: Record<string, string> = {
  'BELL-412': 'Bell 412',
  AW169: 'AW169',
  AW139: 'AW139',
  AW189: 'AW189',
};
const PERFORMANCE: Record<string, string> = {
  AW139: 'PC2e',
  AW189: 'PC2e',
  AW169: 'PC2e',
  'BELL-412': 'PC3',
};

export const MODEL_SEED: ModelRow[] = aircraftModelSeeds.map((m) => ({
  id: idFor('aircraft-model', m.code),
  code: m.code,
  name: MODEL_NAMES[m.code] ?? m.code,
  category: 'ROTARY-WING',
  requiredDM: m.requiredDM,
  requiredTT: m.requiredTT,
  performanceClass: PERFORMANCE[m.code] ?? null,
  weightUnit: 'kg',
  unconfirmedFields: [],
  ...active,
}));

interface TypeSeed {
  code: string;
  name: string;
  category: string;
  passengerCapacity: number;
  seatMap?: { rows: number; seatsPerRow: number; aisleAfter: number | null };
  baggageAllowanceKg?: number;
  payloadKg?: number;
  aircraftModel?: string;
  openSeating?: boolean;
  loadsheetRequired?: boolean;
}

export const TYPE_SEED: TypeRow[] = (typeSeeds as TypeSeed[]).map((t) => ({
  id: idFor('resource-type', t.code),
  code: t.code,
  name: t.name,
  category: t.category,
  aircraftModelId: t.aircraftModel ? idFor('aircraft-model', t.aircraftModel) : null,
  passengerCapacity: t.passengerCapacity,
  seatMap: t.openSeating ? null : (t.seatMap ?? null),
  baggageAllowanceKg: t.baggageAllowanceKg ?? null,
  payloadKg: t.payloadKg ?? null,
  openSeating: t.openSeating ?? false,
  loadsheetRequired: t.loadsheetRequired ?? false,
  ...active,
}));

interface FleetSeed {
  registration: string;
  type: string;
  provider: string;
  availability: FleetRow['availability'];
  bookable?: boolean;
}

export const FLEET_SEED: FleetRow[] = (fleetSeeds as FleetSeed[]).map((f) => ({
  id: idFor('fleet', f.registration),
  registration: f.registration,
  resourceTypeId: idFor('resource-type', f.type),
  serviceProviderId: idFor('service-provider', f.provider),
  availability: f.availability,
  isBookable: f.bookable ?? f.availability !== 'retired',
  capacityOverride: f.registration === 'A6-ADB' ? 48 : null,
  ...active,
}));

export const CARGO_SEED: Schemas['CargoType'][] = (
  cargoSeeds as { code: string; name: string; dgClass?: string }[]
).map((c) => ({
  id: idFor('cargo-type', c.code),
  code: c.code,
  name: c.name,
  dgClass: c.dgClass ?? null,
  ...active,
}));

const locationName = new Map(locationSeeds.map((l) => [l.code, l.name]));

export const FUEL_SEED: Schemas['FuelStation'][] = (
  fuelSeeds as {
    code: string;
    name: string;
    location: string;
    capacityKg?: number;
    reorderLevelKg?: number;
  }[]
).map((s) => ({
  id: idFor('fuel-station', s.code),
  code: s.code,
  name: s.name,
  location: ref('location', s.location, locationName.get(s.location) ?? s.location),
  capacityKg: s.capacityKg ?? null,
  reorderLevelKg: s.reorderLevelKg ?? null,
  ...active,
}));

const PASSENGER_CATEGORY_NAMES: Record<string, string> = {
  VIP: 'VIP',
  EP: 'Essential Personnel',
  DH: 'Direct Hire',
  'EST-POS': 'Essential Position',
  CON: 'Contractor',
  VIS: 'Visitor',
  GEN: 'General',
  RADAR: 'Radar Operations',
};

interface QuotaSeed {
  code: string;
  type: string;
  category: string;
  seatLimit: number;
  period: Schemas['Quota']['period'];
  validFrom: string;
}

export const QUOTA_SEED: Schemas['Quota'][] = (quotaSeeds as QuotaSeed[]).map((q) => ({
  id: idFor('quota', q.code),
  code: q.code,
  appliesTo: {
    dimension: 'passenger-category',
    record: ref(
      'passenger-category',
      q.category,
      PASSENGER_CATEGORY_NAMES[q.category] ?? q.category,
    ),
  },
  scope: {
    kind: 'resource-type',
    record: ref('resource-type', q.type, TYPE_SEED.find((t) => t.code === q.type)?.name ?? q.type),
  },
  period: q.period,
  seatLimit: q.seatLimit,
  warningPct: 80,
  validFrom: q.validFrom,
  validTo: null,
  ...active,
}));

export const PASSENGER_CATEGORY_REFS = Object.entries(PASSENGER_CATEGORY_NAMES).map(
  ([code, name]) => ref('passenger-category', code, name),
);
