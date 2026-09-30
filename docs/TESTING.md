# Testing checklist

Run `npm run watch` (dev build — shows plan switcher at the bottom of the Pro sheet: free / trial / pro / real).

## 0. Setup
1. Figma desktop → new Design file.
2. Plugins → Development → Sheetlingo.
3. Create a Google Sheet, paste `docs/sample-sheet.csv` into A1 (File → Import also works).

## 1. Connect & access check
| Step | Expected |
|---|---|
| Paste the sheet URL while it's **Restricted** | Red error: no access + sharing guide open |
| Share → "Anyone with the link · Viewer" → Check again | Green "Access OK · 6 rows · 5 columns" |
| Paste a random URL | "Doesn't look like a Google Sheets link" |
| Change `#gid=` to a wrong number | "Sheet or tab not found" (or no-access) |
| Columns step | key = `key`, languages = en/ko (+ ja locked on free), `#note` hidden |
| CSV tab → drop `docs/sample-sheet.csv` | Same result without Google |
| Paste tab → copy cells from the sheet → paste | Same result |

## 2. Sync (key → language)
1. Make 5 text layers named `#home.title`, `#home.subtitle`, `#home.cta`, `#missing.key`, `#long.text`.
   Give `#long.text` a fixed width/height (Text → Fixed size).
2. Sync tab → click **ko** → texts become Korean.
3. Click **en** → back to English.
4. Pro/trial: click **ja** → `home.subtitle` shows English + "Used default language 1".
5. Report shows "Missing in sheet 1" (`missing.key`) → click it → canvas jumps to the layer.
6. Pro/trial: "Text overflows its box" lists `#long.text`.
7. Edit a cell in Google Sheets → header ↻ → the layer updates.

## 3. Keys tab
1. Select a plain (unnamed) text layer → Keys → click `nav.settings` → layer renamed `#nav.settings`, text = "Settings".
2. Select it → **Unlink selected** → name reverts.
3. **Extract** → CSV of all text on the page; unlinked layers get keys like `frame_name.layer_name`.

## 3b. Search & auto-link by text
1. Select a text layer whose text is "This nickname is not allowed." → Keys tab shows *Matches for “…”* with the matching key highlighted.
2. Click the key → layer linked (`#key`) and text set to the current language. Switch language in Sync → it follows.
3. Type part of any language value (e.g. "nickname") → ranked results with the matching language shown.
4. **Auto-link** → all unlinked layers with exact text matches get linked; duplicates (same text, several keys) are listed.

## 3c. Private sheet (after server/README.md setup)
1. ⚙ → Google Sheets → **Sign in with Google** → browser opens → sign in → pick the sheet.
2. Back in Figma: tab dropdown appears → choose tab → Save & start.
3. Pro/trial + *Live sync* on → edit a cell in the sheet → within ~10 s the design updates.
4. Paste a private link while signed out → error shows **Sign in with Google** button.

## 4. Fill
1. Connect `docs/sample-cards.csv` (CSV tab).
2. **Text layers**: make 4 text layers stacked vertically, select all → Fill → column `title` → Starter/Pro/Team/Enterprise in order.
3. **Cards**: make a frame with text layers named `title`, `price`, `badge`; duplicate ×4; select all cards → Cards → mapping shows auto matches → Fill.
4. Change a cell in the CSV, reconnect → Sync tab → Apply → filled layers refresh.

## 5. Plans (dev switcher in Pro sheet)
| Tier | Check |
|---|---|
| free | 4th language locked; keys after row 100 show PRO; layers using them are skipped with a banner; "All pages" and live sync open the Pro sheet; 11 cards → only 10 filled |
| trial | badge "Trial · 7d left"; everything unlocked |
| pro | badge "Pro"; overflow check on |
| real | real `figma.payments` status (in dev: trial for 7 days after first run) |

## 6. Relaunch & UI
1. Deselect all → right panel shows **Open Sheetlingo / Re-sync from sheet** → Re-sync runs without opening the window and shows a toast.
2. Settings → Plugin language → try 한국어 / 日本語 → UI switches and is remembered after reopening.
3. Figma light & dark theme → both readable.

## 7. Before publishing
- `npm run build` (no dev switcher in production).
- Test once with a second Figma account (fresh trial, teammate sees links).
