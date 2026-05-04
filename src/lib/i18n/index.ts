import { addMessages, init, register, getLocaleFromNavigator } from 'svelte-i18n';
import ja from './ja.json';
import en from './en.json';

export type Locale = 'ja' | 'en';
const SUPPORTED: Locale[] = ['ja', 'en'];

export function resolveLocale(opts: {
  urlLang: string | null;
  storedLang: string | null;
  browserLang: string | null;
}): Locale {
  for (const candidate of [opts.urlLang, opts.storedLang, opts.browserLang]) {
    const normalized = normalize(candidate);
    if (normalized) return normalized;
  }
  return 'ja';
}

function normalize(lang: string | null): Locale | null {
  if (!lang) return null;
  const head = lang.toLowerCase().split('-')[0];
  return (SUPPORTED as string[]).includes(head) ? (head as Locale) : null;
}

export function setupI18n(): void {
  addMessages('ja', ja);
  addMessages('en', en);
  // initial locale; +layout.svelte may override after mount
  init({ fallbackLocale: 'ja', initialLocale: 'ja' });
}

export function detectBrowserLocale(): string | null {
  if (typeof window === 'undefined') return null;
  return getLocaleFromNavigator();
}
