import { audit, trail } from '../core/audit';
import { bodyOf, json, MockError, noContent, notFound, text } from '../core/http';
import { listRows } from '../core/list';
import type { MasterRow } from '../core/masters';
import { route } from '../core/router';
import { all, find, insert, newId, now, removeRow, replace } from '../core/store';

/**
 * Any master without its own demo service (`/api/v1/masters/:resource`): an empty collection that
 * still lists, creates, edits, deactivates and deletes, so every Administration screen works.
 */
export function registerGenericMasters(): void {
  const rows = (resource?: string) => `masters:${resource ?? ''}`;
  const current = (
    resource: string | undefined,
    id: string | undefined,
    ifMatch: string | null,
  ) => {
    const row = find<MasterRow>(rows(resource), id ?? '');
    if (!row) throw new MockError(404, 'NOT_FOUND', 'The record was not found.');
    if (ifMatch !== null && Number(ifMatch) !== row.version) {
      throw new MockError(
        409,
        'VERSION_CONFLICT',
        'Someone else changed this record. Reload and try again.',
      );
    }
    return row;
  };
  const describe = (r: MasterRow) => ({
    ref: text(r.code) || r.id,
    label: text(r.name) || text(r.code) || r.id,
  });

  route('GET', '/api/v1/masters/:resource', (req) =>
    json(listRows(all<MasterRow>(rows(req.params.resource)), req.query)),
  );
  route('GET', '/api/v1/masters/:resource/options', () => json({}));
  route('GET', '/api/v1/masters/:resource/:id', (req) => {
    const row = find<MasterRow>(rows(req.params.resource), req.params.id ?? '');
    return row ? json(row) : notFound();
  });
  route('GET', '/api/v1/masters/:resource/:id/history', (req) => json(trail(req.params.id ?? '')));
  route('POST', '/api/v1/masters/:resource', (req) => {
    const row = insert<MasterRow>(rows(req.params.resource), {
      ...bodyOf(req),
      id: newId(),
      isActive: true,
      deactivatedReason: null,
      version: 1,
      updatedAt: now(),
    });
    audit(
      req.params.resource ?? 'master',
      { id: row.id, ...describe(row) },
      'created',
      'Record added',
      { after: row },
    );
    return json(row, 201);
  });
  route('PATCH', '/api/v1/masters/:resource/:id', (req) => {
    const row = current(req.params.resource, req.params.id, req.headers.get('If-Match'));
    const next = replace<MasterRow>(rows(req.params.resource), {
      ...row,
      ...bodyOf(req),
      version: row.version + 1,
      updatedAt: now(),
    });
    audit(
      req.params.resource ?? 'master',
      { id: next.id, ...describe(next) },
      'changed',
      'Record changed',
      { before: row, after: next },
    );
    return json(next);
  });
  for (const [action, active] of [
    ['deactivate', false],
    ['reactivate', true],
  ] as const) {
    route('POST', `/api/v1/masters/:resource/:id/${action}`, (req) => {
      const row = current(req.params.resource, req.params.id, req.headers.get('If-Match'));
      const reason = text(bodyOf(req).reason);
      const next = replace<MasterRow>(rows(req.params.resource), {
        ...row,
        isActive: active,
        deactivatedReason: active ? null : reason,
        version: row.version + 1,
        updatedAt: now(),
      });
      audit(
        req.params.resource ?? 'master',
        { id: next.id, ...describe(next) },
        action === 'deactivate' ? 'deactivated' : 'reactivated',
        `Record ${action}d`,
        { reason },
      );
      return json(next);
    });
  }
  route('DELETE', '/api/v1/masters/:resource/:id', (req) => {
    const row = current(req.params.resource, req.params.id, req.headers.get('If-Match'));
    removeRow(rows(req.params.resource), row.id);
    audit(
      req.params.resource ?? 'master',
      { id: row.id, ...describe(row) },
      'deleted',
      'Record deleted',
      { reason: text(bodyOf(req).reason) },
    );
    return noContent();
  });
}
