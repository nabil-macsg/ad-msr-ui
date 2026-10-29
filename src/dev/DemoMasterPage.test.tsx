import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DemoMasterPage } from './DemoMasterPage';

describe('ADR-0034 the gallery’s master page demo (local dev server only)', () => {
  it('PROMPT-4.2 creates, edits and deactivates synthetic zones, with their history', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DemoMasterPage />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: 'New zone' }));
    let form = screen.getByRole('dialog', { name: 'New zone' });
    await user.type(within(form).getByLabelText('Code'), 'bad code');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Use 2–12 capital letters, digits or hyphens'),
    ).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('Code'));
    await user.type(within(form).getByLabelText('Code'), 'MBZ');
    await user.type(within(form).getByLabelText('Name'), 'Mubarraz');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Mubarraz')).toBeInTheDocument();

    await user.click(screen.getByText('Zirku'));
    form = screen.getByRole('dialog', { name: 'Edit ZRK' });
    await user.clear(within(form).getByLabelText('Name'));
    await user.type(within(form).getByLabelText('Name'), 'Zirku Island');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Zirku Island')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions for DAS · Das Island' }));
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate DAS · Das Island?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Closed for works');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(screen.queryByText('Das Island')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Actions for ZRK · Zirku Island' }));
    await user.click(screen.getByRole('menuitem', { name: 'History' }));
    const drawer = screen.getByRole('dialog', { name: 'History of ZRK · Zirku Island' });
    expect(await within(drawer).findByText('Name: Zirku → Zirku Island')).toBeInTheDocument();
  });
});
