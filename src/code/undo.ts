/*
 * One-step undo for the last apply / link / fill. Every node the plugin touches during an
 * operation is snapshotted once (text, key, lang, fill, name); `undoLast` puts it all back.
 */
const NS = 'sheetlingo';
type Snap = { chars: string; key: string; lang: string; fill: string; name: string; relaunch: boolean };
let journal: Map<string, Snap> | null = null;
let last: Map<string, Snap> | null = null;

export function beginJournal() { journal = new Map(); }
export function endJournal(): number {
  if (!journal) return 0;
  const n = journal.size;
  if (n) last = journal;
  journal = null;
  return n;
}
export const canUndo = () => !!last && last.size > 0;

/** Called before the plugin changes a node. Only the first call per operation is kept. */
export function touch(n: BaseNode) {
  if (!journal || journal.has(n.id) || n.type !== 'TEXT') return;
  const t = n as TextNode;
  journal.set(n.id, {
    chars: t.characters,
    key: t.getSharedPluginData(NS, 'key'),
    lang: t.getSharedPluginData(NS, 'lang'),
    fill: t.getSharedPluginData(NS, 'fill'),
    name: t.name,
    relaunch: !!t.getSharedPluginData(NS, 'key'),
  });
}

/** Restores the last operation. Returns how many layers were restored and the keys involved. */
export async function undoLast(setText: (n: TextNode, s: string) => Promise<string>): Promise<{ restored: number; keys: string[] }> {
  const snap = last;
  last = null;
  if (!snap) return { restored: 0, keys: [] };
  let restored = 0;
  const keys = new Set<string>();
  for (const [id, s] of snap) {
    const n = (await figma.getNodeByIdAsync(id)) as TextNode | null;
    if (!n || n.removed || n.type !== 'TEXT') continue;
    const cur = n.getSharedPluginData(NS, 'key');
    if (cur) keys.add(cur);
    if (s.key) keys.add(s.key);
    const r = await setText(n, s.chars);
    if (r !== 'ok' && r !== 'same') continue;
    try {
      n.setSharedPluginData(NS, 'key', s.key);
      n.setSharedPluginData(NS, 'lang', s.lang);
      n.setSharedPluginData(NS, 'fill', s.fill);
      n.setRelaunchData(s.key ? { key: s.key } : {});
      if (n.name !== s.name) n.name = s.name;
    } catch (_) { /* read-only node */ }
    restored++;
  }
  return { restored, keys: [...keys] };
}
