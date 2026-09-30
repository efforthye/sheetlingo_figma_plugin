import de from './locales/de';
import en, { type Messages } from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import ja from './locales/ja';
import ko from './locales/ko';
import zhCN from './locales/zh-CN';

/**
 * UI languages. To add one: create locales/<code>.ts (typed as Messages),
 * import it here and add it to LOCALES. Missing strings fall back to English.
 */
export const LOCALES = {
  en: { name: 'English', messages: en },
  ko: { name: '한국어', messages: ko },
  ja: { name: '日本語', messages: ja },
  'zh-CN': { name: '简体中文', messages: zhCN },
  es: { name: 'Español', messages: es },
  fr: { name: 'Français', messages: fr },
  de: { name: 'Deutsch', messages: de },
} satisfies Record<string, { name: string; messages: Partial<Messages> }>;

export type Locale = keyof typeof LOCALES;
export type MsgKey = keyof Messages;
export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (s: unknown): s is Locale => typeof s === 'string' && s in LOCALES;

export function makeT(locale: Locale) {
  const dict: Partial<Messages> = LOCALES[locale].messages;
  return (k: MsgKey, vars?: Record<string, string | number>) => {
    let s: string = dict[k] ?? en[k];
    if (vars) for (const v in vars) s = s.split('{' + v + '}').join(String(vars[v]));
    return s;
  };
}
export type T = ReturnType<typeof makeT>;
