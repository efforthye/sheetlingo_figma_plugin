import { buildDict, normText, stripTags, type Dict } from '../shared/dict';
import type { Mapping, Table } from '../shared/types';
import { getFill, getKey, setData, setKeyBadge, unregisterIfUnused } from './nodes';
import { pluginWrites } from './text';

/*
 * Edit watcher: when the user types into a linked text so it no longer matches its key
 * (in any language), the link is removed. The layer then shows up as "unlinked" and the
 * key picker suggests keys that match the new wording.
 */
let dict: Dict = {};
export function setWatchDict(table: Table | null, mapping: Mapping | undefined) {
  dict = table && mapping ? buildDict(table, mapping).dict : {};
}

/** Unlinks `n` if its wording no longer matches any value of its key. Returns the old key when unlinked. */
export function reconcile(n: TextNode): string | null {
  if (n.removed || getFill(n)) return null;
  const mine = pluginWrites.get(n.id);
  if (mine !== undefined) { if (mine === n.characters) return null; pluginWrites.delete(n.id); }
  const key = getKey(n);
  const entry = key ? dict[key] : undefined;
  if (!key || !entry) return null;
  const now = normText(n.characters);
  const matches = Object.values(entry).some((v) => v && (normText(stripTags(v)) === now || normText(v) === now));
  if (matches) return null;
  setData(n, 'key', '');
  setData(n, 'lang', '');
  setKeyBadge(n, '');
  if (n.name.trim().startsWith('#')) { try { n.name = n.characters.slice(0, 40) || 'Text'; } catch (_) { /* ignore */ } }
  unregisterIfUnused([key]);
  return key;
}

const selectedTexts = (): TextNode[] => {
  const out: TextNode[] = [];
  for (const n of figma.currentPage.selection) { if (n.type === 'TEXT') out.push(n); if (out.length >= 50) break; }
  return out;
};

export function watchEdits(enabled: () => boolean, onUnlinked: (name: string, key: string) => void) {
  const check = (nodes: TextNode[]) => {
    if (!enabled()) return;
    for (const n of nodes) { const k = reconcile(n); if (k) onUnlinked(n.name, k); }
  };
  const handler = (e: NodeChangeEvent) => {
    const nodes: TextNode[] = [];
    for (const c of e.nodeChanges) {
      if (c.type !== 'PROPERTY_CHANGE' || !c.properties.includes('characters')) continue;
      const n = c.node;
      if ('type' in n && n.type === 'TEXT' && !n.removed) nodes.push(n);
    }
    check(nodes);
  };
  // Typing inside a text box doesn't always emit nodechange right away, so also poll the
  // selected texts and react only when their wording actually changed while selected.
  let seen = new Map<string, string>();
  setInterval(() => {
    const t = selectedTexts();
    const changed = t.filter((n) => seen.has(n.id) && seen.get(n.id) !== n.characters);
    seen = new Map(t.map((n) => [n.id, n.characters]));
    if (changed.length) check(changed);
  }, 400);
  let page = figma.currentPage;
  page.on('nodechange', handler);
  figma.on('currentpagechange', () => {
    try { page.off('nodechange', handler); } catch (_) { /* ignore */ }
    page = figma.currentPage;
    page.on('nodechange', handler);
  });
}
