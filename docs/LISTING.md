# Publishing Sheetlingo on Figma Community (paid)

**Live listing:** https://www.figma.com/community/plugin/1686971732936550159/sheetlingo-google-sheets-csv-localization-sync (plugin id `1686971732936550159`, submitted 2026-10-01, first version under review)

## Before you start (one time)

- Use the **personal** Figma account (efforthye@gmail.com) in the **Figma desktop app**, logged in on Windows.
- Turn on **two-factor authentication**: Figma → Settings → Security.
- Publish as an **individual creator** (not under a team or org). Paid plugins need this.
- Selling plugins needs no approval. Korea is a supported payout country. You connect a **Stripe** account during publishing.
- Figma takes a flat **15%** fee (payment processing, tax, support).
- `manifest.json` `id` must belong to the publishing account. If publishing says the plugin belongs to someone else, create a new plugin in that account (Plugins → Development → New plugin…), copy its `id` into `manifest.json`, `npm run build`, and re-import.

## Pricing (Figma's rules)

- Subscription, whole dollars only, minimum $2.
- **Monthly: $4**. **Yearly discount: 25%** gives **$36 / year**.
- A 7-day free trial is on by default. Sheetlingo's Free plan already covers 100 keys, so turn the trial **off** (or set it to the minimum) if the form allows it. If it stays on, trial users simply get Pro for 7 days.
- A paid plugin can never be switched back to free. Price increases: at most 50%, once every 30 days.
- The code checks `figma.payments.status.type === 'PAID'` for Pro and calls `initiateCheckoutAsync` for the upgrade button. `src/shared/constants.ts` `PRICE` is display text only, so keep it equal to what you set in the form.

## Publishing a new version

1. `sheetlingo install` (production build; check ⚙ for the version and build time).
2. Figma desktop → Plugins → Development → Manage plugins in development → Sheetlingo → **Publish new version**.
3. Paste the version notes below, replace the description and the carousel images with the files in `docs/listing/`, submit.
4. If the first version is still **In review**, Figma may not allow a new version until it's approved; publish right after approval.

## Steps

1. Build the production version in WSL: `sheetlingo install` (or `npm run build`). Never publish the `npm run watch` build: it contains the dev plan switcher.
2. Figma desktop → Plugins → Development → **Manage plugins in development** → Sheetlingo → **Publish**.
3. Fill the form with the fields below.
4. **Payment**: choose *Paid* → *Subscription*, monthly $4, yearly discount 25%, trial off. Connect Stripe when asked (identity, bank account, tax info).
5. Submit. The plugin shows **In review**. Figma emails the result; review time varies.
6. After approval, copy the Community URL and send it to Claude to update the website button and README.

## Fields

**Name**
```
Sheetlingo: Google Sheets & CSV Localization & Text Sync
```

**Tagline**
```
Link Figma text to keys from Google Sheets, CSV or Excel and switch languages in one click.
```

**Category**: Design tools (or Content / Localization if offered)

**Tags**: google sheets, csv, excel, localization, translation, i18n, multilingual, spreadsheet, sync, copy, content

**Description**
```
Sheetlingo keeps every word of your design in a spreadsheet: Google Sheets, a CSV file, or cells pasted from Excel or Numbers. Link text layers to keys, switch the whole design to another language in one click, and pick up sheet edits automatically. No more copy and paste.

HOW IT WORKS
1. Sheet tab: connect a Google Sheet, a CSV file or pasted cells. One column for keys, one column per language.
2. Apply text tab: select a text layer and pick its key. Keys with exactly the same wording are suggested, and identical texts in the frame are linked for you.
3. Pick a language and apply it to the selection, the page or the whole file.

SWITCH LANGUAGES SAFELY
• See how many layers will change before you apply, and step through them on the canvas
• Only texts with exactly the same wording change, so nothing gets overwritten by accident
• A clear result: what changed, what already matched, what got linked
• Missing fonts and locked layers are reported as failures, never half-applied
• Missing translations fall back to the base language; overflow check flags text that no longer fits

KEYS
• See the keys used on the page, most used first
• Click a key and step through every place it is used with Prev / Next

STAY IN SYNC
• Live sync: Google Sheet edits flow into Figma while the plugin is open (minimized bar shows the last sync)
• Re-upload a CSV and the new values are applied to every linked text in the file
• Editing a linked text by hand unlinks it, so your manual change is kept
• Plugin UI in English, 한국어, 日本語, 简体中文, Español, Français, Deutsch

PRIVATE AND COMPANY SHEETS
Sign in with Google and pick the sheet. Sheetlingo uses the drive.file scope, so it can open only the file you choose. Public links, CSV files and pasted cells work without signing in or any account.

PRICING
Free: up to 100 linked keys per file, every feature included.
Pro: unlimited keys, $4 / month or $36 / year.

Privacy: https://sheetlingo-auth.efforthye.workers.dev/privacy
Support: efforthye@gmail.com
```

**Support contact**: efforthye@gmail.com

**Network access** (the form shows the domains from `manifest.json`; reason):
```
Reads the Google Sheet the user connects (public CSV export or Google Sheets API after Google sign-in through the Sheetlingo auth server) and loads the Pretendard UI font.
```

**Data security disclosure** (optional, review up to 2 weeks; can be done later):
- Collects: email address (shown in the plugin) and the cell values of the sheet the user picks.
- Stored: only on the user's device (Figma clientStorage). The auth server keeps a sign-in result for 10 minutes.
- Not sold, not shared, not used for ads or AI training.

## Version notes (v0.7.0)

Paste into "What's new" when publishing the new version:
```
• New tabs: Apply text · Keys · Sheet. Settings now hold options only
• Keys tab shows the keys used on this page (most used first) and steps through every place a key is used
• Key suggestions show exact matches only
• Clear results: changed / already matched / linked; missing fonts are reported as failures
• Only links to keys in the connected sheet count toward the key limit
• Re-uploading a CSV applies the new values to every linked text; live sync is on by default for Google Sheets
• Removed: Fill, Auto-link and Extract
```

## Images (`docs/listing/`)

| File | Use |
|---|---|
| `docs/assets/icon-128.png` | Icon (128 × 128) |
| `00-cover.png` | Thumbnail / cover (1920 × 1080) |
| `01-link.png` … `06-dark.png` | Carousel, in this order: 01-link, 02-switch, 03-connect, 04-keys, 06-dark, 05-plans (regenerated for v0.7.0) |

## After launch

- Ask a few people to install and like it in the first week; answer every comment.
- Post a short GIF of the language switch on X, LinkedIn, Threads, the Figma forum and Korean design communities, linking the Community page.
- Ship small updates regularly; recently updated plugins rank better.
