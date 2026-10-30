import { useState } from 'react';
import { useListParams } from '../../shared/lists/list-params';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Field, SelectField, TextAreaField } from '../../shared/ui/field';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { usePobQuery } from './pob-api';
import {
  fieldErrors,
  formatDay,
  type Override,
  type OverridePerson,
  RECORDS,
  recordsSend,
  useRecordsList,
  useRecordsRefresh,
  useRecordsToday,
  useSites,
} from './records-api';
import { MissingList, Note, PersonChoice } from './records-ui';

const COLUMNS: readonly Column<Override>[] = [
  {
    id: 'name',
    header: 'Passenger',
    sortField: 'name',
    cell: (r) => (
      <span>
        <span className="block font-medium text-ink">{r.name}</span>
        <span className="font-mono text-xs text-ink-muted">{r.optima}</span>
      </span>
    ),
  },
  {
    id: 'location',
    header: 'Recorded at',
    sortField: 'locationName',
    cell: (r) => r.locationName,
  },
  { id: 'date', header: 'Date', sortField: 'date', cell: (r) => formatDay(r.date) },
  { id: 'comment', header: 'Reason given', sortField: 'comment', cell: (r) => r.comment },
  { id: 'recordedBy', header: 'Recorded by', sortField: 'recordedBy', cell: (r) => r.recordedBy },
];

/** Location Override: correct where somebody is recorded when no dispatch record exists. */
export default function LocationOverridePage() {
  const { params, update, apiQuery } = useListParams();
  const list = useRecordsList<Override>('/overrides', apiQuery);
  const refresh = useRecordsRefresh();
  const [recording, setRecording] = useState(false);

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title="Location Override"
        subtitle="Correct where somebody is recorded when no dispatch record exists"
        actions={<Button onClick={() => setRecording(true)}>Record an arrival</Button>}
      />
      {list.isError && <Banner tone="danger">The corrections could not be loaded.</Banner>}
      <h2 className="text-sm font-semibold text-ink">Corrections made · {list.data?.total ?? 0}</h2>
      <DataTable
        caption="Corrections made"
        columns={COLUMNS}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(r) => r.id}
        params={params}
        onParamsChange={update}
        loading={list.isFetching}
        emptyTitle="No corrections made yet"
      />
      {recording && <ArrivalModal onClose={() => setRecording(false)} onSaved={refresh} />}
    </section>
  );
}

function ArrivalModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const today = useRecordsToday().data?.today ?? '';
  const sites = useSites();
  const [q, setQ] = useState('');
  const people = usePobQuery<OverridePerson[]>(
    `${RECORDS}/override-people?q=${encodeURIComponent(q.trim())}`,
  );
  const [person, setPerson] = useState<OverridePerson | null>(null);
  const [locationCode, setLocationCode] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const day = date ?? today;

  const missing = [
    !person && 'A passenger is required.',
    !locationCode && 'A location is required.',
    !day && 'A date is required.',
    !comment.trim() && 'A comment is required — it is the record of why this override was made.',
  ].filter((m): m is string => typeof m === 'string');

  const save = async () => {
    if (!person || missing.length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      await recordsSend('POST', '/overrides', {
        optima: person.optima,
        locationCode,
        date: day,
        comment,
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
      title="Record an arrival"
      size="lg"
    >
      <div className="space-y-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        <Field
          label="Find the passenger"
          placeholder="Name or Optima number"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div
          role="radiogroup"
          aria-label="Passenger"
          className="max-h-56 space-y-1.5 overflow-y-auto"
        >
          {people.data?.map((p) => (
            <PersonChoice
              key={p.optima}
              radio
              group="override-passenger"
              name={p.name}
              detail={`currently ${p.locationName}`}
              optima={p.optima}
              selected={person?.optima === p.optima}
              onSelect={() => setPerson(p)}
            />
          ))}
          {people.data?.length === 0 && <Note>Nobody matches “{q}”.</Note>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Arrived at"
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
          <Field
            label="Date"
            type="date"
            required
            value={day}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <TextAreaField
            label="Comment"
            required
            placeholder="e.g. Arrived by vessel Al Rayyan from Abu Dhabi"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Note>
            Required. The comment is the record of why POB was corrected by hand, and it is kept
            against the person.
          </Note>
        </div>
        <MissingList items={missing} />
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy || missing.length > 0}>
            Record arrival
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
