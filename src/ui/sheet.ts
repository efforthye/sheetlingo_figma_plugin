import Papa from 'papaparse';
import type { Table } from '../shared/types';

export type SheetErrorCode = 'invalid-url' | 'not-shared' | 'not-found' | 'empty' | 'network' | 'bad-file';
export class SheetError extends Error {
  constructor(public code: SheetErrorCode) { super(code); }
}

export interface SheetRef { id: string; gid: string; published: boolean; script?: string }

/** Apps Script web app the user pastes into their own sheet: reads a private sheet without any server or sign-in. */
export const APPS_SCRIPT = `// Sheetlingo: lets the Figma plugin read this sheet (it stays private)
function doGet(e) {
  var p = (e && e.parameter) || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  if (p.tabs) {
    var list = sheets.map(function (s) { return { id: s.getSheetId(), title: s.getName() }; });
    return ContentService.createTextOutput(JSON.stringify(list)).setMimeType(ContentService.MimeType.JSON);
  }
  var sh = sheets.filter(function (s) { return String(s.getSheetId()) === String(p.gid); })[0] || sheets[0];
  var rows = sh.getDataRange().getDisplayValues();
  var csv = rows.map(function (r) {
    return r.map(function (c) { return /[",\\r\\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
  }).join('\\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.TEXT);
}
`;

const SCRIPT_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+|macros)\/s\/([\w-]{20,})\/exec/;
export const isScriptUrl = (s: string) => SCRIPT_RE.test(s.trim());
export const scriptUrlWithGid = (s: string, gid: number | string) => {
  const m = s.trim().match(SCRIPT_RE);
  return m ? `${m[0]}?gid=${gid}` : s;
};

/** Tabs of a sheet reached through the Apps Script web app. */
export async function fetchScriptTabs(ref: SheetRef): Promise<{ id: number; title: string }[]> {
  const r = await tryFetch(`${ref.script}?tabs=1`);
  if (!r.ok) throw new SheetError(r.code);
  try { return JSON.parse(r.text); } catch (_) { throw new SheetError('not-shared'); }
}

export function parseSheetUrl(input: string): SheetRef | null {
  const s = input.trim();
  const sm = s.match(SCRIPT_RE);
  if (sm) return { id: sm[1], gid: (s.match(/[?&]gid=(\d+)/) || [])[1] || '', published: false, script: sm[0] };
  const gid = (s.match(/[#&?]gid=(\d+)/) || [])[1] || '0';
  const pub = s.match(/\/spreadsheets\/d\/e\/([\w-]+)/);
  if (pub) return { id: pub[1], gid, published: true };
  const m = s.match(/\/spreadsheets\/d\/([\w-]{20,})/);
  return m ? { id: m[1], gid, published: false } : null;
}

/** CSV / TSV text → raw rows (no header interpretation). */
export function parseRaw(text: string): string[][] {
  const res = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  const data = res.data.filter((r) => Array.isArray(r)).map((r) => r.map((c) => String(c ?? '')));
  if (!data.length) throw new SheetError('empty');
  return data;
}

const HEADERISH = /^(key|keys|id|string_?id|string_?key|키|[a-z]{2,3}([-_][A-Za-z0-9]{2,4})?)$/i;

/** Guess which of the first rows holds the column names. */
export function detectHeaderRow(raw: string[][]): number {
  const limit = Math.min(raw.length, 10);
  for (let i = 0; i < limit; i++) {
    const cells = raw[i].map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2 && cells.filter((c) => HEADERISH.test(c)).length >= 2) return i;
  }
  for (let i = 0; i < limit; i++) if (raw[i].filter((c) => c.trim()).length >= 2) return i;
  return 0;
}

/** Raw rows + header row index → Table (unique, non-empty column names). */
export function toTable(raw: string[][], headerRow: number): Table {
  const h = Math.max(0, Math.min(headerRow, raw.length - 1));
  const width = raw.reduce((m, r) => Math.max(m, r.length), 0);
  const seen = new Map<string, number>();
  const columns = Array.from({ length: width }, (_, i) => {
    let name = (raw[h]?.[i] ?? '').trim() || `col${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n) name = `${name} (${n + 1})`;
    return name;
  });
  const rows = raw.slice(h + 1).filter((r) => r.some((c) => c.trim())).map((r) => columns.map((_, i) => r[i] ?? ''));
  return { columns, rows, raw };
}

export function parseCsv(text: string): Table {
  const raw = parseRaw(text);
  return toTable(raw, detectHeaderRow(raw));
}

async function tryFetch(url: string): Promise<{ ok: true; text: string } | { ok: false; code: SheetErrorCode }> {
  let res: Response;
  try { res = await fetch(url, { redirect: 'follow', cache: 'no-store' }); }
  catch (_) { return { ok: false, code: 'not-shared' }; } // blocked redirect to login / CORS
  if (res.status === 404) return { ok: false, code: 'not-found' };
  if (res.status === 401 || res.status === 403) return { ok: false, code: 'not-shared' };
  if (!res.ok) return { ok: false, code: 'network' };
  const text = await res.text();
  if (/^\s*</.test(text)) return { ok: false, code: 'not-shared' }; // HTML login page
  return { ok: true, text };
}

/** Fetch a Google Sheet tab as CSV. Needs "Anyone with the link · Viewer" (or Publish to web). */
export async function fetchGoogleSheet(ref: SheetRef): Promise<string[][]> {
  const base = 'https://docs.google.com/spreadsheets/d/';
  const urls = ref.script
    ? [`${ref.script}${ref.gid ? `?gid=${ref.gid}` : ''}`]
    : ref.published
    ? [`${base}e/${ref.id}/pub?output=csv&gid=${ref.gid}`]
    : [
        `${base}${ref.id}/export?format=csv&gid=${ref.gid}`,
        `${base}${ref.id}/gviz/tq?tqx=out:csv&gid=${ref.gid}`,
      ];
  let code: SheetErrorCode = 'network';
  for (const u of urls) {
    const r = await tryFetch(u);
    if (r.ok) return parseRaw(r.text);
    if (r.code === 'not-found' || code === 'network') code = r.code;
  }
  if (!navigator.onLine) code = 'network';
  throw new SheetError(code);
}

export function tableHash(t: Table): string {
  const s = JSON.stringify([t.columns, t.rows]);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(36) + ':' + s.length;
}

export const SAMPLE_CSV = [
  'key,en,ko,es,pt',
  'common.button.confirm,Confirm,확인,Confirmar,Confirmar',
  'common.button.cancel,Cancel,취소,Cancelar,Cancelar',
  'common.button.retry,Try again,다시 시도,Intentar de nuevo,Tentar novamente',
  'login.title,Welcome back,다시 오신 걸 환영해요,Bienvenido de nuevo,Bem-vindo de volta',
  'login.error.password,Incorrect password. Please try again.,비밀번호가 올바르지 않아요. 다시 입력해 주세요.,Contraseña incorrecta. Inténtalo de nuevo.,Senha incorreta. Tente novamente.',
  'shop.item.count,{count} items left,{count}개 남음,Quedan {count} artículos,Restam {count} itens',
  'shop.purchase.success,Purchase complete!,구매가 완료됐어요!,¡Compra completada!,Compra concluída!',
  "star.expire.notice,Stars expire automatically after their expiration date. We'll notify you one day before they expire.,스타는 유효기간이 지나면 자동으로 소멸돼요. 소멸 하루 전에 알려드릴게요.,Las estrellas vencen automáticamente tras su fecha de expiración. Te avisaremos un día antes.,As estrelas expiram automaticamente após a data de vencimento. Avisaremos você um dia antes.",
  'guild.war.start,Guild war starts in {minutes} minutes,{minutes}분 후 길드전이 시작돼요,La guerra de gremios empieza en {minutes} minutos,A guerra de guildas começa em {minutes} minutos',
  'settings.language,"Language, region","언어, 지역","Idioma, región","Idioma, região"',
].join('\n');
