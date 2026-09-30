# Sheetlingo — Product Plan (v0.1)

## 1. One-liner
**Manage Figma text from a Google Sheet by key, and switch languages in one click.**
Copy and translations live in the sheet (the source of truth); designs always stay current.

## 2. Audience & problem
| Who | Pain today | What Sheetlingo gives them |
|---|---|---|
| Designers of multi-language products | Build each locale by copy-paste; redo everything when copy changes | Link once → switch languages with a chip |
| Teams working with PMs / copywriters | Spec sheet and mockups drift apart | Edit the sheet → hit Re-sync |
| Data-heavy screens (cards, lists, tables) | Lorem ipsum, manual typing | Pick a column → Fill; fill cards row by row |

## 3. Core concepts
- **Sheet shape**: row 1 = headers. `key | en | ko | ja …` (one key column + one or more language columns). Columns/keys starting with `#` are ignored (notes).
- **Default language (fallback)**: empty cells use the default language and are flagged in the report.
- **Two kinds of links**
  - **Key link**: layer named `#home.title`, or clicked in the Keys tab → follows the selected language.
  - **Data link**: layers filled from the Fill tab remember (column, row) → Re-sync refreshes that cell.
- Links are stored in each layer's sharedPluginData, so teammates who open the file get them too.

## 4. User flow
1. **Connect**: Google Sheets URL / CSV file / paste cells
   - URL → **access is checked immediately** (public? tab exists?) → cause-specific error + 3-step sharing guide
   - Success → **Columns**: pick key column, languages, default language; live preview
2. **Sync tab**: click a language chip = apply instantly; scope Selection / This page / All pages
   - Report: updated, unchanged, missing keys, fallbacks, missing fonts, overflowing text (click to jump to the layer)
3. **Fill tab**: text layers (one column in reading order) / cards (one card = one row, layer names ↔ column names auto-matched, dropdown override)
4. **Keys tab**: search keys → click to link the selection / unlink / **Extract text** (existing design → key,en CSV with auto-generated keys) for onboarding old files
5. **Re-sync**: header button, right-panel relaunch button (runs without opening the UI), Pro: auto re-sync every 60s while open

## 5. Pricing (usage-based, one Figma subscription)
Figma native payments allow **one price per plugin**, so pricing is usage-based on a single plan:

| Plan | Linked keys per file | Price |
|---|---|---|
| Free | up to 100 | $0 |
| Pro | Unlimited | $3.99 / month or $36 / year (Figma payments, 15% fee) |

- Every feature is available on every plan; plans differ only by linked-key count. No time-based trial.
- "Linked keys" = distinct keys linked in the file (registry stored in the document).
- Limits / price / contact live in `src/shared/constants.ts`.

## 6. Differentiators
- Built around **key-based localization**, not just data fill (language switching, fallback, missing-key report).
- **Access check + cause-specific guidance** up front → no "why won't it load?" support tickets.
- **Extract text** turns an existing design into a sheet in minutes.
- **Overflow check** catches long translations (German, Japanese…) breaking layouts.

## 7. Plugin UI languages
English (default), 한국어, 日本語, 简体中文, Español, Français, Deutsch.
Add one by creating `src/ui/locales/<code>.ts` and registering it in `src/ui/i18n.ts`; missing strings fall back to English.
UI font: Pretendard (loaded from jsDelivr, falls back to system fonts).

## 8. Roadmap
- v0.2: Excel (.xlsx) upload, multiple tabs at once, `{name}` variable substitution
- v0.3: duplicate page per language ("Home / ko"), per-language fallback fonts
- ✅ Google sign-in for private / company sheets (server/ — Cloudflare Worker)
- v1.0: change history, per-key comments

---

## 9. Community listing
See [LISTING.md](LISTING.md) (search-optimized copy, tags, assets checklist).
