import { parseRaw } from './sheet';
import { AUTH_SERVER } from '../shared/config';
import type { GoogleAuth } from '../shared/types';
import { send } from './bridge';

export type GoogleErrorCode = 'auth' | 'no-access' | 'network' | 'cancelled' | 'tab-missing';
export class GoogleError extends Error {
  constructor(public code: GoogleErrorCode, detail = '') { super(code + (detail ? ': ' + detail : '')); }
}

export interface PickedFile { id: string; name: string; mime?: string }
export interface Tab { id: number; title: string }

const randomKey = () => {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Opens Google sign-in + spreadsheet picker in the browser and waits for the result.
 * `fileHint` pre-selects a spreadsheet (e.g. from a pasted private link).
 */
export async function signInAndPick(opts: { consent: boolean; fileHint?: string; signal: { cancelled: boolean } }) {
  const key = randomKey();
  const q = new URLSearchParams({ key, consent: opts.consent ? '1' : '0', ...(opts.fileHint ? { file: opts.fileHint } : {}) });
  send({ type: 'open-url', url: `${AUTH_SERVER}/auth/start?${q}` });
  const until = Date.now() + 5 * 60_000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 2000));
    if (opts.signal.cancelled) throw new GoogleError('cancelled');
    let data: any;
    try { data = await (await fetch(`${AUTH_SERVER}/auth/poll?key=${key}`)).json(); } catch (_) { continue; }
    if (data.status === 'done') {
      const auth: Omit<GoogleAuth, 'refresh'> & { refresh: string | null } = {
        email: data.email, accessToken: data.accessToken, expiresAt: data.expiresAt, refresh: data.refresh,
      };
      return { auth, file: data.file as PickedFile };
    }
  }
  throw new GoogleError('cancelled', 'timeout');
}

/** Returns an auth object with a valid access token (refreshing if needed). */
export async function freshAuth(auth: GoogleAuth): Promise<GoogleAuth> {
  if (auth.expiresAt > Date.now() + 30_000) return auth;
  if (!auth.refresh) throw new GoogleError('auth');
  let res: Response;
  try {
    res = await fetch(`${AUTH_SERVER}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: auth.refresh }) });
  } catch (_) { throw new GoogleError('network'); }
  if (res.status === 401) throw new GoogleError('auth');
  if (!res.ok) throw new GoogleError('network');
  const t = await res.json();
  return { ...auth, accessToken: t.accessToken, expiresAt: t.expiresAt };
}

export async function revoke(auth: GoogleAuth) {
  if (!auth.refresh) return;
  try { await fetch(`${AUTH_SERVER}/auth/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: auth.refresh }) }); } catch (_) { /* ignore */ }
}

async function api(token: string, url: string) {
  let res: Response;
  try { res = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' }); }
  catch (_) { throw new GoogleError('network'); }
  if (res.status === 401) throw new GoogleError('auth');
  if (res.status === 403 || res.status === 404) throw new GoogleError('no-access');
  if (res.status === 400) throw new GoogleError('tab-missing');
  if (!res.ok) throw new GoogleError('network', String(res.status));
  return res.json();
}

/** A CSV file stored in Google Drive (picked in the Picker): downloaded as text. */
export async function fetchDriveCsv(token: string, fileId: string): Promise<string[][]> {
  let res: Response;
  try { res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' }); }
  catch (_) { throw new GoogleError('network'); }
  if (res.status === 401) throw new GoogleError('auth');
  if (res.status === 403 || res.status === 404) throw new GoogleError('no-access');
  if (!res.ok) throw new GoogleError('network', String(res.status));
  return parseRaw(await res.text());
}

export async function listTabs(token: string, fileId: string): Promise<{ title: string; tabs: Tab[] }> {
  const d = await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=properties.title,sheets.properties(sheetId,title)`);
  return {
    title: d.properties?.title ?? '',
    tabs: (d.sheets ?? []).map((s: any) => ({ id: s.properties.sheetId, title: s.properties.title })),
  };
}

/** Raw cell values of one tab (header row is chosen later). */
export async function fetchTab(token: string, fileId: string, title: string): Promise<string[][]> {
  const range = encodeURIComponent(`'${title.replace(/'/g, "''")}'`);
  const d = await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${range}?valueRenderOption=FORMATTED_VALUE`);
  return (d.values ?? []).map((r: unknown[]) => r.map((c) => String(c ?? '')));
}

/** Cheap change check (Drive metadata) — used for near-real-time sync. */
export async function modifiedTime(token: string, fileId: string): Promise<string> {
  const d = await api(token, `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime&supportsAllDrives=true`);
  return d.modifiedTime ?? '';
}
