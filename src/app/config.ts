/** Settings for this environment, read from /config.js (no secrets). */
export function runtimeConfig(): MasarRuntimeConfig {
  const raw = window.__MASAR_CONFIG__ ?? {};
  return {
    environment: raw.environment ?? 'unknown',
    features: { ai: raw.features?.ai === true },
    supportPortalUrl: raw.supportPortalUrl ?? null,
    map: {
      tileUrl: raw.map?.tileUrl ?? '',
      attribution: raw.map?.attribution ?? '',
    },
  };
}
