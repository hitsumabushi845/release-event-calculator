import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveLocale } from './index';

describe('resolveLocale', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers URL lang param', () => {
    expect(resolveLocale({ urlLang: 'en', storedLang: 'ja', browserLang: 'ja' })).toBe('en');
  });

  it('falls back to stored lang when URL absent', () => {
    expect(resolveLocale({ urlLang: null, storedLang: 'en', browserLang: 'ja' })).toBe('en');
  });

  it('falls back to browser lang when URL and storage absent', () => {
    expect(resolveLocale({ urlLang: null, storedLang: null, browserLang: 'en-US' })).toBe('en');
  });

  it('defaults to ja when nothing matches', () => {
    expect(resolveLocale({ urlLang: null, storedLang: null, browserLang: 'fr' })).toBe('ja');
  });

  it('rejects invalid URL lang and falls through', () => {
    expect(resolveLocale({ urlLang: 'xx', storedLang: 'en', browserLang: 'ja' })).toBe('en');
  });
});
