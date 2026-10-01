import { useEffect, useMemo, useRef, useState } from 'react';
import { FREE, PRICE } from '../shared/constants';
import { allowedLanguages, buildDict, guessMapping, normName, normText, stripTags } from '../shared/dict';
import { authConfigured } from '../shared/config';
import type { DocConfig, GoogleAuth, Mapping, SameRef, ScopeInfo, PlanInfo, Report, ReportSource, Scope, SelectionInfo, SourceMeta, Table } from '../shared/types';
import { send } from './bridge';
import { CopyButton, Icon, ReportView, Seg, copyText } from './components';
import { LOCALES, type Locale, type MsgKey, type T } from './i18n';
import type { Scope as ScopeT } from '../shared/types';
import { APPS_SCRIPT, SAMPLE_CSV, SheetError, detectHeaderRow, fetchGoogleSheet, fetchScriptTabs, isScriptUrl, parseCsv, parseSheetUrl, scriptUrlWithGid, toTable } from './sheet';
import { GoogleError, fetchTab, freshAuth, listTabs, revoke, signInAndPick, type Tab } from './google';

export function errorText(e: unknown, t: T): string {
  if (e instanceof SheetError) {
    const m = { 'invalid-url': 'errInvalid', 'not-shared': 'errNotShared', 'not-found': 'errNotFound', empty: 'errEmpty', network: 'errNetwork', 'bad-file': 'errBadFile' } as const;
    return t(m[e.code]);
  }
  if (e instanceof GoogleError) {
    const g = { auth: 'errSignIn', 'no-access': 'errNoAccessApi', network: 'errNetwork', cancelled: 'errCancelled', 'tab-missing': 'errNotFound' } as const;
    return t(g[e.code]);
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === 'NO_TEXT_SELECTED') return t('noTextSel');
  if (msg === 'NO_CARD_SELECTED') return t('noCardSel');
  return t('error', { msg });
}

type Rep = { source: ReportSource; report: Report } | null;
export type Review = { excluded: string[]; index: number };

const GoogleG = () => (
  <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/* ───────────────────────── Source & settings ───────────────────────── */

export function SourceView(p: {
  t: T; config: DocConfig; table: Table | null; pro: boolean; locale: Locale;
  onSave: (meta: SourceMeta, table: Table, mapping: Mapping) => void;
  saveConfig: (c: DocConfig) => void; setLocale: (l: Locale) => void;
  onUpgrade: (reason?: MsgKey) => void; onDisconnect: () => void;
  auth: GoogleAuth | null; onAuth: (a: GoogleAuth | null) => void;
}) {
  const { t, config, pro } = p;
  type Kind = 'google' | 'file' | 'paste';
  const initialKind: Kind = config.source?.kind === 'file' || config.source?.kind === 'paste' ? config.source.kind : 'google';
  const [kind, setKind] = useState<Kind>(initialKind);
  const [tabs, setTabs] = useState<Tab[] | null>(null);
  const [apiFile, setApiFile] = useState<{ id: string; name: string } | null>(
    config.source?.kind === 'google-api' && config.source.fileId ? { id: config.source.fileId, name: config.source.label.split(' · ')[0] } : null,
  );
  const [signing, setSigning] = useState(false);
  const signal = useRef({ cancelled: false });
  const [url, setUrl] = useState(config.source?.url ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>(p.table ? 'ok' : 'idle');
  const [errCode, setErrCode] = useState('');
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<{ table: Table; meta: SourceMeta } | null>(
    p.table && config.source ? { table: p.table, meta: config.source } : null,
  );
  const [mapping, setMapping] = useState<Mapping | null>(config.mapping ?? (p.table ? guessMapping(p.table.columns) : null));
  const [headerRow, setHeaderRow] = useState<number>(config.mapping?.headerRow ?? 0);
  const [paste, setPaste] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const accept = (table: Table, meta: SourceMeta) => {
    setDraft({ table, meta });
    setHeaderRow(table.raw ? detectHeaderRow(table.raw) : 0);
    const same = config.mapping && config.mapping.keyColumn && table.columns.includes(config.mapping.keyColumn);
    setMapping(same ? { ...config.mapping!, languages: config.mapping!.languages.filter((l) => table.columns.includes(l)) } : guessMapping(table.columns));
    setStatus('ok'); setErr('');
  };
  const fail = (e: unknown) => {
    setStatus('error'); setErr(errorText(e, t));
    setErrCode(e instanceof SheetError || e instanceof GoogleError ? e.code : '');
  };

  /* ── signed-in Google Sheets API ── */
  const withAuth = async (a: GoogleAuth) => {
    const f = await freshAuth(a);
    if (f !== a) p.onAuth(f);
    return f;
  };
  const loadTab = async (a: GoogleAuth, file: { id: string; name: string }, tab: Tab) => {
    const raw = await fetchTab(a.accessToken, file.id, tab.title);
    if (!raw.length) throw new SheetError('empty');
    const table = toTable(raw, detectHeaderRow(raw));
    accept(table, {
      kind: 'google-api', fileId: file.id, sheetId: tab.id, sheetTitle: tab.title,
      label: `${file.name} · ${tab.title}`, fetchedAt: Date.now(), rowCount: table.rows.length,
    });
  };
  const loadFile = async (a0: GoogleAuth, fileId: string, gid?: number) => {
    setStatus('loading');
    const a = await withAuth(a0);
    const info = await listTabs(a.accessToken, fileId);
    const file = { id: fileId, name: info.title || 'Google Sheet' };
    setTabs(info.tabs); setApiFile(file);
    const tab = info.tabs.find((x) => x.id === gid) ?? info.tabs[0];
    if (!tab) throw new SheetError('empty');
    await loadTab(a, file, tab);
  };
  const pick = async (hint?: string, gid?: number) => {
    signal.current = { cancelled: false };
    setSigning(true); setStatus('idle'); setErr('');
    try {
      const { auth, file } = await signInAndPick({ consent: !p.auth?.refresh, fileHint: hint, signal: signal.current });
      const merged: GoogleAuth = { ...auth, refresh: auth.refresh ?? p.auth?.refresh ?? null };
      p.onAuth(merged);
      setSigning(false);
      await loadFile(merged, file.id, file.id === hint ? gid : undefined);
    } catch (e) { setSigning(false); fail(e); }
  };
  const changeTab = async (id: number) => {
    const tab = tabs?.find((x) => x.id === id);
    if (!tab || !apiFile || !p.auth) return;
    setStatus('loading');
    try { await loadTab(await withAuth(p.auth), apiFile, tab); } catch (e) { fail(e); }
  };
  const signOut = async () => { if (p.auth) await revoke(p.auth); p.onAuth(null); };

  // Reopening settings on a connected private sheet → load its tab list
  useEffect(() => {
    if (config.source?.kind !== 'google-api' || !config.source.fileId || !p.auth) return;
    withAuth(p.auth).then((a) => listTabs(a.accessToken, config.source!.fileId!)).then((i) => setTabs(i.tabs)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [scriptTabs, setScriptTabs] = useState<{ id: number; title: string }[] | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const connectScript = async (input: string, gidPick?: number) => {
    const ref = parseSheetUrl(input)!;
    setStatus('loading');
    try {
      const list = await fetchScriptTabs(ref);
      setScriptTabs(list);
      const tab = list.find((x) => String(x.id) === String(gidPick ?? ref.gid)) ?? list[0];
      const u = scriptUrlWithGid(input, tab?.id ?? 0);
      setUrl(u);
      const raw = await fetchGoogleSheet(parseSheetUrl(u)!);
      const table = toTable(raw, detectHeaderRow(raw));
      accept(table, { kind: 'google', url: u, label: `Google Sheet · ${tab?.title ?? ''}`, sheetTitle: tab?.title, fetchedAt: Date.now(), rowCount: table.rows.length });
    } catch (e) { fail(e); }
  };

  const connectGoogle = async () => {
    const ref = parseSheetUrl(url);
    if (!ref) return fail(new SheetError('invalid-url'));
    if (ref.script) return connectScript(url);
    const gid = Number(ref.gid);
    // Signed in → try the API first (works for private/company sheets the user already picked)
    if (p.auth && !ref.published) {
      try { return await loadFile(p.auth, ref.id, gid); }
      catch (e) {
        if (e instanceof GoogleError && (e.code === 'no-access' || e.code === 'auth')) return pick(ref.id, gid);
        // fall through to public CSV
      }
    }
    setStatus('loading');
    try {
      const raw = await fetchGoogleSheet(ref);
      const table = toTable(raw, detectHeaderRow(raw));
      accept(table, { kind: 'google', url: url.trim(), label: `Google Sheet · gid ${ref.gid}`, fetchedAt: Date.now(), rowCount: table.rows.length });
    } catch (e) { fail(e); }
  };
  const readFile = async (f: File) => {
    if (!/\.(csv|tsv|txt)$/i.test(f.name)) return fail(new SheetError('bad-file'));
    try {
      const table = parseCsv(await f.text());
      accept(table, { kind: 'file', label: f.name, fetchedAt: Date.now(), rowCount: table.rows.length });
    } catch (e) { fail(e instanceof SheetError ? e : new SheetError('bad-file')); }
  };
  const usePaste = () => {
    try {
      const table = parseCsv(paste);
      accept(table, { kind: 'paste', label: t('srcPaste'), fetchedAt: Date.now(), rowCount: table.rows.length });
    } catch (e) { fail(e); }
  };

  /** Header row changed → rebuild columns from the raw rows and re-guess roles. */
  const changeHeader = (h: number) => {
    if (!draft?.table.raw) return;
    const table = toTable(draft.table.raw, h);
    setHeaderRow(h);
    setDraft({ ...draft, table });
    setMapping(guessMapping(table.columns));
  };

  type Role = 'key' | 'lang' | 'skip';
  const roleOf = (c: string): Role => (mapping?.keyColumn === c ? 'key' : mapping?.languages.includes(c) ? 'lang' : 'skip');
  const setRole = (c: string, role: Role) => {
    if (!mapping || roleOf(c) === role) return;
    let { keyColumn, languages, baseLang } = mapping;
    if (role === 'lang' && !pro && languages.length >= FREE.maxLanguages) return p.onUpgrade('upLang');
    if (keyColumn === c) keyColumn = '';
    languages = languages.filter((l) => l !== c);
    if (role === 'key') keyColumn = c;
    if (role === 'lang') languages = cols.filter((x) => x === c || languages.includes(x));
    if (!languages.includes(baseLang)) baseLang = languages[0] ?? '';
    setMapping({ ...mapping, keyColumn, languages, baseLang });
  };

  const trySample = () => accept(parseCsv(SAMPLE_CSV), { kind: 'paste', label: 'Sample data', fetchedAt: Date.now(), rowCount: 7 });
  const downloadSample = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' }));
    a.download = 'sheetlingo-example.csv'; a.click();
  };

  const cols = draft?.table.columns ?? [];
  const raw = draft?.table.raw ?? (draft ? [draft.table.columns, ...draft.table.rows] : []);
  const sampleOf = (c: string) => {
    const i = cols.indexOf(c);
    return draft?.table.rows.find((r) => r[i]?.trim())?.[i] ?? '';
  };
  const canSave = !!(draft && mapping && mapping.keyColumn && mapping.languages.length && mapping.baseLang);

  return (
    <>
      <div className="body">
        {!config.source && !draft && (
          <div className="card soft stack">
            <b>{t('howTitle')}</b>
            <ol className="how">
              <li><span>1</span>{t('how1')}</li>
              <li><span>2</span>{t('how2')}</li>
              <li><span>3</span>{t('how3')}</li>
            </ol>
            <div className="row">
              <button className="btn primary sm" onClick={trySample}>{t('trySample')}</button>
              <button className="btn ghost sm" onClick={downloadSample}>{t('downloadSample')}</button>
            </div>
          </div>
        )}

        <Seg value={kind} onChange={(k) => { setKind(k); }} options={[
          { value: 'google', label: t('srcGoogle') }, { value: 'file', label: t('srcFile') }, { value: 'paste', label: t('srcPaste') },
        ]} />

        {kind === 'google' && (
          <div className="stack">
            <div className="card soft stack">
              <div className="row between">
                <b>{t('privateTitle')}</b>
                {p.auth && <button className="btn ghost sm" onClick={signOut}>{t('signOut')}</button>}
              </div>
              {p.auth
                ? <span className="small muted">{t('signedInAs', { email: p.auth.email || 'Google' })}</span>
                : <span className="small muted">{t(authConfigured() ? 'privateDesc' : 'scriptDesc')}</span>}
              {!authConfigured() ? (
                <details className="script-guide" open={!config.source || (status === 'error' && errCode === 'not-shared')}>
                  <summary>{t('scriptTitle')}</summary>
                  <ol className="steps">
                    <li>{t('script1')}</li>
                    <li>{t('script2')}
                      <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => { copyText(APPS_SCRIPT); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500); }}>
                        <Icon name={codeCopied ? 'check' : 'copy'} size={12} />{codeCopied ? t('copied') : t('copyCode')}
                      </button>
                    </li>
                    <li>{t('script3')}</li>
                    <li>{t('script4')}</li>
                  </ol>
                  <p className="small muted">{t('scriptNote')}</p>
                </details>
              ) : signing ? (
                <div className="note row"><Icon name="refresh" className="spin" size={14} /><span className="grow">{t('waitingBrowser')}</span>
                  <button className="btn sm" onClick={() => { signal.current.cancelled = true; setSigning(false); }}>{t('cancel')}</button></div>
              ) : (
                <button className="btn google" onClick={() => pick()}>
                  <GoogleG />{p.auth ? t('chooseSheet') : t('signInGoogle')}
                </button>
              )}
              {scriptTabs && scriptTabs.length > 1 && isScriptUrl(url) && (
                <div className="field">
                  <label>{t('tab')}</label>
                  <select className="select" value={parseSheetUrl(url)?.gid || scriptTabs[0].id} onChange={(e) => connectScript(url, Number(e.target.value))}>
                    {scriptTabs.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                  </select>
                </div>
              )}
              {apiFile && tabs && tabs.length > 0 && (
                <div className="field">
                  <label>{apiFile.name} · {t('tab')}</label>
                  <select className="select" value={draft?.meta.sheetId ?? tabs[0].id} onChange={(e) => changeTab(Number(e.target.value))}>
                    {tabs.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                  </select>
                </div>
              )}
            </div>

            <label className="small muted">{t('orPublicLink')}</label>
            <div className="row">
              <input className="input grow" placeholder={t('urlPlaceholder')} value={url} onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connectGoogle()} />
              <button className="btn primary" disabled={!url.trim() || status === 'loading'} onClick={connectGoogle}>
                {status === 'loading' ? <Icon name="refresh" className="spin" size={14} /> : t(status === 'error' ? 'recheck' : 'connect')}
              </button>
            </div>
            {status === 'loading' && <div className="note">{t('checking')}</div>}
            {status === 'error' && (
              <div className="note err stack">
                <span>{err}</span>
                {errCode === 'not-shared' && authConfigured() && (
                  <button className="btn google sm" style={{ alignSelf: 'flex-start' }} onClick={() => { const r = parseSheetUrl(url); pick(r?.id, r ? Number(r.gid) : undefined); }}>
                    <GoogleG />{t('signInGoogle')}
                  </button>
                )}
              </div>
            )}
            {status === 'ok' && (draft?.meta.kind === 'google' || draft?.meta.kind === 'google-api') && (
              <div className="note ok row"><Icon name="check" size={14} />{t('accessOk', { rows: draft.table.rows.length, cols: draft.table.columns.length })}</div>
            )}
            <details open={status === 'error' && errCode === 'not-shared' && !authConfigured()}>
              <summary>{t('howShare')}</summary>
              <ol className="steps"><li>{t('share1')}</li><li>{t('share2')}</li><li>{t('share3')}</li></ol>
              <p className="small muted" style={{ marginTop: 6 }}>{t('shareTab')}<br />{t('sharePrivate')}</p>
            </details>
          </div>
        )}

        {kind === 'file' && (
          <div className="stack">
            <div className={'drop' + (over ? ' over' : '')} onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}>
              {t('dropFile')}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
            {status === 'error' && <div className="note err">{err}</div>}
            {status === 'ok' && draft?.meta.kind === 'file' && <div className="note ok">{draft.meta.label} · {t('accessOk', { rows: draft.table.rows.length, cols: draft.table.columns.length })}</div>}
          </div>
        )}

        {kind === 'paste' && (
          <div className="stack">
            <textarea className="input" placeholder={t('pastePlaceholder')} value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button className="btn" disabled={!paste.trim()} onClick={usePaste}>{t('usePaste')}</button>
            {status === 'error' && <div className="note err">{err}</div>}
          </div>
        )}

        {draft && mapping && (
          <div className="card stack">
            <div className="field">
              <label>{t('headerRow')}</label>
              <select className="select" value={headerRow} onChange={(e) => changeHeader(Number(e.target.value))} disabled={!draft.table.raw}>
                {raw.slice(0, 10).map((r, i) => (
                  <option key={i} value={i}>{t('rowN', { n: i + 1 })}: {r.filter((c) => c.trim()).slice(0, 4).join(' · ').slice(0, 60)}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>{t('columnsTitle')}</label>
              <div className="cols">
                {cols.map((c) => {
                  const role = roleOf(c);
                  return (
                    <div key={c} className={'colrow ' + role}>
                      <div className="grow colname">
                        <b title={c}>{c}</b>
                        <span title={sampleOf(c)}>{sampleOf(c) || t('emptyVal')}</span>
                      </div>
                      {role === 'lang' && (
                        <button className={'deflang' + (mapping.baseLang === c ? ' on' : '')} title={t('setDefault')}
                          onClick={() => setMapping({ ...mapping, baseLang: c })}>
                          {mapping.baseLang === c ? '★ ' + t('defaultBadge') : '☆'}
                        </button>
                      )}
                      <div className="seg mini">
                        {(['key', 'lang', 'skip'] as const).map((r) => (
                          <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(c, r)}>
                            {t(r === 'key' ? 'roleKey' : r === 'lang' ? 'roleLang' : 'roleSkip')}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!mapping.keyColumn && <span className="small warn-text">{t('needKey')}</span>}
              {mapping.keyColumn && !mapping.languages.length && <span className="small warn-text">{t('needLang')}</span>}
              <span className="small muted">{t('baseHint')}</span>
            </div>

            {mapping.keyColumn && mapping.languages.length > 0 && (
              <div className="field">
                <label>{t('preview')} · {t('rowsCount', { n: draft.table.rows.length })}</label>
                <div className="tbl">
                  <table>
                    <thead><tr>{[mapping.keyColumn, ...mapping.languages].map((c) => <th key={c} className={c === mapping.keyColumn ? 'k' : ''}>{c}</th>)}</tr></thead>
                    <tbody>
                      {draft.table.rows.slice(0, 6).map((r, i) => (
                        <tr key={i}>{[mapping.keyColumn, ...mapping.languages].map((c) => { const v = r[cols.indexOf(c)]; return <td key={c} title={v}>{v}</td>; })}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {config.source && (
          <div className="card stack">
            <h2>{t('options')}</h2>
            <label className="check">
              <input type="checkbox" checked={config.renameOnBind} onChange={(e) => p.saveConfig({ ...config, renameOnBind: e.target.checked })} />
              <span>{t('optRename')}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={config.autoSync} disabled={config.source.kind !== 'google' && config.source.kind !== 'google-api'}
                onChange={(e) => p.saveConfig({ ...config, autoSync: e.target.checked })} />
              <span>{t('optAuto')}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={config.unlinkOnEdit !== false} onChange={(e) => p.saveConfig({ ...config, unlinkOnEdit: e.target.checked })} />
              <span>{t('optUnlinkOnEdit')}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={config.stripTags !== false} onChange={(e) => p.saveConfig({ ...config, stripTags: e.target.checked })} />
              <span>{t('optStripTags')}</span>
            </label>
            <div className="field">
              <label>{t('uiLanguage')}</label>
              <select className="select" value={p.locale} onChange={(e) => p.setLocale(e.target.value as Locale)}>
                {(Object.keys(LOCALES) as Locale[]).map((l) => <option key={l} value={l}>{LOCALES[l].name}</option>)}
              </select>
            </div>
            <button className="btn ghost danger sm" style={{ alignSelf: 'flex-start' }} onClick={p.onDisconnect}>{t('disconnect')}</button>
            <span className="small muted">Sheetlingo v{__VERSION__} · build {__BUILD__}</span>
          </div>
        )}
      </div>
      <div className="footer">
        <button className="btn primary block" disabled={!canSave} onClick={() => draft && mapping && p.onSave(draft.meta, draft.table, { ...mapping, headerRow })}>
          {t('saveContinue')}
        </button>
      </div>
    </>
  );
}

/* ───────────────────────── Sync ───────────────────────── */

export function SyncView(p: {
  t: T; config: DocConfig; mapping: Mapping; table: Table; sel: SelectionInfo; scope: Scope; setScope: (s: Scope) => void;
  pro: boolean; busy: boolean; report: Rep; onApply: (lang: string) => void; onUpgrade: (reason?: MsgKey) => void; usage: number;
  onSelectLang: (lang: string) => void; scopeInfo: ScopeInfo | null; saveConfig: (c: DocConfig) => void;
  same: SameRef | null; review: Review | null; setReview: (r: Review | null) => void;
  unlinkedPos: { index: number; total: number } | null;
  onPendingSame: (r: SameRef | null) => void;
  inspectKey: string | null; onCloseInspect: () => void;
  keyOnly: boolean; setKeyOnly: (v: boolean) => void;
  onClearBase: () => void;
  /** Last linked text remembered while an area (frame) is selected. */
  baseFromArea: SameRef | null;
}) {
  const { t, mapping, pro, sel } = p;
  const autoLinkOn = p.config.autoLinkOnApply !== false && (p.scope === 'selection' || p.keyOnly);
  const info = p.scopeInfo && p.scopeInfo.scope === p.scope ? p.scopeInfo : null;
  const excluded = new Set(p.review?.excluded ?? []);
  const items = info?.items ?? [];
  const exLinked = items.filter((i) => excluded.has(i.id) && i.key).length;
  const exNew = items.filter((i) => excluded.has(i.id) && !i.key).length;
  const nLinked = info ? info.linked - exLinked : 0;
  const nNew = info && autoLinkOn ? info.unlinked - exNew : 0;
  // The list is always shown; it freezes (stops following canvas selection) once you navigate or exclude
  const [listOpen, setListOpen] = useState(true);
  const rv = p.review ?? { excluded: [], index: -1 };
  const go = (i: number) => {
    if (!items.length) return;
    const idx = (i + items.length) % items.length;
    p.setReview({ ...rv, index: idx });
    send({ type: 'focus', nodeId: items[idx].id });
  };
  const [changing, setChanging] = useState(false);
  const [picked, setPicked] = useState('');
  /** Text layer(s) the picked key will be linked to — kept while you select an area below. */
  const [pinned, setPinned] = useState<{ ids: string[]; text: string } | null>(null);
  const allowed = allowedLanguages(mapping, pro, FREE.maxLanguages);
  const current = p.config.currentLang && allowed.includes(p.config.currentLang) ? p.config.currentLang : mapping.baseLang;
  const dict = useMemo(() => buildDict(p.table, mapping).dict, [p.table, mapping]);
  // How many layers will actually change (text differs from the value to apply, or a new link)
  const strip = p.config.stripTags !== false;
  const willChange = useMemo(() => {
    let n = 0;
    for (const it of items) {
      if (excluded.has(it.id)) continue;
      const newLink = !it.key || (p.keyOnly && !!p.same && it.key !== p.same.key);
      if (newLink && !autoLinkOn) continue;
      const k = newLink ? p.same?.key ?? '' : it.key;
      const raw = k ? dict[k]?.[current] || dict[k]?.[mapping.baseLang] : undefined;
      const next = raw !== undefined && strip ? stripTags(raw) : raw;
      if (newLink || (next !== undefined && normText(next) !== normText(it.text))) n++;
    }
    return n;
  }, [items, p.review?.excluded, autoLinkOn, p.keyOnly, p.same?.key, dict, current, strip]);
  const linkedKey = sel.textCount === 1 && sel.keyedCount === 1 ? sel.keys[0] : '';
  const held = !!(picked && pinned);
  const linking = held || (sel.textCount > 0 && (!linkedKey || changing)) || (!!p.baseFromArea && changing);
  const selKey = sel.keys.join('|') + '#' + sel.firstText;
  // A picked key stays pinned to its text while you select a frame/area for "Apply to"
  useEffect(() => { if (!held) { setChanging(false); setPicked(''); setPinned(null); } }, [selKey]);
  useEffect(() => { p.onPendingSame(held ? { key: picked, text: pinned!.text, relink: true } : null); }, [held, picked, pinned?.text]);
  const pick = (k: string) => {
    setPicked(k);
    if (!pinned) setPinned(p.baseFromArea?.nodeId
      ? { ids: [p.baseFromArea.nodeId], text: p.baseFromArea.text }
      : { ids: (sel.sig || '').split(',').filter(Boolean), text: sel.firstText });
  };
  const unpin = () => { setPicked(''); setPinned(null); setChanging(false); };
  const step3 = useRef<HTMLDivElement>(null);
  useEffect(() => { if (picked) step3.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [picked]);

  const linkAndApply = () => {
    if (!picked) return;
    const v = dict[picked];
    const val = v?.[current] || v?.[mapping.baseLang];
    const strip = p.config.stripTags !== false;
    // One step: link the pinned text(s) to the key, then apply the language to the chosen scope
    send({
      type: 'bind', key: picked, value: val !== undefined && strip ? stripTags(val) : val, ids: pinned?.ids,
      sync: { table: p.table, mapping, lang: current, scope: p.scope, stripTags: strip,
        same: p.keyOnly || !p.same ? { key: picked, text: pinned?.text ?? sel.firstText, relink: true } : undefined },
    });
    p.onSelectLang(current);
    unpin();
  };
  const Values = ({ k }: { k: string }) => (
    <div className="vals">
      {mapping.languages.map((l) => (
        <div key={l} className={'val' + (l === current ? ' on' : '')}><b>{l}</b><span className={dict[k]?.[l] ? '' : 'muted'}>{dict[k]?.[l] || t('emptyVal')}</span></div>
      ))}
    </div>
  );

  return (
    <>
      <div className="body">
        <div className="section-title">{t('linkSection')}</div>
        {/* ① selected text → ② choose key → ③ link & apply */}
        <div className="card stack steps-card">
          <div className={'step' + (sel.textCount ? ' done' : ' active')}>
            <span className="num">1</span>
            <div className="grow stack">
              <b>{t('stepSelect')}</b>
              {held ? (
                <div className="stack">
                  <div className="seltext pinned">
                    “{pinned!.text.length > 120 ? pinned!.text.slice(0, 120) + '…' : pinned!.text || ' '}”
                    {pinned!.ids.length > 1 && <span className="small muted"> +{pinned!.ids.length - 1}</span>}
                  </div>
                  <div className="row between">
                    <span className="small muted">{t('pinnedHint')}</span>
                    <button className="btn ghost sm" onClick={unpin}>{t('cancel')}</button>
                  </div>
                </div>
              ) : p.baseFromArea ? (
                <div className="stack">
                  <div className="seltext pinned">“{p.baseFromArea.text.length > 120 ? p.baseFromArea.text.slice(0, 120) + '…' : p.baseFromArea.text}”</div>
                  <span className="small muted">{t('baseAreaHint')}</span>
                </div>
              ) : sel.textCount === 0 && sel.containerCount > 0 ? (
                <div className="stack">
                  <span className="small muted">{t('frameSelected', { n: sel.insideCount })}</span>
                  {sel.inside.length > 0 && (
                    <div className="klist scroll mini">
                      {sel.inside.map((x) => (
                        <div key={x.nodeId} className="krow" onClick={() => send({ type: 'focus', nodeId: x.nodeId })} title={t('frameItemHint')}>
                          <div className="k"><span className="kname">{x.key}</span></div>
                          <div className="v">{x.text || t('emptyVal')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : sel.textCount === 0 ? (
                <span className="small muted">{t('start1')}</span>
              ) : (
                <div className="seltext">
                  “{sel.firstText.length > 120 ? sel.firstText.slice(0, 120) + '…' : sel.firstText || ' '}”
                  {sel.textCount > 1 && <span className="small muted"> +{sel.textCount - 1}</span>}
                </div>
              )}
              {sel.textCount > 0 && (
                <div className="row unlinked-nav">
                  <button className="btn ghost sm" onClick={() => send({ type: 'select-next-unlinked', dir: -1 })}>‹ {t('prev')}</button>
                  <span className="small muted grow">{t('unlinkedNav')}{p.unlinkedPos ? ` ${p.unlinkedPos.index + 1} / ${p.unlinkedPos.total}` : ''}</span>
                  <button className="btn ghost sm" onClick={() => send({ type: 'select-next-unlinked', dir: 1 })}>{t('next')} ›</button>
                </div>
              )}
            </div>
          </div>

          {!held && !p.baseFromArea && sel.textCount === 0 && sel.containerCount > 0 ? null : !held && (linkedKey || p.baseFromArea) && !changing ? (
            <div className="step done">
              <span className="num">2</span>
              <div className="grow stack">
                <div className="row between">
                  <b>{t('linkedTo')}</b>
                  <div className="row">
                    <button className="btn sm" onClick={() => setChanging(true)}>{t('changeKey')}</button>
                    <button className="btn sm ghost" onClick={() => send({ type: 'unbind', ids: p.baseFromArea?.nodeId ? [p.baseFromArea.nodeId] : undefined })}>{t('unlinkShort')}</button>
                  </div>
                </div>
                <div className="row keyline"><code className="keyname grow">{linkedKey || p.baseFromArea!.key}</code><CopyButton text={linkedKey || p.baseFromArea!.key} title={t('copy')} /></div>
                <Values k={linkedKey || p.baseFromArea!.key} />
              </div>
            </div>
          ) : (
            <div className={'step' + (linking ? (picked ? ' done' : ' active') : '')}>
              <span className="num">2</span>
              <div className="grow stack">
                <div className="row between">
                  <b>{t('stepKey')}</b>
                  {changing && <button className="btn sm ghost" onClick={() => setChanging(false)}>{t('cancel')}</button>}
                </div>
                {held && !changing ? (
                  <div className="stack">
                    <div className="row between keyline">
                      <code className="keyname grow">{picked}</code>
                      <CopyButton text={picked} title={t('copy')} />
                      <button className="btn sm" onClick={() => setChanging(true)}>{t('changeKey')}</button>
                    </div>
                  </div>
                ) : linking ? (
                  <>
                    {sel.textCount > 1 && <span className="small muted">{t('mixedSel')}</span>}
                    <KeyPicker t={t} table={p.table} mapping={mapping} lang={current}
                      sel={held && pinned ? { ...sel, firstText: pinned.text, textCount: Math.max(1, pinned.ids.length) }
                        : p.baseFromArea ? { ...sel, firstText: p.baseFromArea.text, textCount: 1 } : sel}
                      pro={pro} onUpgrade={p.onUpgrade}
                      selected={picked} onSelect={(k) => { pick(k); setChanging(false); }} scroll />
                  </>
                ) : (
                  <span className="small muted">{t('start2')}</span>
                )}
              </div>
            </div>
          )}

          {linking && (
            <div ref={step3} className={'step' + (picked ? ' active' : '')}>
              <span className="num">3</span>
              <div className="grow stack">
                <b>{t('stepApply')}</b>
                {picked ? (
                  <>
                    {!held && <div className="row keyline"><code className="keyname grow">{picked}</code><CopyButton text={picked} title={t('copy')} /></div>}
                    <Values k={picked} />
                  </>
                ) : (
                  <span className="small muted">{t('stepApplyHint')}</span>
                )}
              </div>
            </div>
          )}
        </div>


        <div className="section-title">{t('switchSection')}</div>
        {p.inspectKey && (
          <div className="note ok row">
            <span className="grow">{t('inspecting')} <b className="keyname">{p.inspectKey}</b></span>
            <button className="btn ghost sm" onClick={p.onCloseInspect}>{t('close')}</button>
          </div>
        )}
        <div className="field">
          <label>{t('language')}</label>
          <div className="chips">
            {mapping.languages.map((l) => {
              const locked = !allowed.includes(l);
              return (
                <button key={l} className={'chip' + (l === current ? ' on' : '') + (locked ? ' locked' : '')}
                  onClick={() => (locked ? p.onUpgrade('upLang') : p.onSelectLang(l))} disabled={p.busy}>
                  {l}{l === mapping.baseLang && <span className="base">BASE</span>}{locked && <Icon name="lock" size={11} />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <label>{t('scope')}</label>
          <Seg value={p.scope} onChange={(s) => { p.setReview(null); p.setScope(s); }} options={[
            { value: 'selection', label: t('scopeSelection') },
            { value: 'page', label: t('scopePage') },
            { value: 'document', label: t('scopeDocument') },
          ]} />
          {p.same && p.keyOnly ? (
            <div className="field" style={{ marginTop: 6 }}>
              {!held && (
                <div className="basechip">
                  <span className="small muted">{t('baseText')}</span>
                  <span className="grow basetext">“{p.same.text.length > 40 ? p.same.text.slice(0, 40) + '…' : p.same.text}”</span>
                  <button className="icon-btn sm" title={t('cancel')} onClick={p.onClearBase}><Icon name="x" size={12} /></button>
                </div>
              )}
              <span className="small muted">{t('whatKeyHint', { area: t(p.scope === 'selection' ? 'scopeSelection' : p.scope === 'page' ? 'scopePage' : 'scopeDocument') })}</span>
            </div>
          ) : (
            <span className="small muted">{t(p.scope === 'selection' ? 'scopeHintSel' : p.scope === 'page' ? 'scopeHintPage' : 'scopeHintDoc')}</span>
          )}
        </div>
        {(p.keyOnly || p.scope === 'selection') && info && info.unlinked > 0 && (
          <label className="check small">
            <input type="checkbox" checked={p.config.autoLinkOnApply !== false} onChange={(e) => p.saveConfig({ ...p.config, autoLinkOnApply: e.target.checked })} />
            <span className="stack" style={{ gap: 1 }}>
              <span>{t('optAutoLinkApply', { n: info.unlinked })}</span>
              <span className="muted">{t('optAutoLinkApplyHint')}</span>
            </span>
          </label>
        )}
        <div className={'target' + (p.scope === 'selection' && !sel.total ? ' empty' : '')}>
          <div className="row between">
            <span className="small muted">{t('targetLabel')}</span>
            <div className="row">
              {p.review && <button className="btn ghost sm" title={t('unfreezeHint')} onClick={() => p.setReview(null)}>{t('unfreeze')}</button>}
              {info && items.length > 0 && (
                <button className="btn ghost sm" onClick={() => setListOpen(!listOpen)}>
                  {listOpen ? t('reviewClose') : t('reviewOpen', { n: items.length })}
                </button>
              )}
            </div>
          </div>
          {p.scope === 'selection' && !sel.total ? (
            <span className="small">{t('targetNone')}</span>
          ) : p.scope === 'document' ? (
            <span className="small"><b>{t('docAll')}</b></span>
          ) : info ? (
            <span className="small">
              <b>{info.names[0] === '*' ? t('docAll') : info.names.slice(0, 2).join(', ')}</b>{info.names.length > 2 ? t('targetMore', { n: info.names.length - 2 }) : ''}
              {' · '}<b className="will">{t('willChange', { n: willChange })}</b>{' · '}{t('targetCount', { n: nLinked })}
              {info.unlinked > 0 && <span className="muted">{' · '}{t(autoLinkOn ? 'targetUnlinkedAuto' : 'targetUnlinked', { n: autoLinkOn ? nNew : info.unlinked })}</span>}
              {excluded.size > 0 && <span className="muted">{' · '}{t('reviewExcluded', { n: excluded.size })}</span>}
            </span>
          ) : (
            <span className="small muted">…</span>
          )}
          {listOpen && info && items.length > 0 && (
            <div className="review in-target">
              <div className="row between review-nav">
                <button className="btn sm" onClick={() => go(rv.index - 1)}>‹ {t('prev')}</button>
                <div className="nav-cur grow">
                  {rv.index >= 0 && items[rv.index] ? (
                    <>
                      <div className="row nav-line">
                        {(!items[rv.index].key || (p.keyOnly && !!p.same && items[rv.index].key !== p.same.key)) && <span className="tag new">● {t('reviewNew')}</span>}
                        <span className="nav-text">{items[rv.index].text || t('emptyVal')}</span>
                      </div>
                      <span className="small muted">{items[rv.index].where ? items[rv.index].where + ' · ' : ''}{t('navPos', { i: rv.index + 1, n: items.length })}</span>
                    </>
                  ) : (
                    <span className="small muted">{t('reviewHint')}</span>
                  )}
                </div>
                <button className="btn sm" onClick={() => go(rv.index + 1)}>{t('next')} ›</button>
              </div>
              <div className="klist scroll">
                {items.map((it, i) => {
                  const off = excluded.has(it.id);
                  const willLink = !it.key || (p.keyOnly && !!p.same && it.key !== p.same.key);
                  if (willLink && !autoLinkOn) return null;
                  return (
                    <div key={it.id} className={'krow trow' + (i === rv.index ? ' picked' : '') + (off ? ' off' : '')} onClick={() => go(i)}>
                      <div className="k">
                        <input type="checkbox" checked={!off} onClick={(e) => e.stopPropagation()}
                          onChange={() => {
                            const ex = new Set(excluded);
                            if (off) ex.delete(it.id); else ex.add(it.id);
                            p.setReview({ ...rv, excluded: Array.from(ex) });
                          }} />
                        <span className="kname grow">{it.text || t('emptyVal')}</span>
                        {willLink && <span className="tag new">{t('reviewNew')}</span>}
                      </div>
                      {(() => {
                        const k = it.key || (p.keyOnly ? p.same?.key : '');
                        const raw = k ? dict[k]?.[current] || dict[k]?.[mapping.baseLang] : undefined;
                        const nextV = raw !== undefined && p.config.stripTags !== false ? stripTags(raw) : raw;
                        return nextV !== undefined && normText(nextV) !== normText(it.text)
                          ? <div className="v next">→ {nextV || t('emptyVal')}</div> : null;
                      })()}
                      {it.where && <div className="v">{it.where}</div>}
                    </div>
                  );
                })}
              </div>
              {(info.linked + (autoLinkOn ? info.unlinked : 0)) > items.length && <span className="small muted">{t('reviewCap', { n: items.length })}</span>}
            </div>
          )}
        </div>


        {p.report?.source === 'sync' && <ReportView t={t} pro={pro} onUpgrade={p.onUpgrade} {...p.report} />}
        {p.report?.source === 'bind' && (p.report.report.failed.length > 0 || p.report.report.ambiguous.length > 0 || p.report.report.total > 1) && (
          <ReportView t={t} pro={pro} onUpgrade={p.onUpgrade} {...p.report} />
        )}
      </div>
      <div className="footer">
        {linking && picked ? (
          <button className="btn primary block" onClick={linkAndApply}>{info && p.scope !== 'document' ? t('linkApplyScope', { lang: current, n: willChange }) : t('linkApply', { lang: current })}</button>
        ) : (
          <button className="btn primary block" disabled={p.busy || (p.scope === 'selection' && !sel.total) ||
            (!!info && p.scope !== 'document' && willChange <= 0)}
            onClick={() => p.onApply(current)}>
            {p.busy ? <Icon name="refresh" className="spin" size={14} />
              : p.scope !== 'document' && info
                ? t('applyCount', { lang: current, n: willChange })
              : t('applyLang', { lang: current })}
          </button>
        )}
      </div>
    </>
  );
}

/* ───────────────────────── Fill ───────────────────────── */

export function FillView(p: { t: T; table: Table; mapping: Mapping; sel: SelectionInfo; pro: boolean; busy: boolean; report: Rep; setBusy: (b: boolean) => void; onUpgrade: (reason?: MsgKey) => void }) {
  const { t, table, sel, pro } = p;
  const [mode, setMode] = useState<'text' | 'cards'>('text');
  const [column, setColumn] = useState(table.columns.find((c) => c !== p.mapping.keyColumn) ?? table.columns[0]);
  const [start, setStart] = useState(1);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const byNorm = useMemo(() => new Map(table.columns.map((c) => [normName(c), c] as [string, string])), [table]);

  const n = mode === 'text' ? sel.textCount : sel.containerCount;
  const cap = mode === 'text' ? (pro ? n : Math.min(n, FREE.maxFillLayers)) : (pro ? n : Math.min(n, FREE.maxCards));
  const to = start + Math.max(cap, 1) - 1;

  const fill = () => {
    p.setBusy(true);
    if (mode === 'text') send({ type: 'fill-text', table, column, startRow: start });
    else send({ type: 'fill-cards', table, startRow: start, overrides });
  };

  return (
    <>
      <div className="body">
        <Seg value={mode} onChange={setMode} options={[{ value: 'text', label: t('fillText') }, { value: 'cards', label: t('fillCards') }]} />
        <p className="small muted">{t(mode === 'text' ? 'fillTextHint' : 'fillCardsHint')}</p>
        <div className="row">
          {mode === 'text' && (
            <div className="field grow">
              <label>{t('column')}</label>
              <select className="select" value={column} onChange={(e) => setColumn(e.target.value)}>
                {table.columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ width: mode === 'text' ? 96 : '100%' }}>
            <label>{t('startRow')}</label>
            <input className="input" type="number" min={1} max={table.rows.length} value={start}
              onChange={(e) => setStart(Math.max(1, Math.min(table.rows.length, Number(e.target.value) || 1)))} />
          </div>
        </div>

        {n > 0 ? (
          <div className="note">{t(mode === 'text' ? 'fillTextSel' : 'fillCardsSel', { n, from: start, to })}</div>
        ) : (
          <div className="note warn">{t(mode === 'text' ? 'noTextSel' : 'noCardSel')}</div>
        )}
        {!pro && n > cap && (
          <div className="note pro">{t('rLimited', { n: n - cap })}<button className="btn sm pro" onClick={() => p.onUpgrade('upKey')}>{t('unlock')}</button></div>
        )}

        {mode === 'cards' && sel.cardFields.length > 0 && (
          <div className="card stack">
            <h2>{t('fields')}</h2>
            {sel.cardFields.map((f) => {
              const nn = normName(f);
              const auto = byNorm.get(nn);
              const val = nn in overrides ? overrides[nn] : auto ?? '';
              return (
                <div key={nn} className="row">
                  <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                  <select className="select" style={{ width: 150 }} value={val} onChange={(e) => setOverrides({ ...overrides, [nn]: e.target.value })}>
                    <option value="">{t('skip')}</option>
                    {table.columns.map((c) => <option key={c} value={c}>{c}{c === auto ? ` (${t('auto')})` : ''}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        )}
        {p.report?.source === 'fill' && <ReportView t={t} pro={pro} onUpgrade={p.onUpgrade} {...p.report} />}
      </div>
      <div className="footer">
        <button className="btn primary block" disabled={p.busy || n === 0} onClick={fill}>
          {p.busy ? <Icon name="refresh" className="spin" size={14} /> : t('fillBtn')}
        </button>
      </div>
    </>
  );
}

/** Free plan: how many distinct keys are linked in this file. */
export function UsageMeter({ t, used, pro, onUpgrade }: { t: T; used: number; pro: boolean; onUpgrade: (r?: MsgKey) => void }) {
  if (pro) return null;
  const pct = Math.min(100, (used / FREE.maxKeys) * 100);
  return (
    <div className="usage" onClick={() => onUpgrade('upKey')} title={t('upKey', { max: FREE.maxKeys })}>
      <div className="row between small"><span>{t('usageKeys', { n: used, max: FREE.maxKeys })}</span>{used >= FREE.maxKeys && <span className="pill">PRO</span>}</div>
      <div className="bar"><i style={{ width: pct + '%' }} className={used >= FREE.maxKeys ? 'full' : ''} /></div>
    </div>
  );
}

/* ───────────────────────── Keys ───────────────────────── */

type Hit = { key: string; v: Record<string, string>; score: number; lang?: string };

/** Ranks keys by how well the key or any language value matches the query. */
function searchKeys(entries: [string, Record<string, string>][], q: string, langs: string[]): Hit[] {
  const nq = normText(q);
  if (!nq) return entries.map(([key, v]) => ({ key, v, score: 0 }));
  const tokens = nq.split(' ');
  const hits: Hit[] = [];
  for (const [key, v] of entries) {
    const nk = key.toLowerCase();
    let score = nk === nq ? 100 : nk.includes(nq) ? 60 : 0;
    let lang: string | undefined;
    for (const l of langs) {
      const tv = normText(v[l] || '');
      if (!tv) continue;
      let sc = tv === nq ? 95 : tv.startsWith(nq) ? 80 : tv.includes(nq) ? 65 : tokens.length > 1 && tokens.every((x) => tv.includes(x)) ? 40 : 0;
      // Layer text was edited a bit ("Continue with Google2", "Welcome back!") → still suggest the close match
      if (!sc && tv.length >= 4 && nq.includes(tv)) sc = 55;
      if (!sc && tokens.length > 1) {
        const words = tokens.filter((x) => x.length >= 2);
        const hit = words.filter((x) => tv.includes(x) || tv.includes(x.replace(/\d+$/, ''))).length;
        const ratio = words.length ? hit / words.length : 0;
        if (ratio >= 0.6) sc = Math.round(20 + 20 * ratio);
      }
      if (sc > score) { score = sc; lang = l; }
    }
    if (score > 0) hits.push({ key, v, score, lang });
  }
  return hits.sort((x, y) => y.score - x.score || x.key.localeCompare(y.key));
}

function Highlight({ text, q }: { text: string; q: string }) {
  const nq = q.trim().toLowerCase();
  const i = nq ? text.toLowerCase().indexOf(nq) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + nq.length)}</mark>{text.slice(i + nq.length)}</>;
}

/** Search box + ranked key list. Clicking a key links the selected text layers to it. */
export function KeyPicker(p: {
  t: T; table: Table; mapping: Mapping; lang: string; sel: SelectionInfo; pro: boolean; onUpgrade: (reason?: MsgKey) => void; limit?: number;
  /** Controlled mode: clicking a key only selects it (apply happens elsewhere). */
  selected?: string; onSelect?: (key: string) => void; strip?: boolean;
  /** Show every hit inside a scrollable list (instead of the page scrolling). */
  scroll?: boolean;
  /** Show a "where is it used" button per key. */
  onUsage?: (key: string) => void;
}) {
  const { t, sel, mapping, pro } = p;
  const [q, setQ] = useState('');
  const entries = useMemo(() => {
    const { dict, order } = buildDict(p.table, mapping);
    return order.map((k) => [k, dict[k]] as [string, Record<string, string>]);
  }, [p.table, mapping]);

  // Nothing typed + a text layer selected → suggest keys matching its current text
  const suggest = !q.trim() && sel.textCount > 0 && !!sel.firstText.trim();
  const query = suggest ? sel.firstText : q;
  const hits = useMemo(() => searchKeys(entries, query, mapping.languages), [entries, query, mapping.languages]);
  const [more, setMore] = useState(0);
  useEffect(() => setMore(0), [query]);
  const pageSize = 200;
  const shown = hits.slice(0, p.limit ?? pageSize * (more + 1));
  const lang = p.lang;

  const bind = (h: Hit) => {
    if (p.onSelect) return p.onSelect(h.key);
    if (!sel.textCount) return send({ type: 'notify', message: t('keysHintNone') });
    const val = h.v[lang] || h.v[mapping.baseLang];
    send({ type: 'bind', key: h.key, value: val !== undefined && p.strip !== false ? stripTags(val) : val });
    setQ('');
  };

  return (
    <div className="stack">
      <input className="input" placeholder={t('searchKeys')} value={q} onChange={(e) => setQ(e.target.value)} />
      {suggest && <span className="small muted">{t('suggestFor', { text: sel.firstText.length > 40 ? sel.firstText.slice(0, 40) + '…' : sel.firstText })}</span>}
      {query.trim() && hits.length === 0 ? (
        <div className="note">{t('noMatches')}</div>
      ) : (
        <div className={'klist' + (p.scroll ? ' scroll' : '')}
          onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight > el.scrollHeight - 80 && shown.length < hits.length) setMore((m) => m + 1); }}>
          {shown.map((h) => {
            const isLocked = false;
            const main = h.v[lang] || h.v[mapping.baseLang] || t('emptyVal');
            return (
              <div key={h.key} className={'krow' + (sel.keys.includes(h.key) ? ' on' : '') + (p.selected === h.key ? ' picked' : '') + (isLocked ? ' locked' : '')} onClick={() => bind(h)}>
                <div className="k">
                  {p.onSelect && <span className={'radio' + (p.selected === h.key ? ' on' : '')} />}
                  <span className="kname"><Highlight text={h.key} q={query} /></span>
                  {sel.keys.includes(h.key) && <span className="tag">● {t('linked')}</span>}
                  {p.onUsage && (
                    <button className="btn ghost sm usage-btn" title={t('whereUsedHint')} onClick={(e) => { e.stopPropagation(); p.onUsage!(h.key); }}>{t('whereUsed')}</button>
                  )}
                  {isLocked && <span className="pill">PRO</span>}
                </div>
                <div className="v"><Highlight text={main} q={h.lang === lang || !h.lang ? query : ''} /></div>
                {h.lang && h.lang !== lang && h.v[h.lang] && (
                  <div className="v alt"><b>{h.lang}</b> <Highlight text={h.v[h.lang]} q={query} /></div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hits.length > shown.length && (
        <button className="btn ghost sm" onClick={() => setMore((m) => m + 1)}>{t('showing', { n: shown.length, total: hits.length })} · {t('showMore')}</button>
      )}
      {hits.length > 1 && <span className="small muted">{t('resultsCount', { n: hits.length })}</span>}
    </div>
  );
}

export function KeysView(p: { t: T; table: Table; mapping: Mapping; config: DocConfig; sel: SelectionInfo; report: Rep; pro: boolean; onUpgrade: (reason?: MsgKey) => void; usage: number; onShowUsage: (key: string) => void }) {
  const { t, sel, mapping, pro } = p;
  const [gen, setGen] = useState(true);
  const lang = p.config.currentLang ?? mapping.baseLang;
  return (
    <div className="body">
      <div className="row between">
        <span className="small muted">{sel.textCount ? t('keysHintSel', { n: sel.textCount }) : t('keysHintNone')}</span>
        {sel.keyedCount > 0 && <button className="btn sm" onClick={() => send({ type: 'unbind' })}>{t('unlink')}</button>}
      </div>
      <KeyPicker t={t} table={p.table} mapping={mapping} lang={lang} sel={sel} pro={pro} onUpgrade={p.onUpgrade} strip={p.config.stripTags !== false} onUsage={p.onShowUsage} />
      {(p.report?.source === 'bind' || p.report?.source === 'unbind') && <ReportView t={t} pro={pro} onUpgrade={p.onUpgrade} {...p.report} />}

      <div className="card stack">
        <h2>{t('autoLinkTitle')}</h2>
        <p className="small muted">{t('autoLinkDesc')}</p>
        <button className="btn" onClick={() => send({ type: 'auto-link', table: p.table, mapping, scope: 'page' })}>{t('autoLinkBtn')}</button>
      </div>

      <div className="card stack">
        <h2>{t('exportTitle')}</h2>
        <p className="small muted">{t('exportDesc', { lang: mapping.baseLang })}</p>
        <label className="check"><input type="checkbox" checked={gen} onChange={(e) => setGen(e.target.checked)} /><span>{t('exportGen')}</span></label>
        <button className="btn" onClick={() => send({ type: 'export', scope: 'page', generateKeys: gen, baseLang: mapping.baseLang })}>{t('exportBtn')}</button>
      </div>
    </div>
  );
}

/* ───────────────────────── Plan ───────────────────────── */

export function PlanSheet({ t, plan, reason, usage, onClose }: { t: T; plan: PlanInfo; reason?: MsgKey | null; usage: number; onClose: () => void }) {
  const pro = plan.tier === 'pro';
  const pct = Math.min(100, (usage / FREE.maxKeys) * 100);
  const tiers = [
    { id: 'free', name: t('planFree'), price: '$0', keys: t('freeKeys', { n: FREE.maxKeys }), current: !pro },
    { id: 'pro', name: t('planPro'), price: PRICE.monthly, per: t('perMonth'), sub: t('orYearly', { p: PRICE.yearly }), keys: t('proKeys'), current: pro, highlight: true },
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><b style={{ fontSize: 14 }}>{t('planTitle')}</b><button className="btn ghost sm" onClick={onClose}>{t('close')}</button></div>
        {reason && <div className="note pro">{t(reason, { max: FREE.maxKeys, n: usage })}</div>}
        <div className="usage-big">
          <div className="row between small"><span>{t('usageThisFile')}</span><b>{pro ? usage : `${usage} / ${FREE.maxKeys}`}</b></div>
          {!pro && <div className="bar"><i style={{ width: pct + '%' }} className={usage >= FREE.maxKeys ? 'full' : ''} /></div>}
        </div>
        <div className="tiers">
          {tiers.map((x) => (
            <div key={x.id} className={'tier' + (x.highlight ? ' hl' : '') + (x.current ? ' cur' : '')}>
              <div className="row between"><b>{x.name}</b>{x.current && <span className="pill cur">{t('currentPlan')}</span>}</div>
              <div className="tprice">{x.price}{x.per && <small> {x.per}</small>}</div>
              {x.sub && <span className="small muted">{x.sub}</span>}
              <span className="small"><b>{x.keys}</b></span>
              {x.id === 'pro' && !pro && <button className="btn pro block" onClick={() => send({ type: 'upgrade' })}>{t('upgrade')}</button>}
            </div>
          ))}
        </div>
        <span className="small muted">{t('allFeatures')}</span>
        {pro && (
          <details className="card soft">
            <summary>{t('manageSub')}</summary>
            <p className="small muted" style={{ marginTop: 6 }}>{t('manageSubHow', { max: FREE.maxKeys })}</p>
            <button className="btn sm" style={{ marginTop: 8 }}
              onClick={() => send({ type: 'open-url', url: 'https://help.figma.com/hc/en-us/articles/29316602010775-Manage-your-plugin-subscriptions' })}>
              {t('manageSubGuide')} ↗
            </button>
          </details>
        )}
        {__DEV__ && (
          <div className="row small muted">
            {t('devTools')}
            {(['free', 'pro'] as const).map((tier) => (
              <button key={tier} className="btn sm" onClick={() => send({ type: 'dev-set-tier', tier })}>{tier}</button>
            ))}
            <button className="btn sm" onClick={() => send({ type: 'dev-set-tier', tier: null })}>real</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Export result ───────────────────────── */

export function ExportSheet({ t, csv, rows, generated, onClose }: { t: T; csv: string; rows: number; generated: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const ta = document.createElement('textarea');
    ta.value = csv; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'sheetlingo-keys.csv'; a.click();
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <b>{t('exportTitle')}</b>
        <span className="small muted">{t('exportDone', { rows, gen: generated })}</span>
        <textarea className="input" readOnly value={csv} />
        <div className="row">
          <button className="btn primary grow" onClick={copy}>{copied ? t('copied') : t('copy')}</button>
          <button className="btn grow" onClick={download}>{t('download')}</button>
        </div>
        <button className="btn ghost" onClick={onClose}>{t('close')}</button>
      </div>
    </div>
  );
}
