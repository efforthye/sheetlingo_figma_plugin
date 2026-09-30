/** same = texts linked to the same key as the selected text, or with exactly the same text (current page). */
export type Scope = 'same' | 'selection' | 'page' | 'document';
export interface SameRef {
  key: string;
  text: string;
  /** Explicit link action: identical-wording texts linked to another key are re-linked too. */
  relink?: boolean;
  /** The text layer this came from (remembered base). */
  nodeId?: string;
}
export type Tier = 'free' | 'trial' | 'pro';

/** A parsed sheet: header row + data rows (all strings). */
export interface Table {
  columns: string[];
  rows: string[][];
  /** Original rows before picking the header row (lets the user change it later). */
  raw?: string[][];
}

export interface SourceMeta {
  /** google = public link (CSV export) · google-api = signed-in Google Sheets API */
  kind: 'google' | 'google-api' | 'file' | 'paste';
  label: string;
  url?: string;
  fileId?: string;
  sheetId?: number;
  sheetTitle?: string;
  fetchedAt: number;
  rowCount: number;
}

export interface Mapping {
  /** 0-based index (in the raw sheet) of the row holding column names. */
  headerRow?: number;
  keyColumn: string;
  languages: string[];
  baseLang: string;
}

export interface DocConfig {
  source?: SourceMeta;
  mapping?: Mapping;
  currentLang?: string;
  renameOnBind: boolean;
  autoSync: boolean;
  /** Remove markup like <b>…</b> or <support>…</support> from sheet values before applying. */
  stripTags?: boolean;
  /** When applying, link unlinked text layers whose text matches a sheet value. */
  autoLinkOnApply?: boolean;
  /** Editing a linked text so it no longer matches its key removes the link. */
  unlinkOnEdit?: boolean;
}

/** Per-user Google sign-in (stored in figma.clientStorage, never in the document). */
export interface GoogleAuth {
  email: string;
  accessToken: string;
  expiresAt: number;
  refresh: string | null; // encrypted by the auth server
}

export const DEFAULT_CONFIG: DocConfig = { renameOnBind: true, autoSync: false, stripTags: true };

export interface PlanInfo {
  tier: Tier;
  trialDaysLeft: number;
}

export interface SelectionInfo {
  total: number;
  textCount: number;
  keyedCount: number;
  keys: string[];
  containerCount: number;
  cardFields: string[];
  /** Text of the first selected text layer (for key suggestions). */
  firstText: string;
  /** Linked text layers inside selected frames/groups (capped). */
  inside: { nodeId: string; key: string; text: string }[];
  insideCount: number;
  /** Ids of the selected nodes — changes whenever the selection changes. */
  sig: string;
}

export interface TargetItem { id: string; text: string; where: string; key: string }
export interface ScopeInfo { scope: Scope; names: string[]; linked: number; unlinked: number; items: TargetItem[] }

export interface Issue {
  nodeId: string;
  name: string;
  key?: string;
  reason?: string;
}

export interface Report {
  updated: number;
  unchanged: number;
  total: number;
  missing: Issue[];
  fallback: Issue[];
  failed: Issue[];
  overflow: Issue[];
  ambiguous: Issue[];
  /** Unlinked layers that were linked automatically while applying. */
  linkedNew: number;
  /** Unlinked layers with no matching key. */
  noMatch: Issue[];
  unmatched: number;
  limited: number;
  overflowChecked: boolean;
}

export type UiToCode =
  | { type: 'ui-ready' }
  | { type: 'save-config'; config: DocConfig }
  | { type: 'cache-table'; table: Table }
  | { type: 'sync'; table: Table; mapping: Mapping; lang: string; scope: Scope; silent?: boolean; stripTags?: boolean; autoLink?: boolean; same?: SameRef; ids?: string[] }
  | { type: 'fill-text'; table: Table; column: string; startRow: number }
  | { type: 'fill-cards'; table: Table; startRow: number; overrides: Record<string, string> }
  | { type: 'bind'; key: string; value?: string; ids?: string[]; sync?: { table: Table; mapping: Mapping; lang: string; scope: Scope; stripTags?: boolean; same?: SameRef } }
  | { type: 'unbind'; ids?: string[] }
  | { type: 'auto-link'; table: Table; mapping: Mapping; scope: Scope }
  | { type: 'export'; scope: Scope; generateKeys: boolean; baseLang: string }
  | { type: 'focus'; nodeId: string; zoom?: boolean }
  | { type: 'upgrade' }
  | { type: 'dev-set-tier'; tier: Tier | null }
  | { type: 'set-ui-locale'; locale: string }
  | { type: 'notify'; message: string }
  | { type: 'open-url'; url: string }
  | { type: 'auth-save'; auth: GoogleAuth | null }
  | { type: 'resize'; width: number; height: number }
  | { type: 'select-next-unlinked'; dir?: 1 | -1 }
  | { type: 'expand' }
  | { type: 'mini' }
  | { type: 'recount-keys' }
  | { type: 'scope-info'; scope: Scope; same?: SameRef }
  | { type: 'close' };

export type ReportSource = 'sync' | 'fill' | 'bind' | 'unbind';

export type CodeToUi =
  | {
      type: 'init';
      config: DocConfig;
      plan: PlanInfo;
      selection: SelectionInfo;
      table: Table | null;
      command: string;
      locale: string | null;
      auth: GoogleAuth | null;
    }
  | { type: 'selection'; selection: SelectionInfo }
  | { type: 'plan'; plan: PlanInfo }
  | { type: 'report'; source: ReportSource; report: Report; silent?: boolean }
  | { type: 'export-result'; csv: string; rows: number; generated: number }
  | { type: 'next-result'; remaining: number; index?: number }
  | { type: 'usage'; linkedKeys: number }
  | { type: 'auto-unlinked'; name: string; key: string }
  | { type: 'scope-info'; info: ScopeInfo }
  | { type: 'error'; message: string };

export function emptyReport(): Report {
  return {
    updated: 0, unchanged: 0, total: 0,
    missing: [], fallback: [], failed: [], overflow: [], ambiguous: [], linkedNew: 0, noMatch: [],
    unmatched: 0, limited: 0, overflowChecked: false,
  };
}
