import { touch } from './undo';
const loaded = new Set<string>();

/** Texts the plugin itself is writing (so the edit watcher can tell them apart from user edits). */
export const pluginWrites = new Map<string, string>();

export type SetResult = 'ok' | 'same' | 'font' | 'locked';

const missing = new Set<string>();
/** Forget fonts that failed earlier (the user may have installed them since). */
export const resetMissingFonts = () => missing.clear();
let lastDetail = '';

/** "font:Wanted Sans/Bold" or "locked:<message>" — for the report. */
export const failTag = (r: SetResult) => r + (lastDetail ? ':' + lastDetail : '');

/** Remembers the wording the plugin last put (or confirmed) on a linked text, so any later hand edit is detectable. */
export function markSynced(node: TextNode) {
  try { if (node.getSharedPluginData('sheetlingo', 'key')) node.setSharedPluginData('sheetlingo', 'txt', node.characters); } catch (_) { /* read-only */ }
}

export async function setText(node: TextNode, text: string): Promise<SetResult> {
  lastDetail = '';
  if (node.characters === text) { markSynced(node); return 'same'; }
  const len = node.characters.length;
  let fonts: FontName[] = [];
  try {
    fonts = len > 0 ? node.getRangeAllFontNames(0, len) : node.fontName !== figma.mixed ? [node.fontName] : [];
  } catch (_) { /* ignore */ }
  for (const f of fonts) {
    const id = f.family + ' ' + f.style;
    if (loaded.has(id)) continue;
    if (missing.has(id)) { lastDetail = id; return 'font'; }
    try { await figma.loadFontAsync(f); loaded.add(id); }
    catch (_) { missing.add(id); lastDetail = id; return 'font'; }
  }
  try {
    touch(node);
    pluginWrites.set(node.id, text);
    node.characters = text;
    markSynced(node);
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/font/i.test(msg)) { lastDetail = fonts.map((f) => f.family + ' ' + f.style).join(', '); return 'font'; }
    lastDetail = msg.slice(0, 120);
    return 'locked';
  }
}

/** True when the text visibly spills out of its box or its clipping parent. */
export function isOverflowing(node: TextNode): boolean {
  const b = node.absoluteBoundingBox;
  const r = node.absoluteRenderBounds;
  if (!b) return false;
  if (r && node.textAutoResize !== 'WIDTH_AND_HEIGHT' && (r.height > b.height + 2 || r.width > b.width + 2)) return true;
  let p: BaseNode | null = node.parent;
  while (p && p.type !== 'PAGE' && p.type !== 'DOCUMENT') {
    if ((p.type === 'FRAME' || p.type === 'COMPONENT' || p.type === 'INSTANCE') && p.clipsContent) {
      const pb = p.absoluteBoundingBox;
      if (pb && (b.x < pb.x - 1 || b.y < pb.y - 1 || b.x + b.width > pb.x + pb.width + 1 || b.y + b.height > pb.y + pb.height + 1)) return true;
      break;
    }
    p = p.parent;
  }
  return false;
}
