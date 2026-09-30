import { normName } from '../shared/dict';
import type { SelectionInfo } from '../shared/types';
import { getFill, getKey, hasChildren } from './nodes';

export function getSelectionInfo(): SelectionInfo {
  const sel = figma.currentPage.selection;
  let textCount = 0, keyedCount = 0, containerCount = 0, scanned = 0;
  let firstText = '';
  const keys = new Set<string>();
  const fields = new Map<string, string>();
  const inside: { nodeId: string; key: string; text: string }[] = [];
  let insideCount = 0, budget = 800; // cap work on huge frames
  for (const n of sel) {
    if (n.type === 'TEXT') {
      textCount++;
      if (!firstText) firstText = n.characters.slice(0, 300);
      const k = getKey(n);
      if (k) { keyedCount++; keys.add(k); }
    } else if (hasChildren(n)) {
      containerCount++;
      const texts = budget > 0 ? n.findAllWithCriteria({ types: ['TEXT'] }) : [];
      for (const t of texts) {
        if (budget-- <= 0) break;
        if (scanned < 3) {
          const nn = normName(t.name);
          if (nn && !fields.has(nn) && fields.size < 40) fields.set(nn, t.name);
        }
        const k = getFill(t) ? '' : getKey(t);
        if (k) { insideCount++; if (inside.length < 60) inside.push({ nodeId: t.id, key: k, text: t.characters.slice(0, 80) }); }
      }
      scanned++;
    }
  }
  return {
    total: sel.length, textCount, keyedCount, containerCount,
    keys: Array.from(keys).slice(0, 30),
    cardFields: Array.from(fields.values()),
    firstText,
    inside, insideCount,
    sig: sel.map((n) => n.id).join(','),
  };
}
