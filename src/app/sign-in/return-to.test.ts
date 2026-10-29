import { describe, expect, it } from 'vitest';
import { loginPath, safeReturnTo } from './return-to';

describe('PROMPT-2.17 login returns only to paths inside the app', () => {
  it('PROMPT-2.17 keeps in-app paths', () => {
    expect(safeReturnTo('/pob/dashboard?x=1')).toBe('/pob/dashboard?x=1');
  });

  it('PROMPT-2.17 refuses other origins, schemes and the public pages', () => {
    for (const value of [
      null,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil',
      '/',
      '/login',
    ]) {
      expect(safeReturnTo(value)).toBe('/dashboard');
    }
  });

  it('PROMPT-2.6 builds the login address', () => {
    expect(loginPath('/dashboard')).toBe('/login');
    expect(loginPath('/pob', 'SESSION_ENDED')).toBe('/login?returnTo=%2Fpob&error=SESSION_ENDED');
  });
});
