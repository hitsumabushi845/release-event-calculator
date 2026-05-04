<script lang="ts">
  import { onMount } from 'svelte';
  import { locale } from 'svelte-i18n';
  import { setupI18n, resolveLocale, detectBrowserLocale } from '$lib/i18n';
  import { initGa } from '$lib/analytics/ga';

  setupI18n();

  let { children } = $props();

  onMount(() => {
    const url = new URL(window.location.href);
    const urlLang = url.searchParams.get('lang');
    const stored = localStorage.getItem('lang');
    const browser = detectBrowserLocale();
    const resolved = resolveLocale({
      urlLang,
      storedLang: stored,
      browserLang: browser
    });
    locale.set(resolved);
    initGa();
  });
</script>

<main>
  {@render children()}
</main>

<style>
  :global(body) {
    margin: 0;
    background: #fafafa;
    color: #111;
    font-family:
      system-ui,
      -apple-system,
      'Hiragino Kaku Gothic ProN',
      'Yu Gothic',
      sans-serif;
    font-size: 16px;
  }
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>
