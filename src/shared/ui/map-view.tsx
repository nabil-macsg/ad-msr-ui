import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tone } from './tone';

export interface MapMarker {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly tone?: Tone;
}

export interface MapViewProps {
  readonly markers: readonly MapMarker[];
  /** From runtime config (ADR-0011). Without a tile URL the map shows markers on a plain canvas. */
  readonly tiles: { readonly url: string; readonly attribution: string };
  readonly center?: readonly [number, number];
  readonly zoom?: number;
  readonly height?: number;
  readonly onSelect?: (id: string) => void;
}

/** The ADNOC offshore area. */
const DEFAULT_CENTER: [number, number] = [24.6, 53.4];

/**
 * Leaflet map (PROMPT §4.2). Leaflet (BSD-2) is used directly: react-leaflet's licence is not on
 * the allow-list (ADR-0035). Markers are keyboard reachable, and listed for screen readers.
 */
export function MapView({
  markers,
  tiles,
  center = DEFAULT_CENTER,
  zoom = 8,
  height = 420,
  onSelect,
}: MapViewProps) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { center: [center[0], center[1]], zoom });
    if (tiles.url)
      L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 18 }).addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
    // The map is created once; markers update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    for (const marker of markers) {
      L.marker([marker.lat, marker.lng], {
        title: marker.label,
        alt: marker.label,
        keyboard: true,
        icon: L.divIcon({
          className: '',
          html: `<span class="block size-4 rounded-full border-2 border-white shadow" style="background: var(--color-${marker.tone ?? 'info'}-fg)"></span>`,
          iconSize: [16, 16],
        }),
      })
        .on('click', () => select.current?.(marker.id))
        .addTo(group);
    }
  }, [markers]);

  return (
    <div>
      <div
        ref={container}
        role="region"
        aria-label={t('ui.map.region')}
        style={{ height }}
        className="z-0 overflow-hidden rounded-lg border border-border bg-surface-muted"
      />
      <ul className="sr-only">
        {markers.map((m) => (
          <li key={m.id}>{m.label}</li>
        ))}
      </ul>
    </div>
  );
}
