<script lang="ts">
  import { _ } from 'svelte-i18n';

  let { onShare }: { onShare: () => void } = $props();
  let toast = $state<string | null>(null);

  async function handleClick() {
    onShare();
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast = $_('header.shareCopied');
      setTimeout(() => (toast = null), 2000);
    } catch (err) {
      console.warn('clipboard failed', err);
    }
  }
</script>

<button type="button" class="share" onclick={handleClick}>{$_('header.share')}</button>
{#if toast}
  <div class="toast" role="status">{toast}</div>
{/if}

<style>
  .share {
    padding: 0.25rem 0.75rem;
    background: white;
    border: 1px solid #1d4ed8;
    color: #1d4ed8;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
  }
  .toast {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    z-index: 1000;
  }
</style>
