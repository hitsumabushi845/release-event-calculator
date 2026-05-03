import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Empty base by default (dev, preview, local Playwright). The deploy
// workflow sets BASE_PATH=/release-event-calculator for GitHub Pages.
const base = process.env.BASE_PATH ?? '';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      strict: true
    }),
    paths: { base },
    prerender: { entries: ['*'] }
  }
};
