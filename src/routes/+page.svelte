<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { _, locale } from 'svelte-i18n';
  import { calculate } from '$lib/calculator';
  import type { CalculationResult } from '$lib/calculator/types';
  import { encodeState, decodeState } from '$lib/url/state';
  import { createInputState } from '$lib/stores/input.svelte';
  import { trackEvent } from '$lib/analytics/ga';
  import RuleInput from '$lib/components/RuleInput.svelte';
  import CdList from '$lib/components/CdList.svelte';
  import ResultCard from '$lib/components/ResultCard.svelte';
  import LangSwitcher from '$lib/components/LangSwitcher.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';

  const input = createInputState();
  let result = $state<CalculationResult>({ ok: false, reason: 'empty' });
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    const url = new URL(window.location.href);
    const s = url.searchParams.get('s');
    if (s) {
      const restored = decodeState(s);
      if (restored) input.replaceAll(restored);
    }
    runCalculate();
  });

  $effect(() => {
    // Reactive trigger; read deeply
    JSON.stringify(input.value);
    untrack(() => scheduleCalculate());
  });

  function scheduleCalculate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runCalculate();
      syncUrl();
    }, 200);
  }

  function runCalculate() {
    const r = calculate(input.value);
    result = r;
    if (r.ok) {
      trackEvent('calculate', {
        candidates: r.solutions.length,
        cdTypes: input.value.cds.length,
        target: input.value.targetTickets
      });
    }
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('s', encodeState(input.value));
    if ($locale) url.searchParams.set('lang', $locale);
    history.replaceState({}, '', url.toString());
  }

  function handleLangChange(lang: 'ja' | 'en') {
    localStorage.setItem('lang', lang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    history.replaceState({}, '', url.toString());
    trackEvent('lang_switch', { to: lang });
  }

  function handleShare() {
    syncUrl();
    trackEvent('share');
  }

  const errorKey = $derived(
    !result.ok && result.reason !== 'empty'
      ? `result.errors.${result.reason === 'too-large' ? 'tooLarge' : result.reason}`
      : null
  );
</script>

<header class="page-header">
  <h1>{$_('header.title')}</h1>
  <div class="actions">
    <LangSwitcher onChange={handleLangChange} />
    <ShareButton onShare={handleShare} />
  </div>
</header>

<RuleInput
  unit={input.value.ticketUnitPrice}
  target={input.value.targetTickets}
  onUnitChange={(v) => input.setUnit(v)}
  onTargetChange={(v) => input.setTarget(v)}
/>

<CdList
  cds={input.value.cds}
  onAdd={() => input.addCd()}
  onRemove={(id) => input.removeCd(id)}
  onChange={(id, patch) => input.updateCd(id, patch)}
/>

<section class="result">
  <h2>{$_('result.section')}</h2>
  {#if !result.ok && result.reason === 'empty'}
    <p class="empty">{$_('result.empty')}</p>
  {:else if errorKey}
    <p class="err">{$_(errorKey)}</p>
  {:else if result.ok}
    {#each result.solutions as solution (solution.label)}
      <ResultCard {solution} cds={input.value.cds} />
    {/each}
  {/if}
</section>

<style>
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .page-header h1 {
    font-size: 1.25rem;
    margin: 0;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  section {
    margin-bottom: 1.5rem;
  }
  .empty,
  .err {
    color: #555;
  }
  .err {
    color: #b91c1c;
  }
</style>
