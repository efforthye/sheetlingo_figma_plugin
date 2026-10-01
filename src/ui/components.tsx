import { useState, type ReactNode } from 'react';
import { FREE } from '../shared/constants';
import type { Issue, Report, ReportSource } from '../shared/types';
import { send } from './bridge';
import type { MsgKey, T } from './i18n';

export const Logo = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#18c286"/><stop offset="1" stopColor="#0a7a54"/></linearGradient></defs><rect width="20" height="20" rx="5" fill="url(#lg)"/><rect x="3.2" y="3.2" width="11.8" height="12.6" rx="1.8" fill="#fff"/><path d="M3.2 9.5h11.8M9.1 3.2v12.6" stroke="#0f9d6b" strokeOpacity=".3" strokeWidth=".7" fill="none"/><path d="M4.66 8.1H5.35L5.59 7.23H6.69L6.93 8.1H7.64L6.55 4.69H5.75ZM5.73 6.7 5.83 6.32C5.94 5.97 6.03 5.58 6.12 5.21H6.14C6.24 5.57 6.34 5.97 6.44 6.32L6.54 6.7ZM12.79 4.49V8.47H13.37V6.49H13.92V6.02H13.37V4.49ZM10.42 4.91V5.37H11.72C11.62 6.25 11.13 6.88 10.21 7.36L10.53 7.79C11.85 7.12 12.31 6.1 12.31 4.91ZM7.22 11.94 6.7 11.82C6.69 11.88 6.67 11.99 6.66 12.08H6.58C6.37 12.08 6.15 12.11 5.94 12.15L5.97 11.76C6.5 11.74 7.07 11.69 7.5 11.61L7.49 11.11C7.02 11.23 6.55 11.28 6.03 11.3L6.07 11.07C6.09 11 6.11 10.92 6.13 10.84L5.57 10.83C5.58 10.9 5.57 11 5.57 11.08L5.54 11.32H5.37C5.11 11.32 4.73 11.28 4.58 11.26L4.59 11.75C4.79 11.76 5.13 11.78 5.35 11.78H5.49C5.47 11.96 5.46 12.14 5.45 12.32C4.85 12.61 4.39 13.18 4.39 13.74C4.39 14.17 4.66 14.36 4.97 14.36C5.2 14.36 5.43 14.29 5.64 14.19L5.69 14.36L6.19 14.21C6.15 14.11 6.12 14 6.09 13.9C6.42 13.62 6.76 13.17 6.99 12.59C7.29 12.7 7.44 12.93 7.44 13.19C7.44 13.61 7.1 14.03 6.27 14.12L6.56 14.58C7.62 14.42 7.97 13.83 7.97 13.22C7.97 12.72 7.64 12.33 7.14 12.16ZM6.52 12.52C6.37 12.86 6.18 13.12 5.97 13.33C5.94 13.12 5.92 12.89 5.92 12.62V12.61C6.09 12.56 6.29 12.52 6.52 12.52ZM5.53 13.69C5.37 13.78 5.22 13.84 5.1 13.84C4.96 13.84 4.9 13.76 4.9 13.62C4.9 13.38 5.11 13.05 5.44 12.83C5.44 13.13 5.48 13.43 5.53 13.69Z" fill="#0a7a54"/><g transform="translate(10.6 10.2) scale(.86)"><path d="M5 2.6c-.9-.6-2.2-.7-3.1 0C.8 3.5.6 5.2 1.1 6.6c.5 1.4 1.5 2.8 2.6 2.8.5 0 .8-.25 1.3-.25s.8.25 1.3.25c1.1 0 2.1-1.4 2.6-2.8.5-1.4.3-3.1-.8-4-.9-.7-2.2-.6-3.1 0z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round"/><path d="M5 2.6c-.9-.6-2.2-.7-3.1 0C.8 3.5.6 5.2 1.1 6.6c.5 1.4 1.5 2.8 2.6 2.8.5 0 .8-.25 1.3-.25s.8.25 1.3.25c1.1 0 2.1-1.4 2.6-2.8.5-1.4.3-3.1-.8-4-.9-.7-2.2-.6-3.1 0z" fill="#ff4d4f"/><path d="M2.2 4.4c.2-.8.8-1.2 1.4-1.3" stroke="#fff" strokeOpacity=".55" strokeWidth=".55" strokeLinecap="round" fill="none"/><path d="M5 2.7c0-.8.2-1.4.7-1.9" stroke="#6b3e1e" strokeWidth=".6" strokeLinecap="round" fill="none"/><path d="M5.4 1.6c.5-.9 1.5-1.2 2.4-1 -.3.9-1.2 1.4-2.4 1z" fill="#3ccf7f"/></g>
  </svg>
);

const paths: Record<string, string> = {
  refresh: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3',
  // Lucide "settings" (ISC) — 24×24 box, scaled below
  gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  // Lucide "infinity" (ISC) — 24×24 box
  infinity: 'M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z',
  back: 'M10 3.5 5.5 8l4.5 4.5',
  x: 'M4 4l8 8M12 4l-8 8',
  download: 'M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10',
  info: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 7.2v4M8 4.9v.01',
  minimize: 'M2.5 9.5h4v4M13.5 6.5h-4v-4M2.5 13.5 6.5 9.5M13.5 2.5 9.5 6.5',
  expand: 'M9.5 3.5h3v3M6.5 12.5h-3v-3M12.5 3.5 9 7M3.5 12.5 7 9',
  lock: 'M5 7V5.5a3 3 0 0 1 6 0V7M4 7h8v6H4z',
  check: 'M3.5 8.5 6.5 11.5 12.5 4.5',
  copy: 'M5.5 5.5V3.8c0-.7.6-1.3 1.3-1.3h5.4c.7 0 1.3.6 1.3 1.3v5.4c0 .7-.6 1.3-1.3 1.3h-1.7M3.8 5.5h5.4c.7 0 1.3.6 1.3 1.3v5.4c0 .7-.6 1.3-1.3 1.3H3.8c-.7 0-1.3-.6-1.3-1.3V6.8c0-.7.6-1.3 1.3-1.3z',
  link: 'M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1',
};
export const Icon = ({ name, size = 16, className }: { name: keyof typeof paths | string; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox={name === 'gear' || name === 'infinity' ? '0 0 24 24' : '0 0 16 16'} fill="none" stroke="currentColor"
    strokeWidth={name === 'gear' ? 2.1 : name === 'infinity' ? 2.4 : 1.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={paths[name]} />
  </svg>
);

export function copyText(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
}

/** Small icon button that copies `text` and briefly shows a check. */
export function CopyButton({ text, title }: { text: string; title?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="icon-btn sm" title={title} onClick={(e) => { e.stopPropagation(); copyText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      <Icon name={done ? 'check' : 'copy'} size={14} />
    </button>
  );
}

export function Seg<V extends string>({ value, options, onChange }: {
  value: V; onChange: (v: V) => void;
  options: { value: V; label: ReactNode; locked?: boolean }[];
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}{o.locked && <span className="pill">PRO</span>}
        </button>
      ))}
    </div>
  );
}

/** Where to download a font: known design-system fonts first, else Google Fonts search. */
function fontUrl(fontId: string): string {
  const family = fontId.replace(/\s+(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black|Italic|Heavy|Book)(\s+Italic)?$/i, '').trim();
  const known: Record<string, string> = {
    'wanted sans': 'https://github.com/wanteddev/wanted-sans/releases',
    pretendard: 'https://github.com/orioncactus/pretendard/releases',
    'pretendard variable': 'https://github.com/orioncactus/pretendard/releases',
    'sf pro': 'https://developer.apple.com/fonts/',
    'sf pro display': 'https://developer.apple.com/fonts/',
    'sf pro text': 'https://developer.apple.com/fonts/',
    'spoqa han sans neo': 'https://spoqa.github.io/spoqa-han-sans/',
    suit: 'https://sun.fo/suit/',
  };
  return known[family.toLowerCase()] ?? 'https://fonts.google.com/?query=' + encodeURIComponent(family);
}

function reasonText(r: string | undefined, t: T): string {
  if (!r) return '';
  const [kind, ...rest] = r.split(':');
  const detail = rest.join(':');
  if (kind === 'font') return t('reasonFont', { font: detail || '?' });
  if (kind === 'locked') return t('reasonLocked');
  return '';
}

function IssueList({ title, items, tone, t }: { title: string; items: Issue[]; tone: 'warn' | 'err' | 'soft'; t: T }) {
  if (!items?.length) return null;
  return (
    <details className={'issues ' + tone}>
      <summary>{title}<span className="cnt">{items.length}</span></summary>
      <ul>
        {items.slice(0, 200).map((i, idx) => (
          <li key={i.nodeId + idx} onClick={() => send({ type: 'focus', nodeId: i.nodeId })}>
            <span className="iname">{i.name}</span>{i.key && <code>{i.key}</code>}
            {reasonText(i.reason, t) && <em className="reason">{reasonText(i.reason, t)}
              {i.reason?.startsWith('font:') && (
                <button className="linkbtn" onClick={(e) => { e.stopPropagation(); send({ type: 'open-url', url: fontUrl(i.reason!.slice(5)) }); }}>{t('findFont')} ↗</button>
              )}
            </em>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ReportView({ report, source, t, pro, onUpgrade }: { report: Report; source: ReportSource; t: T; pro: boolean; onUpgrade: (reason?: MsgKey) => void }) {
  const isLink = source === 'bind' || source === 'unbind';
  if (source === 'sync' && report.total === 0 && !report.noMatch?.length && !report.ambiguous?.length) return <div className="note">{t('rNothing')}</div>;
  const heading = source === 'sync' ? t('repSync') : source === 'fill' ? t('repFill') : source === 'unbind' ? t('repUnbind') : t('repBind');
  return (
    <div className="report">
      <div className="small muted rep-title">{heading}</div>
      <div className="stats">
        <div className="stat"><b>{report.updated}</b><span>{isLink ? t(source === 'bind' ? 'rLinked' : 'rUnlinked') : t('rUpdated')}</span></div>
        <div className="stat"><b>{isLink ? report.failed.length : report.unchanged}</b><span>{isLink ? t('rFailed') : t('rUnchanged')}</span></div>
      </div>
      {report.linkedNew > 0 && <div className="note ok small">{t('rLinkedNew', { n: report.linkedNew })}</div>}
      <IssueList title={t('rMissing')} items={report.missing} tone="err" t={t} />
      <IssueList title={t('rNoMatch')} items={report.noMatch} tone="warn" t={t} />
      <IssueList title={t('rFallback')} items={report.fallback} tone="warn" t={t} />
      {!isLink && <IssueList title={t('rFailed')} items={report.failed} tone="err" t={t} />}
      {report.failed.some((i) => i.reason?.startsWith('font')) && <div className="note warn small">{t('fontTip')}</div>}
      <IssueList title={t('rOverflow')} items={report.overflow} tone="warn" t={t} />
      <IssueList title={t('rAmbiguous')} items={report.ambiguous} tone="warn" t={t} />
      {report.unmatched > 0 && source === 'fill' && <div className="note warn">{t('rUnmatched', { n: report.unmatched })}</div>}
      {report.limited > 0 && (
        <div className="note pro">{source === 'fill' ? t('rLimited', { n: report.limited }) : t('rLimitedKeys', { n: report.limited, max: FREE.maxKeys })}<button className="btn sm pro" onClick={() => onUpgrade(source === 'fill' ? 'upFill' : 'upKey')}>{t('unlock')}</button></div>
      )}
    </div>
  );
}

/** Calm, success-first result dialog: what got done on top, things worth a look below. */
export function ResultSheet({ t, source, report, lang, undoable, onUndo, onClose }: {
  t: T; source: ReportSource; report: Report; lang: string; undoable: boolean; onUndo: () => void; onClose: () => void;
}) {
  const r = report;
  const did = r.updated > 0 || r.linkedNew > 0;
  const title = source === 'fill' ? t('toastFilled', { n: r.updated })
    : source === 'bind' ? t('toastLinked', { n: r.updated })
    : source === 'unbind' ? t('toastUnlinked', { n: r.updated })
    : did ? t('doneTitle') : r.failed.length ? t('doneFailed') : t('doneNone');
  // Sync results read as a short list: what changed, what was already the same, what got linked
  const bullets = source === 'sync' ? [
    r.updated > 0 && t('bChanged', { n: r.updated, lang }),
    r.unchanged > 0 && t('bSame', { n: r.unchanged }),
    r.linkedNew > 0 && t('bLinked', { n: r.linkedNew }),
  ].filter(Boolean) as string[] : [];
  const fonts = r.failed.filter((i) => i.reason?.startsWith('font'));
  const locked = r.failed.filter((i) => !i.reason?.startsWith('font'));
  // Not applied at all (failures) vs applied but worth a look
  const failGroups: [string, Issue[]][] = [[t('failFont'), fonts], [t('failLocked'), locked], [t('chkMissing'), r.missing]];
  const checkGroups: [string, Issue[]][] = [[t('chkOverflow'), r.overflow], [t('chkFallback'), r.fallback], [t('chkAmbiguous'), r.ambiguous]];
  const nFail = failGroups.reduce((a, [, g]) => a + g.length, 0);
  const nCheck = checkGroups.reduce((a, [, g]) => a + g.length, 0);
  const fontNames = [...new Set(fonts.map((i) => (i.reason ?? '').replace(/^font:/, '')))].filter(Boolean).join(', ');
  return (
    <div className="sheet result-sheet" onClick={(e) => e.stopPropagation()}>
      <div className="result-head">
        {did
          ? <svg className="mark" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" /><path d="M12.5 20.5l5 5 10-11" /></svg>
          : <span className={'mark-info' + (nFail ? ' fail' : '')}><Icon name={nFail ? 'x' : 'info'} size={18} /></span>}
        <div className="grow">
          <b>{title}</b>
          {bullets.length > 0 ? (
            <ul className="result-bullets small">{bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          ) : <span className="small muted">{[
            r.unchanged > 0 && t('doneSame', { n: r.unchanged }),
            r.linkedNew > 0 && t('rLinkedNew', { n: r.linkedNew }),
          ].filter(Boolean).join(' · ')}</span>}
        </div>
      </div>
      {nFail > 0 && (
        <div className="result-check fail">
          <div className="small"><b>{t('failItems', { n: nFail })}</b></div>
          {failGroups.map(([title, items]) => <IssueList key={title} title={title} items={items} tone="err" t={t} />)}
          {fonts.length > 0 && <span className="small">{t('fontNeeded', { fonts: fontNames })}</span>}
        </div>
      )}
      {nCheck > 0 && (
        <div className="result-check">
          <div className="small muted">{t('checkItems', { n: nCheck })}</div>
          {checkGroups.map(([title, items]) => <IssueList key={title} title={title} items={items} tone="soft" t={t} />)}
        </div>
      )}
      {r.limited > 0 && <div className="note pro small">{t('rLimitedKeys', { n: r.limited, max: FREE.maxKeys })}</div>}
      <div className="row result-actions">
        {undoable && <button className="btn ghost sm" onClick={onUndo}>{t('undo')}</button>}
        <span className="sp" /><button className="btn primary sm" onClick={onClose}>{t('done')}</button>
      </div>
    </div>
  );
}
