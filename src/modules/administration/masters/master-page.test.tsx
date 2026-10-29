import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith } from '../../../../test/render-app';
import { ApiError } from '../../../api/errors';
import type { Right } from '../../../app/access/registry';
import { myAccessQuery } from '../../../app/session/queries';
import type { AuditPage } from '../../../shared/audit/audit-trail';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { type MasterFormProps, MasterPage } from './master-page';
import type { ApiQuery, MasterResource } from './master-resource';

interface Zone {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  deactivatedReason: string | null;
  version: number;
}

const ZONES: Zone[] = [
  {
    id: 'z1',
    code: 'DAS',
    name: 'Das Island',
    isActive: true,
    deactivatedReason: null,
    version: 1,
  },
  { id: 'z2', code: 'ZRK', name: 'Zirku', isActive: true, deactivatedReason: null, version: 3 },
  {
    id: 'z3',
    code: 'USH',
    name: 'Umm Shaif',
    isActive: false,
    deactivatedReason: 'Merged',
    version: 2,
  },
];

const HISTORY: AuditPage = {
  items: [
    {
      id: 'e2',
      occurredAt: '2026-10-13T06:00:00Z',
      module: 'administration',
      actionType: 'zone.updated',
      actionLabel: 'Zone updated · DAS',
      reason: null,
      referenceId: null,
      outcome: 'success',
      record: { type: 'zone', id: 'z1', ref: 'DAS', label: 'Das Island' },
      actor: { userId: 'u1', role: null, label: 'Reem Al Kindi', onBehalfOf: null },
      before: { name: 'Das' },
      after: { name: 'Das Island' },
      source: { ip: null, device: null, userAgent: null },
      correlationId: null,
      highRisk: false,
    },
  ],
  nextCursor: null,
};

function fakeResource(overrides: Partial<MasterResource<Zone>> = {}) {
  const list = vi.fn((query: ApiQuery) =>
    Promise.resolve({
      items: query.includeDeactivated ? ZONES : ZONES.filter((z) => z.isActive),
      total: query.includeDeactivated ? 3 : 2,
      page: 1,
      pageSize: 20,
    }),
  );
  const base = {
    pageKey: 'admin.zones',
    queryKey: ['masters', 'zones'],
    path: '/api/v1/masters/zones',
    list,
    deactivate: vi.fn((zone: Zone) => Promise.resolve({ ...zone, isActive: false })),
    reactivate: vi.fn((zone: Zone) => Promise.resolve({ ...zone, isActive: true })),
    remove: vi.fn(() => Promise.resolve()),
    history: vi.fn(() => Promise.resolve(HISTORY)),
  } satisfies MasterResource<Zone>;
  const resource = Object.assign(base, overrides);
  return resource;
}

function ZoneForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Zone>) {
  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={record ? `Edit ${record.code}` : 'New zone'}
      onSubmit={(e) => {
        e.preventDefault();
        onSaved();
      }}
    >
      <p>Zone fields</p>
    </EntityFormModal>
  );
}

function renderZones(rights: Right[], resource = fakeResource()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(myAccessQuery.queryKey, accessWith({ 'admin.zones': rights }));
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MasterPage
          resource={resource}
          title="Zones"
          subtitle="The areas that group locations and scope access."
          noun="zone"
          columns={[
            { id: 'code', header: 'Code', cell: (z) => z.code, sortField: 'code' },
            { id: 'name', header: 'Name', cell: (z) => z.name, sortField: 'name' },
          ]}
          describe={(z) => `${z.code} · ${z.name}`}
          form={ZoneForm}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return resource;
}

const ALL: Right[] = ['view', 'create', 'edit', 'deactivate', 'delete', 'export'];

async function openActions(code: string, name: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `Actions for ${code} · ${name}` }));
  return user;
}

afterEach(() => vi.unstubAllGlobals());

describe('PROMPT-4.2 the master page pattern (plan P1-02)', () => {
  it('BRD-D.3 shows the title, subtitle, list with "N of M", status and the allowed controls', async () => {
    renderZones(ALL);
    expect(screen.getByRole('heading', { level: 1, name: 'Zones' })).toBeInTheDocument();
    expect(
      screen.getByText('The areas that group locations and scope access.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Das Island')).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'New zone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByLabelText('Show deactivated')).toBeInTheDocument();
    await expectAccessible();
  });

  it('PROMPT-2.16 "Show deactivated" asks the API for deactivated records too', async () => {
    const resource = renderZones(ALL);
    await screen.findByText('Das Island');
    await userEvent.setup().click(screen.getByLabelText('Show deactivated'));
    expect(await screen.findByText('Umm Shaif')).toBeInTheDocument();
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    expect(resource.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeactivated: true, page: 1 }),
    );
  });

  it('PROMPT-2.7 a view-only user gets the list and history, nothing else', async () => {
    renderZones(['view']);
    await screen.findByText('Das Island');
    expect(screen.queryByRole('button', { name: 'New zone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    await openActions('DAS', 'Das Island');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['History']);
  });

  it('PROMPT-2.8 deactivates with a reason, then refreshes the list', async () => {
    const resource = renderZones(ALL);
    await screen.findByText('Das Island');
    const callsBefore = resource.list.mock.calls.length;
    const user = await openActions('DAS', 'Das Island');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Edit',
      'History',
      'Deactivate',
      'Delete',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate DAS · Das Island?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Closed for works');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(resource.deactivate).toHaveBeenCalledWith(ZONES[0], 'Closed for works');
    });
    await waitFor(() => {
      expect(resource.list.mock.calls.length).toBeGreaterThan(callsBefore);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('PROMPT-2.16 a version conflict stays in the dialog and reloads the list', async () => {
    const conflict = new ApiError(
      409,
      'VERSION_CONFLICT',
      'This record was changed by someone else. Reload it and try again.',
    );
    const resource = renderZones(
      ALL,
      fakeResource({ deactivate: vi.fn(() => Promise.reject(conflict)) }),
    );
    await screen.findByText('Das Island');
    const callsBefore = resource.list.mock.calls.length;
    const user = await openActions('DAS', 'Das Island');
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason'), 'Closed for works');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await within(dialog).findByText(conflict.message)).toBeInTheDocument();
    expect(resource.list.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('PROMPT-2.8 the audit-trail drawer shows who changed what', async () => {
    const resource = renderZones(['view']);
    await screen.findByText('Das Island');
    const user = await openActions('DAS', 'Das Island');
    await user.click(screen.getByRole('menuitem', { name: 'History' }));
    const drawer = screen.getByRole('dialog', { name: 'History of DAS · Das Island' });
    expect(await within(drawer).findByText('Zone updated · DAS')).toBeInTheDocument();
    expect(within(drawer).getByText('Name: Das → Das Island')).toBeInTheDocument();
    expect(within(drawer).getByText(/Reem Al Kindi/)).toBeInTheDocument();
    expect(resource.history).toHaveBeenCalledWith('z1', undefined);
    await expectAccessible();
  });

  it('PROMPT-4.2 opens the form for New and for a row, and refreshes after a save', async () => {
    const resource = renderZones(ALL);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New zone' }));
    expect(screen.getByRole('dialog', { name: 'New zone' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByText('Zirku'));
    const form = screen.getByRole('dialog', { name: 'Edit ZRK' });
    const callsBefore = resource.list.mock.calls.length;
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(resource.list.mock.calls.length).toBeGreaterThan(callsBefore);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('PROMPT-2.16 exports the list as shown, every page, in the chosen format', async () => {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(() =>
      Promise.resolve(
        new Response('x', {
          headers: { 'content-disposition': 'attachment; filename="zones-2026-10-13.xlsx"' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderZones(ALL);
    await screen.findByText('Das Island');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Show deactivated'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Export as Excel',
      'Export as CSV',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Export as Excel' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const url = new URL(fetchMock.mock.calls[0]?.[0].url ?? '');
    expect(url.pathname).toBe('/api/v1/masters/zones/export');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      includeDeactivated: 'true',
      format: 'xlsx',
    });
  });

  it('PROMPT-2.8 reactivates a deactivated record and deletes (admin tier) with a reason', async () => {
    const resource = renderZones(ALL);
    await screen.findByText('Das Island');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Show deactivated'));
    await user.click(await screen.findByRole('button', { name: 'Actions for USH · Umm Shaif' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reactivate' }));
    let dialog = screen.getByRole('dialog', { name: 'Reactivate USH · Umm Shaif?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Back in use');
    await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => {
      expect(resource.reactivate).toHaveBeenCalledWith(ZONES[2], 'Back in use');
    });

    await user.click(screen.getByRole('button', { name: 'Actions for ZRK · Zirku' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    dialog = screen.getByRole('dialog', { name: 'Delete ZRK · Zirku?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Created in error');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(resource.remove).toHaveBeenCalledWith(ZONES[1], 'Created in error');
    });
  });

  it('PROMPT-2.16 shows why an export or the list was refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'EXPORT_TOO_LARGE',
                message: 'This list has 120,000 rows; an export holds at most 100,000.',
              },
            }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );
    renderZones(
      ALL,
      fakeResource({
        list: vi.fn(() => Promise.reject(new ApiError(503, 'UNAVAILABLE', 'Try again shortly.'))),
      }),
    );
    expect(await screen.findByText('Try again shortly.')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));
    expect(
      await screen.findByText('This list has 120,000 rows; an export holds at most 100,000.'),
    ).toBeInTheDocument();
  });
});
