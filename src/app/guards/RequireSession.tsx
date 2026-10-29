import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { onSessionEnded } from '../../api/client';
import { ApiError } from '../../api/errors';
import { FullScreenSpinner } from '../../shared/ui/spinner';
import { useAuth } from '../auth/auth-context';
import { useRealtime } from '../realtime';
import { useMe, useMyAccess } from '../session/queries';

/** Signed-in area: loads the user and their access, or ends the demo login. */
export function RequireSession() {
  const me = useMe();
  const access = useMyAccess();
  const { expire } = useAuth();

  useEffect(() => onSessionEnded(() => expire(true)), [expire]);
  useRealtime();

  const error = me.error ?? access.error;
  const unauthenticated = error instanceof ApiError && error.status === 401;
  useEffect(() => {
    if (unauthenticated) expire(false);
  }, [unauthenticated, expire]);

  if (error && !unauthenticated) throw error;
  if (unauthenticated || !me.data || !access.data) return <FullScreenSpinner />;
  return <Outlet />;
}
