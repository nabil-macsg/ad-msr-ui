import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { Field } from '../../../shared/ui/field';
import { Modal, ModalFooter } from '../../../shared/ui/modal';

export interface AccessChange {
  readonly reason: string;
  readonly referenceId: string;
}

/**
 * Confirms an access change (BRD D.2.1.1): the access-request reference ID is always required,
 * the reason when the change needs one. A refusal from the API stays in the dialog.
 */
export function AccessChangeDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  tone = 'primary',
  requireReason = true,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  requireReason?: boolean;
  /** Extra fields above the reference, e.g. the approval tier. */
  children?: ReactNode;
  onConfirm: (change: AccessChange) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const schema = z.object({
    reason: requireReason
      ? z.string().trim().min(3, t('users.dialog.reasonRequired')).max(500)
      : z.string().trim().max(500),
    referenceId: z.string().trim().min(1, t('users.dialog.referenceRequired')).max(100),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '', referenceId: '' },
  });
  const [failure, setFailure] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;

  const close = (next: boolean) => {
    if (!next) {
      form.reset();
      setFailure(null);
    }
    onOpenChange(next);
  };

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await onConfirm(values);
      close(false);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  });

  return (
    <Modal open={open} onOpenChange={close} title={title} description={body} size="sm">
      <form onSubmit={submit} noValidate className="space-y-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        {children}
        {requireReason && (
          <Field
            label={t('users.dialog.reason')}
            error={errors.reason?.message}
            {...form.register('reason')}
          />
        )}
        <div className="space-y-1">
          <Field
            label={t('users.dialog.reference')}
            error={errors.referenceId?.message}
            autoComplete="off"
            {...form.register('referenceId')}
          />
          <p className="text-xs text-ink-muted">{t('users.dialog.referenceHint')}</p>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => close(false)}>
            {t('ui.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className={tone === 'danger' ? 'bg-danger-fg hover:bg-danger-fg/90' : undefined}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
