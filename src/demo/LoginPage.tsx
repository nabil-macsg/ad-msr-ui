import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../app/auth/auth-context';
import { safeReturnTo } from '../app/sign-in/return-to';
import { SignInLayout } from '../app/sign-in/SignInLayout';
import { Banner } from '../shared/ui/banner';
import { Button } from '../shared/ui/button';
import { Field } from '../shared/ui/field';

interface Errors {
  username?: string;
  password?: string;
  form?: string;
}

/** The demo login: one demo account (src/app/auth/demo-account.ts), checked in the browser. */
export function LoginPage() {
  const { t } = useTranslation();
  const { signedIn, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  if (signedIn) return <Navigate to={returnTo} replace />;

  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!username.trim()) next.username = t('demo.login.usernameRequired');
    if (!password) next.password = t('demo.login.passwordRequired');
    if (!next.username && !next.password && login(username, password) === 'invalid') {
      next.form = t('demo.login.invalid');
      setPassword('');
    }
    setErrors(next);
    if (Object.keys(next).length === 0) void navigate(returnTo, { replace: true });
  };

  return (
    <SignInLayout>
      <h1 className="text-2xl font-bold text-ink">{t('demo.login.title')}</h1>
      {params.get('error') === 'SESSION_ENDED' && (
        <Banner tone="info">{t('signIn.errors.SESSION_ENDED')}</Banner>
      )}
      {errors.form && (
        <div role="alert">
          <Banner tone="danger">{errors.form}</Banner>
        </div>
      )}
      <form className="space-y-4" noValidate onSubmit={submit}>
        <Field
          label={t('demo.login.username')}
          name="username"
          autoComplete="username"
          required
          autoFocus
          value={username}
          error={errors.username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Field
          label={t('demo.login.password')}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" block>
          {t('demo.login.submit')}
        </Button>
      </form>
      <p className="text-xs text-ink-secondary">{t('demo.login.note')}</p>
    </SignInLayout>
  );
}
