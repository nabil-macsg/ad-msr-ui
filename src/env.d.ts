/// <reference types="vite/client" />

/** True only on the local dev server: the persona switcher (ADR-0013) and the component gallery. */
declare const __MASAR_DEV_TOOLS__: boolean;

interface MasarRuntimeConfig {
  readonly environment: string;
  readonly features: { readonly ai: boolean };
  readonly supportPortalUrl: string | null;
  /** Map tiles (ADR-0011): OpenStreetMap locally, Azure Maps in Azure environments. */
  readonly map: { readonly tileUrl: string; readonly attribution: string };
}

interface Window {
  __MASAR_CONFIG__?: Partial<MasarRuntimeConfig>;
}
