# Sheetlingo

A Figma plugin that syncs text layers with a Google Sheet by key — switch languages in one click.
Product plan, pricing and listing copy: [docs/PLAN.md](docs/PLAN.md).

## Quick start

### 1. Requirements
- **Figma desktop app** (plugins can't be developed in the browser)
- **Node.js 22** — on WSL use nvm so the Linux Node is used, not the Windows one:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  source ~/.bashrc
  nvm install 22
  ```

### 2. Install & build
```bash
cd ~/workspace/personal/sheetlingo_figma_plugin
nvm use            # reads .nvmrc (22)
npm install
npm run build      # outputs dist/code.js + dist/ui.html
```

### 3. Load it in Figma (once)
Figma desktop → open any Design file → **Plugins → Development → Import plugin from manifest…** →
```
\\wsl.localhost\Ubuntu\home\softnyx\workspace\personal\sheetlingo_figma_plugin\manifest.json
```

### 4. Develop
```bash
nvm use && npm run watch   # rebuilds on every save
```
Then **Plugins → Development → Sheetlingo** (re-run the plugin after each rebuild).
Tip — one-word shortcut:
```bash
echo "alias sheetlingo='cd ~/workspace/personal/sheetlingo_figma_plugin && nvm use && npm run watch'" >> ~/.bashrc
source ~/.bashrc
sheetlingo
```

### 5. Try it in 1 minute (no Google needed)
1. In the plugin choose **Paste**, paste this and click **Use pasted data** → **Save & start**:
   ```
   key,en,ko,ja
   home.title,Welcome back,다시 오신 걸 환영해요,おかえりなさい
   home.cta,Get started,시작하기,はじめる
   ```
2. Create two text layers and rename them `#home.title` and `#home.cta`.
3. **Sync** tab → click **ko** / **en** / **ja**.

With Google Sheets:
- **Public link**: share as *Anyone with the link · Viewer*, then ⚙ → Google Sheets → paste the link → Connect.
- **Private / company sheet**: set up the auth server once ([server/README.md](server/README.md)), then ⚙ → **Sign in with Google** → pick the sheet.
Full test checklist: [docs/TESTING.md](docs/TESTING.md).

### Commands
| Command | What it does |
|---|---|
| `npm run watch` | Dev build on save (includes free/trial/pro switcher in the Pro sheet) |
| `npm run build` | Type check + production build — use before publishing |
| `npm run typecheck` | Type check only |

### Troubleshooting
| Problem | Fix |
|---|---|
| `UNC paths are not supported` / `tsconfig.json not found` | Windows npm is running inside WSL → `nvm use` (check `which npm` → `/home/.../.nvm/...`) |
| "An error occurred while loading the plugin environment" | `dist/` missing → run `npm run build`; or re-import the manifest if the folder moved |
| Google Sheet won't load | Sharing must be "Anyone with the link · Viewer"; each tab has its own `#gid=` link |
| Changes don't show | Keep `npm run watch` running and re-run the plugin |

## Sheet format
| key | en | ko | ja |
|---|---|---|---|
| home.title | Welcome | 환영합니다 | ようこそ |

- Row 1 = column names: one key column + one or more language columns. Columns/keys starting with `#` are ignored.
- Share Google Sheets as "Anyone with the link · Viewer".

## Structure
```
src/
  shared/    types, constants (free limits, price), sheet → dictionary helpers
  code/      Figma main thread: sync, fill, link, extract, payments
  ui/        React UI: sheet loading (access check), views
  ui/locales UI translations (en, ko, ja, zh-CN, es, fr, de)
server/      Cloudflare Worker for Google sign-in (private sheets)
```
- Free-plan limits: `src/shared/constants.ts`
- Payments: `figma.payments` (manifest `permissions: ["payments"]`). In `npm run watch` builds, the Pro sheet shows PAID/UNPAID toggles.
- Add a UI language: copy `src/ui/locales/en.ts` → `<code>.ts`, translate, register in `src/ui/i18n.ts`.
- UI font: Pretendard via jsDelivr (allowed in `manifest.json` networkAccess).
