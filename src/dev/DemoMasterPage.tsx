import { zodResolver } from '@hookform/resolvers/zod';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { myAccessQuery } from '../app/session/queries';
import { type MasterFormProps, MasterPage } from '../modules/administration/masters/master-page';
import type { ApiQuery, MasterResource } from '../modules/administration/masters/master-resource';
import type { AuditEvent } from '../shared/audit/audit-trail';
import { EntityFormModal } from '../shared/ui/entity-form-modal';
import { Field } from '../shared/ui/field';

interface DemoZone {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  deactivatedReason: string | null;
  version: number;
}

/** Synthetic zones kept in memory: the gallery has no API behind it. */
function demoResource(): MasterResource<DemoZone> & {
  save(id: string | null, values: { code: string; name: string }): void;
} {
  let zones: DemoZone[] = [
    ['DAS', 'Das Island'],
    ['ZRK', 'Zirku'],
    ['USH', 'Umm Shaif'],
    ['ZKM', 'Upper Zakum'],
    ['RUW', 'Ruwais'],
  ].map(([code = '', name = ''], i) => ({
    id: `zone-${i}`,
    code,
    name,
    isActive: i !== 4,
    deactivatedReason: i === 4 ? 'Moved to the Western zone' : null,
    version: 1,
  }));
  const history = new Map<string, AuditEvent[]>();
  const log = (zone: DemoZone, label: string, reason: string | null, before?: object) => {
    const event: AuditEvent = {
      id: `${zone.id}-${String(Date.now())}`,
      occurredAt: new Date().toISOString(),
      module: 'administration',
      actionType: 'zone.changed',
      actionLabel: `${label} · ${zone.code}`,
      reason,
      referenceId: null,
      outcome: 'success',
      record: { type: 'zone', id: zone.id, ref: zone.code, label: zone.name },
      actor: {
        userId: null,
        role: 'Master Data Power User',
        label: 'Reem Al Kindi',
        onBehalfOf: null,
      },
      before: before ?? null,
      after: before ? { code: zone.code, name: zone.name } : null,
      source: { ip: null, device: null, userAgent: null },
      correlationId: null,
      highRisk: false,
    };
    history.set(zone.id, [event, ...(history.get(zone.id) ?? [])]);
  };
  const change = (id: string, patch: Partial<DemoZone>, label: string, reason: string | null) => {
    const current = zones.find((z) => z.id === id);
    if (!current) throw new Error('Not found');
    const next = { ...current, ...patch, version: current.version + 1 };
    zones = zones.map((z) => (z.id === id ? next : z));
    log(next, label, reason, { code: current.code, name: current.name });
    return next;
  };

  return {
    pageKey: 'admin.zones',
    queryKey: ['demo', 'zones'],
    path: '/api/v1/masters/zones',
    list: (query: ApiQuery) => {
      const q = String(query.q ?? '').toLowerCase();
      const items = zones
        .filter((z) => query.includeDeactivated === true || z.isActive)
        .filter((z) => `${z.code} ${z.name}`.toLowerCase().includes(q));
      return Promise.resolve({ items, total: items.length, page: 1, pageSize: 20 });
    },
    deactivate: (zone, reason) =>
      Promise.resolve(
        change(zone.id, { isActive: false, deactivatedReason: reason }, 'Zone deactivated', reason),
      ),
    reactivate: (zone, reason) =>
      Promise.resolve(
        change(zone.id, { isActive: true, deactivatedReason: null }, 'Zone reactivated', reason),
      ),
    remove: (zone) => {
      zones = zones.filter((z) => z.id !== zone.id);
      return Promise.resolve();
    },
    history: (id) => Promise.resolve({ items: history.get(id) ?? [], nextCursor: null }),
    save: (id, values) => {
      if (id) {
        change(id, values, 'Zone updated', null);
      } else {
        const zone = {
          id: `zone-${String(zones.length)}`,
          ...values,
          isActive: true,
          deactivatedReason: null,
          version: 1,
        };
        zones = [...zones, zone];
        log(zone, 'Zone created', null);
      }
    },
  };
}

const ZoneSchema = z.object({
  code: z.string().regex(/^[A-Z0-9-]{2,12}$/, 'Use 2–12 capital letters, digits or hyphens'),
  name: z.string().trim().min(1, 'Enter a name').max(100),
});

/** A master's form: react-hook-form + zod, in the EntityFormModal. */
function zoneForm(resource: ReturnType<typeof demoResource>) {
  return function ZoneForm({ open, onOpenChange, record, onSaved }: MasterFormProps<DemoZone>) {
    const form = useForm<z.infer<typeof ZoneSchema>>({
      resolver: zodResolver(ZoneSchema),
      defaultValues: { code: record?.code ?? '', name: record?.name ?? '' },
    });
    const { errors } = form.formState;
    return (
      <EntityFormModal
        open={open}
        onOpenChange={onOpenChange}
        title={record ? `Edit ${record.code}` : 'New zone'}
        onSubmit={form.handleSubmit((values) => {
          resource.save(record?.id ?? null, values);
          onSaved();
        })}
      >
        <Field label="Code" error={errors.code?.message} {...form.register('code')} />
        <Field label="Name" error={errors.name?.message} {...form.register('name')} />
      </EntityFormModal>
    );
  };
}

/** The master page pattern (plan P1-02) on synthetic zones, with every right. */
export function DemoMasterPage() {
  const [setup] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(myAccessQuery.queryKey, {
      matrixVersion: 1,
      modules: ['administration'],
      pages: { 'admin.zones': ['view', 'create', 'edit', 'deactivate', 'delete', 'export'] },
      capabilities: [],
    });
    const resource = demoResource();
    return { client, resource, form: zoneForm(resource) };
  });
  return (
    <QueryClientProvider client={setup.client}>
      <MasterPage
        resource={setup.resource}
        title="Zones"
        subtitle="The areas that group locations and scope access."
        noun="zone"
        columns={[
          { id: 'code', header: 'Code', cell: (z) => z.code },
          { id: 'name', header: 'Name', cell: (z) => z.name },
        ]}
        describe={(z) => `${z.code} · ${z.name}`}
        form={setup.form}
      />
    </QueryClientProvider>
  );
}
