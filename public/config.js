// MASAR UI demo runtime settings. No secrets and no server addresses: the demo uses mock data.
window.__MASAR_CONFIG__ = {
  environment: 'demo',
  features: { ai: false },
  supportPortalUrl: null,
  // Local development only, at low volume (ADR-0011). Azure environments use Azure Maps (P-09).
  map: {
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};
