import { json, noContent, problem } from '../core/http';
import { route } from '../core/router';
import { currentPersona, signOutDemo } from '../demo-auth';

/** `me`, `me/access` and sign-out for the demo user picked on the demo login screen. */
export function registerSession(): void {
  const unauthenticated = () => problem(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  route('GET', '/api/v1/me', () => {
    const persona = currentPersona();
    return persona ? json(persona.me) : unauthenticated();
  });
  route('GET', '/api/v1/me/access', () => {
    const persona = currentPersona();
    return persona ? json(persona.access) : unauthenticated();
  });
  route('POST', '/api/v1/auth/logout', () => {
    signOutDemo();
    return noContent();
  });
  route('POST', '/api/v1/auth/refresh', () => unauthenticated());
}
