import { FREE } from '../shared/constants';
import { buildDict } from '../shared/dict';
import { makeMatcher } from '../shared/match';
import { emptyReport, type Mapping, type Report, type Scope, type Table } from '../shared/types';
import { collectText, getFill, getKey, hasChildren, issue, linkedKeys, registerKeys, setData, setKeyBadge, unregisterIfUnused } from './nodes';
import { failTag, setText } from './text';

function selectedTexts(): TextNode[] {
  const out: TextNode[] = [];
  for (const n of figma.currentPage.selection) {
    if (n.type === 'TEXT') out.push(n);
    else if (hasChildren(n)) out.push(...n.findAllWithCriteria({ types: ['TEXT'] }));
  }
  return out;
}

export async function bindSelection(key: string, value: string | undefined, rename: boolean, pro: boolean, ids?: string[]): Promise<Report> {
  const report = emptyReport();
  const texts = ids
    ? (await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)))).filter((n): n is TextNode => !!n && n.type === 'TEXT')
    : figma.currentPage.selection.filter((n): n is TextNode => n.type === 'TEXT');
  if (!texts.length) throw new Error('NO_TEXT_SELECTED');
  const prev = texts.map(getKey).filter(Boolean);
  if (!pro) {
    // Free: only keys among the first N linked in this file can be (re)linked once the file is at the limit
    const used = linkedKeys();
    const inFree = used.slice(0, FREE.maxKeys).includes(key);
    if (!inFree && used.length >= FREE.maxKeys) throw new Error('KEY_LIMIT');
  }
  registerKeys([key]);
  report.total = texts.length;
  report.changedText = 0; report.newlyLinked = 0;
  for (const n of texts) {
    const prevKey = n.getSharedPluginData('sheetlingo', 'key');
    const isNew = getKey(n) !== key;
    setData(n, 'key', key);
    setData(n, 'fill', '');
    setKeyBadge(n, key);
    if (rename) { try { n.name = '#' + key; } catch (_) { /* instance sublayer */ } }
    if (value !== undefined) {
      const r = await setText(n, value);
      if (r === 'font' || r === 'locked') {
        // Text can't be changed here: undo the link so nothing is left half-done
        setData(n, 'key', prevKey); setKeyBadge(n, prevKey);
        report.failed.push(issue(n, key, failTag(r))); continue;
      }
      if (r === 'ok') report.changedText++;
    }
    if (isNew) report.newlyLinked = (report.newlyLinked ?? 0) + 1;
    report.updated++;
  }
  unregisterIfUnused(prev.filter((k) => k !== key));
  return report;
}

export async function unbindSelection(ids?: string[]): Promise<Report> {
  const report = emptyReport();
  const removed: string[] = [];
  const targets = ids
    ? (await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)))).filter((n): n is TextNode => !!n && n.type === 'TEXT')
    : selectedTexts();
  for (const n of targets) {
    const had = getKey(n) || n.getSharedPluginData('sheetlingo', 'fill');
    if (!had) continue;
    const k = getKey(n);
    if (k) removed.push(k);
    setData(n, 'key', '');
    setData(n, 'fill', '');
    setData(n, 'lang', '');
    setKeyBadge(n, '');
    if (n.name.trim().startsWith('#')) {
      try { n.name = n.characters.slice(0, 40) || 'Text'; } catch (_) { /* ignore */ }
    }
    report.updated++;
  }
  report.total = report.updated;
  unregisterIfUnused(removed);
  return report;
}

/**
 * Links unlinked text layers whose current text exactly matches a sheet value (any language).
 * Ambiguous matches (same text under several keys) are reported, not linked.
 */
export async function autoLink(table: Table, mapping: Mapping, scope: Scope, rename: boolean, pro: boolean): Promise<Report> {
  const report = emptyReport();
  const { dict } = buildDict(table, mapping);
  const used = new Set(linkedKeys());
  const added: string[] = [];
  const match = makeMatcher(dict);
  const candidates = (await collectText(scope === 'same' ? 'page' : scope)).filter((n) => !getKey(n) && !getFill(n) && n.characters.trim());
  report.total = candidates.length;
  for (const n of candidates) {
    const m = match(n.characters);
    if (m.kind === 'none') { report.noMatch.push(issue(n)); continue; }
    if (m.kind === 'many') { report.ambiguous.push(issue(n, m.keys.slice(0, 3).join(' / '))); continue; }
    const key = m.key;
    if (!used.has(key)) {
      if (!pro && used.size >= FREE.maxKeys) { report.limited++; continue; }
      used.add(key); added.push(key);
    }
    setData(n, 'key', key);
    setKeyBadge(n, key);
    if (rename) { try { n.name = '#' + key; } catch (_) { /* instance sublayer */ } }
    report.updated++;
  }
  registerKeys(added);
  return report;
}
