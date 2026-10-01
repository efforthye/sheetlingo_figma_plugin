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

/* ── pages ── */
const page = (title: string, body: string, script = '') => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f7f6;color:#1e1e1e;display:grid;place-items:center;min-height:100vh;margin:0}
.c{background:#fff;border-radius:14px;padding:32px 36px;box-shadow:0 8px 30px rgba(0,0,0,.08);max-width:420px;text-align:center}
.logo{width:44px;height:44px;border-radius:11px;background:linear-gradient(135deg,#14b87e,#0b7f58);margin:0 auto 14px}
h1{font-size:20px;margin:0 0 6px}p{color:#666;margin:0 0 18px}button{background:#0f9d6b;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer}</style>
</head><body><div class="c"><div class="logo"></div>${body}</div>${script}</body></html>`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function pickerPage(env: Env, key: string, accessToken: string, hint: string) {
  const cfg = JSON.stringify({ key, token: accessToken, apiKey: env.GOOGLE_API_KEY, appId: env.GOOGLE_APP_ID, hint });
  return page('Choose a sheet · Sheetlingo',
    `<h1 id="t">Choose your spreadsheet</h1><p id="d">Pick the sheet Sheetlingo should read.</p><button id="b" onclick="openPicker()">Choose spreadsheet</button>`,
    `<script>const C=${cfg.replace(/</g, '\\u003c')};
function done(msg){document.getElementById('t').textContent=msg;document.getElementById('d').textContent='You can close this tab and return to Figma.';document.getElementById('b').style.display='none';}
function openPicker(){
  const view=new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(google.picker.DocsViewMode.LIST);
  if(C.hint) view.setFileIds(C.hint);
  new google.picker.PickerBuilder().addView(view).setOAuthToken(C.token).setDeveloperKey(C.apiKey).setAppId(C.appId)
   .setCallback(async d=>{ if(d.action!==google.picker.Action.PICKED) return; const f=d.docs[0];
     const r=await fetch('/auth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:C.key,id:f.id,name:f.name})});
     done(r.ok?'Connected ✓':'Something went wrong. Please try again from Figma.'); }).build().setVisible(true);
}
</script><script src="https://apis.google.com/js/api.js" onload="gapi.load('picker',openPicker)"></script>`);
}

/* ── public pages (home, privacy, terms) for Google brand verification ── */
const CONTACT = 'efforthye@gmail.com';
const UPDATED = '2026-10-01';
const docShell = (title: string, inner: string, head = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${head}<title>${title}</title>
<style>body{font:16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f7f6;color:#1e1e1e;margin:0}
main{max-width:720px;margin:0 auto;padding:48px 20px 64px}h1{font-size:30px;margin:0 0 8px}h2{font-size:19px;margin:32px 0 8px}
a{color:#0b7f58}.logo{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#14b87e,#0b7f58);margin-bottom:18px}
.muted{color:#666}nav{margin-top:40px;font-size:14px}nav a{margin-right:16px}ul{padding-left:20px}</style></head>
<body><main><div class="logo"></div>${inner}<nav><a href="/">Home</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></nav></main></body></html>`;
const homePage = (env: Env) => docShell('Sheetlingo: sync Figma text with Google Sheets', `
<h1>Sheetlingo</h1>
<p class="muted">Sync Figma text layers with a spreadsheet by key, and switch languages in one click.</p>
<h2>What it does</h2>
<ul><li>Link text layers in Figma to keys in your Google Sheet, CSV or pasted table.</li>
<li>Switch every linked layer to another language column at once.</li>
<li>Keep designs up to date when the sheet changes.</li></ul>
<h2>Google sign-in</h2>
<p>Signing in with Google lets the plugin read a private spreadsheet that <b>you pick</b> in Google's file picker.
Sheetlingo uses the <code>drive.file</code> scope, so it can only open files you explicitly choose. It cannot see, change or delete anything else in your Drive.</p>
<p>Contact: <a href="mailto:${CONTACT}">${CONTACT}</a></p>`,
  env.GOOGLE_SITE_VERIFICATION ? `<meta name="google-site-verification" content="${esc(env.GOOGLE_SITE_VERIFICATION)}">` : '');
const docPage = (title: string, body: string) => docShell(`${title} · Sheetlingo`, `<h1>${title}</h1><p class="muted">Last updated ${UPDATED}</p>${body}`);

const PRIVACY = `
<p>Sheetlingo is a Figma plugin that fills Figma text layers from a spreadsheet. This policy explains what data it uses when you sign in with Google.</p>
<h2>Data we access</h2>
<ul><li><b>Your email address</b> (<code>email</code>, <code>openid</code>): shown in the plugin so you know which account is connected.</li>
<li><b>Spreadsheets you pick</b> (<code>drive.file</code>): only the files you select in Google's picker. The plugin reads their cell values to fill your Figma layers.</li></ul>
<h2>How the data is used</h2>
<p>Spreadsheet values are used only to update text in your Figma file. We do not use Google user data for advertising, sell it, or share it with third parties, and we do not use it to train AI or machine-learning models.</p>
<h2>Storage</h2>
<ul><li>Spreadsheet contents and access tokens are stored only on your computer, in Figma's plugin storage.</li>
<li>The refresh token is encrypted before it reaches your computer. Our server (a Cloudflare Worker) keeps a sign-in result for at most 10 minutes while the plugin picks it up, then deletes it. It keeps no copy of your spreadsheets.</li></ul>
<h2>Your choices</h2>
<p>Sign out in the plugin settings to delete stored tokens, or remove access any time at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
<h2>Google API Services User Data Policy</h2>
<p>Sheetlingo's use and transfer of information received from Google APIs adheres to the
<a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
<h2>Contact</h2><p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`;

const TERMS = `
<p>By using the Sheetlingo Figma plugin you agree to these terms.</p>
<h2>The service</h2><p>Sheetlingo updates text in your Figma files from spreadsheets you connect. You are responsible for the content of your spreadsheets and designs.</p>
<h2>Plans and payment</h2><p>Paid plans are billed and managed through Figma. You can cancel through Figma at any time; the plan stays active until the end of the paid period.</p>
<h2>Acceptable use</h2><p>Do not use Sheetlingo to break the law or to access data you are not allowed to access.</p>
<h2>No warranty</h2><p>Sheetlingo is provided "as is". We are not liable for indirect damages or lost data. Keep backups of important files.</p>
<h2>Changes</h2><p>We may update these terms. Material changes will be noted on this page.</p>
<h2>Contact</h2><p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`;

/* ── routes ── */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const redirectUri = url.origin + '/auth/callback';

    try {
      switch (url.pathname) {
        case '/': return html(homePage(env));
        case '/privacy': return html(docPage('Privacy Policy', PRIVACY));
        case '/terms': return html(docPage('Terms of Service', TERMS));

        case '/auth/start': {
          const key = url.searchParams.get('key') ?? '';
          if (!KEY_RE.test(key)) return html(page('Error', '<h1>Invalid request</h1>'), 400);
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
          if (!KEY_RE.test(key)) return html(page('Error', '<h1>Invalid state</h1>'), 400);
          if (url.searchParams.get('error')) return html(page('Cancelled', '<h1>Sign-in cancelled</h1><p>Return to Figma to try again.</p>'));
          const t = await tokenRequest(env, { code: url.searchParams.get('code') ?? '', grant_type: 'authorization_code', redirect_uri: redirectUri });
          await env.PENDING.put(key, JSON.stringify({
            accessToken: t.access_token,
            expiresAt: Date.now() + (t.expires_in - 60) * 1000,
            refresh: t.refresh_token ? await seal(t.refresh_token, env.TOKEN_SECRET) : null,
            email: emailFromIdToken(t.id_token),
            file: null,
          }), { expirationTtl: 600 });
          return html(pickerPage(env, key, t.access_token, /^[\w-]{20,}$/.test(hint) ? hint : ''));
        }

        case '/auth/complete': {
          if (req.method !== 'POST') return json({ error: 'method' }, 405);
          const { key, id, name } = (await req.json()) as { key: string; id: string; name: string };
          const raw = KEY_RE.test(key) ? await env.PENDING.get(key) : null;
          if (!raw || !/^[\w-]{20,}$/.test(id)) return json({ error: 'expired' }, 400);
          const entry = JSON.parse(raw);
          entry.file = { id, name: String(name ?? '').slice(0, 200) };
          await env.PENDING.put(key, JSON.stringify(entry), { expirationTtl: 600 });
          return json({ ok: true });
        }

        case '/auth/poll': {
          const key = url.searchParams.get('key') ?? '';
          const raw = KEY_RE.test(key) ? await env.PENDING.get(key) : null;
          if (!raw) return json({ status: 'pending' });
          const entry = JSON.parse(raw);
          if (!entry.file) return json({ status: 'picking' });
          await env.PENDING.delete(key); // one-time
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
      return html(page('Error', `<h1>Something went wrong</h1><p>${esc(String(e))}</p>`), 500);
    }
  },
};
