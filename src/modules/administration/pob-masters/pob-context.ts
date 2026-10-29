import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { PageKey } from '../../../app/access/registry';
import { masterResource } from '../masters/master-api';
import type { MasterRecord, MasterResource } from '../masters/master-resource';
import type { PobMaster, Proposed } from './pob-api';

export interface Sent {
  readonly sent: Proposed | null;
  readonly report: (proposed: Proposed) => void;
}

export const SentContext = createContext<Sent>({ sent: null, report: () => undefined });

/** Forms and dialogs report what they proposed. */
export function useReportProposal() {
  const queryClient = useQueryClient();
  const { report } = useContext(SentContext);
  return (proposed: Proposed) => {
    report(proposed);
    void queryClient.invalidateQueries({ queryKey: ['masters', 'pending-changes'] });
  };
}

/**
 * A POB master's resource: deactivate, reactivate and delete are proposals too (spec 10 §5.3),
 * reported to the page's notice.
 */
export function usePobResource<T extends MasterRecord>(
  slug: PobMaster,
  pageKey: PageKey,
): MasterResource<T> {
  const report = useReportProposal();
  return useMemo(() => {
    const base = masterResource<T>(slug, pageKey, { deletable: false });
    const one = `/api/v1/masters/${slug}/{id}` as '/api/v1/masters/muster-points/{id}';
    return {
      ...base,
      deactivate: async (record, reason) => {
        report((await base.deactivate(record, reason)) as unknown as Proposed);
        return record;
      },
      reactivate: async (record, reason) => {
        report((await base.reactivate(record, reason)) as unknown as Proposed);
        return record;
      },
      remove: async (record, reason) => {
        report(
          unwrap(
            await api.DELETE(one, {
              params: { path: { id: record.id }, header: { 'If-Match': String(record.version) } },
              body: { reason },
            }),
          ),
        );
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report is stable per page
  }, [slug, pageKey]);
}
