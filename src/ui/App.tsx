import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_CHECK_MS, PUBLIC_SYNC_MS } from '../shared/config';
import { FREE } from '../shared/constants';
import { DEFAULT_CONFIG, type CodeToUi, type DocConfig, type GoogleAuth, type SameRef, type ScopeInfo, type Mapping, type PlanInfo, type Report, type ReportSource, type Scope, type SelectionInfo, type SourceMeta, type Table } from '../shared/types';
import { send } from './bridge';
import { Icon, Logo } from './components';
import type React from 'react';
import { DEFAULT_LOCALE, isLocale, makeT, type Locale, type MsgKey } from './i18n';
import { GoogleError, fetchTab, freshAuth, listTabs, modifiedTime } from './google';
import { fetchGoogleSheet, parseSheetUrl, tableHash, toTable } from './sheet';
import { ExportSheet, FillView, KeysView, PlanSheet, SourceView, SyncView, errorText, type Review } from './views';

type View = 'sync' | 'fill' | 'keys' | 'source';
const EMPTY_SEL: SelectionInfo = { total: 0, textCount: 0, keyedCount: 0, keys: [], containerCount: 0, cardFields: [], firstText: '', inside: [], insideCount: 0, sig: '' };

export function App() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const t = useMemo(() => makeT(locale), [locale]);
  const [ready, setReady] = useState(false);
  const [config, setConfigState] = useState<DocConfig>(DEFAULT_CONFIG);
  const [plan, setPlan] = useState<PlanInfo>({ tier: 'free', trialDaysLeft: 0 });
  const [sel, setSel] = useState<SelectionInfo>(EMPTY_SEL);
  const [table, setTable] = useState<Table | null>(null);
  const [view, setView] = useState<View>('sync');
  const [scope, setScope] = useState<Scope>('selection');
  const [report, setReport] = useState<{ source: ReportSource; report: Report } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [exported, setExported] = useState<{ csv: string; rows: number; generated: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [auth, setAuthState] = useState<GoogleAuth | null>(null);
  const [usage, setUsage] = useState(0);
  const [mini, setMini] = useState(false);
  const [unlinkedPos, setUnlinkedPos] = useState<{ index: number; total: number } | null>(null);
  const [lastCheck, setLastCheck] = useState(0);
  const [lastApplied, setLastApplied] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 5000); return () => clearInterval(id); }, []);
  const [scopeInfo, setScopeInfo] = useState<ScopeInfo | null>(null);
  const [upReason, setUpReason] = useState<MsgKey | null>(null);
  const pro = plan.tier !== 'free';

  const st = useRef({ config, table, scope, command: 'open', t, auth, lastModified: '' });
  st.current.config = config; st.current.table = table; st.current.scope = scope; st.current.t = t; st.current.auth = auth;

  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((x) => (x === m ? null : x)), 3200); }, []);
  const saveConfig = useCallback((c: DocConfig) => { st.current.config = c; setConfigState(c); send({ type: 'save-config', config: c }); }, []);
  const onAuth = useCallback((a: GoogleAuth | null) => { st.current.auth = a; setAuthState(a); send({ type: 'auth-save', auth: a }); }, []);

  /** Valid access token for private sheets (refreshes; signs out if access was revoked). */
  const token = useCallback(async () => {
    const a0 = st.current.auth;
    if (!a0) throw new GoogleError('auth');
    try {
      const a = await freshAuth(a0);
      if (a !== a0) onAuth(a);
      return a.accessToken;
    } catch (e) {
      if (e instanceof GoogleError && e.code === 'auth') onAuth(null);
      throw e;
    }
  }, [onAuth]);

  /** Downloads the current source (public CSV or private sheet via API). null = nothing to fetch. */
  const loadRaw = useCallback(async (): Promise<string[][] | null> => {
    const src = st.current.config.source;
    if (src?.kind === 'google' && src.url) {
      const ref = parseSheetUrl(src.url);
      return ref ? fetchGoogleSheet(ref) : null;
    }
    if (src?.kind === 'google-api' && src.fileId) {
      const tk = await token();
      try { return await fetchTab(tk, src.fileId, src.sheetTitle ?? ''); }
      catch (e) {
        if (!(e instanceof GoogleError && e.code === 'tab-missing')) throw e;
        const tab = (await listTabs(tk, src.fileId)).tabs.find((x) => x.id === src.sheetId); // tab renamed
        if (!tab) throw e;
        st.current.config = { ...st.current.config, source: { ...src, sheetTitle: tab.title } };
        return fetchTab(tk, src.fileId, tab.title);
      }
    }
    return null;
  }, [token]);

  const loadSource = useCallback(async (): Promise<Table | null> => {
    const raw = await loadRaw();
    return raw ? toTable(raw, st.current.config.mapping?.headerRow ?? 0) : null;
  }, [loadRaw]);

  const setLocale = (l: Locale) => { setLocaleState(l); send({ type: 'set-ui-locale', locale: l }); };

  /** Re-fetch Google source (if any) and optionally apply. silent = auto-sync: only apply when the sheet changed. */
  const refresh = useCallback(async (apply: boolean, silent = false) => {
    let tbl = st.current.table;
    const kind = st.current.config.source?.kind;
    if (kind === 'google' || kind === 'google-api') {
      setRefreshing(true);
      try {
        const fresh = await loadSource();
        setLastCheck(Date.now());
        if (fresh) {
          const changed = !tbl || tableHash(fresh) !== tableHash(tbl);
          tbl = fresh;
          if (changed) {
            const c = st.current.config;
            setTable(fresh); st.current.table = fresh;
            send({ type: 'cache-table', table: fresh });
            saveConfig({ ...c, source: { ...c.source!, fetchedAt: Date.now(), rowCount: fresh.rows.length } });
          }
          if (silent && !changed) return;
        }
      } catch (e) {
        if (!silent) flash(errorText(e, st.current.t));
        if (st.current.command === 'resync') { send({ type: 'notify', message: errorText(e, st.current.t) }); send({ type: 'close' }); }
        return;
      } finally { setRefreshing(false); }
    }
    const m = st.current.config.mapping;
    if (apply && tbl && m) {
      const lang = st.current.config.currentLang || m.baseLang;
      const sc = silent && st.current.scope === 'selection' ? 'page' : st.current.scope;
      if (!silent) setBusy(true);
      send({ type: 'sync', table: tbl, mapping: m, lang, scope: sc, silent, stripTags: st.current.config.stripTags !== false, autoLink: silent ? false : undefined });
    } else if (st.current.command === 'resync') {
      send({ type: 'notify', message: st.current.t('notifyConnectFirst') }); send({ type: 'close' });
    }
  }, [flash, saveConfig, loadSource]);

  useEffect(() => {
    window.onmessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage as CodeToUi | undefined;
      if (!msg) return;
      switch (msg.type) {
        case 'init': {
          st.current.config = msg.config; st.current.table = msg.table; st.current.command = msg.command; st.current.auth = msg.auth;
          setAuthState(msg.auth);
          setConfigState(msg.config); setPlan(msg.plan); setSel(msg.selection); setTable(msg.table);
          if (isLocale(msg.locale)) { setLocaleState(msg.locale); st.current.t = makeT(msg.locale); }
          if (!msg.config.source || !msg.config.mapping || !msg.table) setView('source');
          setReady(true);
          if (msg.command === 'resync') refresh(true);
          else if (msg.config.source?.kind === 'google' || msg.config.source?.kind === 'google-api') refresh(false);
          break;
        }
        case 'selection': setSel(msg.selection); break;
        case 'plan': setPlan(msg.plan); break;
        case 'report': {
          setBusy(false);
          if (st.current.command === 'resync') {
            send({ type: 'notify', message: st.current.t('notifyResync', { n: msg.report.updated, m: msg.report.missing.length }) });
            send({ type: 'close' });
            return;
          }
          if (msg.source === 'sync' && (!msg.silent || msg.report.updated)) setLastApplied(Date.now());
          if (msg.silent) { if (msg.report.updated) flash(st.current.t('autoChanged', { n: msg.report.updated })); return; }
          setReport({ source: msg.source, report: msg.report });
          break;
        }
        case 'export-result': setExported(msg); break;
        case 'usage': setUsage(msg.linkedKeys); break;
        case 'auto-unlinked': flash(st.current.t('autoUnlinked', { key: msg.key })); break;
        case 'scope-info': setScopeInfo(msg.info); break;
        case 'next-result':
          if (!msg.remaining) { flash(st.current.t('noUnlinked')); setUnlinkedPos(null); }
          else setUnlinkedPos({ index: msg.index ?? 0, total: msg.remaining });
          break;
        case 'error':
          setBusy(false);
          if (msg.message === 'KEY_LIMIT') { setUpReason('upKey'); setShowPlan(true); break; }
          if (msg.message === 'OVER_LIMIT') { setUpReason('upOver'); setShowPlan(true); break; }
          setBootError(msg.message); flash(errorText(new Error(msg.message), st.current.t)); break;
      }
    };
    send({ type: 'ui-ready' });
    const timer = setTimeout(() => setBootError((e) => e ?? 'No response from the plugin main thread (dist/code.js). Open Plugins → Development → Show/Hide console.'), 4000);
    return () => clearTimeout(timer);
  }, [refresh, flash]);

  // Pro: live sync while open.
  //  private sheets → cheap Drive modifiedTime check every 10s, re-download only when it changed
  //  public links   → re-download CSV every 60s (Google caches these exports anyway)
  useEffect(() => {
    const kind = config.source?.kind;
    if (!config.autoSync || (kind !== 'google' && kind !== 'google-api')) return;
    if (kind === 'google') {
      const id = setInterval(() => refresh(true, true), PUBLIC_SYNC_MS);
      return () => clearInterval(id);
    }
    const fileId = config.source!.fileId!;
    const id = setInterval(async () => {
      try {
        const mt = await modifiedTime(await token(), fileId);
        setLastCheck(Date.now());
        const prev = st.current.lastModified;
        st.current.lastModified = mt;
        if (prev && mt !== prev) refresh(true, true);
      } catch (_) { /* offline / signed out: try again next tick */ }
    }, LIVE_CHECK_MS);
    return () => clearInterval(id);
  }, [config.autoSync, config.source?.kind, config.source?.fileId, refresh, token]);

  // "Same text" target: the single linked text currently selected
  const [review, setReview] = useState<Review | null>(null);
  const frozenSame = useRef<SameRef | null>(null);
  const [pendingSame, setPendingSame] = useState<SameRef | null>(null);
  const [inspect, setInspect] = useState<SameRef | null>(null);
  // Remember the last single linked text; selecting a frame afterwards treats the frame as the area
  const [lastLinked, setLastLinked] = useState<SameRef | null>(null);
  // relink: texts with exactly the same wording follow this key even if they were linked to another one
  const singleLinked: SameRef | null = sel.textCount === 1 && sel.keyedCount === 1 ? { key: sel.keys[0], text: sel.firstText, relink: true, nodeId: sel.sig } : null;
  useEffect(() => {
    if (singleLinked) setLastLinked(singleLinked);
    else if (sel.textCount > 0) setLastLinked(null); // another (unlinked) text chosen → forget
  }, [sel.sig, singleLinked?.key, singleLinked?.text]);
  const areaSelected = sel.textCount === 0 && sel.containerCount > 0;
  const liveSame: SameRef | null = pendingSame ?? inspect ?? singleLinked ?? (areaSelected || sel.total === 0 ? lastLinked : null);
  const same = review ? frozenSame.current : liveSame;
  if (!review) frozenSame.current = liveSame;
  const sameSig = liveSame ? liveSame.key + '\u0000' + liveSame.text : '';
  // Key filter ("only this key") is on whenever there's a key in context
  const [keyOnly, setKeyOnly] = useState(true);
  const useKey = keyOnly && !!same;
  useEffect(() => {
    if (review) return;
    setScope((s) => (s === 'same' ? 'page' : s));
    if (!liveSame) return;
    setKeyOnly(true);
    // "Where used" looks across the page; otherwise the default area is the selection
    if (inspect) setScope('page');
  }, [sameSig]);
  // Key pinned and a frame/area selected → apply inside that area
  useEffect(() => {
    if ((pendingSame || lastLinked) && areaSelected) setScope('selection');
  }, [sel.sig, !!pendingSame, !!lastLinked]);

  // Target preview for "Apply": which layers / how many texts the current scope covers (frozen while reviewing)
  const selSig = sel.sig;
  useEffect(() => {
    if (!ready || review || (scope === 'document' && !(keyOnly && liveSame))) return;
    setScopeInfo(null); // don't show a stale target while recounting
    const id = setTimeout(() => send({ type: 'scope-info', scope, same: keyOnly && liveSame ? liveSame : undefined }), 200);
    return () => clearTimeout(id);
  }, [ready, scope, scope === 'selection' ? selSig : '', keyOnly ? sameSig : '', keyOnly, report, !!review]);

  const upgrade = (reason?: MsgKey) => { setUpReason(reason ?? null); setShowPlan(true); };

  /** Drag the bottom-right corner to resize the plugin window. */
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY, sw = window.innerWidth, sh = window.innerHeight;
    let raf = 0;
    const move = (ev: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => send({ type: 'resize', width: Math.round(sw + ev.clientX - sx), height: Math.round(sh + ev.clientY - sy) }));
    };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const onSaveSource = (meta: SourceMeta, tbl: Table, mapping: Mapping) => {
    setTable(tbl); st.current.table = tbl;
    send({ type: 'cache-table', table: tbl });
    const currentLang = config.currentLang && mapping.languages.includes(config.currentLang) ? config.currentLang : mapping.baseLang;
    saveConfig({ ...config, source: meta, mapping, currentLang });
    setReport(null);
    setView('sync');
  };

  const onDisconnect = () => {
    saveConfig({ ...DEFAULT_CONFIG, renameOnBind: config.renameOnBind });
    setTable(null); st.current.table = null; setReport(null);
  };

  const onApply = (lang: string) => {
    if (!table || !config.mapping) return;
    saveConfig({ ...config, currentLang: lang });
    setBusy(true);
    // Reviewed list with exclusions → apply exactly the checked layers
    const ex = new Set(review?.excluded ?? []);
    const ids = review && ex.size && scopeInfo ? scopeInfo.items.filter((i) => !ex.has(i.id)).map((i) => i.id) : undefined;
    send({ type: 'sync', table, mapping: config.mapping, lang, scope, stripTags: config.stripTags !== false,
      same: useKey ? same ?? undefined : undefined, ids });
    setReview(null);
  };

  const ago = (ts: number) => {
    if (!ts) return t('notYet');
    const sec = Math.round((Date.now() - ts) / 1000);
    if (sec < 10) return t('justNow');
    if (sec < 60) return t('secAgo', { n: sec });
    if (sec < 3600) return t('minAgo', { n: Math.floor(sec / 60) });
    return new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };
  const liveCapable = config.source?.kind === 'google' || config.source?.kind === 'google-api';
  const liveOn = liveCapable && !!config.autoSync && !(!pro && usage > FREE.maxKeys);
  const goMini = () => { setMini(true); send({ type: 'mini' }); };
  const goFull = () => { setMini(false); send({ type: 'expand' }); };

  const lastSync = Math.max(lastCheck, lastApplied);
  const blink = Date.now() - lastSync < 2500;

  if (ready && mini) {
    return (
      <div className="minibar">
        <span className={'live-dot' + (liveOn ? ' on' : ' ok') + (blink ? ' blink' : '')} key={lastSync} />
        <span className="grow mini-text">
          {lastSync ? t('syncedAgo', { t: ago(lastSync) }) : liveCapable ? t('notSynced') : t('manualSync')}
        </span>
        <button className="icon-btn" title={t('resync')} disabled={refreshing || busy} onClick={() => refresh(true)}>
          <Icon name="refresh" className={refreshing || busy ? 'spin' : ''} />
        </button>
        <button className="icon-btn" title={t('expand')} onClick={goFull}><Icon name="expand" /></button>
        {toast && <div className="toast mini">{toast}</div>}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="app"><div className="body">
        <div className="brand"><Logo />Sheetlingo</div>
        {bootError ? <pre className="note err" style={{ whiteSpace: 'pre-wrap', userSelect: 'text' }}>{bootError}</pre> : <span className="muted">Loading…</span>}
      </div></div>
    );
  }
  const connected = !!(config.source && config.mapping && table);
  const tier = plan.tier === 'pro' ? t('planPro') : plan.tier === 'trial' ? t('planTrial', { d: plan.trialDaysLeft }) : t('planFree');
  const time = config.source ? new Date(config.source.fetchedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="app">
      <header className="hd">
        {connected && view !== 'source' ? (
          <nav className="tabs">
            {(['sync', 'fill', 'keys'] as const).map((v) => (
              <button key={v} className={'tab' + (view === v ? ' on' : '')} onClick={() => setView(v)}>
                {t(v === 'sync' ? 'tabSync' : v === 'fill' ? 'tabFill' : 'tabKeys')}
              </button>
            ))}
          </nav>
        ) : (
          <div className="row">
            {connected && <button className="icon-btn" onClick={() => setView('sync')} title={t('back')}><Icon name="back" /></button>}
            <b className="hd-title">{connected ? t('settings') : t('connectTitle')}</b>
          </div>
        )}
        <div className="sp" />
        <button className={'badge gauge ' + plan.tier + (!pro && usage >= FREE.maxKeys ? ' full' : '')} onClick={() => upgrade()} title={t('usageKeys', { n: usage, max: FREE.maxKeys })}>
          {pro ? tier : <>{tier} · {usage}/{FREE.maxKeys}<i style={{ width: Math.min(100, (usage / FREE.maxKeys) * 100) + '%' }} /></>}
        </button>
        {connected && (
          <button className="icon-btn" title={t('resync')} disabled={refreshing || busy} onClick={() => refresh(true)}>
            <Icon name="refresh" className={refreshing ? 'spin' : ''} />
          </button>
        )}
        {connected && view !== 'source' && (
          <button className="icon-btn" title={t('minimize')} onClick={goMini}><Icon name="minimize" /></button>
        )}
        {connected && view !== 'source' && (
          <button className="icon-btn" title={t('settings')} onClick={() => setView('source')}><Icon name="gear" /></button>
        )}
      </header>

      {connected && view !== 'source' && (
        <div className="srcbar">
          <span className={'live-dot' + (liveOn ? ' on' : '') + (blink ? ' blink' : '')} key={lastSync} title={liveOn ? t('liveOn') : t('liveOff')} /><span className="name" title={config.source!.label}>{config.source!.label}</span>
          <span className="meta">· {t('rowsCount', { n: table!.rows.length })} · {liveOn && lastSync ? t('syncedAgo', { t: ago(lastSync) }) : t('sourceUpdated', { time })}</span>
          <button className="btn ghost sm" onClick={() => setView('source')}>{t('changeSource')}</button>
        </div>
      )}

      {connected && view !== 'source' && !pro && usage > FREE.maxKeys && (
        <div className="lockbar">
          <b>{t('overTitle')}</b>
          <span>{t('upOver', { n: usage, max: FREE.maxKeys })}</span>
          <div className="row">
            <button className="btn sm pro" onClick={() => upgrade('upOver')}>{t('upgrade')}</button>
            <button className="btn sm ghost" onClick={() => send({ type: 'recount-keys' })} title={t('recountHint')}>{t('recount')}</button>
          </div>
        </div>
      )}

      {(view === 'source' || !connected) && (
        <SourceView key={config.source ? config.source.kind + ':' + (config.source.url ?? config.source.fileId ?? config.source.label) : 'new'} t={t} config={config} table={table} pro={pro} locale={locale}
          onSave={onSaveSource} saveConfig={saveConfig} setLocale={setLocale} onUpgrade={upgrade} onDisconnect={onDisconnect}
          auth={auth} onAuth={onAuth} />
      )}
      {connected && view === 'sync' && (
        <SyncView t={t} config={config} mapping={config.mapping!} table={table!} sel={sel} scope={scope} setScope={setScope}
          pro={pro} busy={busy} report={report} onApply={onApply} onUpgrade={upgrade} usage={usage}
          scopeInfo={scopeInfo} onSelectLang={(l) => saveConfig({ ...config, currentLang: l })} saveConfig={saveConfig}
          same={same} review={review} setReview={setReview} unlinkedPos={unlinkedPos}
          onPendingSame={setPendingSame} inspectKey={inspect?.key ?? null} onCloseInspect={() => setInspect(null)}
          onClearBase={() => { setLastLinked(null); setInspect(null); }}
          baseFromArea={areaSelected && !pendingSame && !inspect ? lastLinked : null}
          keyOnly={useKey} setKeyOnly={setKeyOnly} />
      )}
      {connected && view === 'fill' && (
        <FillView t={t} table={table!} mapping={config.mapping!} sel={sel} pro={pro} busy={busy} setBusy={setBusy} report={report} onUpgrade={upgrade} />
      )}
      {connected && view === 'keys' && (
        <KeysView t={t} table={table!} mapping={config.mapping!} config={config} sel={sel} report={report} pro={pro} onUpgrade={upgrade} usage={usage}
          onShowUsage={(key) => {
            const cols = table!.columns; const m = config.mapping!;
            const row = table!.rows.find((r) => r[cols.indexOf(m.keyColumn)] === key);
            setInspect({ key, text: row?.[cols.indexOf(m.baseLang)] ?? '' });
            setReview(null); setScope('page'); setKeyOnly(true); setView('sync');
          }} />
      )}

      {showPlan && <PlanSheet t={t} plan={plan} reason={upReason} usage={usage} onClose={() => setShowPlan(false)} />}
      {exported && <ExportSheet t={t} {...exported} onClose={() => setExported(null)} />}
      {toast && <div className="toast">{toast}</div>}
      <div className="resize" onPointerDown={startResize} title="Drag to resize" />
    </div>
  );
}
