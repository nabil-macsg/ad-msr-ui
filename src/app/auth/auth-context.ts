import { createContext, useContext } from 'react';

export type LoginResult = 'ok' | 'invalid';

export interface AuthContextValue {
  readonly signedIn: boolean;
  /** Set after Log out, so the app goes to the login page without a "return to" address. */
  readonly loggedOut: boolean;
  /** Set when the session ended on its own, so the login page says so. */
  readonly ended: boolean;
  login: (username: string, password: string) => LoginResult;
  logout: () => void;
  /** The session is gone (the API answered 401): back to login, keeping the address. */
  expire: (ended: boolean) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth needs an AuthProvider');
  return value;
}
