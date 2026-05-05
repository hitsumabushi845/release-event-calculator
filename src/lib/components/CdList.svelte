<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { CdEntry } from '$lib/calculator/types';
  import CdRow from './CdRow.svelte';

  let {
    cds,
    onAdd,
    onRemove,
    onChange
  }: {
    cds: CdEntry[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    onChange: (id: string, patch: Partial<CdEntry>) => void;
  } = $props();
</script>

<section class="cd-list">
  <h2>{$_('cd.section')}</h2>
  {#each cds as cd, i (cd.id)}
    <CdRow
      {cd}
      index={i}
      onChange={(patch) => onChange(cd.id, patch)}
      onRemove={() => onRemove(cd.id)}
    />
  {/each}
  <button type="button" class="add" onclick={onAdd}>{$_('cd.add')}</button>
</section>

<style>
  .cd-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.25rem;
  }
  .add {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: #1d4ed8;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
  }
</style>
