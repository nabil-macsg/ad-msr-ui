import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { ScopeEditor } from './ScopeEditor';
import type { RoleOption, RoleScope, ScopeOptions } from './users-api';

const OPTIONS: ScopeOptions = {
  zones: [{ id: '00000000-0000-4000-8000-0000000000a1', code: 'DAS', name: 'Das Island' }],
  locations: [
    {
      id: '00000000-0000-4000-8000-0000000000b1',
      code: 'DAS-1',
      name: 'Das Terminal',
      zoneId: '00000000-0000-4000-8000-0000000000a1',
    },
  ],
  serviceProviders: [
    { id: '00000000-0000-4000-8000-0000000000c1', code: 'FAL', name: 'Falcon Aviation' },
  ],
  departments: [{ id: '00000000-0000-4000-8000-0000000000d1', code: 'OPS', name: 'Operations' }],
  modules: [{ key: 'pob', label: 'POB Tracking' }],
};

function Harness({
  level,
  external = false,
  initial = {},
  onChange,
}: {
  level: RoleOption['scopeLevel'];
  external?: boolean;
  initial?: RoleScope;
  onChange: (scope: RoleScope) => void;
}) {
  const [scope, setScope] = useState<RoleScope>(initial);
  return (
    <ScopeEditor
      level={level}
      external={external}
      value={scope}
      options={OPTIONS}
      onChange={(next) => {
        setScope(next);
        onChange(next);
      }}
    />
  );
}

describe('PROMPT-2.7 the scope editor shows what each role level needs', () => {
  it('module: modules and places; All locations replaces zones and locations', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness level="module" onChange={onChange} />);
    await user.click(screen.getByLabelText('POB Tracking'));
    await user.click(screen.getByLabelText('Das Terminal (DAS-1)'));
    expect(onChange).toHaveBeenLastCalledWith({
      moduleKeys: ['pob'],
      locationIds: [OPTIONS.locations[0]?.id],
    });
    await user.click(screen.getByLabelText('All locations'));
    expect(onChange).toHaveBeenLastCalledWith({ moduleKeys: ['pob'], allLocations: true });
    expect(screen.queryByLabelText('Das Terminal (DAS-1)')).not.toBeInTheDocument();
    await expectAccessible();
  });

  it('provider and external roles: choose the service provider', async () => {
    const onChange = vi.fn();
    render(<Harness level="site" external onChange={onChange} />);
    await userEvent
      .setup()
      .selectOptions(
        screen.getByLabelText('Service provider'),
        OPTIONS.serviceProviders[0]?.id ?? '',
      );
    expect(onChange).toHaveBeenLastCalledWith({
      serviceProviderId: OPTIONS.serviceProviders[0]?.id,
    });
  });

  it('department and self levels', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<Harness level="department" onChange={onChange} />);
    await user.click(screen.getByLabelText('Operations (OPS)'));
    expect(onChange).toHaveBeenLastCalledWith({ departmentIds: [OPTIONS.departments[0]?.id] });
    unmount();
    render(<Harness level="self" initial={{ self: true }} onChange={onChange} />);
    await user.click(screen.getByLabelText('The people who report to them'));
    await user.click(screen.getByLabelText("The person's own records"));
    expect(onChange).toHaveBeenLastCalledWith({ lineManagerOf: true });
  });

  it('platform: All locations, fixed', () => {
    render(<Harness level="platform" initial={{ allLocations: true }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('All locations')).toBeChecked();
    expect(screen.getByLabelText('All locations')).toBeDisabled();
  });
});
