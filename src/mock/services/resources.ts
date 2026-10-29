import type { components } from '../../api/schema';
import { MockError, text } from '../core/http';
import { masterCrud } from '../core/masters';
import { all, find, seed } from '../core/store';
import {
  type BaseMode,
  CARGO_SEED,
  CATEGORY_SEED,
  type CategoryRow,
  FLEET_SEED,
  type FleetRow,
  FUEL_SEED,
  MODEL_SEED,
  type ModelRow,
  PASSENGER_CATEGORY_REFS,
  QUOTA_SEED,
  TYPE_SEED,
  type TypeRow,
} from '../data/resources';

type Schemas = components['schemas'];
type Provider = Schemas['ServiceProvider'];

/** Resource categories, types, aircraft models, fleet, quotas, cargo types and fuel stations. */
export function registerResources(): void {
  seed('resource-categories', () => CATEGORY_SEED);
  seed('aircraft-models', () => MODEL_SEED);
  seed('resource-types', () => TYPE_SEED);
  seed('fleet', () => FLEET_SEED);
  seed('quotas', () => QUOTA_SEED);
  seed('cargo-types', () => CARGO_SEED);
  seed('fuel-stations', () => FUEL_SEED);

  registerCategories();
  registerAircraftModels();
  registerResourceTypes();
  registerFleet();
  registerQuotas();
  masterCrud('/api/v1/masters/cargo-types', 'cargo-types', 'cargo type');
  masterCrud('/api/v1/masters/fuel-stations', 'fuel-stations', 'fuel station', {
    create: (b) => ({ ...b, location: locationRef(text(b.locationId)) }),
    update: (current, b) => ({
      ...current,
      ...b,
      ...(b.locationId ? { location: locationRef(text(b.locationId)) } : {}),
    }),
  });
}

// ---------- shared lookups ----------

const categories = () => all<CategoryRow>('resource-categories');
const categoryOf = (code: string) => categories().find((c) => c.code === code);
const baseModeOf = (code: string): BaseMode => categoryOf(code)?.baseMode ?? 'fixed-wing';
const categoryOptions = (): Schemas['ResourceCategoryOption'][] =>
  categories()
    .filter((c) => c.isActive)
    .map((c) => ({ code: c.code, name: c.name, weightUnit: c.weightUnit, baseMode: c.baseMode }));

/** Service providers come from the Organisations service; the seed's ids are the fallback. */
function providers(): Provider[] {
  return all<Provider>('service-providers');
}
const providerRef = (id: string) => {
  const p = providers().find((x) => x.id === id);
  return p
    ? { id: p.id, code: p.code, name: p.legalName }
    : { id, code: '?', name: 'Unknown provider' };
};

function locationRef(id: string) {
  const l = all<{ id: string; code: string; name: string }>('locations').find((x) => x.id === id);
  if (!l)
    throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
      fields: { locationId: 'Choose a location' },
    });
  return { id: l.id, code: l.code, name: l.name };
}

const typeActive = (t: TypeRow) => t.isActive && (categoryOf(t.category)?.isActive ?? false);

function specsOf(t: TypeRow) {
  return {
    passengerCapacity: t.passengerCapacity,
    seatMap: t.seatMap,
    baggageAllowanceKg: t.baggageAllowanceKg,
    payloadKg: t.payloadKg,
    openSeating: t.openSeating,
  };
}

/** What a rotary-wing type's aircraft model needs of a helideck (BRD A.3.3-7); null otherwise. */
function helideckOf(t: TypeRow) {
  if (baseModeOf(t.category) !== 'rotary-wing' || !t.aircraftModelId) return null;
  const m = find<ModelRow>('aircraft-models', t.aircraftModelId);
  if (!m) return null;
  return {
    aircraftModel: { id: m.id, code: m.code, name: m.name },
    requiredDM: m.requiredDM,
    requiredTT: m.requiredTT,
    performanceClass: m.performanceClass,
  };
}

const validation = (field: string, message: string) =>
  new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
    fields: { [field]: message },
  });

// ---------- resource categories ----------

function registerCategories() {
  masterCrud<CategoryRow>(
    '/api/v1/masters/resource-categories',
    'resource-categories',
    'resource category',
    {
      create: (b) => ({
        code: text(b.code).toUpperCase(),
        name: text(b.name),
        weightUnit: b.weightUnit ?? 'kg',
        baseMode: b.baseMode ?? 'fixed-wing',
        deactivatedReason: null,
      }),
    },
  );
}

// ---------- aircraft models ----------

function registerAircraftModels() {
  masterCrud<ModelRow>('/api/v1/masters/aircraft-models', 'aircraft-models', 'aircraft model', {
    view: (m) => ({
      ...m,
      resourceTypes: all<TypeRow>('resource-types').filter((t) => t.aircraftModelId === m.id)
        .length,
    }),
    options: () => ({ categories: categoryOptions() }),
    create: (b) => ({
      code: text(b.code).toUpperCase(),
      name: text(b.name),
      category: text(b.category) || 'ROTARY-WING',
      requiredDM: b.requiredDM ?? null,
      requiredTT: b.requiredTT ?? null,
      performanceClass: b.performanceClass ?? null,
      weightUnit: 'kg',
      unconfirmedFields: [],
      deactivatedReason: null,
    }),
  });
}

// ---------- resource types ----------

function typeView(t: TypeRow): Schemas['ResourceType'] {
  const c = categoryOf(t.category);
  const model = t.aircraftModelId
    ? find<ModelRow>('aircraft-models', t.aircraftModelId)
    : undefined;
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    category: { code: t.category, name: c?.name ?? t.category, weightUnit: c?.weightUnit ?? 'kg' },
    aircraftModel: model ? { id: model.id, code: model.code, name: model.name } : null,
    ...specsOf(t),
    loadsheetRequired: t.loadsheetRequired,
    fleet: all<FleetRow>('fleet').filter((f) => f.resourceTypeId === t.id).length,
    isActive: t.isActive,
    deactivatedReason: t.deactivatedReason,
    version: t.version,
    updatedAt: t.updatedAt,
  };
}

function typeFields(b: Record<string, unknown>, current?: TypeRow) {
  const raw = (key: keyof TypeRow & string): unknown => (key in b ? b[key] : current?.[key]);
  const num = (key: keyof TypeRow & string) => {
    const v = raw(key);
    return typeof v === 'number' ? v : null;
  };
  const capacity = num('passengerCapacity');
  if (capacity === null) throw validation('passengerCapacity', 'Enter the seat capacity');
  const model = raw('aircraftModelId');
  return {
    name: text(raw('name')),
    category: text(raw('category')) || 'FIXED-WING',
    aircraftModelId: typeof model === 'string' && model !== '' ? model : null,
    passengerCapacity: capacity,
    seatMap: (raw('seatMap') ?? null) as TypeRow['seatMap'],
    baggageAllowanceKg: num('baggageAllowanceKg'),
    payloadKg: num('payloadKg'),
    openSeating: raw('openSeating') === true,
    loadsheetRequired: raw('loadsheetRequired') === true,
  };
}

function registerResourceTypes() {
  masterCrud<TypeRow>('/api/v1/masters/resource-types', 'resource-types', 'resource type', {
    view: typeView,
    search: (t) => [t.code, t.name],
    filters: { category: (t, v) => t.category === v },
    sorts: { name: (t) => t.name, code: (t) => t.code, category: (t) => t.category },
    options: (): Schemas['ResourceTypeOptions'] => ({
      categories: categoryOptions(),
      aircraftModels: all<ModelRow>('aircraft-models')
        .filter((m) => m.isActive)
        .map((m) => ({ id: m.id, code: m.code, name: m.name, category: m.category })),
    }),
    create: (b) => ({
      code: text(b.code).toUpperCase(),
      ...typeFields(b),
      deactivatedReason: null,
    }),
    update: (current, b) => ({ ...current, ...typeFields(b, current) }),
  });
}

// ---------- fleet ----------

const REGISTRATION = /^[A-Za-z0-9][A-Za-z0-9 .-]{1,39}$/;
const FLEET_FIELDS = new Set([
  'registration',
  'resourceTypeId',
  'serviceProviderId',
  'availability',
  'isBookable',
  'passengerCapacity',
]);

function fleetView(f: FleetRow): Schemas['FleetUnit'] {
  const t = find<TypeRow>('resource-types', f.resourceTypeId);
  const specs = t
    ? specsOf(t)
    : {
        passengerCapacity: null,
        seatMap: null,
        baggageAllowanceKg: null,
        payloadKg: null,
        openSeating: false,
      };
  return {
    id: f.id,
    registration: f.registration,
    resourceType: {
      id: f.resourceTypeId,
      code: t?.code ?? '?',
      name: t?.name ?? 'Unknown type',
      category: t?.category ?? 'FIXED-WING',
      baseMode: baseModeOf(t?.category ?? 'FIXED-WING'),
    },
    serviceProvider: providerRef(f.serviceProviderId),
    availability: f.availability,
    isBookable: f.isBookable,
    overrides: { passengerCapacity: f.capacityOverride },
    effective: { ...specs, passengerCapacity: f.capacityOverride ?? specs.passengerCapacity },
    helideck: t ? helideckOf(t) : null,
    isActive: f.isActive,
    deactivatedReason: f.deactivatedReason,
    version: f.version,
    updatedAt: f.updatedAt,
  };
}

/** The Fleet API's rules (BRD D.3.2.1, D.3.1.8): strict body, active references, capacity within the seat map. */
function fleetValues(b: Record<string, unknown>, current?: FleetRow) {
  const unknown = Object.keys(b).filter((k) => !FLEET_FIELDS.has(k));
  if (unknown.length > 0) {
    throw new MockError(422, 'VALIDATION_FAILED', `Fleet doesn’t keep ${unknown.join(', ')}.`, {
      fields: Object.fromEntries(unknown.map((k) => [k, 'Not a Fleet field'])),
    });
  }
  const resourceTypeId = text(b.resourceTypeId ?? current?.resourceTypeId);
  const serviceProviderId = text(b.serviceProviderId ?? current?.serviceProviderId);
  const availability = (b.availability ??
    current?.availability ??
    'available') as FleetRow['availability'];
  const capacityOverride =
    'passengerCapacity' in b
      ? (b.passengerCapacity as number | null)
      : (current?.capacityOverride ?? null);
  const isBookable =
    typeof b.isBookable === 'boolean'
      ? b.isBookable
      : availability === 'retired'
        ? false
        : (current?.isBookable ?? true);

  const type = find<TypeRow>('resource-types', resourceTypeId);
  if (!type || (!typeActive(type) && current?.resourceTypeId !== resourceTypeId)) {
    throw new MockError(422, 'RESOURCE_TYPE_INACTIVE', 'Choose an active resource type.');
  }
  const provider = providers().find((p) => p.id === serviceProviderId);
  if (!provider || (!provider.isActive && current?.serviceProviderId !== serviceProviderId)) {
    throw new MockError(422, 'PROVIDER_INACTIVE', 'Choose an active service provider.');
  }
  if (availability === 'retired' && isBookable) {
    throw new MockError(422, 'RETIRED_NOT_BOOKABLE', 'A retired unit can’t be bookable.');
  }
  if (
    capacityOverride !== null &&
    (!Number.isInteger(capacityOverride) || capacityOverride < 1 || capacityOverride > 1000)
  ) {
    throw validation('passengerCapacity', 'Enter a whole number from 1 to 1000');
  }
  const seats = type.seatMap ? type.seatMap.rows * type.seatMap.seatsPerRow : null;
  const capacity = capacityOverride ?? type.passengerCapacity;
  if (seats !== null && capacity !== null && capacity > seats) {
    throw new MockError(
      422,
      'CAPACITY_ABOVE_SEAT_MAP',
      `The type’s seat map has ${seats} seats; enter no more than that.`,
      {
        fields: { passengerCapacity: `No more than ${seats}` },
      },
    );
  }
  return { resourceTypeId, serviceProviderId, availability, isBookable, capacityOverride };
}

function registerFleet() {
  masterCrud<FleetRow>('/api/v1/masters/fleet', 'fleet', 'fleet unit', {
    recordType: 'fleet-unit',
    unique: 'registration',
    describe: (f) => ({ ref: f.registration, label: f.registration }),
    view: fleetView,
    search: (f) => {
      const v = fleetView(f);
      return [v.registration, v.resourceType.name, v.serviceProvider.name];
    },
    filters: {
      type: (f, v) => f.resourceTypeId === v,
      provider: (f, v) => f.serviceProviderId === v,
      category: (f, v) => find<TypeRow>('resource-types', f.resourceTypeId)?.category === v,
      availability: (f, v) => f.availability === v,
    },
    sorts: {
      registration: (f) => f.registration,
      type: (f) => find<TypeRow>('resource-types', f.resourceTypeId)?.name,
      provider: (f) => providerRef(f.serviceProviderId).name,
      availability: (f) => f.availability,
      updatedAt: (f) => f.updatedAt,
    },
    defaultSort: 'registration:asc',
    options: (): Schemas['FleetOptions'] => ({
      resourceTypes: all<TypeRow>('resource-types')
        .filter(typeActive)
        .map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          category: t.category,
          baseMode: baseModeOf(t.category),
          specs: specsOf(t),
          helideck: helideckOf(t),
        })),
      serviceProviders: providers()
        .filter((p) => p.isActive)
        .map((p) => ({ id: p.id, code: p.code, name: p.legalName })),
      categories: categoryOptions(),
    }),
    create: (b) => {
      const registration = text(b.registration).trim();
      if (!REGISTRATION.test(registration)) {
        throw validation(
          'registration',
          '2–40 letters, digits, spaces, dots or hyphens, starting with a letter or digit',
        );
      }
      return { registration, ...fleetValues(b), deactivatedReason: null };
    },
    update: (current, b) => {
      if ('registration' in b && b.registration !== current.registration) {
        throw validation('registration', 'The registration is permanent');
      }
      return { ...current, ...fleetValues(b, current) };
    },
  });
}

// ---------- quotas ----------

function quotaRefs(): Schemas['QuotaOptions'] {
  type Named = { id: string; code: string; name?: string; legalName?: string; isActive?: boolean };
  const pick = (rows: Named[]) =>
    rows
      .filter((r) => r.isActive !== false)
      .map((r) => ({ id: r.id, code: r.code, name: r.name ?? r.legalName ?? r.code }));
  return {
    department: pick(all<Named>('departments')),
    location: pick(all<Named>('locations')),
    zone: pick(all<Named>('zones')),
    'service-provider': pick(all<Named>('service-providers')),
    'passenger-category':
      all<Named>('passenger-categories').length > 0
        ? pick(all<Named>('passenger-categories'))
        : PASSENGER_CATEGORY_REFS,
    'resource-type': all<TypeRow>('resource-types')
      .filter((t) => typeActive(t) && baseModeOf(t.category) === 'fixed-wing')
      .map((t) => ({ id: t.id, code: t.code, name: t.name })),
    route: pick(all<Named>('routes')),
  };
}

function registerQuotas() {
  masterCrud<Schemas['Quota'] & { [key: string]: unknown }>(
    '/api/v1/masters/quotas',
    'quotas',
    'quota',
    {
      options: quotaRefs,
      filters: {
        appliesTo: (q, v) => q.appliesTo.dimension === v,
        scopeKind: (q, v) => q.scope.kind === v,
        period: (q, v) => q.period === v,
      },
      create: (b) => quotaFields(b),
      update: (current, b) => ({ ...current, ...quotaFields({ ...flatten(current), ...b }) }),
    },
  );
}

function flatten(q: Schemas['Quota']) {
  return {
    code: q.code,
    appliesTo: q.appliesTo.dimension,
    appliesToId: q.appliesTo.record.id,
    scopeKind: q.scope.kind,
    scopeId: q.scope.record.id,
    period: q.period,
    seatLimit: q.seatLimit,
    warningPct: q.warningPct,
    validFrom: q.validFrom,
    validTo: q.validTo,
  };
}

type QuotaChoice = { id: string; code: string; name: string };

function quotaFields(b: Record<string, unknown>) {
  const refs = quotaRefs();
  const dimension = text(b.appliesTo) as Schemas['Quota']['appliesTo']['dimension'];
  const record = (refs[dimension] as QuotaChoice[] | undefined)?.find(
    (r) => r.id === b.appliesToId,
  );
  if (!record) throw validation('appliesToId', 'Choose whose seats');
  const kind = text(b.scopeKind) as Schemas['Quota']['scope']['kind'];
  const scope = (refs[kind] as QuotaChoice[] | undefined)?.find((r) => r.id === b.scopeId);
  if (!scope) throw validation('scopeId', 'Choose a fixed-wing resource type or route');
  return {
    code: text(b.code).toUpperCase(),
    appliesTo: { dimension, record },
    scope: { kind, record: scope },
    period: (text(b.period) || 'flight') as Schemas['Quota']['period'],
    seatLimit: Number(b.seatLimit),
    warningPct: Number(b.warningPct ?? 80),
    validFrom: text(b.validFrom),
    validTo: (b.validTo as string | null) ?? null,
    deactivatedReason: null,
  };
}
