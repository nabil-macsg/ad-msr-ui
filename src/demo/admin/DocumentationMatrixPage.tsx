import { type SubmitEvent, useState } from 'react';
import { type MasterFormProps, MasterPage } from '../../modules/administration/masters/master-page';
import { CheckboxList } from '../../shared/ui/checkbox-list';
import { EntityFormModal } from '../../shared/ui/entity-form-modal';
import { Field } from '../../shared/ui/field';
import { StatusPill } from '../../shared/ui/status-pill';
import {
  ASSET_TYPES,
  DOCUMENTS_PATH,
  type DocumentRequirementRow,
  documentRequirements,
  saveRecord,
  useDocumentCounts,
} from './admin-api';

const ASSET_OPTIONS = ASSET_TYPES.map((type) => ({ value: type, label: type }));

/** Documentation Matrix (original `admin-documentation-matrix`). */
export default function DocumentationMatrixPage() {
  return (
    <MasterPage<DocumentRequirementRow>
      resource={documentRequirements}
      title="Documentation Matrix"
      subtitle="Which supporting documents each asset type must supply at inspection"
      noun="document"
      searchPlaceholder="Search documents..."
      describe={(row) => row.name}
      form={DocumentForm}
      kpis={<DocumentCounts />}
      columns={[
        {
          id: 'name',
          header: 'Document',
          sortField: 'name',
          cell: (row) => <span className="font-medium text-ink">{row.name}</span>,
        },
        { id: 'category', header: 'Category', sortField: 'category', cell: (row) => row.category },
        { id: 'appliesTo', header: 'Applies To', cell: (row) => row.assetTypes.join(', ') },
        {
          id: 'mandatory',
          header: 'Mandatory',
          sortField: 'mandatory',
          cell: (row) =>
            row.mandatory ? (
              <StatusPill tone="info">Mandatory</StatusPill>
            ) : (
              <StatusPill tone="neutral">Optional</StatusPill>
            ),
        },
      ]}
      lifecycleText={{
        deactivate: {
          menu: 'Deactivate',
          title: () => 'Deactivate document',
          body: (row) =>
            `This will mark ${row.name} as deactivated. It stays visible in historical records but won't be offered for new ones.`,
        },
      }}
    />
  );
}

/** Documents required per asset type: the counts that drive an inspection's upload slots. */
function DocumentCounts() {
  const counts = useDocumentCounts();
  return (
    <section
      aria-labelledby="doc-counts"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <h2 id="doc-counts" className="text-label font-medium text-ink-secondary">
        Documents required per asset type
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(counts.data ?? []).map((count) => (
          <li key={count.assetType} className="rounded-lg bg-surface-muted p-3">
            <p className="text-sm text-ink">
              <span className="text-kpi leading-none font-semibold tabular-nums">
                {count.required}
              </span>{' '}
              {count.assetType}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{count.mandatory} mandatory</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-muted">
        These counts are what the matrix configures: a wellhead tower carrying a helipad needs far
        fewer documents than a full helideck. They drive the upload slots on the inspection.
      </p>
    </section>
  );
}

function DocumentForm({
  open,
  onOpenChange,
  record,
  onSaved,
}: MasterFormProps<DocumentRequirementRow>) {
  const [name, setName] = useState(record?.name ?? '');
  const [category, setCategory] = useState(record?.category ?? '');
  const [assetTypes, setAssetTypes] = useState<string[]>(record?.assetTypes ?? []);
  const [mandatory, setMandatory] = useState(record?.mandatory ?? false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missing = name.trim() ? undefined : 'Enter the document name.';
    setNameError(missing);
    if (missing) return;
    setFailure(null);
    setSaving(true);
    try {
      await saveRecord(DOCUMENTS_PATH, record, {
        name: name.trim(),
        category: category.trim(),
        assetTypes,
        mandatory,
      });
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The document was not saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit document' : 'New document'}
      onSubmit={(event) => void submit(event)}
      submitting={saving}
      error={failure}
    >
      <Field
        label="Document name"
        required
        placeholder="e.g. Friction test report"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
      />
      <Field
        label="Category"
        placeholder="e.g. Test, Structure, Firefighting"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <CheckboxList
        legend="Applicable asset types"
        options={ASSET_OPTIONS}
        selected={assetTypes}
        onChange={setAssetTypes}
      />
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={mandatory}
          onChange={(e) => setMandatory(e.target.checked)}
        />
        Mandatory — an inspection cannot be accepted without it
      </label>
    </EntityFormModal>
  );
}
