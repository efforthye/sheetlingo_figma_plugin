import type { CodeToUi, Scope, UiToCode } from '../shared/types';
import { autoLink, bindSelection, unbindSelection } from './bind';
import { exportLayers } from './export';
import { fillCards, fillText } from './fill';
import { devSetTier, getPlan, isPro, loadDevTier, loadLocalTrial, loadWasPro, upgrade } from './payments';
import { collectSame, collectText, getFill, getKey, linkedKeys, readingOrder, recountKeys, registerKeys, setSheetKeys, unregisterIfUnused, whereOf } from './nodes';
import { FREE } from '../shared/constants';
import { buildDict, stripTags } from '../shared/dict';
import { getSelectionInfo } from './selection';
import { loadConfig, loadTable, saveConfig, saveTable } from './storage';
import { syncScope } from './sync';
import { resetMissingFonts, setText } from './text';
import { setWatchDict, watchEdits } from './watch';
import { beginJournal, endJournal, undoLast } from './undo';

const command = figma.command || 'open';
// right-panel "Sheetlingo key" button (command 'key') simply opens the full plugin
figma.showUI(__html__, { width: 400, height: 660, themeColors: true, visible: command !== 'resync' });
figma.clientStorage.getAsync('uiSize').then((s) => { if (s && s.w && s.h) figma.ui.resize(s.w, s.h); }).catch(() => {});
try { figma.root.setRelaunchData({ open: '', resync: '' }); } catch (_) { /* ignore */ }

const post = (m: CodeToUi) => {
  // A visible result closes the undo journal for the operation that produced it.
  if (m.type === 'report' && !m.silent) m = { ...m, undoable: endJournal() > 0 };
  figma.ui.postMessage(m);
};
const JOURNALED = new Set(['sync', 'fill-text', 'fill-cards', 'bind', 'auto-link', 'unbind']);
const postSelection = () => post({ type: 'selection', selection: getSelectionInfo() });
const postUsage = () => post({ type: 'usage', linkedKeys: linkedKeys().length });

figma.on('selectionchange', postSelection);
watchEdits(() => loadConfig().unlinkOnEdit !== false, (name, key) => {
  post({ type: 'auto-unlinked', name, key });
  postSelection();
  postUsage();
});
figma.on('currentpagechange', postSelection);

const effectiveScope = (s: Scope): Scope => s;

/** Free plan hard stop: a file with more linked keys than the Free limit is locked until upgrade. */
// Reading (export) and cleaning up (unbind, recount) stay open so nobody is stuck with their own data.
const LOCKED = new Set(['sync', 'fill-text', 'fill-cards', 'bind', 'auto-link']);
const overLimit = () => !isPro() && linkedKeys().length > FREE.maxKeys;

figma.ui.onmessage = async (msg: UiToCode) => {
  resetMissingFonts();
  if (JOURNALED.has(msg.type) && !(msg.type === 'sync' && msg.silent)) beginJournal();
  try {
    if (LOCKED.has(msg.type) && overLimit()) {
      if (msg.type === 'sync' && msg.silent) return; // live sync just stops quietly
      post({ type: 'error', message: 'OVER_LIMIT' });
      return;
    }
    switch (msg.type) {
      case 'ui-ready': {
        const [table, locale, auth] = await Promise.all([loadTable(), figma.clientStorage.getAsync('uiLocale'), figma.clientStorage.getAsync('googleAuth'), loadDevTier(), loadLocalTrial(), loadWasPro()]);
        setWatchDict(table, loadConfig().mapping);
        post({ type: 'init', config: loadConfig(), plan: getPlan(), selection: getSelectionInfo(), table, command, locale: locale ?? null, auth: auth ?? null });
        if (command !== 'resync') postUsage();
        break;
      }
      case 'save-config': saveConfig(msg.config); break;
      case 'cache-table': await saveTable(msg.table); setWatchDict(msg.table, loadConfig().mapping); break;
      case 'sync': {
        setWatchDict(msg.table, msg.mapping);
        const report = await syncScope({ table: msg.table, mapping: msg.mapping, lang: msg.lang, scope: effectiveScope(msg.scope), pro: isPro(), strip: msg.stripTags ?? loadConfig().stripTags !== false,
          autoLink: msg.autoLink ?? true, rename: loadConfig().renameOnBind, same: msg.same, ids: msg.ids,
          onProgress: msg.silent ? undefined : (done, total) => post({ type: 'progress', done, total }) });
        post({ type: 'report', source: 'sync', report, silent: msg.silent });
        postUsage();
        break;
      }
      case 'fill-text': {
        const report = await fillText(msg.table, msg.column, msg.startRow, isPro());
        post({ type: 'report', source: 'fill', report });
        postSelection();
        break;
      }
      case 'fill-cards': {
        const report = await fillCards(msg.table, msg.startRow, msg.overrides, isPro());
        post({ type: 'report', source: 'fill', report });
        break;
      }
      case 'bind': {
        const cfg = loadConfig();
        const report = await bindSelection(msg.key, msg.value, cfg.renameOnBind, isPro(), msg.ids);
        if (msg.sync) {
          const r2 = await syncScope({ ...msg.sync, pro: isPro(), strip: msg.sync.stripTags ?? cfg.stripTags !== false,
            autoLink: true, rename: cfg.renameOnBind });
          // One result for "link + apply": texts the link step already rewrote count as changed, not "unchanged".
          const pre = report.changedText ?? 0;
          r2.updated += pre;
          r2.unchanged = Math.max(0, r2.unchanged - pre);
          r2.linkedNew += report.newlyLinked ?? 0;
          r2.failed.push(...report.failed);
          post({ type: 'report', source: 'sync', report: r2 });
        } else {
          post({ type: 'report', source: 'bind', report });
        }
        postSelection();
        postUsage();
        break;
      }
      case 'auto-link': {
        const report = await autoLink(msg.table, msg.mapping, effectiveScope(msg.scope), loadConfig().renameOnBind, isPro());
        post({ type: 'report', source: 'bind', report });
        postSelection();
        postUsage();
        break;
      }
      case 'undo': {
        const { restored, keys } = await undoLast(setText);
        registerKeys(keys);
        unregisterIfUnused(keys);
        post({ type: 'undone', restored });
        postSelection();
        postUsage();
        break;
      }
      case 'unbind': {
        post({ type: 'report', source: 'unbind', report: await unbindSelection(msg.ids) });
        postSelection();
        postUsage();
        break;
      }
      case 'export': {
        const res = await exportLayers(effectiveScope(msg.scope), msg.generateKeys, msg.baseLang, loadConfig().renameOnBind, isPro());
        post({ type: 'export-result', ...res });
        postSelection();
        postUsage();
        break;
      }
      case 'select-next-unlinked': {
        const sheetKeys = msg.keys ? new Set(msg.keys) : null;
        // visible on screen (absoluteRenderBounds is null when the node or a parent is hidden) and not locked
        const isLocked = (n: BaseNode | null): boolean => {
          for (let p: BaseNode | null = n; p && p.type !== 'PAGE'; p = p.parent) if ('locked' in p && (p as SceneNode).locked) return true;
          return false;
        };
        const texts = readingOrder(figma.currentPage.findAllWithCriteria({ types: ['TEXT'] })
          .filter((n) => {
            if (!n.absoluteRenderBounds || !n.characters.trim() || getFill(n) || isLocked(n)) return false;
            const k = getKey(n);
            return !k || (!!sheetKeys && !sheetKeys.has(k)); // a key that isn't in the sheet is not a real link
          }));
        if (!texts.length) { post({ type: 'next-result', remaining: 0 }); break; }
        const cur = figma.currentPage.selection[0];
        const dir = msg.dir ?? 1;
        let idx = cur ? texts.findIndex((n) => n.id === cur.id) : -1;
        if (idx < 0 && cur) {
          // current layer is linked (not in the list) → start from its reading position
          const b = cur.absoluteBoundingBox;
          idx = b ? texts.findIndex((n) => { const nb = n.absoluteBoundingBox; return !!nb && (nb.y > b.y + 1 || (Math.abs(nb.y - b.y) <= 1 && nb.x > b.x)); }) - (dir > 0 ? 1 : 0) : -1;
        }
        if (msg.peek) { // only report where the current selection sits, don't move
          const here = !!cur && texts[idx]?.id === cur.id;
          post({ type: 'next-result', remaining: texts.length, index: idx, here });
          break;
        }
        const ni = ((idx + dir) % texts.length + texts.length) % texts.length;
        const next = texts[ni];
        figma.currentPage.selection = [next];
        figma.viewport.scrollAndZoomIntoView([next]);
        postSelection();
        post({ type: 'next-result', remaining: texts.length, index: ni, here: true });
        break;
      }
      case 'focus': {
        const n = await figma.getNodeByIdAsync(msg.nodeId);
        if (!n || n.type === 'DOCUMENT' || n.type === 'PAGE') break;
        let p: BaseNode | null = n;
        while (p && p.type !== 'PAGE') p = p.parent;
        if (p && p.type === 'PAGE' && p.id !== figma.currentPage.id) await figma.setCurrentPageAsync(p);
        figma.currentPage.selection = [n as SceneNode];
        figma.viewport.scrollAndZoomIntoView([n as SceneNode]);
        if (msg.zoom === false) { /* keep zoom: reserved */ }
        break;
      }
      case 'upgrade': await upgrade(); post({ type: 'plan', plan: getPlan() }); break;
      case 'dev-set-tier': await devSetTier(msg.tier); post({ type: 'plan', plan: getPlan() }); break;
      case 'set-ui-locale': await figma.clientStorage.setAsync('uiLocale', msg.locale); break;
      case 'notify': figma.notify(msg.message); break;
      case 'open-url': figma.openExternal(msg.url); break;
      case 'auth-save': await figma.clientStorage.setAsync('googleAuth', msg.auth); break;
      case 'scope-info': {
        const areaNames = () => msg.scope === 'selection' ? figma.currentPage.selection.map((n) => n.name)
          : msg.scope === 'document' ? ['*'] : [figma.currentPage.name];
        if (msg.same) {
          const cfg = loadConfig();
          const tbl = await loadTable();
          const entry = tbl && cfg.mapping ? buildDict(tbl, cfg.mapping).dict[msg.same.key] : undefined;
          const base = await collectText(msg.scope === 'same' ? 'page' : msg.scope);
          const r = collectSame(msg.same, Object.values(entry ?? {}), base);
          const items = readingOrder([...r.linked, ...r.unlinked]).slice(0, 300)
            .map((n) => ({ id: n.id, text: n.characters.slice(0, 80), where: whereOf(n), key: getKey(n) }));
          post({ type: 'scope-info', info: { scope: msg.scope, names: areaNames(), linked: r.linked.length, unlinked: r.unlinked.length, items } });
          break;
        }
        const nodes = await collectText(msg.scope);
        if (msg.scope === 'document') {
          // All pages: count what would change for the chosen language (shown in the confirm step)
          const cfg = loadConfig();
          const tbl = await loadTable();
          const dict = tbl && cfg.mapping ? buildDict(tbl, cfg.mapping).dict : {};
          const lang = msg.lang || cfg.currentLang || cfg.mapping?.baseLang || '';
          const strip = cfg.stripTags !== false;
          let linked = 0, change = 0;
          for (const n of nodes) {
            if (getFill(n)) continue;
            const k = getKey(n);
            if (!k) continue;
            linked++;
            const e = dict[k];
            const raw = e ? e[lang] || (cfg.mapping ? e[cfg.mapping.baseLang] : '') : undefined;
            const v = raw !== undefined && strip ? stripTags(raw) : raw;
            if (v !== undefined && v !== n.characters) change++;
          }
          post({ type: 'scope-info', info: { scope: 'document', names: ['*'], linked, unlinked: 0, items: [], willChange: change } });
          break;
        }
        let linked = 0, unlinked = 0;
        const picked: TextNode[] = [];
        for (const n of nodes) {
          if (getFill(n) || getKey(n)) { linked++; if (picked.length < 300) picked.push(n); }
          else if (n.characters.trim()) { unlinked++; if (msg.scope === 'selection' && picked.length < 300) picked.push(n); }
        }
        const items = readingOrder(picked).map((n) => ({ id: n.id, text: n.characters.slice(0, 80), where: whereOf(n), key: getKey(n) }));
        const names = msg.scope === 'page' ? [figma.currentPage.name] : figma.currentPage.selection.map((n) => n.name);
        post({ type: 'scope-info', info: { scope: msg.scope, names, linked, unlinked, items } });
        break;
      }
      case 'get-selection': postSelection(); break;
      case 'usage-counts': {
        const counts: Record<string, number> = {};
        for (const n of figma.currentPage.findAllWithCriteria({ types: ['TEXT'], sharedPluginData: { namespace: 'sheetlingo', keys: ['key'] } })) {
          const k = n.getSharedPluginData('sheetlingo', 'key');
          if (k) counts[k] = (counts[k] ?? 0) + 1;
        }
        post({ type: 'usage-counts', counts });
        break;
      }
      case 'find-usage': {
        // Every text on this page linked to the key, in reading order (for Prev / Next on the canvas)
        const nodes = readingOrder(figma.currentPage.findAllWithCriteria({ types: ['TEXT'], sharedPluginData: { namespace: 'sheetlingo', keys: ['key'] } })
          .filter((n) => n.getSharedPluginData('sheetlingo', 'key') === msg.key));
        post({ type: 'usage-list', key: msg.key, items: nodes.slice(0, 500).map((n) => ({ id: n.id, text: n.characters.slice(0, 120), where: whereOf(n) })) });
        break;
      }
      case 'sheet-keys': setSheetKeys(msg.keys); postUsage(); postSelection(); break;
      case 'recount-keys': {
        const r = await recountKeys();
        postUsage();
        post({ type: 'recount-done', ...r });
        break;
      }
      case 'mini': figma.ui.resize(300, 56); break;
      case 'expand': {
        const s = await figma.clientStorage.getAsync('uiSize');
        figma.ui.resize(s?.w ?? 400, s?.h ?? 660);
        break;
      }
      case 'resize': {
        const w = Math.max(340, Math.min(900, msg.width));
        const h = Math.max(420, Math.min(1200, msg.height));
        figma.ui.resize(w, h);
        figma.clientStorage.setAsync('uiSize', { w, h }).catch(() => {});
        break;
      }
      case 'close': figma.closePlugin(); break;
    }
  } catch (e) {
    endJournal();
    console.error('[Sheetlingo]', e);
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
