import { normName } from '../shared/dict';
import type { SelectionInfo } from '../shared/types';
import { getFill, getKey, hasChildren, isSheetKey } from './nodes';

export function getSelectionInfo(): SelectionInfo {
  const sel = figma.currentPage.selection;
  let textCount = 0, keyedCount = 0, containerCount = 0, scanned = 0;
  let firstText = '';
  const keys = new Set<string>();
  const fields = new Map<string, string>();
  const inside: { nodeId: string; key: string; text: string }[] = [];
  let insideCount = 0, insideUnlinked = 0, budget = 800; // cap work on huge frames
  for (const n of sel) {
    if (n.type === 'TEXT') {
      textCount++;
      if (!firstText) firstText = n.characters.slice(0, 5000);
      const k = getKey(n);
      if (isSheetKey(k)) { keyedCount++; keys.add(k); }
    } else if (hasChildren(n)) {
      containerCount++;
      const texts = budget > 0 ? n.findAllWithCriteria({ types: ['TEXT'] }) : [];
      for (const t of texts) {
        if (budget-- <= 0) break;
        if (scanned < 3) {
          const nn = normName(t.name);
          if (nn && !fields.has(nn) && fields.size < 40) fields.set(nn, t.name);
        }
        if (getFill(t) || !t.characters.trim()) continue;
        const k = getKey(t);
        // Every text in the frame is listed; key '' = not linked (no key, or a key that isn't in the sheet)
        const linked = isSheetKey(k);
        if (linked) insideCount++; else insideUnlinked++;
        if (inside.length < 60) inside.push({ nodeId: t.id, key: linked ? k : '', text: t.characters.slice(0, 80) });
      }
      scanned++;
    }
  }
  return {
    total: sel.length, textCount, keyedCount, containerCount,
    keys: Array.from(keys).slice(0, 30),
    cardFields: Array.from(fields.values()),
    firstText,
    inside, insideCount, insideUnlinked,
    sig: sel.map((n) => n.id).join(','),
  };
}
