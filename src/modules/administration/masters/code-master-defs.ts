import type { ParseKeys } from 'i18next';
import type { Tone } from '../../../shared/ui/tone';
import type { CodeMasterKind } from './code-master-api';

type Key = ParseKeys;

/** A field of a code master besides its code and name, as the page shows and edits it. */
export type FieldView =
  | {
      readonly kind: 'flag';
      readonly key: string;
      readonly label: Key;
      readonly pill: { tone: Tone; label: Key };
    }
  | {
      readonly kind: 'text';
      readonly key: string;
      readonly label: Key;
      readonly pattern?: RegExp;
      readonly invalid?: Key;
      readonly hint?: Key;
      readonly max: number;
    }
  | { readonly kind: 'number'; readonly key: string; readonly label: Key }
  | {
      readonly kind: 'choice';
      readonly key: string;
      readonly label: Key;
      readonly choices: readonly { value: string; label: Key }[];
    }
  | { readonly kind: 'ref'; readonly key: string; readonly label: Key; readonly choose: Key };

export interface CodeMasterView {
  readonly texts: { title: Key; subtitle: Key; noun: Key; search: Key };
  readonly codeMax: number;
  readonly fields: readonly FieldView[];
  /** False: fixed records; no New and no Delete. */
  readonly creatable?: boolean;
  readonly deletable?: boolean;
  /** Built-in records: never deleted or deactivated here (the API refuses them too). */
  readonly fixedCodes?: readonly string[];
}

/** Each code master's page (ADR-0056, ADR-0057). */
export const CODE_MASTER_VIEWS: Readonly<Record<CodeMasterKind, CodeMasterView>> = {
  zones: {
    texts: {
      title: 'places.zones.title',
      subtitle: 'places.zones.subtitle',
      noun: 'places.zones.noun',
      search: 'places.zones.search',
    },
    codeMax: 12,
    fields: [],
  },
  'location-types': {
    texts: {
      title: 'places.locationTypes.title',
      subtitle: 'places.locationTypes.subtitle',
      noun: 'places.locationTypes.noun',
      search: 'places.locationTypes.search',
    },
    codeMax: 20,
    fields: [
      {
        kind: 'flag',
        key: 'isMobile',
        label: 'places.code.form.mobile',
        pill: { tone: 'warning', label: 'places.code.mobile' },
      },
      {
        kind: 'flag',
        key: 'isOffshore',
        label: 'places.code.form.offshore',
        pill: { tone: 'info', label: 'places.code.offshore' },
      },
    ],
  },
  'installation-types': {
    texts: {
      title: 'places.installationTypes.title',
      subtitle: 'places.installationTypes.subtitle',
      noun: 'places.installationTypes.noun',
      search: 'places.installationTypes.search',
    },
    codeMax: 20,
    fields: [],
  },
  'resource-categories': {
    texts: {
      title: 'resources.categories.title',
      subtitle: 'resources.categories.subtitle',
      noun: 'resources.categories.noun',
      search: 'resources.categories.search',
    },
    codeMax: 20,
    fields: [
      {
        kind: 'choice',
        key: 'weightUnit',
        label: 'resources.fields.weightUnit',
        choices: [
          { value: 'kg', label: 'resources.choices.kg' },
          { value: 'lb', label: 'resources.choices.lb' },
        ],
      },
    ],
    fixedCodes: ['FIXED-WING', 'ROTARY-WING', 'MARINE'],
  },
  'cargo-types': {
    texts: {
      title: 'resources.cargoTypes.title',
      subtitle: 'resources.cargoTypes.subtitle',
      noun: 'resources.cargoTypes.noun',
      search: 'resources.cargoTypes.search',
    },
    codeMax: 20,
    fields: [
      {
        kind: 'text',
        key: 'dgClass',
        label: 'resources.fields.dgClass',
        pattern: /^([1-9](\.[1-6])?)?$/,
        invalid: 'resources.fields.dgClassInvalid',
        hint: 'resources.fields.dgClassHint',
        max: 4,
      },
    ],
  },
  'fuel-stations': {
    texts: {
      title: 'resources.fuelStations.title',
      subtitle: 'resources.fuelStations.subtitle',
      noun: 'resources.fuelStations.noun',
      search: 'resources.fuelStations.search',
    },
    codeMax: 20,
    fields: [
      {
        kind: 'ref',
        key: 'location',
        label: 'resources.fields.location',
        choose: 'resources.fields.chooseLocation',
      },
      { kind: 'number', key: 'capacityKg', label: 'resources.fields.capacityKg' },
      { kind: 'number', key: 'reorderLevelKg', label: 'resources.fields.reorderLevelKg' },
    ],
  },
};
