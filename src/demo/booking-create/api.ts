import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/errors';
import type {
  DemoAdHocRequest,
  DemoBookingRequest,
  DemoChargeCode,
  DemoFreight,
  DemoLocation,
  DemoMovement,
  DemoPassenger,
  Mode,
} from '../../mock/data/demo-booking-create';

const BASE = '/api/v1/demo/booking-create';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Options {
  today: string;
  locations: DemoLocation[];
  chargeCodes: DemoChargeCode[];
  reasons: string[];
  categories: string[];
  modes: Mode[];
}

export type DayMovement = DemoMovement & { movementId: string; travelDate: string; available: number };
export type MovementPage = Page<DayMovement> & { modeCounts: Record<string, number> };

/** The screens' calls go through `fetch`, which the demo's mock layer answers. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body: unknown = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw ApiError.from(response.status, body);
  return body as T;
}

const post = <T>(path: string, body: unknown) =>
  call<T>(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

type Query = Record<string, string | number | boolean | undefined>;
const qs = (query: Query) =>
  new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

export const bookingCreateKey = ['demo', 'booking-create'] as const;

export function useOptions() {
  return useQuery({
    queryKey: [...bookingCreateKey, 'options'],
    queryFn: () => call<Options>(`${BASE}/options`),
    staleTime: Infinity,
  });
}

export function usePassengers(query: Query, enabled = true) {
  const search = qs(query);
  return useQuery({
    queryKey: [...bookingCreateKey, 'passengers', search],
    queryFn: () => call<Page<DemoPassenger>>(`${BASE}/passengers?${search}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMovements(query: Query) {
  const search = qs(query);
  return useQuery({
    queryKey: [...bookingCreateKey, 'movements', search],
    queryFn: () => call<MovementPage>(`${BASE}/movements?${search}`),
    placeholderData: keepPreviousData,
  });
}

export function useFreight(query: Query) {
  const search = qs(query);
  return useQuery({
    queryKey: [...bookingCreateKey, 'freight', search],
    queryFn: () => call<Page<DemoFreight>>(`${BASE}/freight?${search}`),
    placeholderData: keepPreviousData,
  });
}

/** Every passenger matching a filter (Bulk Booking's "Select all"). */
export const fetchAllPassengers = (query: Query) =>
  call<Page<DemoPassenger>>(`${BASE}/passengers?${qs(query)}`).then((p) => p.items);

export const createBooking = (body: {
  passengerId: string;
  movementId: string;
  reason: string;
  chargeCode: string;
  specialRequirements: string;
}) => post<DemoBookingRequest>('/bookings', body);

export const createBulkBooking = (body: {
  movementId: string;
  reason: string;
  passengers: { passengerId: string; chargeCode: string }[];
}) => post<{ batch: string; items: DemoBookingRequest[] }>('/bookings/bulk', body);

export const createAdHocRequest = (body: {
  travelDate: string;
  from: string;
  to: string;
  mode: string;
  passengers: number;
  reason: string;
}) => post<DemoAdHocRequest>('/adhoc-requests', body);

export const createFreight = (body: Record<string, unknown>) => post<DemoFreight>('/freight', body);

/** The API's per-field messages from a 422, if any. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiError && error.details && typeof error.details === 'object') {
    const fields = (error.details as { fields?: Record<string, string> }).fields;
    if (fields) return fields;
  }
  return {};
}
