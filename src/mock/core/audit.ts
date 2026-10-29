import type { components } from '../../api/schema';
import { currentPersona } from '../demo-auth';
import { all, insert, newId, now } from './store';

type AuditEvent = components['schemas']['AuditEvent'];

/** Records a change in the demo's audit trail, as the API does for every master change. */
export function audit(
  recordType: string,
  record: { id: string; ref: string; label: string },
  action: string,
  label: string,
  detail: { reason?: string | null; before?: unknown; after?: unknown } = {},
): void {
  const persona = currentPersona();
  insert<AuditEvent>('audit', {
    id: newId(),
    occurredAt: now(),
    module: 'administration',
    actionType: `${recordType}.${action}`,
    actionLabel: label,
    reason: detail.reason ?? null,
    referenceId: null,
    outcome: 'success',
    record: { type: recordType, id: record.id, ref: record.ref, label: record.label },
    actor: {
      userId: persona?.me.id ?? null,
      role: persona?.me.roles[0]?.name ?? null,
      label: persona?.me.displayName ?? 'Demo user',
      onBehalfOf: null,
    },
    before: detail.before,
    after: detail.after,
    source: { ip: null, device: 'Demo browser', userAgent: null },
    correlationId: null,
    highRisk: false,
  });
}

/** A record's trail, newest first (`GET …/:id/history`). */
export function trail(recordId: string): { items: AuditEvent[]; nextCursor: null } {
  return {
    items: all<AuditEvent>('audit').filter((e) => e.record.id === recordId),
    nextCursor: null,
  };
}
