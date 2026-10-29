import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';
import type { MasterResource } from '../masters/master-resource';

type Schemas = components['schemas'];
export type Location = Schemas['Location'];
export type LocationInput = Schemas['LocationInput'];
export type LocationUpdate = Schemas['LocationUpdate'];
export type Installation = Schemas['Installation'];
export type InstallationInput = Schemas['InstallationInput'];
export type InstallationUpdate = Schemas['InstallationUpdate'];
export type Route = Schemas['Route'];
export type RouteInput = Schemas['RouteInput'];
export type RouteUpdate = Schemas['RouteUpdate'];
export type ServiceabilityChange = Schemas['ServiceabilityChange'];
export type UnconfirmedField = Installation['unconfirmedFields'][number];

const ifMatch = (version: number) => ({ 'If-Match': String(version) });

// ── Locations ─────────────────────────────────────────────────────────────────

export const LOCATIONS_KEY = ['masters', 'locations'] as const;

export const locationsResource: MasterResource<Location> = {
  pageKey: 'admin.locations',
  queryKey: [...LOCATIONS_KEY],
  path: '/api/v1/masters/locations',
  list: async (query) => unwrap(await api.GET('/api/v1/masters/locations', { params: { query } })),
  deactivate: async (record, reason) =>
    unwrap(
      await api.POST('/api/v1/masters/locations/{id}/deactivate', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      }),
    ),
  reactivate: async (record, reason) =>
    unwrap(
      await api.POST('/api/v1/masters/locations/{id}/reactivate', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      }),
    ),
  remove: async (record, reason) => {
    unwrap(
      await api.DELETE('/api/v1/masters/locations/{id}', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/masters/locations/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

export async function saveLocation(
  record: Location | null,
  create: LocationInput,
  update: LocationUpdate,
): Promise<Location> {
  if (record) {
    return unwrap(
      await api.PATCH('/api/v1/masters/locations/{id}', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: update,
      }),
    );
  }
  return unwrap(await api.POST('/api/v1/masters/locations', { body: create }));
}

export async function syncLocationCoordinates(record: Location): Promise<Location> {
  return unwrap(
    await api.POST('/api/v1/masters/locations/{id}/coordinates/sync', {
      params: { path: { id: record.id }, header: ifMatch(record.version) },
    }),
  );
}

export async function setLocationServiceability(
  record: Location,
  change: ServiceabilityChange,
): Promise<Location> {
  return unwrap(
    await api.POST('/api/v1/masters/locations/{id}/serviceability', {
      params: { path: { id: record.id }, header: ifMatch(record.version) },
      body: change,
    }),
  );
}

export function useLocationOptions() {
  return useQuery({
    queryKey: [...LOCATIONS_KEY, 'options'],
    queryFn: async () => unwrap(await api.GET('/api/v1/masters/locations/options')),
    staleTime: 60_000,
  });
}

// ── Installations ─────────────────────────────────────────────────────────────

export const INSTALLATIONS_KEY = ['masters', 'installations'] as const;

export const installationsResource: MasterResource<Installation> = {
  pageKey: 'admin.installations',
  queryKey: [...INSTALLATIONS_KEY],
  path: '/api/v1/masters/installations',
  list: async (query) =>
    unwrap(await api.GET('/api/v1/masters/installations', { params: { query } })),
  deactivate: async (record, reason) =>
    unwrap(
      await api.POST('/api/v1/masters/installations/{id}/deactivate', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      }),
    ),
  // Reactivation goes through activation, which checks the required values again.
  reactivate: async (record, reason) => activateInstallation(record, reason),
  remove: async (record, reason) => {
    unwrap(
      await api.DELETE('/api/v1/masters/installations/{id}', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/masters/installations/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

export async function saveInstallation(
  record: Installation | null,
  create: InstallationInput,
  update: InstallationUpdate,
): Promise<Installation> {
  if (record) {
    return unwrap(
      await api.PATCH('/api/v1/masters/installations/{id}', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: update,
      }),
    );
  }
  return unwrap(await api.POST('/api/v1/masters/installations', { body: create }));
}

export async function activateInstallation(
  record: Installation,
  reason?: string,
): Promise<Installation> {
  return unwrap(
    await api.POST('/api/v1/masters/installations/{id}/activate', {
      params: { path: { id: record.id }, header: ifMatch(record.version) },
      body: reason ? { reason } : {},
    }),
  );
}

export async function syncInstallationCoordinates(record: Installation): Promise<Installation> {
  return unwrap(
    await api.POST('/api/v1/masters/installations/{id}/coordinates/sync', {
      params: { path: { id: record.id }, header: ifMatch(record.version) },
    }),
  );
}

export async function setInstallationServiceability(
  record: Installation,
  change: ServiceabilityChange,
): Promise<Installation> {
  return unwrap(
    await api.POST('/api/v1/masters/installations/{id}/serviceability', {
      params: { path: { id: record.id }, header: ifMatch(record.version) },
      body: change,
    }),
  );
}

export function useInstallationOptions() {
  return useQuery({
    queryKey: [...INSTALLATIONS_KEY, 'options'],
    queryFn: async () => unwrap(await api.GET('/api/v1/masters/installations/options')),
    staleTime: 60_000,
  });
}

export function useInstallationFiles(id: string) {
  return useQuery({
    queryKey: [...INSTALLATIONS_KEY, id, 'files'],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/masters/installations/{id}/attachments', {
          params: { path: { id } },
        }),
      ).items,
  });
}

export async function attachInstallationFiles(id: string, fileIds: string[]) {
  return unwrap(
    await api.POST('/api/v1/masters/installations/{id}/attachments', {
      params: { path: { id } },
      body: { fileIds },
    }),
  ).items;
}

export async function removeInstallationFile(id: string, fileId: string, reason: string) {
  return unwrap(
    await api.DELETE('/api/v1/masters/installations/{id}/attachments/{fileId}', {
      params: { path: { id, fileId } },
      body: { reason },
    }),
  ).items;
}

export async function fileLink(id: string) {
  return unwrap(await api.GET('/api/v1/files/{id}', { params: { path: { id } } })).download;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const ROUTES_KEY = ['masters', 'routes'] as const;

export const routesResource: MasterResource<Route> = {
  pageKey: 'admin.routes',
  queryKey: [...ROUTES_KEY],
  path: '/api/v1/masters/routes',
  list: async (query) => unwrap(await api.GET('/api/v1/masters/routes', { params: { query } })),
  deactivate: async (record, reason) =>
    unwrap(
      await api.POST('/api/v1/masters/routes/{id}/deactivate', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      }),
    ),
  reactivate: async (record, reason) =>
    unwrap(
      await api.POST('/api/v1/masters/routes/{id}/reactivate', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      }),
    ),
  remove: async (record, reason) => {
    unwrap(
      await api.DELETE('/api/v1/masters/routes/{id}', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/masters/routes/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

export async function saveRoute(
  record: Route | null,
  create: RouteInput,
  update: RouteUpdate,
): Promise<Route> {
  if (record) {
    return unwrap(
      await api.PATCH('/api/v1/masters/routes/{id}', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body: update,
      }),
    );
  }
  return unwrap(await api.POST('/api/v1/masters/routes', { body: create }));
}

export function useRouteOptions() {
  return useQuery({
    queryKey: [...ROUTES_KEY, 'options'],
    queryFn: async () => unwrap(await api.GET('/api/v1/masters/routes/options')),
    staleTime: 60_000,
  });
}

export function useRouteRevisions(id: string) {
  return useQuery({
    queryKey: [...ROUTES_KEY, id, 'revisions'],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/masters/routes/{id}/revisions', { params: { path: { id } } }))
        .items,
  });
}

/** The future journeys taking a location out of service would cancel (spec 10 §5.1, P-63). */
export function useAffectedJourneys(locationId: string | null) {
  return useQuery({
    queryKey: ['/api/v1/scheduling/locations', locationId, 'affected-journeys'],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/scheduling/locations/{id}/affected-journeys', {
          params: { path: { id: locationId ?? '' } },
        }),
      ),
    enabled: locationId !== null,
  });
}
