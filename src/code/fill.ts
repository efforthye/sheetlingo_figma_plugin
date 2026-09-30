import { FREE } from '../shared/constants';
import { normName } from '../shared/dict';
import { emptyReport, type Report, type Table } from '../shared/types';
import { hasChildren, issue, readingOrder, setData, setKeyBadge } from './nodes';
import { failTag, isOverflowing, setText } from './text';

function bindFill(n: TextNode, column: string, row: number) {
  setData(n, 'fill', JSON.stringify({ c: column, r: row }));
  setKeyBadge(n, `${column} · row ${row + 1}`);
  setData(n, 'key', '');
}

/** Fill selected text layers (reading order) with consecutive rows of one column. */
export async function fillText(table: Table, column: string, startRow: number, pro: boolean): Promise<Report> {
  const report = emptyReport();
  report.overflowChecked = true;
  const ci = table.columns.indexOf(column);
  if (ci < 0) throw new Error('Column not found: ' + column);
  const texts = readingOrder(figma.currentPage.selection.filter((n): n is TextNode => n.type === 'TEXT'));
  if (!texts.length) throw new Error('NO_TEXT_SELECTED');
  report.total = texts.length;
  let list = texts;
  if (!pro && texts.length > FREE.maxFillLayers) {
    report.limited = texts.length - FREE.maxFillLayers;
    list = texts.slice(0, FREE.maxFillLayers);
  }
  const start = Math.max(0, startRow - 1);
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    const row = start + i;
    const value = table.rows[row]?.[ci];
    if (value === undefined) { report.missing.push(issue(n, `row ${row + 1}`, 'no-row')); continue; }
    const r = await setText(n, value);
    if (r === 'ok') report.updated++; else if (r === 'same') report.unchanged++; else { report.failed.push(issue(n, undefined, failTag(r))); continue; }
    bindFill(n, column, row);
    if (isOverflowing(n)) report.overflow.push(issue(n));
  }
  return report;
}

/** Fill selected cards row by row; text layers are matched to columns by name. */
export async function fillCards(table: Table, startRow: number, overrides: Record<string, string>, pro: boolean): Promise<Report> {
  const report = emptyReport();
  report.overflowChecked = true;
  const cards = readingOrder(figma.currentPage.selection.filter(hasChildren));
  if (!cards.length) throw new Error('NO_CARD_SELECTED');
  report.total = cards.length;
  let list = cards;
  if (!pro && cards.length > FREE.maxCards) {
    report.limited = cards.length - FREE.maxCards;
    list = cards.slice(0, FREE.maxCards);
  }
  const byNorm = new Map(table.columns.map((c) => [normName(c), c] as [string, string]));
  const start = Math.max(0, startRow - 1);

  for (let i = 0; i < list.length; i++) {
    const row = start + i;
    const cells = table.rows[row];
    if (!cells) { report.missing.push(issue(list[i], `row ${row + 1}`, 'no-row')); continue; }
    for (const t of list[i].findAllWithCriteria({ types: ['TEXT'] })) {
      const nn = normName(t.name);
      const col = nn in overrides ? overrides[nn] : byNorm.get(nn);
      if (!col) { report.unmatched++; continue; }
      const ci = table.columns.indexOf(col);
      if (ci < 0) { report.unmatched++; continue; }
      const r = await setText(t, cells[ci] ?? '');
      if (r === 'ok') report.updated++; else if (r === 'same') report.unchanged++; else { report.failed.push(issue(t, undefined, failTag(r))); continue; }
      bindFill(t, col, row);
      if (isOverflowing(t)) report.overflow.push(issue(t));
    }
  }
  return report;
}
