# Publishing Sheetlingo on Figma Community (paid)

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
Sheetlingo: Google Sheets Localization & Text Sync
```

**Tagline**
```
Link Figma text to Google Sheets keys and switch languages in one click.
```

**Category**: Design tools (or Content / Localization if offered)

**Tags**: google sheets, localization, translation, i18n, multilingual, csv, spreadsheet, sync, copy, content

**Description**
```
Sheetlingo keeps every word of your design in a spreadsheet. Link text layers to keys, switch the whole design to another language in one click, and pick up sheet edits automatically. No more copy and paste.

HOW IT WORKS
1. Connect a Google Sheet, a CSV file or pasted cells. One column for keys, one column per language.
2. Select a text layer and pick its key. Identical texts in the frame are linked for you.
3. Pick a language and apply it to the selection, the page or the whole file.

SWITCH LANGUAGES SAFELY
• See how many layers will change before you apply, and step through them on the canvas
• Only texts with exactly the same wording change, so nothing gets overwritten by accident
• Missing translations fall back to the base language
• Overflow check flags text that no longer fits its box

STAY IN SYNC
• Live sync: sheet edits flow into Figma while the plugin is open (minimized bar shows the last sync)
• Re-sync from the right panel without opening the plugin
• Editing a linked text by hand unlinks it, so your manual change is kept

MORE
• Fill: put spreadsheet rows into text layers or cards in reading order
• Keys: every key in the file, where it is used, and which are missing in the sheet
• Export the texts of an existing design to CSV to start your sheet
• Plugin UI in English, 한국어, 日本語, 简体中文, Español, Français, Deutsch

PRIVATE AND COMPANY SHEETS
Sign in with Google and pick the sheet. Sheetlingo uses the drive.file scope, so it can open only the file you choose. Public links, CSV and paste work without signing in.

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

## Images (`docs/listing/`)

| File | Use |
|---|---|
| `docs/assets/icon-128.png` | Icon (128 × 128) |
| `00-cover.png` | Thumbnail / cover (1920 × 1080) |
| `01-link.png` … `05-plans.png` | Carousel, in this order |

## After launch

- Ask a few people to install and like it in the first week; answer every comment.
- Post a short GIF of the language switch on X, LinkedIn, Threads, the Figma forum and Korean design communities, linking the Community page.
- Ship small updates regularly; recently updated plugins rank better.
