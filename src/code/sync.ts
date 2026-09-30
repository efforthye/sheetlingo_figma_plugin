import { FREE } from '../shared/constants';
import { buildDict, normName, stripTags } from '../shared/dict';
import { emptyReport, type Mapping, type Report, type SameRef, type Scope, type Table } from '../shared/types';
import { collectSame, collectText, getFill, getKey, issue, linkedKeys, registerKeys, setData, setKeyBadge } from './nodes';
import { failTag, isOverflowing, setText } from './text';
import { makeMatcher } from '../shared/match';

interface SyncArgs { table: Table; mapping: Mapping; lang: string; scope: Scope; pro: boolean; strip?: boolean; autoLink?: boolean; rename?: boolean; same?: SameRef; ids?: string[] }

/** Updates every linked layer in scope: key-linked layers get `lang`, fill-linked layers get their cell. */
export async function syncScope({ table, mapping, lang, scope, pro, strip, autoLink, rename, same, ids }: SyncArgs): Promise<Report> {
  const report = emptyReport();
  report.overflowChecked = true;
  const { dict } = buildDict(table, mapping);
  // Free: only the first N distinct keys linked in this file are synced
  const registry = linkedKeys();
  const usable = pro ? null : new Set(registry.slice(0, FREE.maxKeys));
  const known = new Set(registry);
  const fresh: string[] = [];
  const colIndex = (c: string) => {
    const i = table.columns.indexOf(c);
    return i >= 0 ? i : table.columns.findIndex((x) => normName(x) === normName(c));
  };

  let nodes: TextNode[];
  let sameUnlinked: TextNode[] = [];
  if (ids) {
    // Reviewed target list: exactly these layers (user may have excluded some)
    const found = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)));
    const texts = found.filter((n): n is TextNode => !!n && n.type === 'TEXT');
    nodes = texts.filter((n) => getFill(n) || getKey(n));
    if (autoLink && same) sameUnlinked = texts.filter((n) => !getFill(n) && getKey(n) !== same.key);
    if (same) nodes = texts.filter((n) => getKey(n) === same.key);
    else if (autoLink) nodes = texts; // selection scope: matcher below links unlinked ones
  } else if (same) {
    // Key filter: only texts linked to this key (or with exactly its wording) inside the chosen area
    const base = await collectText(scope === 'same' ? 'page' : scope);
    const r = collectSame(same, Object.values(dict[same.key] ?? {}), base);
    nodes = r.linked;
    sameUnlinked = autoLink ? r.unlinked : [];
  } else {
    nodes = await collectText(scope === 'same' ? 'selection' : scope);
  }
  const linked: { n: TextNode; key: string; fill: ReturnType<typeof getFill> }[] = [];
  // Auto-link only where the user pointed: the selection, or texts identical to the selected one
  const match = autoLink && scope === 'selection' && !same ? makeMatcher(dict, strip !== false) : null;
  for (const n of sameUnlinked) {
    if (!known.has(same!.key) && usable && usable.size >= FREE.maxKeys) { report.limited++; continue; }
    setData(n, 'key', same!.key);
    if (rename) { try { n.name = '#' + same!.key; } catch (_) { /* instance sublayer */ } }
    report.linkedNew++;
    linked.push({ n, key: same!.key, fill: null });
  }
  for (const n of nodes) {
    const fill = getFill(n);
    const key = fill ? '' : getKey(n);
    if (fill || key) { linked.push({ n, key, fill }); continue; }
    // Not linked yet → find its key from the text and link it now
    if (!match || !n.characters.trim()) continue;
    const m = match(n.characters);
    if (m.kind === 'none') { report.noMatch.push(issue(n)); continue; }
    if (m.kind === 'many') { report.ambiguous.push(issue(n, m.keys.slice(0, 3).join(' / '))); continue; }
    if (!known.has(m.key) && usable && usable.size >= FREE.maxKeys) { report.limited++; continue; }
    setData(n, 'key', m.key);
    setData(n, 'fill', '');
    if (rename) { try { n.name = '#' + m.key; } catch (_) { /* instance sublayer */ } }
    report.linkedNew++;
    linked.push({ n, key: m.key, fill: null });
  }
  report.total = linked.length;

  for (const { n, key, fill } of linked) {
    let value: string | undefined;
    if (fill) {
      const ci = colIndex(fill.c);
      value = ci >= 0 ? table.rows[fill.r]?.[ci] : undefined;
      if (value === undefined) { report.missing.push(issue(n, `${fill.c} · row ${fill.r + 1}`)); continue; }
    } else {
      const entry = dict[key];
      if (!entry) { report.missing.push(issue(n, key)); continue; }
      if (!known.has(key)) {
        // layer named #key by hand (not linked through the plugin yet) → register it if there is room
        if (usable && usable.size >= FREE.maxKeys) { report.limited++; continue; }
        known.add(key); fresh.push(key); usable?.add(key);
      }
      if (usable && !usable.has(key)) { report.limited++; continue; } // free plan: beyond the linked-key limit
      value = entry[lang];
      if (!value) {
        value = entry[mapping.baseLang];
        if (!value) { report.missing.push(issue(n, key, 'empty')); continue; }
        if (lang !== mapping.baseLang) report.fallback.push(issue(n, key));
      }
      setData(n, 'lang', lang);
      setKeyBadge(n, key);
    }
    const r = await setText(n, strip ? stripTags(value) : value);
    if (r === 'ok') report.updated++;
    else if (r === 'same') report.unchanged++;
    else report.failed.push(issue(n, key || undefined, failTag(r)));
    if ((r === 'ok' || r === 'same') && isOverflowing(n)) report.overflow.push(issue(n, key || undefined));
  }
  if (fresh.length) registerKeys(fresh);
  return report;
}
