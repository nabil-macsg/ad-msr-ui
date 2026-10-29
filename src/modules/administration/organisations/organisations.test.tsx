import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type {
  ChargeCode,
  Company,
  Department,
  PassengerCategory,
  ServiceProvider,
} from './orgs-api';

const EDITOR: Right[] = ['view', 'create', 'edit', 'deactivate', 'export'];
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number, code: string, name: string) => ({ id: id(n), code, name });
const meta = { isActive: true, deactivatedReason: null, updatedAt: '2026-10-01T00:00:00Z' };

const falcon: ServiceProvider = {
  id: id(1),
  code: 'FAL',
  legalName: 'Falcon Aviation',
  providerType: 'aviation',
  contactName: null,
  contactEmail: 'ops@fal.masar.example',
  contactPhone: null,
  fleet: 6,
  contacts: 2,
  ...meta,
  version: 1,
};
const directHire: PassengerCategory = {
  ...ref(2, 'DH', 'Direct Hire'),
  icon: 'refresh-cw',
  colour: '#1D4ED8',
  priorityRank: 3,
  seatForward: false,
  sourceMapping: null,
  isCrewChange: true,
  ...meta,
  version: 1,
};
const chargeCode: ChargeCode = {
  ...ref(3, '3', 'Direct Hire'),
  description: 'Direct Hire',
  allSites: true,
  sites: [],
  recoverability: 'non-recoverable',
  validFrom: '2026-01-01',
  validTo: null,
  owningDepartment: null,
  ...meta,
  version: 1,
};
const sapDepartment: Department = {
  ...ref(4, 'OPS', 'Operations'),
  parent: null,
  source: 'sap',
  syncedAt: '2026-10-14T03:00:00Z',
  people: 12,
  ...meta,
  version: 1,
};
const manualDepartment: Department = {
  ...ref(5, 'PROJ-X', 'Project X'),
  parent: ref(4, 'OPS', 'Operations'),
  source: 'manual',
  syncedAt: null,
  people: 0,
  ...meta,
  version: 2,
};
const sapCompany: Company = {
  ...ref(6, 'ADNOC-OFF', 'ADNOC Offshore'),
  source: 'sap',
  serviceProvider: null,
  syncedAt: '2026-10-14T03:00:00Z',
  people: 30,
  ...meta,
  version: 1,
};

interface Sent {
  method: string;
  path: string;
  body: unknown;
}

function stubOrgs(): Sent[] {
  const sent: Sent[] = [];
  const page = (items: unknown[]) => json({ items, total: items.length, page: 1, pageSize: 50 });
  stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .text()
        .then((text) => {
          sent.push({ method: request.method, path, body: JSON.parse(text) as unknown });
        });
      return json({}, 201);
    }
    switch (path) {
      case '/api/v1/masters/service-providers':
        return page([falcon]);
      case '/api/v1/masters/passenger-categories':
        return page([directHire]);
      case '/api/v1/masters/charge-codes':
        return page([chargeCode]);
      case '/api/v1/masters/charge-codes/options':
        return json({
          locations: [ref(10, 'ZRK', 'Zirku Island'), ref(11, 'DAS', 'Das Island')],
          departments: [],
        });
      case '/api/v1/masters/departments':
        return page([sapDepartment, manualDepartment]);
      case '/api/v1/masters/departments/options':
        return json({ departments: [ref(4, 'OPS', 'Operations')], serviceProviders: [] });
      case '/api/v1/masters/companies':
        return page([sapCompany]);
      case '/api/v1/masters/companies/options':
        return json({ departments: [], serviceProviders: [ref(1, 'FAL', 'Falcon Aviation')] });
      default:
        return undefined;
    }
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe('SPEC-10-5.1 organisation masters on the web', () => {
  it('BRD-D.3.1.9-MST a provider’s code is two or three letters', async () => {
    const sent = stubOrgs();
    renderApp('/admin/service-providers', {
      access: accessWith({ 'admin.service-providers': EDITOR }),
    });
    const table = await screen.findByRole('table', { name: 'Service Providers' });
    expect(await within(table).findByText('ops@fal.masar.example')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New service provider' }));
    const form = await screen.findByRole('dialog', { name: 'New service provider' });
    await user.type(within(form).getByLabelText('Code'), 'ABCD');
    await user.type(within(form).getByLabelText('Legal name'), 'Gulf Helicopters');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByText('Two or three letters')).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('Code'));
    await user.type(within(form).getByLabelText('Code'), 'gh');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/masters/service-providers',
        body: {
          code: 'GH',
          legalName: 'Gulf Helicopters',
          providerType: 'aviation',
          contactName: null,
          contactEmail: null,
          contactPhone: null,
        },
      });
    });
    await expectAccessible();
  });

  it('BRD-D.3.1.10-MST passenger categories show their rank and crew-change flag', async () => {
    const sent = stubOrgs();
    renderApp('/admin/passenger-categories', {
      access: accessWith({ 'admin.passenger-categories': EDITOR }),
    });
    const table = await screen.findByRole('table', { name: 'Passenger Categories' });
    expect(await within(table).findByText('Crew change')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New passenger category' }));
    const form = await screen.findByRole('dialog', { name: 'New passenger category' });
    await user.type(within(form).getByLabelText('Code'), 'medic');
    await user.type(within(form).getByLabelText('Name'), 'Medical');
    await user.selectOptions(within(form).getByLabelText('Icon'), 'stethoscope');
    await user.selectOptions(within(form).getByLabelText('Colour'), '#DC2626');
    await user.type(within(form).getByLabelText('Priority rank'), '9');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          path: '/api/v1/masters/passenger-categories',
          body: expect.objectContaining({
            code: 'MEDIC',
            icon: 'stethoscope',
            colour: '#DC2626',
            priorityRank: 9,
            isCrewChange: false,
          }) as unknown,
        }),
      );
    });
  });

  it('BRD-D.3.1.11-MST a charge code covers every site, or the sites chosen', async () => {
    const sent = stubOrgs();
    renderApp('/admin/charge-codes', { access: accessWith({ 'admin.charge-codes': EDITOR }) });
    const table = await screen.findByRole('table', { name: 'Charge Codes' });
    expect(await within(table).findByText('All sites')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New charge code' }));
    const form = await screen.findByRole('dialog', { name: 'New charge code' });
    await user.type(within(form).getByLabelText('Code'), 'zs-1');
    await user.type(within(form).getByLabelText('Description'), 'Zirku shutdown');
    await user.click(within(form).getByLabelText('Every site'));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Choose at least one site, or every site'),
    ).toBeInTheDocument();
    await user.click(within(form).getByRole('checkbox', { name: 'Zirku Island' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/masters/charge-codes',
        body: {
          code: 'ZS-1',
          description: 'Zirku shutdown',
          siteIds: [id(10)],
          recoverability: 'non-recoverable',
          validFrom: null,
          validTo: null,
          owningDepartmentId: null,
        },
      });
    });
  });

  it('PROMPT-2.9 SAP’s departments are read-only; MASAR’s own can be edited', async () => {
    stubOrgs();
    renderApp('/admin/departments', { access: accessWith({ 'admin.departments': EDITOR }) });
    const table = await screen.findByRole('table', { name: 'Departments' });
    expect(await within(table).findByText('VIA SAP')).toBeInTheDocument();
    expect(within(table).getByText('KEPT IN MASAR')).toBeInTheDocument();
    expect(within(table).getByText('Under Operations')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for OPS · Operations' }));
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Actions for PROJ-X · Project X' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    await expectAccessible();
  });

  it('PROMPT-2.9 synced companies are read-only; an external organisation needs its provider', async () => {
    const sent = stubOrgs();
    renderApp('/admin/companies', { access: accessWith({ 'admin.companies': EDITOR }) });
    const table = await screen.findByRole('table', { name: 'Companies' });
    expect(await within(table).findByText('ADNOC Offshore')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Actions for ADNOC-OFF · ADNOC Offshore' }),
    );
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'New external organisation' }));
    const form = await screen.findByRole('dialog', { name: 'New external organisation' });
    await user.type(within(form).getByLabelText('Code'), 'fal-sub');
    await user.type(within(form).getByLabelText('Name'), 'Falcon Subcontractor');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Choose the organisation’s service provider'),
    ).toBeInTheDocument();
    await within(form).findByRole('option', { name: 'Falcon Aviation (FAL)' });
    await user.selectOptions(within(form).getByLabelText('Service provider'), id(1));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/masters/companies',
        body: { code: 'FAL-SUB', name: 'Falcon Subcontractor', serviceProviderId: id(1) },
      });
    });
  });
});
