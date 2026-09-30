import { NS } from '../shared/constants';
import type { Issue, SameRef, Scope } from '../shared/types';
import { normText, stripTags } from '../shared/dict';

export interface FillBinding { c: string; r: number }

export function getKey(n: TextNode): string {
  const k = n.getSharedPluginData(NS, 'key');
  if (k) return k;
  const name = n.name.trim();
  return name.startsWith('#') ? name.slice(1).trim() : '';
}

export function getFill(n: TextNode): FillBinding | null {
  const raw = n.getSharedPluginData(NS, 'fill');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

export function setData(n: BaseNode, key: string, value: string) {
  try { n.setSharedPluginData(NS, key, value); } catch (_) { /* read-only node */ }
}

export function issue(n: SceneNode, key?: string, reason?: string): Issue {
  return { nodeId: n.id, name: n.name, key, reason };
}

type Container = SceneNode & ChildrenMixin;
export const hasChildren = (n: SceneNode): n is Container => 'findAllWithCriteria' in n;

export async function collectText(scope: Scope): Promise<TextNode[]> {
  if (scope === 'page' || scope === 'same') return figma.currentPage.findAllWithCriteria({ types: ['TEXT'] });
  if (scope === 'document') {
    await figma.loadAllPagesAsync();
    return figma.root.findAllWithCriteria({ types: ['TEXT'] });
  }
  const out: TextNode[] = [];
  const seen = new Set<string>();
  const push = (t: TextNode) => { if (!seen.has(t.id)) { seen.add(t.id); out.push(t); } };
  for (const n of figma.currentPage.selection) {
    if (n.type === 'TEXT') push(n);
    else if (hasChildren(n)) n.findAllWithCriteria({ types: ['TEXT'] }).forEach(push);
  }
  return out;
}

/** Sort nodes in reading order: top → bottom, then left → right within a row. */
export function readingOrder<T extends SceneNode>(nodes: T[]): T[] {
  const items = nodes.map((n) => ({ n, b: n.absoluteBoundingBox ?? { x: n.x, y: n.y, width: n.width, height: n.height } }));
  items.sort((a, b) => a.b.y - b.b.y);
  const rows: typeof items[] = [];
  for (const it of items) {
    const last = rows[rows.length - 1];
    if (last) {
      const ref = last[0].b;
      const tol = Math.max(4, Math.min(ref.height, it.b.height) / 2);
      if (Math.abs(it.b.y - ref.y) <= tol) { last.push(it); continue; }
    }
    rows.push([it]);
  }
  const out: T[] = [];
  for (const r of rows) { r.sort((a, b) => a.b.x - b.b.x); for (const it of r) out.push(it.n); }
  return out;
}

/*
 * Registry of distinct keys linked in this file (stored on the document).
 * Scanning every page of a big file to count keys froze Figma, so we keep a list instead:
 * keys are added when linked (bind / auto-link / extract / first sync) and removed on unlink
 * when no other layer on the current page still uses them.
 */
export function linkedKeys(): string[] {
  try { return JSON.parse(figma.root.getSharedPluginData(NS, 'keys') || '[]'); } catch (_) { return []; }
}
function saveKeys(keys: string[]) { figma.root.setSharedPluginData(NS, 'keys', JSON.stringify(keys)); }
export function registerKeys(keys: string[]) {
  const cur = linkedKeys();
  const set = new Set(cur);
  let changed = false;
  for (const k of keys) if (k && !set.has(k)) { set.add(k); cur.push(k); changed = true; }
  if (changed) saveKeys(cur);
}
export function unregisterIfUnused(keys: string[]) {
  const still = new Set<string>();
  for (const n of figma.currentPage.findAllWithCriteria({ types: ['TEXT'], sharedPluginData: { namespace: NS, keys: ['key'] } })) {
    const k = n.getSharedPluginData(NS, 'key');
    if (k) still.add(k);
  }
  const drop = new Set(keys.filter((k) => !still.has(k)));
  if (drop.size) saveKeys(linkedKeys().filter((k) => !drop.has(k)));
}

/** Shows the linked key in Figma's right panel (relaunch section) when the layer is selected. */
export function setKeyBadge(n: SceneNode, key: string) {
  try { n.setRelaunchData(key ? { key } : {}); } catch (_) { /* read-only node */ }
}

/** Texts on the current page linked to `ref.key`, plus unlinked texts whose text equals the selected text or a value of that key. */
/**
 * "Exactly the same text": texts whose wording equals the base text (or one of its key's sheet values). Ones already on `ref.key` just
 * change language; the rest (unlinked, or on another key when `relink`) get linked to `ref.key`.
 * Texts linked to the same key but with different wording are ignored.
 */
export function collectSame(ref: SameRef, values: string[], nodes?: TextNode[]): { linked: TextNode[]; unlinked: TextNode[] } {
  // The base wording, plus the key's own sheet values (so it still works after switching language)
  const targets = new Set([normText(ref.text), ...values.map((v) => normText(stripTags(v)))].filter(Boolean));
  const linked: TextNode[] = [], unlinked: TextNode[] = [];
  if (!targets.size) return { linked, unlinked };
  for (const n of nodes ?? figma.currentPage.findAllWithCriteria({ types: ['TEXT'] })) {
    if (getFill(n) || !targets.has(normText(n.characters))) continue;
    const k = getKey(n);
    if (k === ref.key) linked.push(n);
    else if (!k || ref.relink) unlinked.push(n);
  }
  return { linked, unlinked };
}

/** "Screen › Section" — where a layer lives, for the target list. */
export function whereOf(n: BaseNode): string {
  const chain: string[] = [];
  for (let p = n.parent; p && p.type !== 'PAGE' && p.type !== 'DOCUMENT'; p = p.parent) chain.push(p.name);
  if (!chain.length) return '';
  const top = chain[chain.length - 1];
  return chain.length > 1 ? `${top} › ${chain[0]}` : top;
}

/** Explicit, user-triggered full scan (can be slow on big files): rebuilds the key registry from real layers. */
export async function recountKeys(): Promise<number> {
  await figma.loadAllPagesAsync();
  const seen = new Set<string>();
  for (const n of figma.root.findAllWithCriteria({ types: ['TEXT'] })) {
    if (getFill(n)) continue;
    const k = getKey(n);
    if (k) seen.add(k);
  }
  const keys = Array.from(seen);
  figma.root.setSharedPluginData(NS, 'keys', JSON.stringify(keys));
  return keys.length;
}
