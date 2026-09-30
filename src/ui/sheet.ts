import Papa from 'papaparse';
import type { Table } from '../shared/types';

export type SheetErrorCode = 'invalid-url' | 'not-shared' | 'not-found' | 'empty' | 'network' | 'bad-file';
export class SheetError extends Error {
  constructor(public code: SheetErrorCode) { super(code); }
}

export interface SheetRef { id: string; gid: string; published: boolean }

export function parseSheetUrl(input: string): SheetRef | null {
  const s = input.trim();
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
  const urls = ref.published
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
  'key,en,ko,ja,es',
  'home.title,Welcome back,다시 오신 걸 환영해요,おかえりなさい,Bienvenido de nuevo',
  'home.subtitle,Manage every word in one sheet,모든 문구를 시트 하나로 관리하세요,すべての文言をひとつのシートで,Gestiona cada palabra en una hoja',
  'home.cta,Get started,시작하기,はじめる,Empezar',
  'nickname.error_taken,This nickname is already taken.,이미 사용 중인 닉네임이에요.,このニックネームは使用されています。,Este apodo ya está en uso.',
  'nickname.error_forbidden,This nickname is not allowed.,사용할 수 없는 닉네임이에요.,このニックネームは使用できません。,Este apodo no está permitido.',
  'profile.gender_label,Gender,성별,性別,Género',
  'common.confirm,Confirm,확인,確認,Confirmar',
].join('\n');
