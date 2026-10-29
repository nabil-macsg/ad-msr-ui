import type { ReactNode, SubmitEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from './banner';
import { Button } from './button';
import { Modal, ModalFooter } from './modal';

/**
 * Create or edit a master record in a modal (PROMPT §4.2). The page owns the form (react-hook-form
 * + zod) and passes its fields and submit handler; API refusals show as `error`.
 */
export function EntityFormModal({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting = false,
  submitLabel,
  error,
  children,
  size,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  submitting?: boolean;
  submitLabel?: string;
  error?: string | null;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description ? { description } : {})}
      {...(size ? { size } : {})}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}
        {children}
        <ModalFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('ui.cancel')}
          </Button>
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitLabel ?? t('ui.save')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
