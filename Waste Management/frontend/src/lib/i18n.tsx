import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from '../locales/en';
import { hi } from '../locales/hi';
import { gu } from '../locales/gu';

/**
 * Lightweight i18n — no dependency, because the whole point of this platform is
 * that a municipality can run it for free.
 *
 * Hindi and Gujarati fall back to English key by key, so a missing translation
 * shows readable English rather than a raw key. In development the missing key
 * is logged once, which is how the gaps get found.
 */

export const LOCALES = {
  en: { label: 'English', native: 'English', intl: 'en-IN' },
  hi: { label: 'Hindi', native: 'हिन्दी', intl: 'hi-IN' },
  gu: { label: 'Gujarati', native: 'ગુજરાતી', intl: 'gu-IN' },
} as const;

export type Locale = keyof typeof LOCALES;
export const LOCALE_LIST = Object.keys(LOCALES) as Locale[];

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, hi, gu };
const STORAGE_KEY = 'ss_locale';

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && saved in LOCALES) return saved;
  } catch {
    /* private mode — fall through to the browser hint */
  }
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  if (nav === 'hi' || nav === 'gu') return nav;
  return 'en';
}

const missing = new Set<string>();

interface I18nValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** Translate a key, interpolating {placeholders}. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** BCP-47 tag for Intl formatting. */
  intl: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Signing in can adopt the language stored on the account (see auth.tsx).
  useEffect(() => {
    const onChanged = (event: Event) => {
      const next = (event as CustomEvent<{ locale: Locale }>).detail?.locale;
      if (next && next in LOCALES) setLocaleState(next);
    };
    window.addEventListener('ss:locale-changed', onChanged);
    return () => window.removeEventListener('ss:locale-changed', onChanged);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* not fatal — the choice just will not survive a reload */
    }
    // Let non-React listeners (e.g. the citizen profile sync) react too.
    window.dispatchEvent(new CustomEvent('ss:locale-changed', { detail: { locale: next } }));
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = DICTIONARIES[locale];
      let value = dict[key] ?? en[key];

      if (value === undefined) {
        if (import.meta.env.DEV && !missing.has(key)) {
          missing.add(key);
          console.warn(`[i18n] missing key: ${key}`);
        }
        // Last resort: show the final segment rather than the whole path.
        return key.split('.').pop() ?? key;
      }

      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
        }
      }
      return value;
    },
    [locale]
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t, intl: LOCALES[locale].intl }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside an I18nProvider');
  return ctx;
}

/** Shorthand for the common case. */
export function useT() {
  return useI18n().t;
}

/** Read the active locale outside React (formatters, Intl helpers). */
export function currentIntlLocale(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && saved in LOCALES) return LOCALES[saved].intl;
  } catch {
    /* ignore */
  }
  return 'en-IN';
}
