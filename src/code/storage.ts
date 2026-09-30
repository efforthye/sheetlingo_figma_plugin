import { NS } from '../shared/constants';
import { DEFAULT_CONFIG, type DocConfig, type Table } from '../shared/types';

export function loadConfig(): DocConfig {
  try {
    const raw = figma.root.getSharedPluginData(NS, 'config');
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (_) { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(c: DocConfig) {
  figma.root.setSharedPluginData(NS, 'config', JSON.stringify(c));
}

function docId(): string {
  let id = figma.root.getSharedPluginData(NS, 'docId');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    figma.root.setSharedPluginData(NS, 'docId', id);
  }
  return id;
}

export async function loadTable(): Promise<Table | null> {
  const t = await figma.clientStorage.getAsync('table:' + docId());
  return t && Array.isArray(t.columns) ? (t as Table) : null;
}

export async function saveTable(t: Table) {
  await figma.clientStorage.setAsync('table:' + docId(), t);
}
