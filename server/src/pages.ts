/* Public HTML pages served by the auth Worker: sign-in flow cards, home, privacy, terms. */

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const CONTACT = 'efforthye@gmail.com';
const COMMUNITY = 'https://www.figma.com/community/plugin/1686971732936550159/sheetlingo-google-sheets-csv-localization-sync';
const UPDATED = 'October 1, 2026';

const LOGO_BODY = (id: string) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18c286"/><stop offset="1" stop-color="#0a7a54"/></linearGradient></defs><rect width="20" height="20" rx="5" fill="url(#${id})"/><rect x="3.2" y="3.2" width="11.8" height="12.6" rx="1.8" fill="#fff"/><path d="M3.2 9.5h11.8M9.1 3.2v12.6" stroke="#0f9d6b" stroke-opacity=".3" stroke-width=".7" fill="none"/><path d="M4.66 8.1H5.35L5.59 7.23H6.69L6.93 8.1H7.64L6.55 4.69H5.75ZM5.73 6.7 5.83 6.32C5.94 5.97 6.03 5.58 6.12 5.21H6.14C6.24 5.57 6.34 5.97 6.44 6.32L6.54 6.7ZM12.79 4.49V8.47H13.37V6.49H13.92V6.02H13.37V4.49ZM10.42 4.91V5.37H11.72C11.62 6.25 11.13 6.88 10.21 7.36L10.53 7.79C11.85 7.12 12.31 6.1 12.31 4.91ZM7.22 11.94 6.7 11.82C6.69 11.88 6.67 11.99 6.66 12.08H6.58C6.37 12.08 6.15 12.11 5.94 12.15L5.97 11.76C6.5 11.74 7.07 11.69 7.5 11.61L7.49 11.11C7.02 11.23 6.55 11.28 6.03 11.3L6.07 11.07C6.09 11 6.11 10.92 6.13 10.84L5.57 10.83C5.58 10.9 5.57 11 5.57 11.08L5.54 11.32H5.37C5.11 11.32 4.73 11.28 4.58 11.26L4.59 11.75C4.79 11.76 5.13 11.78 5.35 11.78H5.49C5.47 11.96 5.46 12.14 5.45 12.32C4.85 12.61 4.39 13.18 4.39 13.74C4.39 14.17 4.66 14.36 4.97 14.36C5.2 14.36 5.43 14.29 5.64 14.19L5.69 14.36L6.19 14.21C6.15 14.11 6.12 14 6.09 13.9C6.42 13.62 6.76 13.17 6.99 12.59C7.29 12.7 7.44 12.93 7.44 13.19C7.44 13.61 7.1 14.03 6.27 14.12L6.56 14.58C7.62 14.42 7.97 13.83 7.97 13.22C7.97 12.72 7.64 12.33 7.14 12.16ZM6.52 12.52C6.37 12.86 6.18 13.12 5.97 13.33C5.94 13.12 5.92 12.89 5.92 12.62V12.61C6.09 12.56 6.29 12.52 6.52 12.52ZM5.53 13.69C5.37 13.78 5.22 13.84 5.1 13.84C4.96 13.84 4.9 13.76 4.9 13.62C4.9 13.38 5.11 13.05 5.44 12.83C5.44 13.13 5.48 13.43 5.53 13.69Z" fill="#0a7a54"/><g transform="translate(10.6 10.2) scale(.86)"><path d="M5 2.6c-.9-.6-2.2-.7-3.1 0C.8 3.5.6 5.2 1.1 6.6c.5 1.4 1.5 2.8 2.6 2.8.5 0 .8-.25 1.3-.25s.8.25 1.3.25c1.1 0 2.1-1.4 2.6-2.8.5-1.4.3-3.1-.8-4-.9-.7-2.2-.6-3.1 0z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 2.6c-.9-.6-2.2-.7-3.1 0C.8 3.5.6 5.2 1.1 6.6c.5 1.4 1.5 2.8 2.6 2.8.5 0 .8-.25 1.3-.25s.8.25 1.3.25c1.1 0 2.1-1.4 2.6-2.8.5-1.4.3-3.1-.8-4-.9-.7-2.2-.6-3.1 0z" fill="#ff4d4f"/><path d="M2.2 4.4c.2-.8.8-1.2 1.4-1.3" stroke="#fff" stroke-opacity=".55" stroke-width=".55" stroke-linecap="round" fill="none"/><path d="M5 2.7c0-.8.2-1.4.7-1.9" stroke="#6b3e1e" stroke-width=".6" stroke-linecap="round" fill="none"/><path d="M5.4 1.6c.5-.9 1.5-1.2 2.4-1 -.3.9-1.2 1.4-2.4 1z" fill="#3ccf7f"/></g>`;
const LOGO = (size: number, cls = 'logo') => `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 20 20" aria-label="Sheetlingo" xmlns="http://www.w3.org/2000/svg">${LOGO_BODY('lg' + size)}</svg>`;
const FAVICON = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(LOGO(64))}">`;

const FONT = `<link rel="preconnect" href="https://cdn.jsdelivr.net"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">`;

const BASE_CSS = `
:root{--bg:#f7f8f7;--surface:#fff;--ink:#121614;--ink2:#4b5550;--ink3:#86908b;--line:#e4e8e6;--brand:#0f9d6b;--brand-ink:#0a7a54;--brand-soft:#e6f6ef;--danger:#d64545;--danger-soft:#fdeeee;
--shadow:0 1px 2px rgba(16,24,20,.04),0 12px 32px -8px rgba(16,24,20,.12);color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0e1110;--surface:#161a18;--ink:#eef2f0;--ink2:#b3bcb7;--ink3:#7b857f;--line:#262c29;--brand:#22c487;--brand-ink:#5fe0ad;--brand-soft:#123326;--danger:#ff7676;--danger-soft:#3a1c1c;
--shadow:0 1px 2px rgba(0,0,0,.3),0 16px 40px -10px rgba(0,0,0,.6);color-scheme:dark}}
*{box-sizing:border-box}html{-webkit-font-smoothing:antialiased}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:-.01em}
a{color:var(--brand-ink);text-decoration:none}a:hover{text-decoration:underline}
code{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--brand-soft);color:var(--brand-ink);padding:1px 6px;border-radius:5px}
`;

/* ── sign-in flow card ── */

const CARD_CSS = `
body{min-height:100vh;display:grid;place-items:center;padding:24px;
 background:radial-gradient(1200px 600px at 50% -10%,var(--brand-soft),transparent 70%),var(--bg)}
.card{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);padding:28px 28px 24px;text-align:center}
.brand{display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:14px;color:var(--ink2);margin-bottom:22px}
.steps{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 24px;padding:0;list-style:none;font-size:12px;color:var(--ink3)}
.steps li{display:flex;align-items:center;gap:6px}
.steps li+li::before{content:'';width:18px;height:1px;background:var(--line)}
.dot{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--line);font-size:10px;font-weight:700;color:var(--ink3)}
.steps .on{color:var(--ink)}.steps .on .dot{border-color:var(--brand);color:var(--brand)}
.steps .ok .dot{background:var(--brand);border-color:var(--brand);color:#fff}
.steps .ok .dot svg{width:10px;height:10px}
.icon{width:56px;height:56px;margin:0 auto 16px;border-radius:16px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand)}
.icon.err{background:var(--danger-soft);color:var(--danger)}
h1{font-size:20px;line-height:1.35;margin:0 0 6px;font-weight:700;letter-spacing:-.02em}
p{margin:0;color:var(--ink2)}
.actions{margin-top:22px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;border:0;border-radius:11px;background:var(--brand);color:#fff;font:600 15px inherit;font-family:inherit;cursor:pointer;transition:filter .15s,transform .05s}
.btn:hover{filter:brightness(1.06)}.btn:active{transform:translateY(1px)}
.fine{margin-top:14px;font-size:12px;color:var(--ink3)}
.file{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font-size:13px;font-weight:600;color:var(--ink);max-width:100%}
.file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* success mark: soft ring + drawn check */
.mark{width:56px;height:56px;margin:0 auto 16px}
.mark circle{fill:var(--brand-soft);stroke:var(--brand);stroke-width:2;stroke-dasharray:166;stroke-dashoffset:166;animation:ring .5s ease-out forwards}
.mark path{fill:none;stroke:var(--brand);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:40;animation:tick .3s .4s ease-out forwards}
@keyframes ring{to{stroke-dashoffset:0}}@keyframes tick{to{stroke-dashoffset:0}}
.hide{display:none}
`;

const CHECK_SM = `<svg viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SHEET_ICON = (s = 26) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 9h16M4 15h16M10 9v12"/></svg>`;
const SHEET_FILE = `<svg width="16" height="16" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2.5" fill="#0f9d58"/><path d="M8 9h8M8 13h8M8 17h8M12 9v8" stroke="#fff" stroke-width="1.6"/></svg>`;
const ALERT_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>`;
export const SUCCESS_MARK = `<svg class="mark" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26"/><path d="M17.5 28.5l7 7 14-15"/></svg>`;

type Step = 'todo' | 'on' | 'ok';
const steps = (s: [Step, Step, Step]) => {
  const labels = ['Sign in', 'Choose sheet', 'Back to Figma'];
  return `<ol class="steps" id="steps">${labels.map((l, i) => `<li class="${s[i]}"><span class="dot">${s[i] === 'ok' ? CHECK_SM : i + 1}</span>${l}</li>`).join('')}</ol>`;
};

const shell = (title: string, css: string, body: string, script = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON}${FONT}<title>${title}</title>
<style>${BASE_CSS}${css}</style></head><body>${body}${script}</body></html>`;

const card = (title: string, inner: string, script = '') =>
  shell(title, CARD_CSS, `<main class="card"><div class="brand">${LOGO(22, 'b')}Sheetlingo</div>${inner}</main>`, script);

/** Generic message card (errors, cancelled). */
export function messagePage(title: string, desc: string, kind: 'error' | 'info' = 'error') {
  return card(`${title} · Sheetlingo`,
    `<div class="icon ${kind === 'error' ? 'err' : ''}">${ALERT_ICON}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p>
     <p class="fine">Go back to Figma and try again.</p>`);
}

/** Step 2: Google Picker. Swaps to the success state after the user picks a file. */
export function pickerPage(cfg: { key: string; token: string; apiKey: string; appId: string; hint: string }) {
  return card('Choose a sheet · Sheetlingo', `
<div id="pick">
  ${steps(['ok', 'on', 'todo'])}
  <div class="icon">${SHEET_ICON()}</div>
  <h1>Choose your spreadsheet</h1>
  <p>Pick the sheet Sheetlingo should read.</p>
  <div class="actions"><button class="btn" id="b" onclick="openPicker()">${SHEET_ICON(18)}Choose spreadsheet</button></div>
  <p class="fine">Sheetlingo can open only the file you pick here.</p>
</div>
<div id="ok" class="hide">
  ${steps(['ok', 'ok', 'on'])}
  ${SUCCESS_MARK}
  <h1>You're connected</h1>
  <p>Return to Figma. Your sheet is loading there now.</p>
  <div class="file">${SHEET_FILE}<span id="fn"></span></div>
  <p class="fine">You can close this tab.</p>
</div>
<div id="bad" class="hide">
  <div class="icon err">${ALERT_ICON}</div>
  <h1>Couldn't connect</h1>
  <p>Something went wrong. Go back to Figma and try again.</p>
</div>`,
  `<script>const C=${JSON.stringify(cfg).replace(/</g, '\\u003c')};
const show=id=>{for(const x of ['pick','ok','bad'])document.getElementById(x).classList.toggle('hide',x!==id)};
function openPicker(){
  const view=new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMimeTypes('application/vnd.google-apps.spreadsheet,text/csv').setMode(google.picker.DocsViewMode.LIST);
  if(C.hint) view.setFileIds(C.hint);
  new google.picker.PickerBuilder().addView(view).setOAuthToken(C.token).setDeveloperKey(C.apiKey).setAppId(C.appId)
   .setCallback(async d=>{ if(d.action!==google.picker.Action.PICKED) return; const f=d.docs[0];
     const r=await fetch('/auth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:C.key,id:f.id,name:f.name,mime:f.mimeType})});
     if(r.ok){document.getElementById('fn').textContent=f.name;show('ok');}else show('bad'); }).build().setVisible(true);
}
</script><script src="https://apis.google.com/js/api.js" onload="gapi.load('picker',openPicker)"></script>`);
}

/* ── public site: home, privacy, terms ── */

const SITE_CSS = `
.wrap{max-width:1040px;margin:0 auto;padding:0 24px}body{overflow-x:hidden}.hero>*{min-width:0}
header{position:sticky;top:0;z-index:5;backdrop-filter:saturate(1.4) blur(12px);background:color-mix(in srgb,var(--bg) 82%,transparent);border-bottom:1px solid var(--line)}
header .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.home{display:flex;align-items:center;gap:9px;color:var(--ink);font-weight:700;font-size:16px}.home:hover{text-decoration:none}
nav a{color:var(--ink2);font-size:14px;margin-left:22px}nav a:hover{color:var(--ink);text-decoration:none}
footer{border-top:1px solid var(--line);margin-top:96px}
footer .wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;padding-top:28px;padding-bottom:40px;font-size:13px;color:var(--ink3)}
footer nav a{margin:0 0 0 18px;font-size:13px}
/* hero */
.hero{display:grid;grid-template-columns:1fr 1.05fr;gap:56px;align-items:center;padding:88px 0 120px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--brand-ink);background:var(--brand-soft);padding:5px 12px;border-radius:999px;margin-bottom:20px}
.hero h1{font-size:44px;line-height:1.15;letter-spacing:-.035em;margin:0 0 18px;font-weight:800}
.hero h1 em{font-style:normal;background:linear-gradient(120deg,#18c286,#0a7a54);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:18px;color:var(--ink2);margin:0 0 28px;max-width:30em}
.cta{display:flex;gap:10px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 20px;border-radius:12px;font-weight:600;font-size:15px}
.btn.primary{background:var(--ink);color:var(--bg)}.btn.ghost{border:1px solid var(--line);color:var(--ink);background:var(--surface)}
.btn:hover{text-decoration:none;filter:brightness(1.08)}
/* product visual */
.visual{position:relative}
.visual::before{content:'';position:absolute;inset:-40px -20px;background:radial-gradient(closest-side,var(--brand-soft),transparent);z-index:-1}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.sheet table{width:100%;border-collapse:collapse;font-size:13px}
.sheet th,.sheet td{border-bottom:1px solid var(--line);padding:9px 12px;text-align:left;white-space:nowrap}
.sheet th{font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;background:color-mix(in srgb,var(--line) 35%,transparent)}
.sheet td:first-child{font:12px ui-monospace,Menlo,monospace;color:var(--brand-ink)}
.sheet tr:last-child td{border-bottom:0}.sheet .hl td{background:color-mix(in srgb,var(--brand-soft) 70%,transparent)}
.bar{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line);font-size:12px;color:var(--ink3)}
.bar i{width:9px;height:9px;border-radius:50%;background:var(--line)}
.frame{position:absolute;right:-22px;bottom:-104px;width:236px;padding:16px}
.frame .lbl{font-size:11px;color:var(--ink3);margin-bottom:10px;display:flex;justify-content:space-between}
.frame .txt{font-size:17px;font-weight:700;letter-spacing:-.02em;outline:1.5px solid #0d99ff;outline-offset:3px;border-radius:2px}
.frame .sub{font-size:13px;color:var(--ink2);margin-top:8px}
.chips{display:flex;gap:6px;margin-top:14px}.chips span{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--ink2)}
.chips .on{background:var(--brand);border-color:var(--brand);color:#fff}
/* sections */
.features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}
.feat{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px}
.feat .ic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand);margin-bottom:16px}
.feat h3{margin:0 0 6px;font-size:16px;letter-spacing:-.02em}.feat p{margin:0;color:var(--ink2);font-size:14px}
.trust{margin-top:16px;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px 28px}
.trust .ic{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand)}
.trust h3{margin:0 0 4px;font-size:16px}.trust p{margin:0;color:var(--ink2);font-size:14px}
/* documents */
.doc{max-width:720px;padding-top:64px}
.doc h1{font-size:36px;letter-spacing:-.03em;margin:0 0 6px;font-weight:800}
.doc .meta{color:var(--ink3);font-size:14px;margin:0 0 36px}
.doc h2{font-size:18px;margin:36px 0 10px;letter-spacing:-.02em}
.doc p,.doc li{color:var(--ink2)}.doc ul{padding-left:20px}.doc li{margin:6px 0}.doc b{color:var(--ink)}
.box{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:4px 22px 6px}
@media (max-width:860px){.hero{grid-template-columns:1fr;padding:56px 0 130px;gap:48px}.hero h1{font-size:36px}.features{grid-template-columns:1fr;margin-top:96px}.frame{right:8px}.trust{grid-template-columns:1fr}nav a{margin-left:14px}header nav a[href^=mailto],header nav a[target]{display:none}footer nav{display:flex;flex-wrap:wrap;gap:6px 16px}footer nav a{margin:0}.sheet th:nth-child(4),.sheet td:nth-child(4){display:none}.lead{font-size:16px}.frame{width:200px;right:-6px;bottom:-110px}}
`;

const site = (title: string, main: string, head = '') => shell(title, SITE_CSS, `
<header><div class="wrap"><a class="home" href="/">${LOGO(26, 'b')}Sheetlingo</a>
<nav><a href="${COMMUNITY}" target="_blank" rel="noopener">Figma Community</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:${CONTACT}">Contact</a></nav></div></header>
${main}
<footer><div class="wrap"><span>© 2026 Sheetlingo</span><nav><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="mailto:${CONTACT}">${CONTACT}</a></nav></div></footer>`)
  .replace('<title>', head + '<title>');

const IC = {
  link: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  globe: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
  sync: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>',
  shield: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3z"/><path d="m9 12 2.2 2.2L15.5 10" stroke-linecap="round"/></svg>',
};

export const homePage = (verification?: string) => site('Sheetlingo · Sync Figma text with Google Sheets', `
<main class="wrap">
  <section class="hero">
    <div>
      <span class="eyebrow">${IC.globe.replace(/20/g, '14')}Figma plugin for localization</span>
      <h1>Your copy lives<br>in a sheet.<br><em>Your designs follow.</em></h1>
      <p class="lead">Link Figma text layers to spreadsheet keys, switch every screen to another language in one click, and pick up sheet edits automatically.</p>
      <div class="cta"><a class="btn primary" href="${COMMUNITY}" target="_blank" rel="noopener">Get it on Figma</a><a class="btn ghost" href="/privacy">How we handle data</a></div>
    </div>
    <div class="visual">
      <div class="panel sheet">
        <div class="bar"><i></i><i></i><i></i><span style="margin-left:6px">Strings · Google Sheets</span></div>
        <table>
          <tr><th>key</th><th>en</th><th>ko</th><th>ja</th></tr>
          <tr><td>home.title</td><td>Welcome back</td><td>다시 오신 걸 환영해요</td><td>おかえりなさい</td></tr>
          <tr class="hl"><td>home.cta</td><td>Get started</td><td>시작하기</td><td>はじめる</td></tr>
          <tr><td>profile.save</td><td>Save changes</td><td>변경 사항 저장</td><td>変更を保存</td></tr>
          <tr><td>common.ok</td><td>Confirm</td><td>확인</td><td>確認</td></tr>
        </table>
      </div>
      <div class="panel frame">
        <div class="lbl"><span>Frame · Home</span><span>home.cta</span></div>
        <div class="txt">시작하기</div>
        <div class="sub">다시 오신 걸 환영해요</div>
        <div class="chips"><span>EN</span><span class="on">KO</span><span>JA</span></div>
      </div>
    </div>
  </section>

  <section class="features">
    <div class="feat"><div class="ic">${IC.link}</div><h3>Link by key</h3><p>Select a text layer, pick its key, and every identical text in the area is linked and filled for you.</p></div>
    <div class="feat"><div class="ic">${IC.globe}</div><h3>Switch languages</h3><p>Flip a selection, a page or the whole file to any language column and catch overflowing text right away.</p></div>
    <div class="feat"><div class="ic">${IC.sync}</div><h3>Stay in sync</h3><p>Connect a Google Sheet, a CSV or a pasted table. Edits in the sheet flow into Figma while the plugin is open.</p></div>
  </section>

  <section class="trust">
    <div class="ic">${IC.shield}</div>
    <div><h3>Reads only the sheet you pick</h3><p>Google sign-in uses the <code>drive.file</code> scope, so Sheetlingo can open just the spreadsheet you choose. Nothing else in your Drive is visible to it, and your data stays on your computer. <a href="/privacy">Privacy Policy</a></p></div>
  </section>
</main>`, verification ? `<meta name="google-site-verification" content="${esc(verification)}">` : '');

const docPage = (title: string, body: string) =>
  site(`${title} · Sheetlingo`, `<main class="wrap doc"><h1>${title}</h1><p class="meta">Last updated ${UPDATED}</p>${body}</main>`);

export const privacyPage = () => docPage('Privacy Policy', `
<p>Sheetlingo is a Figma plugin that fills Figma text layers from a spreadsheet. This policy explains what data it uses when you sign in with Google.</p>
<h2>Data we access</h2>
<div class="box"><ul>
<li><b>Your email address</b> (<code>email</code>, <code>openid</code>): shown in the plugin so you know which account is connected.</li>
<li><b>Spreadsheets you pick</b> (<code>drive.file</code>): only the files you select in Google's file picker. The plugin reads their cell values to fill your Figma layers.</li>
</ul></div>
<h2>How the data is used</h2>
<p>Spreadsheet values are used only to update text in your Figma file. We do not use Google user data for advertising, sell it, or share it with third parties, and we do not use it to train AI or machine-learning models.</p>
<h2>Storage</h2>
<ul><li>Spreadsheet contents and access tokens are stored only on your computer, in Figma's plugin storage.</li>
<li>The refresh token is encrypted before it reaches your computer. Our server (a Cloudflare Worker) keeps a sign-in result for at most 10 minutes while the plugin picks it up, then deletes it. It keeps no copy of your spreadsheets.</li></ul>
<h2>Your choices</h2>
<p>Sign out in the plugin settings to delete stored tokens, or remove access any time at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
<h2>Google API Services User Data Policy</h2>
<p>Sheetlingo's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
<h2>Contact</h2><p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`);

export const termsPage = () => docPage('Terms of Service', `
<p>By using the Sheetlingo Figma plugin you agree to these terms.</p>
<h2>The service</h2><p>Sheetlingo updates text in your Figma files from spreadsheets you connect. You are responsible for the content of your spreadsheets and designs.</p>
<h2>Plans and payment</h2><p>Paid plans are billed and managed through Figma. You can cancel through Figma at any time; the plan stays active until the end of the paid period.</p>
<h2>Acceptable use</h2><p>Do not use Sheetlingo to break the law or to access data you are not allowed to access.</p>
<h2>No warranty</h2><p>Sheetlingo is provided "as is". We are not liable for indirect damages or lost data. Keep backups of important files.</p>
<h2>Changes</h2><p>We may update these terms. Material changes will be noted on this page.</p>
<h2>Contact</h2><p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`);
