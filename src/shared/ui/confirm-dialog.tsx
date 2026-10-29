import { type SubmitEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Banner } from './banner';
import { Button } from './button';
import { CONTROL, LABEL } from './control-styles';
import { Modal, ModalFooter } from './modal';

/**
 * Confirms a consequential action. The reason is mandatory by default and goes to the audit log
 * with the action (PROMPT §2.8, §4.2). If `onConfirm` throws, its message shows in the dialog,
 * which stays open.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  tone = 'danger',
  requireReason = true,
  minReasonLength = 3,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  requireReason?: boolean;
  minReasonLength?: number;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const changeOpen = (next: boolean) => {
    if (!next) setFailure(null);
    onOpenChange(next);
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (requireReason && trimmed.length < minReasonLength) {
      setError(t('ui.confirm.reasonRequired'));
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await onConfirm(trimmed);
      setReason('');
      setError(null);
      changeOpen(false);
    } catch (thrown) {
      setFailure(thrown instanceof Error ? thrown.message : t('ui.confirm.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={changeOpen} title={title} description={body} size="sm">
      <form onSubmit={submit} noValidate className="space-y-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        {requireReason && (
          <div className="space-y-1.5">
            <label htmlFor={id} className={LABEL}>
              {t('ui.confirm.reason')}
            </label>
            <textarea
              id={id}
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-hint`}
              className={cn('w-full px-3 py-2', CONTROL)}
            />
            <p
              id={`${id}-hint`}
              className={error ? 'text-xs text-danger-fg' : 'text-xs text-ink-muted'}
            >
              {error ?? t('ui.confirm.reasonHint')}
            </p>
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => changeOpen(false)}>
            {t('ui.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className={tone === 'danger' ? 'bg-danger hover:bg-danger-fg' : undefined}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
