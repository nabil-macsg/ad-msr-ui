import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { type ParamsDraft, paramsDraft, paramsOf } from './param-draft';
import { ParametersEditor } from './ParametersEditor';
import type { ColumnField, ParamField } from './rules-api';

const base = {
  min: null,
  max: null,
  step: null,
  unit: null,
  nullable: false,
  options: null,
  columns: null,
  minRows: null,
  maxRows: null,
};
const column = (
  c: Partial<ColumnField> & Pick<ColumnField, 'kind' | 'key' | 'label'>,
): ColumnField => ({
  ...base,
  ...c,
});
const FIELDS: ParamField[] = [
  {
    ...base,
    kind: 'order',
    key: 'order',
    label: 'Order',
    options: [
      { value: 'crew-change', label: 'Crew change' },
      { value: 'vip', label: 'VIP' },
    ],
  },
  { ...base, kind: 'codes', key: 'anyOf', label: 'Certificate types (any one of)' },
  { ...base, kind: 'boolean', key: 'enabled', label: 'Hold back the largest lifeboat' },
  {
    ...base,
    kind: 'choices',
    key: 'categories',
    label: 'Categories',
    options: [
      { value: 'FIXED-WING', label: 'Fixed-wing' },
      { value: 'MARINE', label: 'Marine' },
    ],
  },
  {
    ...base,
    kind: 'table',
    key: 'bands',
    label: 'Bands',
    minRows: 1,
    maxRows: 3,
    columns: [
      column({ kind: 'integer', key: 'minPct', label: 'Score from', unit: '%' }),
      column({
        kind: 'choice',
        key: 'result',
        label: 'Result',
        options: [
          { value: 'pass', label: 'Pass' },
          { value: 'fail', label: 'Fail' },
        ],
      }),
    ],
  },
];

function Harness({ onValue }: { onValue: (value: ParamsDraft) => void }) {
  const [value, setValue] = useState<ParamsDraft>(() => paramsDraft(FIELDS, null));
  return (
    <ParametersEditor
      fields={FIELDS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      problems={{}}
    />
  );
}

describe('SPEC-10-3.2 the type-specific parameter controls', () => {
  it('SPEC-10-3.2 orders, lists, flags, choices and table rows edit the parameters', async () => {
    const user = userEvent.setup();
    let latest: ParamsDraft = {};
    render(
      <Harness
        onValue={(value) => {
          latest = value;
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Move VIP up' }));
    await user.type(screen.getByLabelText('Certificate types (any one of)'), 'OPITO, T-HUET');
    await user.click(screen.getByLabelText('Hold back the largest lifeboat'));
    await user.click(screen.getByLabelText('Marine'));
    await user.type(screen.getByLabelText('Score from, row 1'), '70');
    await user.selectOptions(screen.getByLabelText('Result, row 1'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await user.type(screen.getByLabelText('Score from, row 2'), '0');
    await user.selectOptions(screen.getByLabelText('Result, row 2'), 'fail');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    expect(screen.getByRole('button', { name: 'Add row' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove row 3' }));

    expect(paramsOf(FIELDS, latest)).toEqual({
      value: {
        order: ['vip', 'crew-change'],
        anyOf: ['OPITO', 'T-HUET'],
        enabled: true,
        categories: ['MARINE'],
        bands: [
          { minPct: 70, result: 'pass' },
          { minPct: 0, result: 'fail' },
        ],
      },
      problems: {},
    });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await expectAccessible();
  });
});
