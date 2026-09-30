# Sheetlingo auth server (Google sign-in for private sheets)

Lets users connect **private / company Google Sheets** without link sharing.
Runs on Cloudflare Workers (free plan is enough). ~15 minutes to set up.

```
Figma plugin ──opens──▶ /auth/start ─▶ Google sign-in ─▶ /auth/callback ─▶ Google Picker (choose sheet)
      ▲                                                                           │
      └───────────── polls /auth/poll ◀──── result stored 10 min in KV ◀──────────┘
Plugin then reads the sheet directly from sheets.googleapis.com with the user's token.
```

- Scope: `drive.file` (+ `openid email`) — the app can only read spreadsheets the user **picks**. Non-sensitive scope → no Google security review.
- Refresh tokens are encrypted (AES-GCM, `TOKEN_SECRET`) and only stored on the user's machine (Figma clientStorage). The server keeps nothing except 10-minute pending logins.

## 1. Google Cloud (console.cloud.google.com)
1. Create a project, e.g. **Sheetlingo**. Note the **project number** (Dashboard → Project info).
2. **APIs & Services → Library** → enable **Google Sheets API**, **Google Drive API**, **Google Picker API**.
3. **OAuth consent screen** (Google Auth Platform → Branding / Audience)
   - User type: **Internal** = only your company Workspace accounts (no review, best for in-house use)
     **External** = anyone (needed to sell). Start in *Testing* (add test users), then *Publish*.
   - Scopes (Data access): `.../auth/drive.file`, `openid`, `.../auth/userinfo.email`
4. **Credentials → Create credentials → OAuth client ID** → *Web application*
   - Authorized JavaScript origins: `https://sheetlingo-auth.<you>.workers.dev`
   - Authorized redirect URIs: `https://sheetlingo-auth.<you>.workers.dev/auth/callback`
   - Copy **Client ID** and **Client secret**.
5. **Credentials → Create credentials → API key** → restrict it to *Google Picker API*,
   application restriction *Websites*: `https://sheetlingo-auth.<you>.workers.dev/*`

(You get the `<you>.workers.dev` subdomain in step 2 below — you can deploy first, then come back to fill the URLs.)

## 2. Cloudflare Worker
```bash
cd server
npm install
npx wrangler login
npx wrangler kv namespace create PENDING        # copy the id into wrangler.toml
# edit wrangler.toml: GOOGLE_CLIENT_ID, GOOGLE_API_KEY, GOOGLE_APP_ID (= project number)
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put TOKEN_SECRET            # any long random string, e.g. `openssl rand -base64 48`
npx wrangler deploy                              # prints https://sheetlingo-auth.<you>.workers.dev
```
Open that URL in a browser → you should see "Sheetlingo – Auth service".

## 3. Point the plugin at it
```bash
cd ..    # repo root
node scripts/set-auth-server.mjs https://sheetlingo-auth.<you>.workers.dev
npm run build
```
Then in Figma **re-import `manifest.json`** (network domains changed) and run the plugin:
⚙ → Google Sheets → **Sign in with Google** → pick the sheet → choose the tab.

## Notes
- **Workspace admins** can block third-party apps. If sign-in says the app is blocked, ask the admin to allow the OAuth client ID (Admin console → Security → API controls → App access control).
- Teammates each sign in once and pick the same sheet (drive.file is per user).
- Pasting a private sheet link while signed in opens the picker pre-filtered to that file.
- Live sync (Pro): the plugin checks the file's `modifiedTime` every 10 s and re-downloads only when it changed.
