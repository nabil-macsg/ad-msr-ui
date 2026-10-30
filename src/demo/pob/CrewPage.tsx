import { useState } from 'react';
import { RowActions } from '../../modules/administration/masters/master-page';
import { useListParams } from '../../shared/lists/list-params';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Field, Input, SelectField } from '../../shared/ui/field';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { usePobQuery } from './pob-api';
import {
  type CrewMember,
  type CrewRecord,
  fieldErrors,
  formatDay,
  RECORDS,
  recordsSend,
  useRecordsList,
  useRecordsRefresh,
  useRecordsToday,
  useSites,
  type Vessel,
} from './records-api';
import { Detail, MissingList, Note, PersonChoice } from './records-ui';

/** Crew Entry: vessel crew not covered by the booking flow — the master crew list. */
export default function CrewPage() {
  const { params, update, apiQuery } = useListParams();
  const crew = useRecordsList<CrewRecord>('/crew', apiQuery);
  const refresh = useRecordsRefresh();
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<CrewRecord | null>(null);
  const [checkingOut, setCheckingOut] = useState<CrewRecord | null>(null);

  const columns: readonly Column<CrewRecord>[] = [
    {
      id: 'name',
      header: 'Crew member',
      sortField: 'name',
      cell: (r) => (
        <span>
          <span className="block font-medium text-ink">{r.name}</span>
          <span className="text-xs text-ink-muted">
            {r.role} · <span className="font-mono">{r.optima}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'location',
      header: 'Checked in at',
      sortField: 'locationName',
      cell: (r) => r.locationName,
    },
    { id: 'vessel', header: 'Vessel', sortField: 'vessel', cell: (r) => r.vessel || '—' },
    {
      id: 'onBoardAt',
      header: 'On board',
      sortField: 'onBoardAt',
      cell: (r) => <span className="whitespace-nowrap">{formatDay(r.onBoardAt)}</span>,
    },
    {
      id: 'until',
      header: 'Until',
      sortField: 'until',
      cell: (r) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          {formatDay(r.until)}
          {r.overdue && <StatusPill tone="danger">overdue</StatusPill>}
        </span>
      ),
    },
    {
      id: 'days',
      header: 'Days offshore',
      sortField: 'daysOffshore',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{r.daysOffshore}</span>,
    },
    { id: 'recordedBy', header: 'Recorded by', sortField: 'recordedBy', cell: (r) => r.recordedBy },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <RowActions
          label={`Actions for ${r.name}`}
          items={[
            { label: 'View details', run: () => setViewing(r) },
            { label: 'Check out', run: () => setCheckingOut(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title="Crew Entry"
        subtitle="Vessel crew not covered by the booking flow — the master crew list"
        actions={<Button onClick={() => setAdding(true)}>Check somebody in</Button>}
      />
      {crew.isError && <Banner tone="danger">The crew list could not be loaded.</Banner>}
      <DataTable
        caption="Crew list"
        columns={columns}
        rows={crew.data?.items}
        total={crew.data?.total}
        rowKey={(r) => r.id}
        params={params}
        onParamsChange={update}
        loading={crew.isFetching}
        onRowClick={setViewing}
        emptyTitle="Nobody is on the crew list"
      />
      <Note>
        Checking somebody in closes wherever they were recorded before. A row past its until-date is
        still counted.
      </Note>

      {adding && <CrewCheckInModal onClose={() => setAdding(false)} onSaved={refresh} />}
      {viewing && <CrewDetail record={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog
        open={checkingOut !== null}
        onOpenChange={(open) => {
          if (!open) setCheckingOut(null);
        }}
        title={checkingOut ? `Check ${checkingOut.name} out?` : ''}
        body={
          checkingOut
            ? `They come off the crew list and stop counting at ${checkingOut.locationName}.`
            : ''
        }
        confirmLabel="Check out"
        tone="primary"
        requireReason={false}
        onConfirm={async () => {
          if (!checkingOut) return;
          await recordsSend('DELETE', `/crew/${checkingOut.id}`);
          await refresh();
        }}
      />
    </section>
  );
}

function CrewDetail({ record: r, onClose }: { record: CrewRecord; onClose: () => void }) {
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={r.name}
      size="lg"
    >
      <div className="space-y-5 pb-5">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <div>
            <Detail label="Optima / HSE Passport">
              <span className="font-mono">{r.optima}</span>
            </Detail>
            <Detail label="Employer">{r.employer}</Detail>
            <Detail label="Role">{r.role}</Detail>
            <Detail label="Category">{r.category}</Detail>
            <Detail label="Nationality">{r.nationality}</Detail>
            <Detail label="HSE Passport">{formatDay(r.hsePassportExpiry)}</Detail>
          </div>
          <div>
            <Detail label="Currently at">{r.locationName}</Detail>
            <Detail label="Aboard">{r.vessel || '—'}</Detail>
            <Detail label="At this site">{r.daysOffshore} days</Detail>
            <Detail label="Days offshore">
              <span className="inline-flex items-center gap-2">
                {r.daysOffshore}
                <StatusPill tone={r.overLimit ? 'danger' : 'neutral'}>
                  {r.overLimit ? 'Over limit' : 'Within limit'}
                </StatusPill>
              </span>
            </Detail>
            <Detail label="Offshore since">{formatDay(r.onBoardAt.slice(0, 10))}</Detail>
            <Detail label="Recorded by">Crew entry</Detail>
            <Detail label="Expected until">
              <span className="inline-flex items-center gap-2">
                {formatDay(r.until)}
                {r.overdue && <StatusPill tone="danger">overdue</StatusPill>}
              </span>
            </Detail>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-ink-muted">Movement</p>
          <p className="text-sm text-ink">
            {r.locationName} <StatusPill tone="info">NOW</StatusPill>{' '}
            {formatDay(r.onBoardAt.slice(0, 10))} onward · {r.daysOffshore} days
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-ink-muted">Recorded entries</p>
          <p className="text-sm text-ink-secondary">
            {formatDay(r.onBoardAt)} · Entered on the crew list · {r.locationName} · Crewing{' '}
            {r.vessel || '—'} · {r.recordedBy}
          </p>
        </div>
        <Note>Musters at their assigned point on {r.locationName}.</Note>
      </div>
    </Modal>
  );
}

function CrewCheckInModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const today = useRecordsToday().data?.today ?? '';
  const sites = useSites();
  const members = usePobQuery<CrewMember[]>(`${RECORDS}/crew-members`);
  const vessels = usePobQuery<Vessel[]>(`${RECORDS}/vessels`);
  const [q, setQ] = useState('');
  const [member, setMember] = useState<CrewMember | null>(null);
  const [locationCode, setLocationCode] = useState('');
  const [vessel, setVessel] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState('15:00');
  const [until, setUntil] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const day = date ?? today;

  const needle = q.trim().toLowerCase();
  const matches = (members.data ?? []).filter(
    (m) =>
      !needle || `${m.name} ${m.optima} ${m.employer} ${m.role}`.toLowerCase().includes(needle),
  );
  const missing = [
    !member && 'A crew member is required.',
    !locationCode && 'A location is required.',
    !day && 'A date on board is required.',
    !until && 'An until-when date is required.',
    until && day && until < day && 'Until must be on or after the date on board.',
  ].filter((m): m is string => typeof m === 'string');

  const save = async () => {
    if (!member || missing.length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      await recordsSend('POST', '/crew', {
        optima: member.optima,
        locationCode,
        vessel,
        date: day,
        time,
        until,
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
      title="Check a crew member in"
      size="lg"
    >
      <div className="space-y-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        <Field
          label="Crew member"
          required
          placeholder="Name, HSE Passport / Optima number, employer or role"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {matches.map((m) => (
            <PersonChoice
              key={m.optima}
              name={m.name}
              detail={`${m.role} · ${m.employer}`}
              optima={m.optima}
              selected={member?.optima === m.optima}
              onSelect={() => setMember(m)}
            />
          ))}
          {matches.length === 0 && <Note>No crew member matches “{q}”.</Note>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Location checked in"
            required
            value={locationCode}
            onChange={(e) => setLocationCode(e.target.value)}
          >
            <option value="">— Select a location —</option>
            {sites.data?.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Vessel they crew"
            value={vessel}
            onChange={(e) => setVessel(e.target.value)}
          >
            <option value="">— None / not listed —</option>
            {vessels.data?.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
              </option>
            ))}
          </SelectField>
        </div>
        <Note>
          The location is what puts them in a headcount and on a muster list. The vessel is
          optional: a mechanic may be working a barge nothing in this system carries.
        </Note>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Date on board"
            type="date"
            required
            value={day}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="space-y-1.5">
            <label htmlFor="crew-time" className="block text-label text-ink-secondary">
              Time on board
            </label>
            <Input
              id="crew-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <Field
            label="Until"
            type="date"
            required
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </div>
        <Note>
          Until-when is required. A crew record with no end is somebody nobody ever takes off the
          list, and they stay in the headcount and in the muster.
        </Note>
        <MissingList items={missing} />
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy || missing.length > 0}>
            Add to crew list
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
