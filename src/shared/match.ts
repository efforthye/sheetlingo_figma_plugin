import type { Dict } from './dict';
import { normText, stripTags } from './dict';

export type Match = { kind: 'one'; key: string; close: boolean } | { kind: 'many'; keys: string[] } | { kind: 'none' };

/**
 * Finds the key whose value (any language) matches a layer's text.
 * Exact (normalised) match only. Several different keys with the same text → ambiguous.
 */
export function makeMatcher(dict: Dict, strip = true) {
  const exact = new Map<string, Set<string>>();
  for (const key in dict) {
    for (const lang in dict[key]) {
      const raw = dict[key][lang];
      const v = normText(strip ? stripTags(raw) : raw);
      if (!v) continue;
      if (!exact.has(v)) exact.set(v, new Set());
      exact.get(v)!.add(key);
    }
  }
  return (text: string): Match => {
    const q = normText(text);
    if (!q) return { kind: 'none' };
    const e = exact.get(q);
    if (e) return e.size === 1 ? { kind: 'one', key: Array.from(e)[0], close: false } : { kind: 'many', keys: Array.from(e) };
    // No fuzzy matching here: automatic linking only happens for exactly the same wording.
    // (Close matches like "Continue with Google2" are only *suggested* in the key picker.)
    return { kind: 'none' };
  };
}
