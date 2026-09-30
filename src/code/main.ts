import type { CodeToUi, Scope, UiToCode } from '../shared/types';
import { autoLink, bindSelection, unbindSelection } from './bind';
import { exportLayers } from './export';
import { fillCards, fillText } from './fill';
import { devSetTier, getPlan, isPro, loadDevTier, loadLocalTrial, upgrade } from './payments';
import { collectSame, collectText, getFill, getKey, linkedKeys, readingOrder, recountKeys, whereOf } from './nodes';
import { FREE } from '../shared/constants';
import { buildDict } from '../shared/dict';
import { getSelectionInfo } from './selection';
import { loadConfig, loadTable, saveConfig, saveTable } from './storage';
import { syncScope } from './sync';
import { resetMissingFonts } from './text';
import { setWatchDict, watchEdits } from './watch';

const command = figma.command || 'open';
// right-panel "Sheetlingo key" button (command 'key') simply opens the full plugin
figma.showUI(__html__, { width: 400, height: 660, themeColors: true, visible: command !== 'resync' });
figma.clientStorage.getAsync('uiSize').then((s) => { if (s && s.w && s.h) figma.ui.resize(s.w, s.h); }).catch(() => {});
try { figma.root.setRelaunchData({ open: '', resync: '' }); } catch (_) { /* ignore */ }

const post = (m: CodeToUi) => figma.ui.postMessage(m);
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
const LOCKED = new Set(['sync', 'fill-text', 'fill-cards', 'bind', 'auto-link', 'export']);
const overLimit = () => !isPro() && linkedKeys().length > FREE.maxKeys;

figma.ui.onmessage = async (msg: UiToCode) => {
  resetMissingFonts();
  try {
    if (LOCKED.has(msg.type) && overLimit()) {
      if (msg.type === 'sync' && msg.silent) return; // live sync just stops quietly
      post({ type: 'error', message: 'OVER_LIMIT' });
      return;
    }
    switch (msg.type) {
      case 'ui-ready': {
        const [table, locale, auth] = await Promise.all([loadTable(), figma.clientStorage.getAsync('uiLocale'), figma.clientStorage.getAsync('googleAuth'), loadDevTier(), loadLocalTrial()]);
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
          autoLink: msg.autoLink ?? loadConfig().autoLinkOnApply !== false, rename: loadConfig().renameOnBind, same: msg.same, ids: msg.ids });
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
            autoLink: cfg.autoLinkOnApply !== false, rename: cfg.renameOnBind });
          r2.linkedNew += report.updated;
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
        // visible on screen (absoluteRenderBounds is null when the node or a parent is hidden) and not locked
        const isLocked = (n: BaseNode | null): boolean => {
          for (let p: BaseNode | null = n; p && p.type !== 'PAGE'; p = p.parent) if ('locked' in p && (p as SceneNode).locked) return true;
          return false;
        };
        const texts = readingOrder(figma.currentPage.findAllWithCriteria({ types: ['TEXT'] })
          .filter((n) => n.absoluteRenderBounds && n.characters.trim() && !getKey(n) && !getFill(n) && !isLocked(n)));
        if (!texts.length) { post({ type: 'next-result', remaining: 0 }); break; }
        const cur = figma.currentPage.selection[0];
        const dir = msg.dir ?? 1;
        let idx = cur ? texts.findIndex((n) => n.id === cur.id) : -1;
        if (idx < 0 && cur) {
          // current layer is linked (not in the list) → start from its reading position
          const b = cur.absoluteBoundingBox;
          idx = b ? texts.findIndex((n) => { const nb = n.absoluteBoundingBox; return !!nb && (nb.y > b.y + 1 || (Math.abs(nb.y - b.y) <= 1 && nb.x > b.x)); }) - (dir > 0 ? 1 : 0) : -1;
        }
        const ni = ((idx + dir) % texts.length + texts.length) % texts.length;
        const next = texts[ni];
        figma.currentPage.selection = [next];
        figma.viewport.scrollAndZoomIntoView([next]);
        postSelection();
        post({ type: 'next-result', remaining: texts.length, index: ni });
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
        if (msg.scope === 'document' && !msg.same) break;
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
      case 'recount-keys': {
        await recountKeys();
        postUsage();
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
    console.error('[Sheetlingo]', e);
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
