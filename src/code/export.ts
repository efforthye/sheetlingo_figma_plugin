import type { Scope } from '../shared/types';
import { FREE } from '../shared/constants';
import { collectText, getFill, getKey, linkedKeys, registerKeys, setData, setKeyBadge } from './nodes';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
}

function topFrameName(n: BaseNode): string {
  let p: BaseNode = n;
  while (p.parent && p.parent.type !== 'PAGE' && p.parent.type !== 'DOCUMENT') p = p.parent;
  return p === n ? '' : p.name;
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** Builds a key,<base> CSV from text layers; optionally links unlinked layers with generated keys. */
export async function exportLayers(scope: Scope, generateKeys: boolean, baseLang: string, rename: boolean, pro: boolean) {
  let budget = pro ? Infinity : Math.max(0, FREE.maxKeys - linkedKeys().length);
  const created: string[] = [];
  const nodes = await collectText(scope === 'same' ? 'page' : scope);
  const rows = new Map<string, string>();
  const used = new Set<string>();
  let generated = 0;
  for (const n of nodes) { const k = getKey(n); if (k) used.add(k); }

  for (const n of nodes) {
    if (getFill(n)) continue; // data-filled layers belong to their column, not a key
    let key = getKey(n);
    if (!key) {
      if (!generateKeys || !n.characters.trim() || budget <= 0) continue;
      budget--;
      const base = [slug(topFrameName(n)) || 'screen', slug(n.name) || slug(n.characters) || 'text'].join('.');
      key = base;
      for (let i = 2; used.has(key); i++) key = `${base}_${i}`;
      used.add(key);
      setData(n, 'key', key);
      setKeyBadge(n, key);
      if (rename) { try { n.name = '#' + key; } catch (_) { /* ignore */ } }
      generated++;
      created.push(key);
    }
    if (!rows.has(key)) rows.set(key, n.characters);
  }
  registerKeys(created);
  const lines = ['key,' + csvCell(baseLang || 'en')];
  rows.forEach((text, key) => lines.push(csvCell(key) + ',' + csvCell(text)));
  return { csv: lines.join('\n'), rows: rows.size, generated };
}
