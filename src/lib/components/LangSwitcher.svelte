<script lang="ts">
  import { locale } from 'svelte-i18n';

  let { onChange }: { onChange: (lang: 'ja' | 'en') => void } = $props();

  function set(lang: 'ja' | 'en') {
    locale.set(lang);
    onChange(lang);
  }

  const current = $derived(($locale ?? 'ja').split('-')[0]);
</script>

<div class="switcher" role="group">
  <button
    type="button"
    class:active={current === 'ja'}
    onclick={() => set('ja')}
    aria-pressed={current === 'ja'}>JP</button
  >
  <button
    type="button"
    class:active={current === 'en'}
    onclick={() => set('en')}
    aria-pressed={current === 'en'}>EN</button
  >
</div>

<style>
  .switcher {
    display: inline-flex;
    border: 1px solid #ccc;
    border-radius: 4px;
    overflow: hidden;
  }
  button {
    border: none;
    background: white;
    padding: 0.25rem 0.5rem;
    font: inherit;
    cursor: pointer;
  }
  button.active {
    background: #1d4ed8;
    color: white;
  }
</style>
