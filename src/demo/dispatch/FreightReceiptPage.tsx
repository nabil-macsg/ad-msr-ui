import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Flame, PackageCheck, Search } from 'lucide-react';
import { useState } from 'react';
import { CONTROL } from '../../shared/ui/control-styles';
import { PageHeader } from '../../shared/ui/page-header';
import { datasetKey, updateRow, useDataset } from '../demo-api';
import { num, str } from './DeparturePicker';

const TH = 'px-5 py-3 text-start text-label font-bold text-on-table-head';
const day = (iso: unknown) =>
  new Date(`${str(iso)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** Freight Receipt: the destination confirms each consignment has arrived. */
export default function FreightReceiptPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const all =
    useDataset('freight', { page: 1, pageSize: 100, sort: 'note:desc' }).data?.items ?? [];
  const text = q.trim().toLowerCase();
  const rows = all.filter(
    (f) =>
      !text || [f.note, f.cargo, f.destination].some((v) => str(v).toLowerCase().includes(text)),
  );
  const confirm = async (id: string) => {
    setBusy(id);
    try {
      const now = new Date();
      await updateRow('freight', id, {
        receivedAt: `${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
        receivedBy: 'Super Admin',
      });
      await queryClient.invalidateQueries({ queryKey: datasetKey('freight') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Freight Receipt" subtitle="Confirm cargo has arrived at its destination" />
      <div className="flex flex-wrap items-center gap-4">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search</span>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search consignment note, cargo type or destination…"
            className={`${CONTROL} min-h-touch w-full ps-9 pe-3`}
          />
        </label>
        <span className="text-sm text-ink-muted">{rows.length} consignments</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <caption className="sr-only">Consignments</caption>
            <thead>
              <tr className="border-b border-border bg-table-head">
                {[
                  'Consignment Note',
                  'Cargo',
                  'Destination',
                  'Weight',
                  'Expected',
                  'Receipt',
                  '',
                ].map((h, i) => (
                  <th key={i} scope="col" className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-border/60 last:border-0 hover:bg-table-row-hover"
                >
                  <td className="px-5 py-3.5 font-mono text-ink-secondary">{str(f.note)}</td>
                  <td className="px-5 py-3.5 text-ink">
                    <span className="inline-flex items-center gap-2">
                      {str(f.cargo)}
                      {f.hazmat === true && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-danger-border bg-danger-bg px-2 py-0.5 text-2xs font-bold text-danger-fg">
                          <Flame className="size-3" aria-hidden />
                          HAZMAT
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ink">{str(f.destination)}</td>
                  <td className="px-5 py-3.5 text-ink tabular-nums">
                    {num(f.weightKg).toLocaleString('en')} kg
                  </td>
                  <td className="px-5 py-3.5 text-ink">{day(f.expected)}</td>
                  <td className="px-5 py-3.5">
                    {f.receivedAt ? (
                      <span className="inline-flex items-center gap-1.5 text-success-fg">
                        <CircleCheck className="size-4" aria-hidden />
                        {str(f.receivedAt)} · {str(f.receivedBy)}
                      </span>
                    ) : (
                      <span className="text-ink-muted">Not yet received</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-end">
                    {!f.receivedAt && (
                      <button
                        type="button"
                        disabled={busy === f.id}
                        onClick={() => void confirm(f.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
                      >
                        <PackageCheck className="size-4" aria-hidden />
                        Confirm receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
