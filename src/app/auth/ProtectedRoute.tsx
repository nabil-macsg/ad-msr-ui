import { Navigate, Outlet, useLocation } from 'react-router';
import { ViewportGate } from '../layouts/ViewportGate';
import { loginPath } from '../sign-in/return-to';
import { ThemePreviewToolbar } from '../theme/ThemePreviewToolbar';
import { useAuth } from './auth-context';

/**
 * Every application route sits below this one: without the demo login it goes to /login,
 * keeping the requested address (after Log out, to /login alone).
 */
export function ProtectedRoute() {
  const { signedIn, loggedOut, ended } = useAuth();
  const location = useLocation();
  if (!signedIn) {
    const here = `${location.pathname}${location.search}${location.hash}`;
    const to = loggedOut ? '/login' : loginPath(here, ended ? 'SESSION_ENDED' : undefined);
    return <Navigate to={to} replace />;
  }
  return (
    <ViewportGate>
      <ThemePreviewToolbar />
      <Outlet />
    </ViewportGate>
  );
}
