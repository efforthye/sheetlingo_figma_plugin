# Sheetlingo auth server (Google sign-in for private sheets)

Lets users connect **private / company Google Sheets** without link sharing.
Runs on Cloudflare Workers. The free plan (100,000 requests/day) is more than enough, and Google's side is free too.

```
Figma plugin ──opens──▶ /auth/start ─▶ Google sign-in ─▶ /auth/callback ─▶ Google Picker (choose sheet)
      ▲                                                                           │
      └───────────── polls /auth/poll ◀──── result stored 10 min in KV ◀──────────┘
Plugin then reads the sheet directly from sheets.googleapis.com with the user's token.
```

- Scope: `drive.file` (+ `openid email`). The app can only read spreadsheets the user **picks**. It is a non-sensitive scope, so there is no Google security review.
- Refresh tokens are encrypted (AES-GCM, `TOKEN_SECRET`) and stored only on the user's machine (Figma clientStorage). The server keeps nothing except 10-minute pending logins.

## Current deployment

| Item | Value |
|---|---|
| Cloudflare account | personal (efforthye@gmail.com) |
| Worker | `sheetlingo-auth` |
| URL | `https://sheetlingo-auth.efforthye.workers.dev` |
| KV namespace `PENDING` | `6d663c38727b489786939633c83d29c7` (already in `wrangler.toml`) |
| Google Cloud project | `sheetlingo` (project number `729315461169`, no organization) |
| APIs enabled | Google Sheets API, Google Drive API, Google Picker API |
| OAuth consent | Audience **External**, status **Testing**, test user efforthye@gmail.com |
| OAuth scopes | `drive.file`, `openid`, `userinfo.email` |
| OAuth client | Web application `Sheetlingo Worker` · `729315461169-mlh1cadg7e90nq0m11mdmaghco09nmo2.apps.googleusercontent.com` |
| Client origins / redirect | `https://sheetlingo-auth.efforthye.workers.dev` · `…/auth/callback` |
| API key | `Sheetlingo Picker` · websites `https://sheetlingo-auth.efforthye.workers.dev/*` · Google Picker API only |
| Secrets set | `TOKEN_SECRET`, `GOOGLE_CLIENT_SECRET` (set with `wrangler secret put`, never committed) |
| Plugin | `src/shared/config.ts` `AUTH_SERVER` and `manifest.json` network domains point at the Worker |

Client ID, API key, project number and KV id are **not secret** and live in `wrangler.toml`.
The client secret and `TOKEN_SECRET` are secrets: never paste them into code, chat or git.

## Setup from scratch

Run everything in WSL from the repo. Use the **personal** accounts.

### 1. Cloudflare Worker (do this first to get the URL)

```bash
cd server
npm install
npx wrangler login          # browser opens → Authorize (official Cloudflare CLI)

# KV for pending logins; writes the id into wrangler.toml
npx wrangler kv namespace create PENDING | tee /tmp/kv.txt
ID=$(grep -oE '[0-9a-f]{32}' /tmp/kv.txt | head -1); sed -i "s/REPLACE_WITH_KV_ID/$ID/" wrangler.toml
# If asked "add it to your configuration file?" answer n (the line above does it)

# random encryption key for refresh tokens ("Create a new Worker?" → y)
openssl rand -base64 48 | npx wrangler secret put TOKEN_SECRET

npx wrangler deploy
# first time: "register a workers.dev subdomain?" → yes → pick a name (e.g. efforthye)
# prints https://sheetlingo-auth.<subdomain>.workers.dev
```

Open that URL in a browser. You should see "Sheetlingo – Auth service". A fresh subdomain can take a few minutes for DNS.

In WSL, if the browser doesn't open on `wrangler login`, copy the printed URL into the Windows browser.

### 2. Google Cloud (console.cloud.google.com)

Below, `{URL}` = `https://sheetlingo-auth.efforthye.workers.dev`.

1. **New project** `Sheetlingo` → Dashboard → *Project info* → note the **project number** (digits, not the project ID).
2. **APIs & Services → Library** → enable **Google Sheets API**, **Google Drive API**, **Google Picker API**.
3. **Google Auth Platform** (OAuth consent screen) → Get started
   - App name `Sheetlingo`, support email, audience **External**, contact email.
   - **Data access → Add or remove scopes**: `.../auth/drive.file`, `openid`, `.../auth/userinfo.email`.
   - **Audience → Test users**: add your own Gmail and any account you test with (only these can sign in while in *Testing*).
4. **Clients → Create client** → *Web application*
   - Authorized JavaScript origins: `{URL}`
   - Authorized redirect URIs: `{URL}/auth/callback`
   - Copy the **Client ID**. Copy the **Client secret** somewhere private right away: it is shown only once. Use it only in step 3.
5. **APIs & Services → Credentials → Create credentials → API key**. The creation form has both restrictions:
   - *API restrictions*: open the dropdown, search `Picker`, check **Google Picker API** only.
   - *Application restrictions*: **Websites** → **Add** → `{URL}/*`.
   - Ignore the "service account" box (it is about Gemini/Agent APIs).
   - The API key is public by design (restricted to the Worker site and Picker).

### 3. Put the Google values on the Worker

Edit `server/wrangler.toml`:

```toml
[vars]
GOOGLE_CLIENT_ID = "1234…apps.googleusercontent.com"
GOOGLE_API_KEY = "AIza…"
GOOGLE_APP_ID = "123456789012"   # project number
```

```bash
npx wrangler secret put GOOGLE_CLIENT_SECRET   # paste the client secret at the prompt
npx wrangler deploy
```

### 4. Point the plugin at it

Already done for the current deployment (`src/shared/config.ts`, `manifest.json`). For a new URL:

```bash
cd ..    # repo root
node scripts/set-auth-server.mjs https://sheetlingo-auth.<subdomain>.workers.dev
npm run build
```

The manifest's network domains change, so in Figma **remove the plugin and re-import `manifest.json`**.
Then: Settings → Google Sheets → **Sign in with Google** → pick the sheet → choose the tab.
While the app is in *Testing*, Google shows "Google hasn't verified this app": click **Advanced → Go to Sheetlingo**.

## Checking a deploy

`npx wrangler deploy` prints the bindings. All three Google values must show real values, not `REPLACE_WITH_…`:

```
env.PENDING (6d663c38…)                     KV Namespace
env.GOOGLE_CLIENT_ID ("729315461169-…")     Environment Variable
env.GOOGLE_API_KEY ("AIzaSy…")              Environment Variable
env.GOOGLE_APP_ID ("729315461169")          Environment Variable
```

If they show placeholders (for example after extracting an older package over the repo), fill them and deploy again:

```bash
sed -i 's/REPLACE_WITH_CLIENT_ID.apps.googleusercontent.com/<client id>/; s/REPLACE_WITH_BROWSER_API_KEY/<api key>/; s/REPLACE_WITH_PROJECT_NUMBER/<project number>/' wrangler.toml
npx wrangler deploy
```

Secrets are stored on Cloudflare, not in the file, so redeploying never needs them again.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `redirect_uri_mismatch` | The redirect URI must be exactly `{URL}/auth/callback`. Google changes take 5 min to a few hours. |
| `access_denied` / "app is being tested" | Add the account under Google Auth Platform → Audience → Test users. |
| "Google hasn't verified this app" | Expected while in Testing: Advanced → Go to Sheetlingo. |
| Picker shows "The API developer key is invalid" | API key website restriction must be `{URL}/*`, API restriction must include Google Picker API. |
| Sign-in button says not set up | `AUTH_SERVER` still has `YOUR-SUBDOMAIN`: run `node scripts/set-auth-server.mjs {URL} && npm run build`, re-import the manifest. |
| Network error from the plugin | Re-import `manifest.json` in Figma after the domains changed. |
| `access_not_configured` (company account) | Workspace admin must trust the client ID (see *Company accounts* above). |
| Client secret leaked | Google Auth Platform → Clients → Sheetlingo Worker → Add secret, disable and delete the old one, then `npx wrangler secret put GOOGLE_CLIENT_SECRET`. |

## Going public (selling)

### Publish to production (free, immediate)

Google Auth Platform → **Audience** → **Publish app** → Confirm.
With only non-sensitive scopes (`drive.file`, `openid`, `email`) no review is needed: anyone can sign in, test users are no longer required, and the 7-day re-login of *Testing* goes away.

### Show the name "Sheetlingo" (brand verification)

Until the brand is verified, Google's sign-in screen shows the domain (`efforthye.workers.dev`) instead of the app name.

The Worker already serves the pages Google asks for (`server/src/pages.ts`, which also holds the sign-in flow screens):

| Page | URL |
|---|---|
| Home | `{URL}/` |
| Privacy policy | `{URL}/privacy` |
| Terms of service | `{URL}/terms` |

1. Google Auth Platform → **Branding**: app name `Sheetlingo`, logo (`docs/assets/icon-128.png`), home page `{URL}/`, privacy `{URL}/privacy`, terms `{URL}/terms`, authorized domain `efforthye.workers.dev`.
2. Prove domain ownership in [Search Console](https://search.google.com/search-console): add a **URL prefix** property `{URL}/` → method **HTML tag** → copy only the `content="…"` value, then:
   ```bash
   npx wrangler secret put GOOGLE_SITE_VERIFICATION   # paste the content value
   npx wrangler deploy
   ```
   and click **Verify**. (This token is not secret; a secret just keeps it out of git.)
3. Google Auth Platform → **Verification center** → submit for brand verification (usually 2 to 3 business days).

`workers.dev` is a shared domain, so Google may refuse it because the parent domain cannot be verified with DNS. If that happens, buy a domain (Cloudflare Registrar sells at cost, about $10/year), attach it to the Worker (Workers → sheetlingo-auth → Settings → Domains & Routes → Add custom domain), run `node scripts/set-auth-server.mjs https://<new domain>`, update the OAuth client's origin/redirect and the API key website, and verify that domain instead.

### Company (Google Workspace) accounts

`access_not_configured` / "your admin needs to review this app" is a Workspace policy, not a setup error. Neither publishing nor brand verification removes it.
A Workspace admin allows the app at admin.google.com → Security → Access and data control → API controls → Manage third-party app access → Configure new app → search the client ID → **Trusted**.
The user can also click **Request access** on the error page; the request reaches the admins automatically.

## Notes

- **Workspace admins** can block third-party apps. If sign-in says the app is blocked, the admin allows the client ID in Admin console → Security → API controls → App access control.
- Teammates each sign in once and pick the same sheet (drive.file is per user).
- Pasting a private sheet link while signed in opens the picker pre-filtered to that file.
- Live sync (Pro): the plugin checks the file's `modifiedTime` every 10 s and re-downloads only when it changed.
- Logs: `npx wrangler tail`. Rotate a secret: run `wrangler secret put` again and redeploy (users sign in again after `TOKEN_SECRET` changes).
