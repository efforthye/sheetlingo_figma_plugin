import type { Mapping, Table } from './types';

export type Dict = Record<string, Record<string, string>>;

export function buildDict(table: Table, m: Mapping): { dict: Dict; duplicates: string[]; order: string[] } {
  const ki = table.columns.indexOf(m.keyColumn);
  const langs = m.languages.map((l) => [l, table.columns.indexOf(l)] as [string, number]);
  const dict: Dict = {};
  const duplicates: string[] = [];
  const order: string[] = [];
  if (ki < 0) return { dict, duplicates, order };
  for (const row of table.rows) {
    const key = (row[ki] || '').trim();
    if (!key || key.startsWith('#')) continue;
    if (dict[key]) duplicates.push(key); else order.push(key);
    const entry: Record<string, string> = {};
    for (const [l, i] of langs) if (i >= 0) entry[l] = row[i] ?? '';
    dict[key] = entry;
  }
  return { dict, duplicates, order };
}

/** Normalises a layer / column name for loose matching ("#Product Name" == "product_name"). */
export function normName(s: string): string {
  return s.replace(/^#/, '').trim().toLowerCase().replace(/[\s_\-.]+/g, '');
}

const LANG_RE = /^[a-z]{2,3}([-_][A-Za-z0-9]{2,4})?$/i;
const KEY_RE = /^(key|keys|id|string_?id|string_?key|키)$/i;

/** Guess key column + language columns from the header row. */
export function guessMapping(columns: string[]): Mapping {
  const cols = columns.filter((c) => c && !c.startsWith('#'));
  const keyColumn = cols.find((c) => KEY_RE.test(c.trim())) ?? cols[0] ?? '';
  const rest = cols.filter((c) => c !== keyColumn);
  const langLike = rest.filter((c) => LANG_RE.test(c.trim()));
  const languages = langLike.length ? langLike : rest;
  const baseLang = languages.find((l) => l.toLowerCase() === 'en') ?? languages[0] ?? '';
  return { keyColumn, languages, baseLang };
}

/** Languages usable on the current plan (free: base + first other). */
export function allowedLanguages(m: Mapping, pro: boolean, max: number): string[] {
  if (pro) return m.languages;
  const others = m.languages.filter((l) => l !== m.baseLang);
  return [m.baseLang, ...others].slice(0, max);
}

/** Normalises text for matching layer text against sheet values. */
export function normText(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Keys usable on the current plan (free: the first `max` keys in sheet order). */
export function usableKeys(order: string[], pro: boolean, max: number): Set<string> {
  return new Set(pro ? order : order.slice(0, max));
}

/** Strips inline markup tags (<b>, </support>, <br/>…) — <br> becomes a line break. */
export function stripTags(s: string): string {
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[A-Za-z][\w:-]*(\s[^<>]*)?\/?>/g, '');
}
