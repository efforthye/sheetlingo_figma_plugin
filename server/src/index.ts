/**
 * Sheetlingo auth server (Cloudflare Worker).
 *
 * Flow (Figma's recommended OAuth pattern for plugins):
 *   1. Plugin creates a random `key`, opens  GET /auth/start?key=…  in the browser
 *   2. Google consent → GET /auth/callback  → Google Picker page (user picks a spreadsheet)
 *   3. Picker page POSTs /auth/complete → result stored in KV under `key` (10 min TTL)
 *   4. Plugin polls  GET /auth/poll?key=…  → receives access token + encrypted refresh token + picked file
 *   5. Later, plugin calls  POST /auth/refresh {refresh}  → fresh access token
 *
 * Scope `drive.file` (non-sensitive): the app can only read spreadsheets the user picked.
 * The refresh token never leaves the server in plain text (AES-GCM with TOKEN_SECRET).
 */

export interface Env {
  PENDING: KVNamespace;
  /** Strongly consistent hand-off store (KV can serve stale reads for ~60 s at an edge). */
  PEND?: DurableObjectNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_API_KEY: string;
  GOOGLE_APP_ID: string;
  TOKEN_SECRET: string;
  /** Google Search Console HTML-tag token (content="..."), for OAuth brand verification. */
  GOOGLE_SITE_VERIFICATION?: string;
}

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'].join(' ');
const KEY_RE = /^[A-Za-z0-9_-]{32,128}$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });
const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

import { homePage, messagePage, pickerPage, privacyPage, termsPage } from './pages';

/* ── crypto helpers ── */
const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function aesKey(secret: string) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(plain: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), new TextEncoder().encode(plain));
  return b64u(iv) + '.' + b64u(ct);
}
async function open(sealed: string, secret: string) {
  const [iv, ct] = sealed.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await aesKey(secret), unb64u(ct));
  return new TextDecoder().decode(pt);
}

/* ── Google ── */
async function tokenRequest(env: Env, body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...body }),
  });
  const data = (await res.json()) as Record<string, any>;
  if (!res.ok) throw new Error(data.error_description || data.error || 'token_error');
  return data;
}
function emailFromIdToken(idToken?: string): string {
  try { return JSON.parse(new TextDecoder().decode(unb64u(idToken!.split('.')[1]))).email ?? ''; } catch { return ''; }
}


/* ── pending sign-in hand-off ──
 * The picker page (browser) writes, the plugin (Figma) polls. KV is eventually consistent and
 * caches reads, so the plugin could keep seeing "picking" long after the user picked a sheet.
 * A Durable Object per sign-in key gives read-your-writes consistency. Falls back to KV if unbound.
 */
export class PendingStore {
  constructor(private state: DurableObjectState) {}
  async fetch(req: Request): Promise<Response> {
    const { op, value, ttl } = (await req.json()) as { op: 'get' | 'put' | 'del'; value?: string; ttl?: number };
    const st = this.state.storage;
    if (op === 'put') {
      await st.put('v', { value, exp: Date.now() + (ttl ?? 600) * 1000 });
      await st.setAlarm(Date.now() + (ttl ?? 600) * 1000);
      return new Response('ok');
    }
    if (op === 'del') { await st.deleteAll(); return new Response('ok'); }
    const v = (await st.get('v')) as { value: string; exp: number } | undefined;
    if (!v || v.exp < Date.now()) return new Response('', { status: 404 });
    return new Response(v.value);
  }
  async alarm() { await this.state.storage.deleteAll(); }
}

function pending(env: Env) {
  if (!env.PEND) return {
    get: (k: string) => env.PENDING.get(k),
    put: (k: string, v: string, ttl = 600) => env.PENDING.put(k, v, { expirationTtl: ttl }),
    del: (k: string) => env.PENDING.delete(k),
  };
  const call = async (k: string, body: object) => env.PEND!.get(env.PEND!.idFromName(k)).fetch('https://pending/', { method: 'POST', body: JSON.stringify(body) });
  return {
    get: async (k: string) => { const r = await call(k, { op: 'get' }); return r.ok ? r.text() : null; },
    put: async (k: string, v: string, ttl = 600) => { await call(k, { op: 'put', value: v, ttl }); },
    del: async (k: string) => { await call(k, { op: 'del' }); },
  };
}

/* ── routes ── */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const redirectUri = url.origin + '/auth/callback';

    try {
      switch (url.pathname) {
        case '/': return html(homePage(env.GOOGLE_SITE_VERIFICATION));
        case '/privacy': return html(privacyPage());
        case '/terms': return html(termsPage());

        case '/auth/start': {
          const key = url.searchParams.get('key') ?? '';
          if (!KEY_RE.test(key)) return html(messagePage('Invalid request', 'This sign-in link is not valid.'), 400);
          const hint = url.searchParams.get('file') ?? '';
          const state = key + (hint ? '.' + hint : '');
          const g = new URL('https://accounts.google.com/o/oauth2/v2/auth');
          g.search = new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES,
            access_type: 'offline', include_granted_scopes: 'true', state,
            prompt: url.searchParams.get('consent') === '1' ? 'consent select_account' : 'select_account',
          }).toString();
          return Response.redirect(g.toString(), 302);
        }

        case '/auth/callback': {
          const [key, hint = ''] = (url.searchParams.get('state') ?? '').split('.');
          if (!KEY_RE.test(key)) return html(messagePage('Sign-in expired', 'This sign-in link is no longer valid.'), 400);
          if (url.searchParams.get('error')) return html(messagePage('Sign-in cancelled', 'No changes were made.', 'info'));
          const t = await tokenRequest(env, { code: url.searchParams.get('code') ?? '', grant_type: 'authorization_code', redirect_uri: redirectUri });
          await pending(env).put(key, JSON.stringify({
            accessToken: t.access_token,
            expiresAt: Date.now() + (t.expires_in - 60) * 1000,
            refresh: t.refresh_token ? await seal(t.refresh_token, env.TOKEN_SECRET) : null,
            email: emailFromIdToken(t.id_token),
            file: null,
          }));
          return html(pickerPage({ key, token: t.access_token, apiKey: env.GOOGLE_API_KEY, appId: env.GOOGLE_APP_ID, hint: /^[\w-]{20,}$/.test(hint) ? hint : '' }));
        }

        case '/auth/complete': {
          if (req.method !== 'POST') return json({ error: 'method' }, 405);
          const { key, id, name, mime } = (await req.json()) as { key: string; id: string; name: string; mime?: string };
          const raw = KEY_RE.test(key) ? await pending(env).get(key) : null;
          if (!raw || !/^[\w-]{20,}$/.test(id)) return json({ error: 'expired' }, 400);
          const entry = JSON.parse(raw);
          entry.file = { id, name: String(name ?? '').slice(0, 200), mime: /^[\w.+/-]{3,100}$/.test(String(mime ?? '')) ? mime : undefined };
          await pending(env).put(key, JSON.stringify(entry));
          return json({ ok: true });
        }

        case '/auth/poll': {
          const key = url.searchParams.get('key') ?? '';
          const raw = KEY_RE.test(key) ? await pending(env).get(key) : null;
          if (!raw) return json({ status: 'pending' });
          const entry = JSON.parse(raw);
          if (!entry.file) return json({ status: 'picking' });
          await pending(env).del(key); // one-time
          return json({ status: 'done', ...entry });
        }

        case '/auth/refresh': {
          if (req.method !== 'POST') return json({ error: 'method' }, 405);
          const { refresh } = (await req.json()) as { refresh: string };
          let rt: string;
          try { rt = await open(refresh, env.TOKEN_SECRET); } catch { return json({ error: 'invalid_refresh' }, 401); }
          try {
            const t = await tokenRequest(env, { refresh_token: rt, grant_type: 'refresh_token' });
            return json({ accessToken: t.access_token, expiresAt: Date.now() + (t.expires_in - 60) * 1000 });
          } catch (e) {
            return json({ error: 'revoked', detail: String(e) }, 401); // user removed access → sign in again
          }
        }

        case '/auth/revoke': {
          if (req.method !== 'POST') return json({ error: 'method' }, 405);
          const { refresh } = (await req.json()) as { refresh: string };
          try {
            const rt = await open(refresh, env.TOKEN_SECRET);
            await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(rt), { method: 'POST' });
          } catch { /* ignore */ }
          return json({ ok: true });
        }
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return html(messagePage('Something went wrong', String(e)), 500);
    }
  },
};
