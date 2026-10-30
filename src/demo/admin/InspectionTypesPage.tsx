import { type SubmitEvent, useState } from 'react';
import { type MasterFormProps, MasterPage } from '../../modules/administration/masters/master-page';
import { CheckboxList } from '../../shared/ui/checkbox-list';
import { EntityFormModal } from '../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../shared/ui/field';
import {
  ASSET_TYPES,
  INSPECTION_ACTIVITIES,
  INSPECTION_TYPES_PATH,
  type InspectionTypeRow,
  inspectionTypes,
  saveRecord,
} from './admin-api';

const ASSET_OPTIONS = ASSET_TYPES.map((type) => ({ value: type, label: type }));

/** Inspection / Test Type Configuration (original `admin-inspection-types`). */
export default function InspectionTypesPage() {
  return (
    <MasterPage<InspectionTypeRow>
      resource={inspectionTypes}
      title="Inspection / Test Type Configuration"
      subtitle="What is inspected, how long an acceptance lasts, and which installations it applies to"
      noun="inspection type"
      searchPlaceholder="Search inspection types..."
      describe={(row) => row.name}
      form={InspectionTypeForm}
      columns={[
        {
          id: 'name',
          header: 'Inspection / Test Type',
          sortField: 'name',
          cell: (row) => <span className="font-medium text-ink">{row.name}</span>,
        },
        { id: 'activity', header: 'Activity', sortField: 'activity', cell: (row) => row.activity },
        {
          id: 'validity',
          header: 'Validity',
          sortField: 'validity',
          cell: (row) => `${String(row.validityMonths)} months`,
        },
        {
          id: 'appliesTo',
          header: 'Applies To',
          cell: (row) =>
            row.assetTypes.length > 0 ? (
              row.assetTypes.join(', ')
            ) : (
              <span className="text-ink-muted">Assessed per site, not per installation</span>
            ),
        },
      ]}
      lifecycleText={{
        deactivate: {
          menu: 'Deactivate',
          title: () => 'Deactivate inspection type',
          body: (row) =>
            `This will mark ${row.name} as deactivated. It stays visible in historical records but won't be offered for new ones.` +
            (row.references > 0
              ? ` Still referenced by: ${String(row.references)} inspections and tests. Those records keep pointing at it and will read as stale rather than break.`
              : ''),
        },
      }}
    />
  );
}

function InspectionTypeForm({
  open,
  onOpenChange,
  record,
  onSaved,
}: MasterFormProps<InspectionTypeRow>) {
  const [name, setName] = useState(record?.name ?? '');
  const [activity, setActivity] = useState(record?.activity ?? INSPECTION_ACTIVITIES[0]);
  const [validity, setValidity] = useState(String(record?.validityMonths ?? 12));
  const [assetTypes, setAssetTypes] = useState<string[]>(record?.assetTypes ?? []);
  const [errors, setErrors] = useState<{ name?: string; validity?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const months = Number(validity);
    const found = {
      ...(name.trim() ? {} : { name: 'Enter the inspection / test type.' }),
      ...(Number.isInteger(months) && months >= 1
        ? {}
        : { validity: 'Enter a whole number of months, at least 1.' }),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFailure(null);
    setSaving(true);
    try {
      await saveRecord(INSPECTION_TYPES_PATH, record, {
        name: name.trim(),
        activity,
        validityMonths: months,
        assetTypes,
      });
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The inspection type was not saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit inspection type' : 'New inspection type'}
      onSubmit={(event) => void submit(event)}
      submitting={saving}
      error={failure}
    >
      <Field
        label="Inspection / Test Type"
        required
        placeholder="e.g. Helideck Inspection"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <SelectField label="Activity" value={activity} onChange={(e) => setActivity(e.target.value)}>
        {INSPECTION_ACTIVITIES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
      <div>
        <Field
          label="Validity period (months)"
          required
          type="number"
          min={1}
          value={validity}
          onChange={(e) => setValidity(e.target.value)}
          error={errors.validity}
        />
        <p className="mt-1 text-xs text-ink-secondary">
          How long an acceptance from this inspection lasts. It sets when the next one falls due and
          what the HLL publishes as Acceptance Until.
        </p>
      </div>
      <CheckboxList
        legend="Applicable asset types"
        options={ASSET_OPTIONS}
        selected={assetTypes}
        onChange={setAssetTypes}
        hint="Leave empty where the type is assessed per site rather than per installation, as a crew assessment is."
      />
    </EntityFormModal>
  );
}
