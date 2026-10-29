import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { api } from '../../api/client';
import { ApiError, unwrap } from '../../api/errors';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { Field } from '../../shared/ui/field';
import { Modal, ModalFooter } from '../../shared/ui/modal';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required'),
    newPassword: z.string().min(12, 'validation.passwordLength').max(256),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: 'validation.mismatch',
  });
type Values = z.infer<typeof schema>;

/** External users only (PROMPT §2.6). Ends the user's other sessions. */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const errors = form.formState.errors;
  const message = (key?: string) => (key ? t(key as 'validation.required') : undefined);

  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setFailure(null);
    try {
      unwrap(
        await api.POST('/api/v1/auth/external/password/change', {
          body: { currentPassword, newPassword },
        }),
      );
      setDone(true);
      form.reset();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t('signIn.errors.SSO_FAILED'));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setDone(false);
      }}
      title={t('account.changePasswordTitle')}
      description={t('signIn.setPassword.lead')}
      size="sm"
    >
      {done ? (
        <Banner tone="success">{t('account.changed')}</Banner>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {failure && <Banner tone="danger">{failure}</Banner>}
          <Field
            label={t('account.currentPassword')}
            type="password"
            autoComplete="current-password"
            error={message(errors.currentPassword?.message)}
            {...form.register('currentPassword')}
          />
          <Field
            label={t('account.newPassword')}
            type="password"
            autoComplete="new-password"
            error={message(errors.newPassword?.message)}
            {...form.register('newPassword')}
          />
          <Field
            label={t('account.confirmPassword')}
            type="password"
            autoComplete="new-password"
            error={message(errors.confirm?.message)}
            {...form.register('confirm')}
          />
          <ModalFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('account.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('account.save')}
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
