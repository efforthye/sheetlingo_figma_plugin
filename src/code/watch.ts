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

export function watchEdits(enabled: () => boolean, onUnlinked: (name: string, key: string) => void) {
  const handler = (e: NodeChangeEvent) => {
    if (!enabled()) return;
    for (const c of e.nodeChanges) {
      if (c.type !== 'PROPERTY_CHANGE' || !c.properties.includes('characters')) continue;
      const n = c.node;
      if (!('type' in n) || n.type !== 'TEXT' || n.removed) continue;
      const mine = pluginWrites.get(n.id);
      if (mine !== undefined) { pluginWrites.delete(n.id); if (mine === n.characters) continue; }
      if (getFill(n)) continue;
      const key = getKey(n);
      const entry = key ? dict[key] : undefined;
      if (!key || !entry) continue;
      const now = normText(n.characters);
      const matches = Object.values(entry).some((v) => normText(stripTags(v)) === now || normText(v) === now);
      if (matches) continue;
      setData(n, 'key', '');
      setData(n, 'lang', '');
      setKeyBadge(n, '');
      if (n.name.trim().startsWith('#')) { try { n.name = n.characters.slice(0, 40) || 'Text'; } catch (_) { /* ignore */ } }
      unregisterIfUnused([key]);
      onUnlinked(n.name, key);
    }
  };
  let page = figma.currentPage;
  page.on('nodechange', handler);
  figma.on('currentpagechange', () => {
    try { page.off('nodechange', handler); } catch (_) { /* ignore */ }
    page = figma.currentPage;
    page.on('nodechange', handler);
  });
}
