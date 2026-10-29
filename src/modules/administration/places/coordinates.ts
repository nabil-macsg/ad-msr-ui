import type { StoredCoordinates } from './place-bits';

/** The coordinate inputs' text, for a form: blank when there are none. */
export const coordinateText = (c: StoredCoordinates | null) => ({
  lat: c ? String(c.lat) : '',
  lng: c ? String(c.lng) : '',
});

/**
 * Reads the two coordinate inputs: undefined when unchanged, null when cleared, the point when
 * set; 'invalid' when only one is given or either is out of range.
 */
export function readCoordinates(
  text: { lat: string; lng: string },
  current: StoredCoordinates | null,
): { lat: number; lng: number } | null | undefined | 'invalid' {
  const lat = text.lat.trim();
  const lng = text.lng.trim();
  if (lat === '' && lng === '') return current ? null : undefined;
  const point = { lat: Number(lat), lng: Number(lng) };
  if (
    lat === '' ||
    lng === '' ||
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    Math.abs(point.lat) > 90 ||
    Math.abs(point.lng) > 180
  )
    return 'invalid';
  if (current && current.lat === point.lat && current.lng === point.lng) return undefined;
  return point;
}
