import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import { currentPersona, signInAs, signOutDemo } from '../../mock/demo-auth';
import { AuthContext, type AuthContextValue } from './auth-context';
import { DEMO_ACCOUNT } from './demo-account';

/**
 * The demo's login state, for every route below it. A navigation gate only, not access
 * control: the session is a flag in this tab's sessionStorage (no password is stored), read
 * synchronously so a protected page never renders before the check.
 */
export function AuthProvider() {
  const queryClient = useQueryClient();
  const [state, setState] = useState(() => ({
    signedIn: currentPersona() !== undefined,
    loggedOut: false,
    ended: false,
  }));
  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: (username, password) => {
        if (username.trim() !== DEMO_ACCOUNT.username || password !== DEMO_ACCOUNT.password) {
          return 'invalid';
        }
        signInAs(DEMO_ACCOUNT.persona);
        queryClient.clear();
        setState({ signedIn: true, loggedOut: false, ended: false });
        return 'ok';
      },
      logout: () => {
        signOutDemo();
        setState({ signedIn: false, loggedOut: true, ended: false });
        queryClient.clear();
      },
      expire: (ended) => {
        signOutDemo();
        setState((s) => ({ signedIn: false, loggedOut: false, ended: s.ended || ended }));
        queryClient.clear();
      },
    }),
    [state, queryClient],
  );
  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  );
}
