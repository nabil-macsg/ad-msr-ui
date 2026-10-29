import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { AircraftModel, FleetUnit, Quota, ResourceType } from './resources-api';

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];
const ADMIN: Right[] = [...EDITOR, 'delete'];
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });
const meta = { isActive: true, deactivatedReason: null, updatedAt: '2026-10-01T00:00:00Z' };

const dash8: ResourceType = {
  ...ref(1, 'DASH8-300', 'Dash 8-300'),
  category: { code: 'FIXED-WING', name: 'Fixed wing', weightUnit: 'kg' },
  aircraftModel: null,
  passengerCapacity: 50,
  seatMap: { rows: 13, seatsPerRow: 4, aisleAfter: 2 },
  baggageAllowanceKg: 23,
  payloadKg: 5500,
  openSeating: false,
  loadsheetRequired: true,
  fleet: 2,
  ...meta,
  version: 1,
};
const aw139: AircraftModel = {
  ...ref(2, 'AW139', 'AW139'),
  category: 'ROTARY-WING',
  requiredDM: 13.8,
  requiredTT: 6.4,
  performanceClass: null,
  weightUnit: 'lb',
  unconfirmedFields: ['requiredDM', 'requiredTT'],
  resourceTypes: 1,
  ...meta,
  version: 3,
};
const aw169: AircraftModel = {
  ...aw139,
  ...ref(3, 'AW169', 'AW169'),
  requiredDM: null,
  requiredTT: null,
  unconfirmedFields: [],
  resourceTypes: 0,
};
const dash8Specs = {
  passengerCapacity: 50,
  seatMap: dash8.seatMap,
  baggageAllowanceKg: 23,
  payloadKg: 5500,
  openSeating: false,
};
const aw139Helideck = {
  aircraftModel: ref(2, 'AW139', 'AW139'),
  requiredDM: 13.8,
  requiredTT: 6.4,
  performanceClass: null,
};
const FLEET_TYPES = [
  {
    ...ref(1, 'DASH8-300', 'Dash 8-300'),
    category: 'FIXED-WING',
    baseMode: 'fixed-wing',
    specs: dash8Specs,
    helideck: null,
  },
  {
    ...ref(4, 'AW139', 'AW139 helicopter'),
    category: 'ROTARY-WING',
    baseMode: 'rotary-wing',
    specs: {
      ...dash8Specs,
      passengerCapacity: 12,
      seatMap: { rows: 3, seatsPerRow: 4, aisleAfter: null },
    },
    helideck: aw139Helideck,
  },
  {
    ...ref(5, 'FAST-CREW-BOAT', 'Fast crew boat'),
    category: 'MARINE',
    baseMode: 'marine',
    specs: { ...dash8Specs, passengerCapacity: 40, seatMap: null, openSeating: true },
    helideck: null,
  },
] as const;
const ada: FleetUnit = {
  id: id(10),
  registration: 'A6-ADA',
  resourceType: {
    ...ref(1, 'DASH8-300', 'Dash 8-300'),
    category: 'FIXED-WING',
    baseMode: 'fixed-wing',
  },
  serviceProvider: ref(20, 'ADA', 'Abu Dhabi Aviation'),
  availability: 'available',
  isBookable: true,
  overrides: { passengerCapacity: 48 },
  effective: { ...dash8Specs, passengerCapacity: 48 },
  helideck: null,
  ...meta,
  version: 2,
};
const quota: Quota = {
  id: id(30),
  code: 'Q-DASH8-300-VIP',
  appliesTo: { dimension: 'passenger-category', record: ref(40, 'VIP', 'VIP') },
  scope: { kind: 'resource-type', record: ref(1, 'DASH8-300', 'Dash 8-300') },
  period: 'flight',
  seatLimit: 1,
  warningPct: 80,
  validFrom: '2026-01-01',
  validTo: null,
  ...meta,
  version: 1,
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

const CATEGORY_OPTIONS = [
  { code: 'FIXED-WING', name: 'Fixed wing', weightUnit: 'kg', baseMode: 'fixed-wing' },
  { code: 'HOVERCRAFT', name: 'Hovercraft', weightUnit: 'kg', baseMode: 'marine' },
  { code: 'MARINE', name: 'Marine', weightUnit: 'kg', baseMode: 'marine' },
  { code: 'ROTARY-WING', name: 'Rotary wing', weightUnit: 'lb', baseMode: 'rotary-wing' },
] as const;

function stubResources(): Sent[] {
  const sent: Sent[] = [];
  const page = (items: unknown[]) => json({ items, total: items.length, page: 1, pageSize: 50 });
  stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .text()
        .then((text) => {
          sent.push({
            method: request.method,
            path,
            body: text ? (JSON.parse(text) as unknown) : undefined,
            ifMatch: request.headers.get('if-match'),
          });
        });
      return json({}, 201);
    }
    switch (path) {
      case '/api/v1/masters/resource-categories':
        return page([
          {
            ...ref(50, 'ROTARY-WING', 'Rotary wing'),
            weightUnit: 'lb',
            ...meta,
            version: 1,
          },
          {
            ...ref(51, 'HOVERCRAFT', 'Hovercraft'),
            weightUnit: 'kg',
            ...meta,
            version: 2,
          },
        ]);
      case '/api/v1/masters/resource-types':
        return page([dash8]);
      case '/api/v1/masters/resource-types/options':
        return json({
          categories: CATEGORY_OPTIONS,
          aircraftModels: [{ ...ref(2, 'AW139', 'AW139'), category: 'ROTARY-WING' }],
        });
      case '/api/v1/masters/aircraft-models':
        return page([aw139, aw169]);
      case '/api/v1/masters/aircraft-models/options':
        return json({ categories: CATEGORY_OPTIONS.filter((c) => c.baseMode !== 'marine') });
      case '/api/v1/masters/fleet':
        return page([ada]);
      case '/api/v1/masters/fleet/options':
        return json({
          resourceTypes: FLEET_TYPES,
          serviceProviders: [ref(20, 'ADA', 'Abu Dhabi Aviation')],
          categories: CATEGORY_OPTIONS,
        });
      case '/api/v1/masters/quotas':
        return page([quota]);
      case '/api/v1/masters/quotas/options':
        return json({
          department: [],
          location: [],
          zone: [ref(60, 'DAS', 'Das')],
          'service-provider': [],
          'passenger-category': [ref(40, 'VIP', 'VIP')],
          'resource-type': [ref(1, 'DASH8-300', 'Dash 8-300')],
          route: [ref(70, 'AUH-DAS-FW', 'Abu Dhabi → Das Island')],
        });
      case '/api/v1/masters/fuel-stations':
        return page([]);
      case '/api/v1/masters/fuel-stations/options':
        return json({ location: [ref(80, 'ZRK', 'Zirku Island')] });
      case '/api/v1/masters/cargo-types':
        return page([]);
      default:
        return undefined;
    }
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe('SPEC-10-5.1 resource masters on the web', () => {
  it('BRD-D.3.1.7-MST an administrator adds a resource category', async () => {
    const sent = stubResources();
    renderApp('/admin/resource-categories', {
      access: accessWith({ 'admin.resource-categories': ADMIN }),
    });
    const table = await screen.findByRole('table', { name: 'Resource Categories' });
    expect(await within(table).findByText('Pounds (lb)')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New resource category' }));
    const created = await screen.findByRole('dialog', { name: 'New resource category' });
    await user.type(within(created).getByLabelText('Code'), 'hovercraft');
    await user.type(within(created).getByLabelText('Name'), 'Hovercraft');
    await user.click(within(created).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/resource-categories',
          body: { code: 'HOVERCRAFT', name: 'Hovercraft', weightUnit: 'kg' },
        }),
      );
    });
  });

  it('BRD-D.3.1.7-MST a built-in category is edited but never deleted or deactivated', async () => {
    const sent = stubResources();
    renderApp('/admin/resource-categories', {
      access: accessWith({ 'admin.resource-categories': ADMIN }),
    });
    const table = await screen.findByRole('table', { name: 'Resource Categories' });
    expect(await within(table).findByText('Pounds (lb)')).toBeInTheDocument();
    const user = userEvent.setup();
    // An added category offers Delete and Deactivate.
    await user.click(screen.getByRole('button', { name: 'Actions for HOVERCRAFT · Hovercraft' }));
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Deactivate' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Actions for ROTARY-WING · Rotary wing' }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Rotary wing' });
    // The page shows the BRD's fields only: no base mode.
    expect(within(form).queryByLabelText('Base mode')).not.toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('Weight unit'), 'kg');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'PATCH',
          path: `/api/v1/masters/resource-categories/${id(50)}`,
          body: { name: 'Rotary wing', weightUnit: 'kg' },
        }),
      );
    });
    await expectAccessible();
  });

  it('BRD-D.3.1.8-MST resource types show their seat map; a marine-based type seats openly', async () => {
    const sent = stubResources();
    renderApp('/admin/resource-types', { access: accessWith({ 'admin.resource-types': EDITOR }) });
    const table = await screen.findByRole('table', { name: 'Resource Types' });
    expect(await within(table).findByText('13 × 4, aisle after 2')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New resource type' }));
    const form = await screen.findByRole('dialog', { name: 'New resource type' });
    await user.type(within(form).getByLabelText('Code'), 'ferry-2');
    await user.type(within(form).getByLabelText('Name'), 'Ferry Mk 2');
    // Hovercraft is an added category based on marine: it behaves as marine does.
    await user.selectOptions(within(form).getByLabelText('Category'), 'HOVERCRAFT');
    expect(within(form).queryByLabelText('Aircraft model')).not.toBeInTheDocument();
    await user.click(within(form).getByLabelText('Open seating (marine): no seat map'));
    expect(within(form).queryByLabelText('Rows')).not.toBeInTheDocument();
    await user.type(within(form).getByLabelText('Passenger capacity'), '120');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/resource-types',
          body: expect.objectContaining({
            code: 'FERRY-2',
            category: 'HOVERCRAFT',
            passengerCapacity: 120,
            openSeating: true,
            seatMap: null,
            loadsheetRequired: false,
            aircraftModelId: null,
          }) as unknown,
        }),
      );
    });
  });

  it('P-20 aircraft models flag pending and unrecorded D and T; an edit carries its reason', async () => {
    const sent = stubResources();
    renderApp('/admin/aircraft-models', {
      access: accessWith({ 'admin.aircraft-models': EDITOR }),
    });
    const table = await screen.findByRole('table', { name: 'Aircraft Models' });
    expect(await within(table).findAllByText('Pending AvTech confirmation')).toHaveLength(2);
    expect(within(table).getAllByText('Not recorded')).toHaveLength(2);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for AW139 · AW139' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit AW139' });
    await user.click(within(form).getByRole('checkbox', { name: 'Required D-value' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Give a reason, in at least 3 characters'),
    ).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Reason for the change'), 'AvTech letter');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'PATCH',
          path: `/api/v1/masters/aircraft-models/${aw139.id}`,
          body: {
            name: 'AW139',
            category: 'ROTARY-WING',
            performanceClass: null,
            weightUnit: 'lb',
            confirmed: ['requiredDM'],
            reason: 'AvTech letter',
          },
          ifMatch: '3',
        }),
      );
    });
  });

  it('BRD-D.3.2.1-MST a fleet unit shows its own seat capacity; a retired one is never bookable', async () => {
    const sent = stubResources();
    renderApp('/admin/fleet', { access: accessWith({ 'admin.fleet': EDITOR }) });
    const table = await screen.findByRole('table', { name: 'Fleet' });
    expect(await within(table).findByText('(own value)')).toBeInTheDocument();
    expect(within(table).getByText('Available')).toBeInTheDocument();
    expect(within(table).getByText(/Fixed wing · Air/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for A6-ADA · Dash 8-300' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit A6-ADA' });
    await within(form).findByRole('option', { name: 'Dash 8-300' });
    expect(within(form).getByLabelText('Resource category')).toHaveValue('FIXED-WING');
    expect(within(form).getByLabelText('Seat capacity')).toHaveValue('48');
    expect(within(form).getByText('13 × 4, aisle after 2')).toBeInTheDocument();
    expect(within(form).queryByText('Helideck compatibility')).not.toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('Availability'), 'retired');
    expect(within(form).queryByLabelText('Bookable')).not.toBeInTheDocument();
    expect(within(form).getByText(/never offered for new journeys again/)).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'PATCH',
          path: `/api/v1/masters/fleet/${ada.id}`,
          body: {
            resourceTypeId: ada.resourceType.id,
            serviceProviderId: ada.serviceProvider.id,
            availability: 'retired',
            isBookable: false,
            passengerCapacity: 48,
          },
          ifMatch: '2',
        }),
      );
    });
  });

  it('BRD-D.3.2.1-MST the category narrows the types; helideck needs show for rotary wing only', async () => {
    const sent = stubResources();
    renderApp('/admin/fleet', { access: accessWith({ 'admin.fleet': EDITOR }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New fleet resource' }));
    const form = await screen.findByRole('dialog', { name: 'New fleet resource' });
    const category = within(form).getByLabelText('Resource category');
    const type = within(form).getByLabelText('Resource type');
    await within(form).findByRole('option', { name: 'Rotary wing · Air' });
    expect(
      within(form).getByRole('option', { name: 'Marine · Water / marine' }),
    ).toBeInTheDocument();
    expect(type).toBeDisabled();
    expect(within(form).queryByText(/seat quota/i)).not.toBeInTheDocument();
    // Only BRD D.3.2.1 fields; the seat layout holds its place until a type is chosen.
    expect(within(form).queryByLabelText('Home location')).not.toBeInTheDocument();
    expect(within(form).queryByLabelText('Ownership')).not.toBeInTheDocument();
    expect(within(form).getByRole('img', { name: 'Seat layout' })).toBeInTheDocument();
    expect(within(form).queryByText(/Choose a resource type to see/)).not.toBeInTheDocument();

    await user.selectOptions(category, 'FIXED-WING');
    expect(
      within(type)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose a type', 'Dash 8-300']);
    await user.selectOptions(type, id(1));
    expect(within(form).queryByText('Helideck compatibility')).not.toBeInTheDocument();

    await user.selectOptions(category, 'ROTARY-WING');
    expect(type).toHaveValue('');
    await user.selectOptions(type, id(4));
    expect(within(form).getByText('Helideck compatibility')).toBeInTheDocument();
    expect(within(form).getByText('13.8 m')).toBeInTheDocument();
    expect(within(form).getByText('6.4 t')).toBeInTheDocument();

    await user.selectOptions(category, 'MARINE');
    await user.selectOptions(type, id(5));
    expect(within(form).queryByText('Helideck compatibility')).not.toBeInTheDocument();
    expect(within(form).getByText('Open seating (no seat map)')).toBeInTheDocument();

    await user.selectOptions(category, 'ROTARY-WING');
    await user.selectOptions(type, id(4));
    await user.type(within(form).getByLabelText('Registration (tail or vessel number)'), 'A6-NEW');
    await user.selectOptions(within(form).getByLabelText('Service provider'), id(20));
    await user.type(within(form).getByLabelText('Seat capacity'), '13');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('The type’s seat map has 12 seats; enter no more than that.'),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
    await user.clear(within(form).getByLabelText('Seat capacity'));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/fleet',
          body: {
            registration: 'A6-NEW',
            resourceTypeId: id(4),
            serviceProviderId: id(20),
            availability: 'available',
            isBookable: true,
            passengerCapacity: null,
          },
        }),
      );
    });
  });

  it('BRD-D.3.2.1-MST the form checks the registration and seat capacity as they are entered', async () => {
    const sent = stubResources();
    renderApp('/admin/fleet', { access: accessWith({ 'admin.fleet': EDITOR }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New fleet resource' }));
    const form = await screen.findByRole('dialog', { name: 'New fleet resource' });
    await within(form).findByRole('option', { name: 'Fixed wing · Air' });

    const registration = within(form).getByLabelText('Registration (tail or vessel number)');
    await user.type(registration, '-A6');
    await user.tab();
    expect(
      await within(form).findByText(
        '2–40 letters, digits, spaces, dots or hyphens, starting with a letter or digit',
      ),
    ).toBeInTheDocument();
    expect(registration).toHaveAttribute('aria-invalid', 'true');
    await user.clear(registration);
    await user.type(registration, 'A6-NEW');
    await waitFor(() => {
      expect(registration).not.toHaveAttribute('aria-invalid');
    });

    const capacity = within(form).getByLabelText('Seat capacity');
    await user.type(capacity, '0');
    await user.tab();
    expect(
      await within(form).findByText('Enter a whole number from 1 to 1000'),
    ).toBeInTheDocument();
    await user.clear(capacity);
    await user.type(capacity, '52');
    // Choosing a type re-checks the capacity against its seat map (13 × 4 = 52 fits; 12 doesn't).
    await user.selectOptions(within(form).getByLabelText('Resource category'), 'FIXED-WING');
    await user.selectOptions(within(form).getByLabelText('Resource type'), id(1));
    expect(within(form).queryByText(/seat map has/)).not.toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('Resource category'), 'ROTARY-WING');
    await user.selectOptions(within(form).getByLabelText('Resource type'), id(4));
    expect(
      await within(form).findByText('The type’s seat map has 12 seats; enter no more than that.'),
    ).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(within(form).getByLabelText('Service provider')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });
    expect(sent).toEqual([]);
  });

  it('BRD-D.3.2.1-MST a viewer sees a unit read-only, its specifications from the type', async () => {
    stubResources();
    renderApp('/admin/fleet', { access: accessWith({ 'admin.fleet': ['view'] }) });
    const table = await screen.findByRole('table', { name: 'Fleet' });
    expect(screen.queryByRole('button', { name: 'New fleet resource' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      await within(table).findByRole('button', { name: 'Actions for A6-ADA · Dash 8-300' }),
    );
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    const details = await screen.findByRole('dialog', { name: 'A6-ADA' });
    expect(within(details).getByText('Abu Dhabi Aviation')).toBeInTheDocument();
    expect(within(details).getByText('5500 kg')).toBeInTheDocument();
    expect(within(details).getByRole('group', { name: 'Seat map' })).toBeInTheDocument();
    expect(within(details).queryByText('Helideck compatibility')).not.toBeInTheDocument();
    await expectAccessible(details);
  });

  it('SPEC-20-SCH-R4 quotas say they are fixed wing only, and offer only fixed-wing scopes', async () => {
    const sent = stubResources();
    renderApp('/admin/quotas', { access: accessWith({ 'admin.quotas': EDITOR }) });
    expect(
      await screen.findByText('Quotas apply to fixed-wing services only.'),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Quotas' });
    expect(await within(table).findByText('1 seats · warn at 80%')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New quota' }));
    const form = await screen.findByRole('dialog', { name: 'New quota' });
    await user.type(within(form).getByLabelText('Code'), 'q-das-route');
    await user.selectOptions(within(form).getByLabelText('Whose seats'), 'zone');
    await within(form).findByRole('option', { name: 'Das' });
    await user.selectOptions(within(form).getByLabelText('Which'), id(60));
    await user.selectOptions(within(form).getByLabelText('Where'), 'route');
    await user.selectOptions(within(form).getByLabelText('Which (fixed wing only)'), id(70));
    await user.type(within(form).getByLabelText('Seat limit'), '10');
    await user.type(within(form).getByLabelText('Valid from'), '2026-11-01');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/quotas',
          body: {
            code: 'Q-DAS-ROUTE',
            appliesTo: 'zone',
            appliesToId: id(60),
            scopeKind: 'route',
            scopeId: id(70),
            period: 'flight',
            seatLimit: 10,
            warningPct: 80,
            validFrom: '2026-11-01',
            validTo: null,
          },
        }),
      );
    });
  });

  it('SPEC-10-5.2 a fuel station sits at a location; a cargo type’s DG class is checked', async () => {
    const sent = stubResources();
    renderApp('/admin/fuel-stations', { access: accessWith({ 'admin.fuel-stations': EDITOR }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New fuel station' }));
    const form = await screen.findByRole('dialog', { name: 'New fuel station' });
    await user.type(within(form).getByLabelText('Code'), 'fs-zrk-2');
    await user.type(within(form).getByLabelText('Name'), 'Zirku north');
    await within(form).findByRole('option', { name: 'Zirku Island (ZRK)' });
    await user.selectOptions(within(form).getByLabelText('Location'), id(80));
    await user.type(within(form).getByLabelText('Capacity (kg)'), '15000');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/masters/fuel-stations',
          body: {
            code: 'FS-ZRK-2',
            name: 'Zirku north',
            locationId: id(80),
            capacityKg: 15000,
            reorderLevelKg: null,
          },
        }),
      );
    });
  });
});
