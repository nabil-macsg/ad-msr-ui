/**
 * DEMO ONLY — the single account that opens this standalone demo. It is not a MASAR or ADNOC
 * account, guards nothing but navigation, and ships in the JavaScript bundle like every other
 * line here: anyone can read it. Real protection for a hosted copy belongs at the web server
 * (see README, "Hosting").
 */
export const DEMO_ACCOUNT = {
  username: 'demo',
  password: 'AdMsr#2026',
  /** The static demo user the account opens the screens as (src/mock/demo-auth.ts). */
  persona: 'admin',
} as const;
