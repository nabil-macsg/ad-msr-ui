import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLocalListParams } from '../../shared/lists/list-params';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Field, Input, SelectField } from '../../shared/ui/field';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatCard } from '../../shared/ui/stat-card';
import { RowActions } from '../../modules/administration/masters/master-page';
import { usePobQuery } from './pob-api';
import {
  type AboardRow,
  fieldErrors,
  formatDay,
  type Person,
  RECORDS,
  recordsSend,
  useRecordsList,
  useRecordsRefresh,
  useRecordsToday,
  useSites,
  type Vessel,
} from './records-api';
import { MissingList, Note, PersonChoice } from './records-ui';

/** Vessel / Barge Check-in: who is aboard each vessel and barge, and where it is. */
export default function VesselCheckinPage() {
  const [search, setSearch] = useSearchParams();
  const vessels = usePobQuery<Vessel[]>(`${RECORDS}/vessels`);
  const selectedId = search.get('vessel') ?? '';
  const selected = vessels.data?.find((v) => v.id === selectedId);
  const afloat = (vessels.data ?? []).reduce((n, v) => n + v.aboard, 0);

  const choose = (id: string) => setSearch(id ? { vessel: id } : {}, { replace: true });

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title="Vessel / Barge Check-in"
        subtitle="Who is aboard each vessel and barge, and where it is"
      />
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card px-4 py-3">
        <SelectField
          label="Vessel or barge"
          className="min-w-72 flex-1"
          value={selectedId}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">— Select a vessel —</option>
          {vessels.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.locationName} · {v.aboard} aboard
            </option>
          ))}
        </SelectField>
        <p className="pb-3 text-xs text-ink-muted">
          {vessels.data?.length ?? 0} vessels and barges · {afloat} people afloat
        </p>
      </div>
      {vessels.isError && <Banner tone="danger">The vessels could not be loaded.</Banner>}
      {selected ? (
        <VesselCard vessel={selected} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vessels.data?.map((v) => (
            <StatCard
              key={v.id}
              title={v.name}
              value={v.aboard}
              subline={`aboard · currently at ${v.locationName}`}
              to={`?vessel=${v.id}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VesselCard({ vessel }: { vessel: Vessel }) {
  const { params, update, apiQuery } = useLocalListParams({ sort: null });
  const aboard = useRecordsList<AboardRow>(`/vessels/${vessel.id}/aboard`, apiQuery);
  const refresh = useRecordsRefresh();
  const [moving, setMoving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState<AboardRow | null>(null);

  const columns: readonly Column<AboardRow>[] = [
    {
      id: 'name',
      header: 'Person',
      sortField: 'name',
      cell: (r) => (
        <span>
          <span className="block font-medium text-ink">{r.name}</span>
          <span className="font-mono text-xs text-ink-muted">{r.optima}</span>
        </span>
      ),
    },
    {
      id: 'company',
      header: 'Company',
      sortField: 'company',
      cell: (r) => (
        <span>
          <span className="block">{r.company}</span>
          <span className="text-xs text-ink-muted">{r.role}</span>
        </span>
      ),
    },
    {
      id: 'boardedAt',
      header: 'Boarded',
      sortField: 'boardedAt',
      cell: (r) => formatDay(r.boardedAt),
    },
    { id: 'recordedBy', header: 'Recorded by', sortField: 'recordedBy', cell: (r) => r.recordedBy },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <RowActions
          label={`Actions for ${r.name}`}
          items={[{ label: 'Check out', run: () => setCheckingOut(r) }]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{vessel.name}</p>
          <p className="text-xs text-ink-muted">
            at {vessel.locationName} · {vessel.aboard} aboard
          </p>
        </div>
        <Button variant="secondary" onClick={() => setMoving(true)}>
          Vessel is now at…
        </Button>
        <Button onClick={() => setCheckingIn(true)}>Check somebody in</Button>
      </div>
      <DataTable
        caption={`Aboard ${vessel.name}`}
        columns={columns}
        rows={aboard.data?.items}
        total={aboard.data?.total}
        rowKey={(r) => r.id}
        params={params}
        onParamsChange={update}
        loading={aboard.isFetching}
        emptyTitle="Nobody is checked in aboard"
      />
      <Note>
        Everybody aboard counts at {vessel.locationName} and is left out of its muster — they are on
        the water, not on the deck.
      </Note>

      {moving && <MoveModal vessel={vessel} onClose={() => setMoving(false)} onSaved={refresh} />}
      {checkingIn && (
        <CheckInModal vessel={vessel} onClose={() => setCheckingIn(false)} onSaved={refresh} />
      )}
      <ConfirmDialog
        open={checkingOut !== null}
        onOpenChange={(open) => {
          if (!open) setCheckingOut(null);
        }}
        title={checkingOut ? `Check ${checkingOut.name} out of ${vessel.name}?` : ''}
        body={`They stop counting at ${vessel.locationName}.`}
        confirmLabel="Check out"
        tone="primary"
        requireReason={false}
        onConfirm={async () => {
          if (!checkingOut) return;
          await recordsSend('DELETE', `/vessels/${vessel.id}/aboard/${checkingOut.id}`);
          await refresh();
        }}
      />
    </div>
  );
}

function MoveModal({
  vessel,
  onClose,
  onSaved,
}: {
  vessel: Vessel;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const sites = useSites();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!code) {
      setError('Choose where the vessel is now.');
      return;
    }
    setBusy(true);
    try {
      await recordsSend('POST', `/vessels/${vessel.id}/move`, { locationCode: code });
      await onSaved();
      onClose();
    } catch (e) {
      setError(fieldErrors(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${vessel.name} is now at…`}
      description={`Currently at ${vessel.locationName}. Everybody aboard moves with it.`}
      size="sm"
    >
      <div className="space-y-4">
        <SelectField
          label="Location"
          required
          value={code}
          error={error ?? undefined}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
        >
          <option value="">— Select a location —</option>
          {sites.data
            ?.filter((s) => s.code !== vessel.locationCode)
            .map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
        </SelectField>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            Move vessel
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

function CheckInModal({
  vessel,
  onClose,
  onSaved,
}: {
  vessel: Vessel;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const today = useRecordsToday().data?.today ?? '';
  const [q, setQ] = useState('');
  const people = usePobQuery<Person[]>(`${RECORDS}/people?q=${encodeURIComponent(q.trim())}`);
  const [person, setPerson] = useState<Person | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const day = date ?? today;

  const missing = [
    !person && 'Somebody to check in is required.',
    !day && 'A boarding date is required.',
  ].filter((m): m is string => typeof m === 'string');

  const save = async () => {
    if (!person || missing.length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      await recordsSend('POST', `/vessels/${vessel.id}/aboard`, {
        optima: person.optima,
        date: day,
        time,
      });
      await onSaved();
      onClose();
    } catch (e) {
      setFailure(fieldErrors(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Check somebody in aboard ${vessel.name}`}
      size="lg"
    >
      <div className="space-y-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        <Field
          label="Person"
          required
          placeholder="Name, Optima number, employer or role"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {people.data?.map((p) => (
            <PersonChoice
              key={p.optima}
              name={p.name}
              detail={p.detail}
              optima={p.optima}
              selected={person?.optima === p.optima}
              onSelect={() => setPerson(p)}
            />
          ))}
          {people.data?.length === 0 && <Note>Nobody matches “{q}”.</Note>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Date boarded"
            type="date"
            required
            value={day}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="space-y-1.5">
            <label htmlFor="vessel-checkin-time" className="block text-label text-ink-secondary">
              Time boarded
            </label>
            <Input
              id="vessel-checkin-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <Note>
          Checking somebody in closes wherever they were recorded before. They count at{' '}
          {vessel.locationName} while aboard.
        </Note>
        <MissingList items={missing} />
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy || missing.length > 0}>
            Check in
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
