<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { CdEntry } from '$lib/calculator/types';

  let {
    cd,
    index,
    onChange,
    onRemove
  }: {
    cd: CdEntry;
    index: number;
    onChange: (patch: Partial<CdEntry>) => void;
    onRemove: () => void;
  } = $props();

  let expanded = $state(false);

  let priceError = $derived(
    cd.price > 0 && Number.isInteger(cd.price) ? '' : $_('validation.positiveInt')
  );
  let constraintError = $derived(
    cd.maxQuantity !== undefined &&
      cd.minQuantity !== undefined &&
      cd.maxQuantity < cd.minQuantity
      ? $_('validation.maxLessThanMin')
      : ''
  );

  const placeholder = $derived($_('cd.defaultName').replace('{n}', String(index + 1)));
</script>

<div class="row">
  <div class="main">
    <input
      type="text"
      placeholder={placeholder}
      value={cd.name}
      oninput={(e) => onChange({ name: (e.currentTarget as HTMLInputElement).value })}
    />
    <input
      type="number"
      min="1"
      step="1"
      value={cd.price}
      oninput={(e) =>
        onChange({ price: parseInt((e.currentTarget as HTMLInputElement).value, 10) })}
    />
    <span class="suffix">{$_('cd.priceSuffix')}</span>
    <button type="button" class="remove" onclick={onRemove}>{$_('cd.remove')}</button>
  </div>
  <button type="button" class="toggle" onclick={() => (expanded = !expanded)}>
    {expanded ? '▾' : '▸'} {$_('cd.constraints')}
  </button>
  {#if expanded}
    <div class="constraints">
      <label>
        {$_('cd.minQuantity')}
        <input
          type="number"
          min="0"
          step="1"
          value={cd.minQuantity ?? ''}
          oninput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            onChange({ minQuantity: v === '' ? undefined : parseInt(v, 10) });
          }}
        />
      </label>
      <label>
        {$_('cd.maxQuantity')}
        <input
          type="number"
          min="0"
          step="1"
          value={cd.maxQuantity ?? ''}
          oninput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            onChange({ maxQuantity: v === '' ? undefined : parseInt(v, 10) });
          }}
        />
      </label>
    </div>
  {/if}
  {#if priceError}<p class="err">{priceError}</p>{/if}
  {#if constraintError}<p class="err">{constraintError}</p>{/if}
</div>

<style>
  .row {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .main input[type='text'] {
    flex: 2;
  }
  .main input[type='number'] {
    flex: 1;
    min-width: 5rem;
  }
  .toggle {
    background: none;
    border: none;
    font: inherit;
    color: #1d4ed8;
    cursor: pointer;
    padding: 0.25rem 0;
  }
  .constraints {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr 1fr;
  }
  .constraints label {
    display: flex;
    flex-direction: column;
    font-size: 0.875rem;
  }
  .remove {
    background: none;
    color: #b91c1c;
    border: none;
    cursor: pointer;
    font: inherit;
  }
  .err {
    color: #b91c1c;
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
  }
</style>
