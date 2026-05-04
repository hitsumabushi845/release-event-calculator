// Ensure localStorage is properly available in Node 25+
// Node 25 exposes a native localStorage global, but without --localstorage-file
// it lacks a working .clear() method, so we override with a simple in-memory map.
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (index: number) => Object.keys(store)[index] ?? null
    }
  });
}
