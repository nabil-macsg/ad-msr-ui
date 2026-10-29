import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { CodeMaster } from '../masters/code-master-api';
import type { Installation, Location, Route } from './places-api';

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });

const das: Location = {
  ...ref(1, 'DAS', 'Das Island'),
  locationType: { ...ref(11, 'ISLAND', 'Island'), isMobile: false, isOffshore: true },
  zone: ref(21, 'DAS', 'Das'),
  parent: null,
  subLocations: 0,
  coordinates: {
    lat: 25.158,
    lng: 52.872,
    source: 'integration',
    syncedAt: '2026-10-01T00:00:00Z',
  },
  pobLimit: 260,
  isHub: true,
  isResidencyReset: false,
  isComplex: true,
  hasAccommodation: true,
  focalPointName: 'Khalid Al Hosani',
  focalPointEmail: 'k.alhosani@masar.example',
  isServiceable: true,
  unserviceableReasonCode: null,
  unserviceableReason: null,
  unserviceableSince: null,
  isActive: true,
  deactivatedReason: null,
  version: 3,
  updatedAt: '2026-10-01T00:00:00Z',
};
const zirku: Location = {
  ...das,
  ...ref(2, 'ZRK', 'Zirku Island'),
  coordinates: null,
  isServiceable: false,
  unserviceableReasonCode: 'NOP-WEATHER',
  unserviceableReason: 'Heavy seas',
  unserviceableSince: '2026-10-13T04:00:00Z',
  version: 5,
};

const draft: Installation = {
  ...ref(31, 'DAS-HD-C', 'Das Island Helideck Charlie'),
  callsign: null,
  installationType: ref(41, 'HELIDECK', 'Heliport / helideck'),
  location: { ...ref(1, 'DAS', 'Das Island'), isMobile: false },
  material: null,
  dValue: 16,
  tValue: 12,
  gcaaClassOfUse: null,
  elevationM: null,
  coordinates: null,
  deckClass: null,
  minPerformanceClass: null,
  radioFrequency: null,
  deckHeightFt: null,
  ndb: null,
  heading: null,
  statusLights: false,
  firefighting: null,
  fuelAvailable: false,
  gpuAvailable: false,
  operator: null,
  riskLevel: null,
  lastOpsSurveyOn: null,
  unconfirmedFields: [],
  activationMissing: ['gcaaClassOfUse', 'elevationM', 'coordinates'],
  isServiceable: true,
  unserviceableReasonCode: null,
  unserviceableReason: null,
  unserviceableSince: null,
  status: 'draft',
  isActive: false,
  activatedAt: null,
  deactivatedReason: null,
  attachments: 0,
  version: 1,
  updatedAt: '2026-10-01T00:00:00Z',
};
const alpha: Installation = {
  ...draft,
  ...ref(32, 'DAS-HD-A', 'Das Island Helideck Alpha'),
  gcaaClassOfUse: 'PENDING',
  elevationM: 30,
  coordinates: { lat: 25.161, lng: 52.875, source: 'manual', syncedAt: null },
  unconfirmedFields: ['gcaaClassOfUse', 'elevationM', 'coordinates'],
  activationMissing: [],
  status: 'active',
  isActive: true,
  activatedAt: '2026-10-01T00:00:00Z',
  attachments: 1,
  version: 4,
};

const retired: Installation = {
  ...alpha,
  ...ref(33, 'DAS-HD-B', 'Das Island Helideck Bravo'),
  unconfirmedFields: [],
  status: 'deactivated',
  isActive: false,
  deactivatedReason: 'Deck repairs',
  isServiceable: false,
  unserviceableReasonCode: 'NOP-MAINT',
  unserviceableReason: 'Deck resurfacing',
  unserviceableSince: '2026-10-10T04:00:00Z',
  version: 7,
};
const photo = {
  id: id(72),
  purpose: 'installation-photo',
  fileName: 'deck.png',
  mimeType: 'image/png',
  sizeBytes: 16,
  sha256: 'b'.repeat(64),
  scanStatus: 'pending',
  uploadedAt: '2026-10-14T06:00:00Z',
  attached: false,
  download: null,
};

const acpt: Route = {
  ...ref(51, 'AUH-ACPT-MAR', 'Abu Dhabi → Upper Zakum → Lower Zakum → ACPT'),
  name: null,
  displayName: 'Abu Dhabi → Upper Zakum → Lower Zakum → ACPT',
  origin: ref(61, 'AUH', 'Abu Dhabi'),
  destination: ref(64, 'ACPT', 'ACPT'),
  points: [
    { ...ref(61, 'AUH', 'Abu Dhabi'), hasCoordinates: true },
    { ...ref(62, 'UZ', 'Upper Zakum'), hasCoordinates: true },
    { ...ref(63, 'LZ', 'Lower Zakum'), hasCoordinates: true },
    { ...ref(64, 'ACPT', 'ACPT'), hasCoordinates: true },
  ],
  legs: [99, 34.6, 18.8],
  distanceKm: 152.4,
  resourceCategory: 'MARINE',
  durationMinutes: 510,
  isExclusive: false,
  owningTeam: 'ACPT Logistics',
  revision: 2,
  isActive: true,
  deactivatedReason: null,
  version: 2,
  updatedAt: '2026-10-01T00:00:00Z',
};
const toBelbazem: Route = {
  ...acpt,
  ...ref(52, 'AUH-BLB-RW', 'Abu Dhabi → Belbazem Field'),
  displayName: 'Abu Dhabi → Belbazem Field',
  destination: ref(65, 'BLB', 'Belbazem Field'),
  points: [
    { ...ref(61, 'AUH', 'Abu Dhabi'), hasCoordinates: true },
    { ...ref(65, 'BLB', 'Belbazem Field'), hasCoordinates: false },
  ],
  legs: [null],
  distanceKm: null,
  resourceCategory: 'ROTARY-WING',
  revision: 1,
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

function stubPlaces(): Sent[] {
  const sent: Sent[] = [];
  stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .text()
        .then((text) => {
          let body: unknown = text;
          try {
            body = text ? (JSON.parse(text) as unknown) : undefined;
          } catch {
            // A multipart upload: kept as text.
          }
          sent.push({
            method: request.method,
            path,
            body,
            ifMatch: request.headers.get('if-match'),
          });
        });
      if (path === '/api/v1/files') return json(photo, 201);
      if (path.endsWith('/attachments') || path.includes('/attachments/'))
        return json({ items: [photo] });
      if (path.startsWith('/api/v1/masters/locations')) return json(das);
      if (path.startsWith('/api/v1/masters/installations')) return json(alpha);
      if (path.startsWith('/api/v1/masters/routes')) return json(acpt, 201);
      return json({ ...zone, version: 2 }, 201);
    }
    if (path.endsWith('/affected-journeys')) {
      return json({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000901',
            flightNumber: 'ADA101',
            serviceDate: '2026-10-25',
            departureAt: '2026-10-25T03:00:00.000Z',
            sourceRef: 'RS-001',
            booked: true,
          },
          {
            id: '00000000-0000-4000-8000-000000000902',
            flightNumber: 'ADA102',
            serviceDate: '2026-10-25',
            departureAt: null,
            sourceRef: 'RS-002',
            booked: false,
          },
        ],
      });
    }
    switch (path) {
      case '/api/v1/masters/zones':
        return json({ items: [zone], total: 1, page: 1, pageSize: 50 });
      case '/api/v1/masters/location-types':
        return json({ items: [rig], total: 1, page: 1, pageSize: 50 });
      case '/api/v1/masters/locations':
        return json({ items: [das, zirku], total: 2, page: 1, pageSize: 50 });
      case '/api/v1/masters/locations/options':
        return json({
          zones: [zone],
          locationTypes: [{ ...ref(11, 'ISLAND', 'Island'), isMobile: false }],
          locations: [ref(1, 'DAS', 'Das Island'), ref(2, 'ZRK', 'Zirku Island')],
        });
      case '/api/v1/reason-codes/options':
        return json({
          context: 'non-serviceable',
          mandatory: true,
          options: [
            { code: 'NOP-WEATHER', description: 'Weather / sea state', commentRequired: false },
          ],
        });
      case '/api/v1/masters/installations':
        return json({ items: [alpha, draft, retired], total: 3, page: 1, pageSize: 50 });
      case '/api/v1/masters/installations/options':
        return json({
          installationTypes: [ref(41, 'HELIDECK', 'Heliport / helideck')],
          locations: [ref(1, 'DAS', 'Das Island')],
        });
      case `/api/v1/masters/installations/${alpha.id}/attachments`:
        return json({
          items: [
            {
              id: id(71),
              purpose: 'installation-drawing',
              fileName: 'deck-plan.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 2048,
              sha256: 'a'.repeat(64),
              scanStatus: 'clean',
              uploadedAt: '2026-10-01T00:00:00Z',
              attached: true,
              download: null,
            },
          ],
        });
      case '/api/v1/masters/routes':
        return json({ items: [acpt, toBelbazem], total: 2, page: 1, pageSize: 50 });
      case '/api/v1/masters/routes/options':
        return json({
          locations: [
            { ...ref(61, 'AUH', 'Abu Dhabi'), hasCoordinates: true },
            { ...ref(62, 'UZ', 'Upper Zakum'), hasCoordinates: true },
            { ...ref(65, 'BLB', 'Belbazem Field'), hasCoordinates: false },
          ],
          categories: [
            { code: 'MARINE', name: 'Marine', weightUnit: 'kg' },
            { code: 'ROTARY-WING', name: 'Rotary wing', weightUnit: 'lb' },
          ],
        });
      case `/api/v1/masters/routes/${acpt.id}/revisions`:
        return json({
          items: [
            {
              revision: 2,
              createdAt: '2026-10-10T06:00:00Z',
              createdBy: 'Rashid Al Kindi',
              points: acpt.points.map(({ id: pid, code, name }) => ({ id: pid, code, name })),
            },
            {
              revision: 1,
              createdAt: '2026-09-01T06:00:00Z',
              createdBy: null,
              points: [ref(61, 'AUH', 'Abu Dhabi'), ref(64, 'ACPT', 'ACPT')],
            },
          ],
        });
      default:
        return undefined;
    }
  });
  return sent;
}

const zone: CodeMaster = {
  ...ref(21, 'DAS', 'Das'),
  isActive: true,
  deactivatedReason: null,
  version: 1,
  updatedAt: '2026-10-01T00:00:00Z',
};
const rig: CodeMaster = {
  ...zone,
  ...ref(12, 'RIG', 'Jack-up rig'),
  isMobile: true,
  isOffshore: true,
};

afterEach(() => vi.unstubAllGlobals());

describe('SPEC-10-5.1 zones, location types and installation types', () => {
  it('BRD-D.3.1.4-MST zones are only seen by those who may not change them', async () => {
    stubPlaces();
    renderApp('/admin/zones', { access: accessWith({ 'admin.zones': ['view'] }) });
    const table = await screen.findByRole('table', { name: 'Zones' });
    expect(await within(table).findByText('Das')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New zone' })).not.toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-D.3.1.5-MST a location type carries the mobile and offshore flags', async () => {
    const sent = stubPlaces();
    renderApp('/admin/location-types', {
      access: accessWith({ 'admin.location-types': EDITOR }),
    });
    const table = await screen.findByRole('table', { name: 'Location Types' });
    expect(await within(table).findByText('Mobile')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New location type' }));
    const form = await screen.findByRole('dialog', { name: 'New location type' });
    await user.type(within(form).getByLabelText('Code'), 'barge');
    await user.type(within(form).getByLabelText('Name'), 'Barge');
    await user.click(within(form).getByLabelText('Mobile: its positions can change'));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/location-types',
          body: { code: 'BARGE', name: 'Barge', isMobile: true, isOffshore: false },
        }),
      );
    });
  });
});

describe('BRD-D.3.1.1-MST the Locations page', () => {
  it('BRD-D.3.1.1-MST shows coordinates with their source, and why a location is out of service', async () => {
    stubPlaces();
    renderApp('/admin/locations', { access: accessWith({ 'admin.locations': EDITOR }) });
    const table = await screen.findByRole('table', { name: 'Locations' });
    expect(await within(table).findByText('Das Island')).toBeInTheDocument();
    expect(within(table).getByText('VIA GIS')).toBeInTheDocument();
    expect(within(table).getByText('No coordinates')).toBeInTheDocument();
    expect(within(table).getByText('NOP-WEATHER · Heavy seas')).toBeInTheDocument();
    await expectAccessible();
  });

  it('SPEC-10-5.1 taking a location out of service asks for a reason code and why', async () => {
    const sent = stubPlaces();
    renderApp('/admin/locations', { access: accessWith({ 'admin.locations': EDITOR }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Actions for DAS · Das Island' }));
    await user.click(screen.getByRole('menuitem', { name: 'Take out of service' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Take DAS · Das Island out of service?',
    });
    expect(
      within(dialog).getByText(/Its future journeys are cancelled with your reason/),
    ).toBeInTheDocument();
    // P-63: what it would cancel, before confirming.
    expect(await within(dialog).findByText('Journeys to be cancelled: 2')).toBeInTheDocument();
    expect(within(dialog).getByText('ADA101 · 25 Oct 2026 · has bookings')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        '1 with bookings stay cancelled when it returns, for their passengers to be moved.',
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Why'), 'Heavy seas all week');
    await user.click(within(dialog).getByRole('button', { name: 'Take out of service' }));
    expect(await within(dialog).findByText('Choose a reason code')).toBeInTheDocument();
    await within(dialog).findByRole('option', { name: 'NOP-WEATHER · Weather / sea state' });
    await user.selectOptions(within(dialog).getByLabelText('Reason code'), 'NOP-WEATHER');
    await user.click(within(dialog).getByRole('button', { name: 'Take out of service' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/masters/locations/${das.id}/serviceability`,
        body: { serviceable: false, reason: 'Heavy seas all week', reasonCode: 'NOP-WEATHER' },
        ifMatch: '3',
      });
    });
  });

  it('BRD-C.4.2-37 moving coordinates already set needs a reason; GIS can supply them', async () => {
    const sent = stubPlaces();
    renderApp('/admin/locations', { access: accessWith({ 'admin.locations': EDITOR }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Actions for DAS · Das Island' }));
    await user.click(screen.getByRole('menuitem', { name: 'Get coordinates from GIS' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          path: `/api/v1/masters/locations/${das.id}/coordinates/sync`,
          ifMatch: '3',
        }),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Actions for DAS · Das Island' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Das Island' });
    const lat = within(form).getByLabelText('Latitude');
    await user.clear(lat);
    await user.type(lat, '25.2');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Give a reason for changing the coordinates'),
    ).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Why the coordinates change'), 'Surveyed again');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'PATCH',
          path: `/api/v1/masters/locations/${das.id}`,
          body: expect.objectContaining({
            coordinates: { lat: 25.2, lng: 52.872 },
            reason: 'Surveyed again',
          }) as unknown,
        }),
      );
    });
  });
});

describe('BRD-D.3.1.2-MST the Installations page', () => {
  it('P-53 flags placeholder values, and drafts show what activation still needs', async () => {
    stubPlaces();
    renderApp('/admin/installations', { access: accessWith({ 'admin.installations': EDITOR }) });
    const table = await screen.findByRole('table', { name: 'Installations' });
    expect(await within(table).findByText('Pending AvTech confirmation')).toBeInTheDocument();
    expect(within(table).getByText('Draft')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Actions for DAS-HD-C · Das Island Helideck Charlie' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Activate' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Activate DAS-HD-C · Das Island Helideck Charlie?',
    });
    expect(
      within(dialog).getByText(
        'Enter the GCAA class of use, elevation, and coordinates before activating.',
      ),
    ).toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-C.4.2-31 an edit carries its reason and can confirm placeholders as they are', async () => {
    const sent = stubPlaces();
    renderApp('/admin/installations', { access: accessWith({ 'admin.installations': EDITOR }) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for DAS-HD-A · Das Island Helideck Alpha',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Das Island Helideck Alpha' });
    expect(
      within(form).getByText(
        'Pending Aviation Technical confirmation: GCAA class of use, elevation, and coordinates',
      ),
    ).toBeInTheDocument();
    expect(
      within(form).getByText(
        'Acceptance and test validity come from helideck inspections: not recorded yet.',
      ),
    ).toBeInTheDocument();
    await user.click(within(form).getByRole('checkbox', { name: 'elevation' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Give a reason, in at least 3 characters'),
    ).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Reason for the change'), 'AvTech confirmed');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'PATCH',
        path: `/api/v1/masters/installations/${alpha.id}`,
        body: { confirmed: ['elevationM'], reason: 'AvTech confirmed' },
        ifMatch: '4',
      });
    });
  });

  it('BRD-C.4.2-31 lists an installation’s drawings and photos', async () => {
    stubPlaces();
    renderApp('/admin/installations', { access: accessWith({ 'admin.installations': EDITOR }) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for DAS-HD-A · Das Island Helideck Alpha',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Drawings and photos' }));
    const drawer = await screen.findByRole('dialog', {
      name: 'Drawings and photos of Das Island Helideck Alpha',
    });
    expect(await within(drawer).findByText('deck-plan.pdf')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(within(drawer).getByText('Add photos')).toBeInTheDocument();
  });
});

describe('BRD-C.5.2-CM installation lifecycle and files', () => {
  it('BRD-C.5.2-CM reactivating a deactivated installation asks for a reason', async () => {
    const sent = stubPlaces();
    renderApp('/admin/installations', { access: accessWith({ 'admin.installations': EDITOR }) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for DAS-HD-B · Das Island Helideck Bravo',
      }),
    );
    expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Reactivate' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Activate DAS-HD-B · Das Island Helideck Bravo?',
    });
    await user.type(within(dialog).getByLabelText('Reason'), 'Repairs complete');
    await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/masters/installations/${retired.id}/activate`,
        body: { reason: 'Repairs complete' },
        ifMatch: '7',
      });
    });
  });

  it('SPEC-10-5.1 an installation returns to service with why, and no reason code', async () => {
    const sent = stubPlaces();
    renderApp('/admin/installations', { access: accessWith({ 'admin.installations': EDITOR }) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for DAS-HD-B · Das Island Helideck Bravo',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Return to service' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Return DAS-HD-B · Das Island Helideck Bravo to service?',
    });
    expect(within(dialog).queryByLabelText('Reason code')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Why'), 'Deck resurfaced');
    await user.click(within(dialog).getByRole('button', { name: 'Return to service' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/masters/installations/${retired.id}/serviceability`,
        body: { serviceable: true, reason: 'Deck resurfaced' },
        ifMatch: '7',
      });
    });
  });

  it('BRD-C.4.2-31 uploads photos, attaches them, and removes a file with a reason', async () => {
    const sent = stubPlaces();
    renderApp('/admin/installations', { access: accessWith({ 'admin.installations': EDITOR }) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for DAS-HD-A · Das Island Helideck Alpha',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Drawings and photos' }));
    const drawer = await screen.findByRole('dialog', {
      name: 'Drawings and photos of Das Island Helideck Alpha',
    });
    await within(drawer).findByText('deck-plan.pdf');
    const [, photos] = within(drawer).getAllByLabelText('choose files');
    if (!photos) throw new Error('no photo input');
    await user.upload(
      photos,
      new File([new Uint8Array([0x89, 0x50])], 'deck.png', { type: 'image/png' }),
    );
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: `/api/v1/masters/installations/${alpha.id}/attachments`,
          body: { fileIds: [photo.id] },
        }),
      );
    });
    expect(sent.some((s) => s.path === '/api/v1/files')).toBe(true);

    await user.click(within(drawer).getByRole('button', { name: 'Remove' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remove deck-plan.pdf?' });
    await user.type(within(confirm).getByLabelText('Reason'), 'Superseded drawing');
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'DELETE',
          path: `/api/v1/masters/installations/${alpha.id}/attachments/${id(71)}`,
          body: { reason: 'Superseded drawing' },
        }),
      );
    });
  });
});

describe('BRD-D.3.1.3-MST the Routes page', () => {
  it('SPEC-10-5.1 shows each route’s distance, or that a stop has no coordinates', async () => {
    stubPlaces();
    renderApp('/admin/routes', { access: accessWith({ 'admin.routes': EDITOR }) });
    const table = await screen.findByRole('table', { name: 'Routes' });
    expect(await within(table).findByText('152.4 km')).toBeInTheDocument();
    expect(within(table).getByText('A stop has no coordinates')).toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-D.3.1.3-MST keeps every revision of a route’s path', async () => {
    stubPlaces();
    renderApp('/admin/routes', { access: accessWith({ 'admin.routes': EDITOR }) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for AUH-ACPT-MAR · Abu Dhabi → Upper Zakum → Lower Zakum → ACPT',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Revisions' }));
    const drawer = await screen.findByRole('dialog', { name: /Revisions of AUH-ACPT-MAR/ });
    expect(await within(drawer).findByText('Revision 2')).toBeInTheDocument();
    expect(within(drawer).getByText('Abu Dhabi → ACPT')).toBeInTheDocument();
  });

  it('BRD-D.3.1.3-MST a new route sends its points in order and warns about a stop without coordinates', async () => {
    const sent = stubPlaces();
    renderApp('/admin/routes', { access: accessWith({ 'admin.routes': EDITOR }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New route' }));
    const form = await screen.findByRole('dialog', { name: 'New route' });
    await user.type(within(form).getByLabelText('Code'), 'auh-blb-rw');
    await within(form).findAllByRole('option', { name: 'Abu Dhabi (AUH)' });
    await user.selectOptions(within(form).getByLabelText('Origin'), id(61));
    await user.selectOptions(within(form).getByLabelText('Destination'), id(65));
    expect(await within(form).findByText('A stop has no coordinates')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Add a stop' }));
    await user.selectOptions(within(form).getByLabelText('Stop 1'), id(62));
    await user.selectOptions(within(form).getByLabelText('Resource category'), 'ROTARY-WING');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/routes',
          body: expect.objectContaining({
            code: 'AUH-BLB-RW',
            points: [id(61), id(62), id(65)],
            resourceCategory: 'ROTARY-WING',
          }) as unknown,
        }),
      );
    });
  });
});
