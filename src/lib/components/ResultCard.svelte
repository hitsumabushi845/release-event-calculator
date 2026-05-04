<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import type { CdEntry, Solution } from '$lib/calculator/types';

  let { solution, cds }: { solution: Solution; cds: CdEntry[] } = $props();

  const labelKey = $derived(`result.labels.${solution.label}`);
  const fmt = $derived(
    new Intl.NumberFormat($locale === 'en' ? 'en-US' : 'ja-JP')
  );

  function nameOf(id: string): string {
    return cds.find((c) => c.id === id)?.name || id;
  }
</script>

<article class="card">
  <header>
    <h3>{$_(labelKey)}</h3>
    <span class="meta">
      {$_('result.totalCost', { values: { cost: fmt.format(solution.totalCost) } })}
      ／ {$_('result.totalCount', { values: { count: fmt.format(solution.totalCount) } })}
      ／ {$_('result.tickets', { values: { tickets: fmt.format(solution.ticketsObtained) } })}
    </span>
  </header>
  <ul>
    {#each solution.purchases.filter((p) => p.quantity > 0) as p (p.cdId)}
      <li>{nameOf(p.cdId)} × {p.quantity}</li>
    {/each}
  </ul>
</article>

<style>
  .card {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .meta {
    font-size: 0.875rem;
    color: #555;
  }
  ul {
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
  }
</style>
