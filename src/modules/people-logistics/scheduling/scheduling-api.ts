import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';

type Schemas = components['schemas'];
export type RecurringSchedule = Schemas['RecurringSchedule'];
export type ScheduleOptions = Schemas['RecurringScheduleOptions'];
export type SchedulePreview = Schemas['RecurringSchedulePreview'];
export type PreviewInput = Schemas['RecurringSchedulePreviewInput'];
export type Mode = RecurringSchedule['mode'];

export const SCHEDULES_PATH = '/api/v1/scheduling/recurring-schedules';
export const MODES = [
  'fixed-wing',
  'rotary-wing',
  'ferry',
  'crew-boat',
] as const satisfies readonly Mode[];
export type BaseMode = ScheduleOptions['routes'][number]['baseMode'];
/** The base mode a mode belongs to: a route carries it if its category has that base mode. */
const BASE_MODE: Readonly<Record<Mode, BaseMode>> = {
  'fixed-wing': 'fixed-wing',
  'rotary-wing': 'rotary-wing',
  ferry: 'marine',
  'crew-boat': 'marine',
};
export const baseModeOf = (mode: Mode) => BASE_MODE[mode];
export const modesOf = (baseMode: BaseMode): Mode[] =>
  MODES.filter((m) => BASE_MODE[m] === baseMode);

const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export function useScheduleOptions() {
  return useQuery({
    queryKey: [SCHEDULES_PATH, 'options'],
    queryFn: async () => unwrap(await api.GET('/api/v1/scheduling/recurring-schedules/options')),
    staleTime: 60_000,
  });
}

export async function saveSchedule(
  record: RecurringSchedule | null,
  body: Schemas['RecurringScheduleInput'] | Schemas['RecurringScheduleUpdate'],
) {
  if (record) {
    return unwrap(
      await api.PATCH('/api/v1/scheduling/recurring-schedules/{id}', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body,
      }),
    );
  }
  return unwrap(
    await api.POST('/api/v1/scheduling/recurring-schedules', {
      body: body as Schemas['RecurringScheduleInput'],
    }),
  );
}

/** The live preview: what the form would make (spec 20 §2.1). */
export function usePreview(input: PreviewInput | null) {
  return useQuery({
    queryKey: [SCHEDULES_PATH, 'preview', input],
    queryFn: async () =>
      unwrap(
        await api.POST('/api/v1/scheduling/recurring-schedules/preview', {
          body: input ?? undefined,
        }),
      ),
    enabled: input !== null,
    staleTime: 10_000,
  });
}

export function useReassignment(id: string | null) {
  return useQuery({
    queryKey: [SCHEDULES_PATH, 'reassignment', id],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/scheduling/recurring-schedules/{id}/reassignment', {
          params: { path: { id: id ?? '' } },
        }),
      ),
    enabled: id !== null,
  });
}

export type Journey = Schemas['Journey'];
export type SchedulingDashboard = Schemas['SchedulingDashboard'];

export function useSchedulingDashboard() {
  return useQuery({
    queryKey: ['/api/v1/scheduling/dashboard'],
    queryFn: async () => unwrap(await api.GET('/api/v1/scheduling/dashboard')),
    refetchInterval: 60_000,
  });
}

export async function listJourneys(query: Readonly<Record<string, string | number | boolean>>) {
  return unwrap(await api.GET('/api/v1/scheduling/journeys', { params: { query } }));
}

export type PlanningBoard = Schemas['PlanningBoard'];
export const BOARD_PATH = '/api/v1/scheduling/planning-board';

/** The Planning Board's journeys and weather for a range of days (spec 20 §2.1). */
export function usePlanningBoard(query: {
  from: string;
  to: string;
  category?: string | undefined;
}) {
  return useQuery({
    queryKey: [BOARD_PATH, query],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/scheduling/planning-board', {
          params: {
            query: {
              from: query.from,
              to: query.to,
              ...(query.category ? { category: query.category } : {}),
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Gives a journey the departure time its schedule leaves open (A.3.3-03). */
export async function assignDepartureTime(
  journey: Journey,
  body: { departureTime: string; arrivalTime: string | null },
) {
  return unwrap(
    await api.POST('/api/v1/scheduling/journeys/{id}/departure-time', {
      params: { path: { id: journey.id }, header: ifMatch(journey.version) },
      body,
    }),
  );
}

export type UnscheduledRequest = Schemas['UnscheduledRequest'];
export const UNSCHEDULED_PATH = '/api/v1/scheduling/unscheduled-requests';

/** Requests no movement has taken up yet (A.2.3.2-10, A.3.3-05). */
export async function listUnscheduled(query: Readonly<Record<string, string | number | boolean>>) {
  return unwrap(await api.GET('/api/v1/scheduling/unscheduled-requests', { params: { query } }));
}

export type AdhocMovement = Schemas['AdhocMovement'];
export type Suggestion = Schemas['ConsolidationSuggestion'];
export const ADHOC_PATH = '/api/v1/scheduling/adhoc-movements';

export function useAdhocOptions() {
  return useQuery({
    queryKey: [ADHOC_PATH, 'options'],
    queryFn: async () => unwrap(await api.GET('/api/v1/scheduling/adhoc-movements/options')),
    staleTime: 60_000,
  });
}

export async function saveAdhoc(
  record: AdhocMovement | null,
  body: Schemas['AdhocMovementInput'] | Schemas['AdhocMovementUpdate'],
) {
  if (record) {
    return unwrap(
      await api.PATCH('/api/v1/scheduling/adhoc-movements/{id}', {
        params: { path: { id: record.id }, header: ifMatch(record.version) },
        body,
      }),
    );
  }
  return unwrap(
    await api.POST('/api/v1/scheduling/adhoc-movements', {
      body: body as Schemas['AdhocMovementInput'],
    }),
  );
}

/** Movements the chosen unscheduled requests could share (spec 20 §2.1 consolidation). */
export function useSuggestion(requestIds: readonly string[]) {
  return useQuery({
    queryKey: [ADHOC_PATH, 'suggest', requestIds],
    queryFn: async () =>
      unwrap(
        await api.POST('/api/v1/scheduling/adhoc-movements/suggest', {
          body: { requestIds: [...requestIds] },
        }),
      ),
    enabled: requestIds.length > 0,
  });
}

export type Premanifest = Schemas['Premanifest'];
export type PremanifestLine = Schemas['PremanifestLine'];
export type PremanifestDay = Schemas['PremanifestDay'];
export const PREMANIFEST_PATH = '/api/v1/scheduling/premanifest';

/** A day's journeys with the state of their pre-manifests. */
export function usePremanifestDay(date: string) {
  return useQuery({
    queryKey: [PREMANIFEST_PATH, 'day', date],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/scheduling/premanifest', { params: { query: { date } } })),
    placeholderData: keepPreviousData,
  });
}

export function usePremanifest(journeyId: string | null) {
  return useQuery({
    queryKey: [PREMANIFEST_PATH, journeyId],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/scheduling/premanifest/{journeyId}', {
          params: { path: { journeyId: journeyId ?? '' } },
        }),
      ),
    enabled: journeyId !== null,
  });
}

/** Suggests the pre-manifest now, replacing the draft (P-64). */
export async function refreshPremanifest(journeyId: string) {
  return unwrap(
    await api.POST('/api/v1/scheduling/premanifest/{journeyId}', {
      params: { path: { journeyId } },
    }),
  );
}

export async function adjustPremanifest(
  journeyId: string,
  version: number,
  body: Schemas['PremanifestAdjustment'],
) {
  return unwrap(
    await api.POST('/api/v1/scheduling/premanifest/{journeyId}/adjust', {
      params: { path: { journeyId }, header: ifMatch(version) },
      body,
    }),
  );
}

export async function reservePremanifest(journeyId: string, version: number, seats: number) {
  return unwrap(
    await api.POST('/api/v1/scheduling/premanifest/{journeyId}/reserve', {
      params: { path: { journeyId }, header: ifMatch(version) },
      body: { seats },
    }),
  );
}

export async function publishPremanifest(journeyId: string, version: number) {
  return unwrap(
    await api.POST('/api/v1/scheduling/premanifest/{journeyId}/publish', {
      params: { path: { journeyId }, header: ifMatch(version) },
    }),
  );
}
