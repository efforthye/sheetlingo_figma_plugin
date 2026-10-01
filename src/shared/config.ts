/**
 * URL of your deployed auth server (server/ → Cloudflare Worker).
 * Set it with:  node scripts/set-auth-server.mjs https://sheetlingo-auth.<you>.workers.dev
 * (updates this file AND manifest.json networkAccess)
 */
export const AUTH_SERVER = 'https://sheetlingo-auth.efforthye.workers.dev';

export const authConfigured = () => !AUTH_SERVER.includes('YOUR-SUBDOMAIN');

/** Private (signed-in) sheets: how often to check the sheet's modifiedTime. */
export const LIVE_CHECK_MS = 10_000;
/** Public link sheets: how often to re-download the CSV (Pro auto-sync). */
export const PUBLIC_SYNC_MS = 60_000;
