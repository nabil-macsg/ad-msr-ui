import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import { ConfirmDialog } from './confirm-dialog';
import { EntityFormModal } from './entity-form-modal';
import { Field } from './field';
import { FileDropzone } from './file-dropzone';
import { Stepper } from './stepper';
import { type CapturedWeight, UnitInput } from './unit-input';

describe('PROMPT-4.2 ConfirmDialog', () => {
  it('PROMPT-2.8 refuses to confirm without a reason', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Cancel booking BK-2026-0002?"
        body="The passenger is notified."
        confirmLabel="Cancel booking"
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByText('Enter a reason')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toHaveAttribute('aria-invalid', 'true');
    expect(onConfirm).not.toHaveBeenCalled();
    await expectAccessible();
  });

  it('PROMPT-2.8 passes the reason on and closes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel booking?"
        body="The passenger is notified."
        confirmLabel="Cancel booking"
        onConfirm={onConfirm}
      />,
    );
    await user.type(screen.getByLabelText('Reason'), '  Weather on Das Island  ');
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(onConfirm).toHaveBeenCalledWith('Weather on Das Island');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('PROMPT-2.16 shows a refusal in the dialog and stays open', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Deactivate DAS?"
        body="It can no longer be chosen."
        confirmLabel="Deactivate"
        onConfirm={() =>
          Promise.reject(
            new Error('This record was changed by someone else. Reload it and try again.'),
          )
        }
      />,
    );
    await user.type(screen.getByLabelText('Reason'), 'Closed for works');
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(
      await screen.findByText('This record was changed by someone else. Reload it and try again.'),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('PROMPT-4.2 can confirm without a reason when the action needs none', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Mark all read?"
        body="All alerts are marked as read."
        confirmLabel="Mark all"
        tone="primary"
        requireReason={false}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.queryByLabelText('Reason')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mark all' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });
});

describe('PROMPT-4.2 EntityFormModal', () => {
  it('PROMPT-4.2 submits the page’s form and shows the API refusal', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const onOpenChange = vi.fn();
    render(
      <EntityFormModal
        open
        onOpenChange={onOpenChange}
        title="Edit location"
        onSubmit={onSubmit}
        error="A location with this code exists."
      >
        <Field label="Code" defaultValue="DAS" />
      </EntityFormModal>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit location' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('A location with this code exists.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await expectAccessible();
  });
});

describe('PROMPT-4.2 Stepper', () => {
  it('PROMPT-4.2 marks the current step', async () => {
    const { container } = render(
      <Stepper
        steps={[
          { id: 'journey', label: 'Journey' },
          { id: 'review', label: 'Review & Submit' },
        ]}
        current={1}
      />,
    );
    expect(screen.getByText('Review & Submit').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Journey').closest('li')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Step 2 of 2:')).toHaveClass('sr-only');
    await expectAccessible(container);
  });
});

describe('PROMPT-2.10 FileDropzone', () => {
  const pdf = (name: string, bytes: number) =>
    new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

  it('PROMPT-2.10 takes accepted files, chosen or dropped', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    const { container } = render(
      <FileDropzone
        accept={['application/pdf', '.png']}
        acceptLabel="PDF or PNG"
        maxSizeMb={1}
        multiple
        onFiles={onFiles}
      />,
    );
    await user.upload(screen.getByLabelText('choose files'), pdf('manifest.pdf', 10));
    expect(onFiles).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'manifest.pdf' })]);
    fireEvent.drop(screen.getByText(/Drag files here/).closest('div') as HTMLElement, {
      dataTransfer: { files: [new File(['x'], 'deck.PNG', { type: 'image/png' })] },
    });
    expect(onFiles).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'deck.PNG' })]);
    expect(screen.getByText('PDF or PNG · up to 1 MB each')).toBeInTheDocument();
    await expectAccessible(container);
  });

  it('PROMPT-2.10 refuses the wrong type and oversized files before uploading', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onFiles = vi.fn();
    render(
      <FileDropzone
        accept={['application/pdf']}
        acceptLabel="PDF"
        maxSizeMb={1}
        multiple
        onFiles={onFiles}
      />,
    );
    await user.upload(screen.getByLabelText('choose files'), [
      new File(['x'], 'run.exe', { type: 'application/octet-stream' }),
      pdf('big.pdf', 1024 * 1024 + 1),
    ]);
    expect(onFiles).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('run.exe is not an accepted file type.');
    expect(alert).toHaveTextContent('big.pdf is larger than 1 MB.');
  });
});

describe('PROMPT-2.15 UnitInput', () => {
  function Harness({ onChange }: { onChange: (v: CapturedWeight | null) => void }) {
    const [value, setValue] = useState<CapturedWeight | null>(null);
    return (
      <UnitInput
        label="Baggage weight"
        defaultUnit="lb"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    );
  }

  it('PROMPT-2.15 captures in lb and stores kg, keeping what was entered', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'lb' })).toHaveAttribute('aria-checked', 'true');
    await user.type(screen.getByLabelText('Baggage weight'), '220');
    expect(onChange).toHaveBeenLastCalledWith({ kg: 99.79, captured: { value: 220, unit: 'lb' } });
    expect(screen.getByText('= 99.79 kg')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'kg' }));
    expect(onChange).toHaveBeenLastCalledWith({ kg: 220, captured: { value: 220, unit: 'kg' } });
    await expectAccessible(container);
  });

  it('PROMPT-2.15 an empty, negative or non-numeric entry is no weight', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByLabelText('Baggage weight'), '-5');
    expect(onChange).toHaveBeenLastCalledWith(null);
    await user.clear(screen.getByLabelText('Baggage weight'));
    await user.type(screen.getByLabelText('Baggage weight'), 'abc');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
