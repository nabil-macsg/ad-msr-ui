import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** A panel from the right edge for previews and histories: focus trapped, Escape closes. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-[min(32rem,92vw)] flex-col border-l border-border bg-card shadow-modal"
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-lg leading-tight font-semibold text-ink">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-ink-secondary">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink-secondary focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={t('ui.close')}
            >
              <X className="size-[18px]" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
