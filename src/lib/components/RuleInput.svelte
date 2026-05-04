<script lang="ts">
  import { _ } from 'svelte-i18n';

  let { unit, target, onUnitChange, onTargetChange }: {
    unit: number;
    target: number;
    onUnitChange: (v: number) => void;
    onTargetChange: (v: number) => void;
  } = $props();

  let unitError = $derived(unit > 0 && Number.isInteger(unit) ? '' : $_('validation.positiveInt'));
  let targetError = $derived(target > 0 && Number.isInteger(target) ? '' : $_('validation.positiveInt'));
</script>

<section class="rule">
  <h2>{$_('rule.section')}</h2>
  <label>
    <span>{$_('rule.unitPrice')}</span>
    <input
      type="number"
      min="1"
      step="1"
      value={unit}
      oninput={(e) => onUnitChange(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
    />
    <span class="suffix">{$_('rule.unitPriceSuffix')}</span>
  </label>
  {#if unitError}<p class="err">{unitError}</p>{/if}

  <label>
    <span>{$_('rule.targetTickets')}</span>
    <input
      type="number"
      min="1"
      step="1"
      value={target}
      oninput={(e) => onTargetChange(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
    />
    <span class="suffix">{$_('rule.targetTicketsSuffix')}</span>
  </label>
  {#if targetError}<p class="err">{targetError}</p>{/if}
</section>

<style>
  .rule {
    display: grid;
    gap: 0.5rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem;
    font: inherit;
  }
  .err {
    color: #b91c1c;
    margin: 0;
    font-size: 0.875rem;
  }
</style>
