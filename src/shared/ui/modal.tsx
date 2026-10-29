import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

export interface ModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
}

const WIDTH = { sm: 'w-[min(28rem,92vw)]', md: 'w-[min(36rem,92vw)]', lg: 'w-[min(52rem,92vw)]' };

/** A centred dialog: focus trapped, Escape closes, the title names it. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: ModalProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[min(88vh,56rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-card shadow-modal',
            WIDTH[size],
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
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
              className="-mr-1 rounded-lg p-1 text-ink-muted transition-colors hover:text-ink-secondary focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={t('ui.close')}
            >
              <X className="size-[18px]" aria-hidden />
            </Dialog.Close>
          </div>
          {/* Only the body scrolls: the title stays put, and a ModalFooter stays at the bottom. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-0">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A dialog's actions: right-aligned, pinned to the bottom while the body scrolls. */
export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-6 mt-5 flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
