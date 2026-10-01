import { useState, type ReactNode } from 'react';
import { FREE } from '../shared/constants';
import type { Issue, Report, ReportSource } from '../shared/types';
import { send } from './bridge';
import type { MsgKey, T } from './i18n';

export const Logo = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14b87e" /><stop offset="1" stopColor="#0b7f58" /></linearGradient></defs>
    <rect width="20" height="20" rx="5" fill="url(#lg)" />
    <path d="M5 6.5h10M5 10h10M5 13.5h5.5M8.5 5v10" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="14" cy="13.8" r="2.4" fill="#fff" />
  </svg>
);

const paths: Record<string, string> = {
  refresh: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3',
  // Lucide "settings" (ISC) — 24×24 box, scaled below
  gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  back: 'M10 3.5 5.5 8l4.5 4.5',
  x: 'M4 4l8 8M12 4l-8 8',
  info: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 7.2v4M8 4.9v.01',
  minimize: 'M2.5 9.5h4v4M13.5 6.5h-4v-4M2.5 13.5 6.5 9.5M13.5 2.5 9.5 6.5',
  expand: 'M9.5 3.5h3v3M6.5 12.5h-3v-3M12.5 3.5 9 7M3.5 12.5 7 9',
  lock: 'M5 7V5.5a3 3 0 0 1 6 0V7M4 7h8v6H4z',
  check: 'M3.5 8.5 6.5 11.5 12.5 4.5',
  copy: 'M5.5 5.5V3.8c0-.7.6-1.3 1.3-1.3h5.4c.7 0 1.3.6 1.3 1.3v5.4c0 .7-.6 1.3-1.3 1.3h-1.7M3.8 5.5h5.4c.7 0 1.3.6 1.3 1.3v5.4c0 .7-.6 1.3-1.3 1.3H3.8c-.7 0-1.3-.6-1.3-1.3V6.8c0-.7.6-1.3 1.3-1.3z',
  link: 'M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1',
};
export const Icon = ({ name, size = 16, className }: { name: keyof typeof paths | string; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox={name === 'gear' ? '0 0 24 24' : '0 0 16 16'} fill="none" stroke="currentColor"
    strokeWidth={name === 'gear' ? 2.1 : 1.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
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

function IssueList({ title, items, tone, t }: { title: string; items: Issue[]; tone: 'warn' | 'err'; t: T }) {
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
