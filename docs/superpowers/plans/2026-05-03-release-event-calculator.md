# Release Event Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static SvelteKit web app that computes optimal CD purchase combinations to obtain a target number of release-event bonus tickets, presents Pareto-optimal candidates, supports JP/EN, URL state sharing, and GA4 analytics.

**Architecture:** SvelteKit + adapter-static produces a fully prerendered SPA. Pure-TS calculator in `src/lib/calculator/` is UI-independent and unit-tested. URL query string carries shareable state. svelte-i18n drives JP/EN. GitHub Actions deploys to GitHub Pages.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), Vite, Vitest, @testing-library/svelte, Playwright, svelte-i18n, GitHub Actions, GitHub Pages, GA4.

**Reference spec:** `docs/superpowers/specs/2026-05-03-release-event-calculator-design.md`

---

## File Structure

```
.github/workflows/
  ci.yml              # type-check + tests on push/PR
  deploy.yml          # GitHub Pages deploy on main
src/
├── app.html          # HTML shell, GA4 snippet
├── app.d.ts          # SvelteKit ambient types
├── lib/
│   ├── calculator/
│   │   ├── types.ts          # CalculatorInput, CdEntry, Solution, CalculationResult
│   │   ├── feasibility.ts    # feasibility predicate
│   │   ├── pareto.ts         # bounded knapsack DP, Pareto front, candidate selection
│   │   ├── calculate.ts      # top-level calculate() entry point
│   │   └── *.test.ts         # collocated unit tests
│   ├── i18n/
│   │   ├── index.ts          # init + locale resolution
│   │   ├── ja.json
│   │   └── en.json
│   ├── url/
│   │   ├── state.ts          # encode/decode input ↔ URL
│   │   └── state.test.ts
│   ├── analytics/
│   │   └── ga.ts             # gtag wrapper, conditional on PUBLIC_GA_MEASUREMENT_ID
│   └── components/
│       ├── RuleInput.svelte
│       ├── CdRow.svelte
│       ├── CdList.svelte
│       ├── ResultCard.svelte
│       ├── LangSwitcher.svelte
│       └── ShareButton.svelte
├── routes/
│   ├── +layout.svelte        # header, i18n init
│   ├── +layout.ts            # prerender flag, locale load
│   └── +page.svelte          # main composition
└── tests/e2e/
    ├── calculate.spec.ts
    └── share.spec.ts
package.json
tsconfig.json
svelte.config.js
vite.config.ts
playwright.config.ts
.env.example
README.md
```

---

## Task 1: Bootstrap SvelteKit project

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `.env.example`, `src/app.html`, `src/app.d.ts`, `src/routes/+layout.ts`, `src/routes/+page.svelte`

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "release-event-calculator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "prettier --check ."
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.0",
    "@sveltejs/kit": "^2.5.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@testing-library/svelte": "^5.2.0",
    "@types/node": "^22.0.0",
    "jsdom": "^25.0.0",
    "prettier": "^3.3.0",
    "prettier-plugin-svelte": "^3.2.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "@playwright/test": "^1.48.0"
  },
  "dependencies": {
    "svelte-i18n": "^4.0.0",
    "nanoid": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create svelte.config.js**

```javascript
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
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: true
  }
});
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 5: Create app.html**

`src/app.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Release Event Calculator</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 6: Create app.d.ts**

`src/app.d.ts`:

```typescript
declare global {
  namespace App {}
}
export {};
```

- [ ] **Step 7: Create minimal route files**

`src/routes/+layout.ts`:

```typescript
export const prerender = true;
export const ssr = true;
```

`src/routes/+page.svelte`:

```svelte
<h1>Release Event Calculator</h1>
```

- [ ] **Step 8: Create .env.example**

```
PUBLIC_GA_MEASUREMENT_ID=
```

- [ ] **Step 9: Install and verify build**

```bash
npm install
npm run check
npm run build
```

Expected: build succeeds, output in `build/`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: bootstrap SvelteKit static project"
```

---

## Task 2: Configure Vitest, Prettier, Playwright

**Files:**
- Create: `playwright.config.ts`, `.prettierrc`, `.prettierignore`

- [ ] **Step 1: Add Playwright config**

`playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI
  },
  testDir: 'src/tests/e2e',
  use: { baseURL: 'http://localhost:4173' }
});
```

- [ ] **Step 2: Add Prettier config**

`.prettierrc`:

```json
{
  "useTabs": false,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

`.prettierignore`:

```
build
.svelte-kit
node_modules
package-lock.json
```

- [ ] **Step 3: Add a smoke test to verify Vitest works**

`src/lib/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests to verify**

```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 5: Remove smoke test**

```bash
rm src/lib/smoke.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure Vitest, Prettier, Playwright"
```

---

## Task 3: Define calculator types

**Files:**
- Create: `src/lib/calculator/types.ts`

- [ ] **Step 1: Write the types module**

`src/lib/calculator/types.ts`:

```typescript
export type CdEntry = {
  id: string;
  name: string;
  price: number;
  minQuantity?: number;
  maxQuantity?: number;
};

export type CalculatorInput = {
  ticketUnitPrice: number;
  targetTickets: number;
  cds: CdEntry[];
};

export type Purchase = {
  cdId: string;
  quantity: number;
};

export type SolutionLabel = 'cheapest' | 'fewest' | 'balanced';

export type Solution = {
  purchases: Purchase[];
  totalCost: number;
  totalCount: number;
  ticketsObtained: number;
  label: SolutionLabel;
};

export type FailureReason = 'empty' | 'invalid' | 'infeasible' | 'too-large';

export type CalculationResult =
  | { ok: true; solutions: Solution[] }
  | { ok: false; reason: FailureReason };

export const DP_OPERATION_LIMIT = 1_000_000;
```

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calculator/types.ts
git commit -m "feat(calculator): define types"
```

---

## Task 4: Feasibility predicate (TDD)

Determines whether the calculation is feasible given input shape. Empty/invalid/infeasible cases short-circuit the DP.

**Files:**
- Create: `src/lib/calculator/feasibility.ts`, `src/lib/calculator/feasibility.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/calculator/feasibility.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkInput } from './feasibility';
import type { CalculatorInput } from './types';

const baseCd = (over: Partial<{ id: string; price: number; min: number; max: number }> = {}) => ({
  id: over.id ?? 'a',
  name: 'A',
  price: over.price ?? 1500,
  minQuantity: over.min,
  maxQuantity: over.max
});

describe('checkInput', () => {
  it('rejects when no CDs', () => {
    const input: CalculatorInput = { ticketUnitPrice: 1000, targetTickets: 10, cds: [] };
    expect(checkInput(input)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects non-positive ticketUnitPrice', () => {
    const input: CalculatorInput = { ticketUnitPrice: 0, targetTickets: 10, cds: [baseCd()] };
    expect(checkInput(input)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects non-positive targetTickets', () => {
    const input: CalculatorInput = { ticketUnitPrice: 1000, targetTickets: 0, cds: [baseCd()] };
    expect(checkInput(input)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects non-positive price', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [baseCd({ price: 0 })]
    };
    expect(checkInput(input)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects when maxQuantity < minQuantity', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [baseCd({ min: 5, max: 3 })]
    };
    expect(checkInput(input)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects infeasible when all CDs have a max and total max cost < target cost', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [baseCd({ price: 500, max: 5 })]
    };
    expect(checkInput(input)).toEqual({ ok: false, reason: 'infeasible' });
  });

  it('passes when at least one CD is unbounded', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [baseCd({ price: 500 })]
    };
    expect(checkInput(input)).toEqual({ ok: true });
  });

  it('passes when bounded CDs collectively exceed target cost', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [baseCd({ price: 1000, max: 20 })]
    };
    expect(checkInput(input)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- feasibility
```

Expected: FAIL with "Cannot find module './feasibility'".

- [ ] **Step 3: Implement feasibility.ts**

```typescript
import type { CalculatorInput, FailureReason } from './types';

type CheckResult = { ok: true } | { ok: false; reason: FailureReason };

export function checkInput(input: CalculatorInput): CheckResult {
  if (input.cds.length === 0) return { ok: false, reason: 'empty' };
  if (!isPositiveInt(input.ticketUnitPrice)) return { ok: false, reason: 'invalid' };
  if (!isPositiveInt(input.targetTickets)) return { ok: false, reason: 'invalid' };

  for (const cd of input.cds) {
    if (!isPositiveInt(cd.price)) return { ok: false, reason: 'invalid' };
    const min = cd.minQuantity ?? 0;
    const max = cd.maxQuantity;
    if (!Number.isInteger(min) || min < 0) return { ok: false, reason: 'invalid' };
    if (max !== undefined && (!Number.isInteger(max) || max < min)) {
      return { ok: false, reason: 'invalid' };
    }
  }

  const targetCost = input.targetTickets * input.ticketUnitPrice;
  const hasUnbounded = input.cds.some((c) => c.maxQuantity === undefined);
  if (!hasUnbounded) {
    const maxAchievable = input.cds.reduce(
      (acc, c) => acc + c.price * (c.maxQuantity as number),
      0
    );
    if (maxAchievable < targetCost) return { ok: false, reason: 'infeasible' };
  }

  return { ok: true };
}

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- feasibility
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculator/feasibility.ts src/lib/calculator/feasibility.test.ts
git commit -m "feat(calculator): feasibility predicate"
```

---

## Task 5: Bounded knapsack DP and Pareto front (TDD)

Computes the DP table over additional cost (after applying `minQuantity` floors) and extracts Pareto-optimal `(cost, count)` candidates.

**Files:**
- Create: `src/lib/calculator/pareto.ts`, `src/lib/calculator/pareto.test.ts`

- [ ] **Step 1: Write failing tests for the DP / Pareto core**

`src/lib/calculator/pareto.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeParetoFront } from './pareto';
import type { CalculatorInput } from './types';

const cd = (id: string, price: number, min?: number, max?: number) => ({
  id,
  name: id,
  price,
  minQuantity: min,
  maxQuantity: max
});

describe('computeParetoFront', () => {
  it('finds the single optimal point for one CD type (spec example)', () => {
    // 1500yen CD, 1000yen/ticket, want 10 tickets
    // need >= 10000yen → 7 CDs × 1500 = 10500 → 10 tickets
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [cd('a', 1500)]
    };
    const front = computeParetoFront(input);
    expect(front.ok).toBe(true);
    if (!front.ok) return;
    expect(front.points).toContainEqual(
      expect.objectContaining({ totalCost: 10500, totalCount: 7 })
    );
    expect(front.points.length).toBe(1);
  });

  it('finds multiple Pareto points for mixed CD prices', () => {
    // CD A=1000, CD B=1500, CD C=2200, unit=1000, target=10
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [cd('a', 1000), cd('b', 1500), cd('c', 2200)]
    };
    const front = computeParetoFront(input);
    expect(front.ok).toBe(true);
    if (!front.ok) return;
    // cheapest: 10000yen (10×A or 1×A+6×B), 7 or 10 CDs
    // fewest CDs: e.g. 4×B+2×C=10400yen, 6 CDs (or fewer with different mix)
    const cheapest = front.points.reduce((a, b) => (a.totalCost <= b.totalCost ? a : b));
    expect(cheapest.totalCost).toBe(10000);
    const fewest = front.points.reduce((a, b) => (a.totalCount <= b.totalCount ? a : b));
    expect(fewest.totalCount).toBeLessThanOrEqual(7);
  });

  it('honors minQuantity', () => {
    // min 2 of CD A (1500), unit 1000, target 5 → must include 2×A=3000 baseline
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 5,
      cds: [cd('a', 1500, 2)]
    };
    const front = computeParetoFront(input);
    expect(front.ok).toBe(true);
    if (!front.ok) return;
    for (const p of front.points) {
      const aPurchase = p.purchases.find((x) => x.cdId === 'a');
      expect(aPurchase?.quantity ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('honors maxQuantity', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [cd('a', 1000, 0, 3), cd('b', 2000)]
    };
    const front = computeParetoFront(input);
    expect(front.ok).toBe(true);
    if (!front.ok) return;
    for (const p of front.points) {
      const a = p.purchases.find((x) => x.cdId === 'a');
      expect((a?.quantity ?? 0)).toBeLessThanOrEqual(3);
    }
  });

  it('returns infeasible when constraints cannot meet target', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [cd('a', 500, 0, 5)]
    };
    const front = computeParetoFront(input);
    expect(front).toEqual({ ok: false, reason: 'infeasible' });
  });

  it('aborts when DP operations exceed the limit', () => {
    // ticket unit 1, target 10_000_000 → DP table absurdly large
    const input: CalculatorInput = {
      ticketUnitPrice: 1,
      targetTickets: 10_000_000,
      cds: [cd('a', 1)]
    };
    const front = computeParetoFront(input);
    expect(front).toEqual({ ok: false, reason: 'too-large' });
  });

  it('Pareto front is strictly decreasing in count as cost increases', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [cd('a', 1000), cd('b', 1500), cd('c', 2200)]
    };
    const front = computeParetoFront(input);
    expect(front.ok).toBe(true);
    if (!front.ok) return;
    const sorted = [...front.points].sort((a, b) => a.totalCost - b.totalCost);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].totalCost).toBeGreaterThan(sorted[i - 1].totalCost);
      expect(sorted[i].totalCount).toBeLessThan(sorted[i - 1].totalCount);
    }
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- pareto
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement pareto.ts**

```typescript
import type { CalculatorInput, FailureReason, Purchase } from './types';
import { DP_OPERATION_LIMIT } from './types';

export type ParetoPoint = {
  purchases: Purchase[];
  totalCost: number;
  totalCount: number;
};

export type ParetoResult =
  | { ok: true; points: ParetoPoint[] }
  | { ok: false; reason: FailureReason };

type Cell = { count: number; additions: number[] } | undefined;

export function computeParetoFront(input: CalculatorInput): ParetoResult {
  const { ticketUnitPrice, targetTickets, cds } = input;
  const targetCost = targetTickets * ticketUnitPrice;

  const baseCount = cds.reduce((acc, c) => acc + (c.minQuantity ?? 0), 0);
  const baseCost = cds.reduce((acc, c) => acc + c.price * (c.minQuantity ?? 0), 0);

  const remainingTarget = Math.max(0, targetCost - baseCost);
  const maxPrice = Math.max(...cds.map((c) => c.price));
  const upperBound = remainingTarget + maxPrice - 1;

  const operationsEstimate = cds.reduce((acc, c) => {
    const cap = c.maxQuantity === undefined ? Math.ceil(upperBound / c.price) : c.maxQuantity - (c.minQuantity ?? 0);
    return acc + (upperBound + 1) * Math.max(0, cap);
  }, 0);
  if (operationsEstimate > DP_OPERATION_LIMIT) {
    return { ok: false, reason: 'too-large' };
  }

  const tableSize = upperBound + 1;
  const dp: Cell[] = new Array(tableSize);
  dp[0] = { count: 0, additions: cds.map(() => 0) };

  for (let i = 0; i < cds.length; i++) {
    const cd = cds[i];
    const min = cd.minQuantity ?? 0;
    const cap = cd.maxQuantity === undefined ? Math.ceil(upperBound / cd.price) : cd.maxQuantity - min;
    if (cap <= 0) continue;
    // Process k = 1..cap copies of this CD; iterate cost descending to keep bounded knapsack semantics
    // BUT we want item-by-item so additions[i] is correct. Use 2D approach via cloning prev layer.
    const next: Cell[] = new Array(tableSize);
    for (let c = 0; c < tableSize; c++) {
      next[c] = dp[c] ? { count: dp[c]!.count, additions: dp[c]!.additions.slice() } : undefined;
    }
    for (let k = 1; k <= cap; k++) {
      const addCost = cd.price * k;
      if (addCost > upperBound) break;
      for (let c = 0; c + addCost <= upperBound; c++) {
        const src = dp[c];
        if (!src) continue;
        const newCount = src.count + k;
        const dest = next[c + addCost];
        if (!dest || newCount < dest.count) {
          const additions = src.additions.slice();
          additions[i] = k;
          next[c + addCost] = { count: newCount, additions };
        }
      }
    }
    for (let c = 0; c < tableSize; c++) dp[c] = next[c];
  }

  // Collect candidates whose total achieves the target
  const candidates: ParetoPoint[] = [];
  for (let c = remainingTarget; c < tableSize; c++) {
    const cell = dp[c];
    if (!cell) continue;
    const totalCost = baseCost + c;
    const totalCount = baseCount + cell.count;
    const purchases: Purchase[] = cds.map((cd, i) => ({
      cdId: cd.id,
      quantity: (cd.minQuantity ?? 0) + cell.additions[i]
    }));
    candidates.push({ purchases, totalCost, totalCount });
  }

  if (candidates.length === 0) {
    return { ok: false, reason: 'infeasible' };
  }

  // Pareto filter: sort by cost asc, keep only points whose count strictly decreases
  candidates.sort((a, b) =>
    a.totalCost - b.totalCost || a.totalCount - b.totalCount
  );
  const front: ParetoPoint[] = [];
  let bestCount = Infinity;
  for (const p of candidates) {
    if (p.totalCount < bestCount) {
      front.push(p);
      bestCount = p.totalCount;
    }
  }

  return { ok: true, points: front };
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- pareto
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculator/pareto.ts src/lib/calculator/pareto.test.ts
git commit -m "feat(calculator): bounded knapsack DP and Pareto front"
```

---

## Task 6: Candidate selection (cheapest / fewest / balanced)

Reduces the Pareto front to up to three labeled candidates.

**Files:**
- Create: `src/lib/calculator/candidates.ts`, `src/lib/calculator/candidates.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/calculator/candidates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { selectCandidates } from './candidates';
import type { ParetoPoint } from './pareto';

const pt = (totalCost: number, totalCount: number): ParetoPoint => ({
  purchases: [],
  totalCost,
  totalCount
});

describe('selectCandidates', () => {
  it('returns single point when only one Pareto point', () => {
    const result = selectCandidates([pt(10500, 7)], 1000);
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('cheapest');
  });

  it('returns two points (cheapest, fewest) when exactly two', () => {
    const result = selectCandidates([pt(10000, 10), pt(11000, 7)], 1000);
    expect(result.map((s) => s.label)).toEqual(['cheapest', 'fewest']);
    expect(result[0].totalCost).toBe(10000);
    expect(result[1].totalCount).toBe(7);
  });

  it('returns three points (cheapest, balanced, fewest) when 3+ points', () => {
    const front = [pt(10000, 10), pt(10400, 8), pt(10800, 6), pt(11200, 5)];
    const result = selectCandidates(front, 1000);
    expect(result.map((s) => s.label)).toEqual(['cheapest', 'balanced', 'fewest']);
    expect(result[0].totalCost).toBe(10000);
    expect(result[result.length - 1].totalCount).toBe(5);
  });

  it('balanced point is the knee (smallest normalized distance from origin)', () => {
    // Construct a clear elbow: cheap point with many CDs, expensive with few, knee in middle
    const front = [pt(10000, 100), pt(10100, 50), pt(20000, 49), pt(30000, 1)];
    const result = selectCandidates(front, 1000);
    const balanced = result.find((s) => s.label === 'balanced')!;
    expect(balanced.totalCost).toBe(10100);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- candidates
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement candidates.ts**

```typescript
import type { ParetoPoint } from './pareto';
import type { Solution, SolutionLabel } from './types';

export function selectCandidates(front: ParetoPoint[], ticketUnitPrice: number): Solution[] {
  if (front.length === 0) return [];

  const sorted = [...front].sort((a, b) => a.totalCost - b.totalCost);
  const cheapest = sorted[0];
  const fewest = sorted[sorted.length - 1];

  const ticketsOf = (p: ParetoPoint) => Math.floor(p.totalCost / ticketUnitPrice);
  const make = (p: ParetoPoint, label: SolutionLabel): Solution => ({
    purchases: p.purchases,
    totalCost: p.totalCost,
    totalCount: p.totalCount,
    ticketsObtained: ticketsOf(p),
    label
  });

  if (sorted.length === 1) return [make(cheapest, 'cheapest')];
  if (sorted.length === 2) return [make(cheapest, 'cheapest'), make(fewest, 'fewest')];

  const interior = sorted.slice(1, -1);
  const costMin = sorted[0].totalCost;
  const costMax = sorted[sorted.length - 1].totalCost;
  const countMin = sorted[sorted.length - 1].totalCount;
  const countMax = sorted[0].totalCount;
  const costSpan = Math.max(1, costMax - costMin);
  const countSpan = Math.max(1, countMax - countMin);

  let knee = interior[0];
  let bestDist = Infinity;
  for (const p of interior) {
    const nx = (p.totalCost - costMin) / costSpan;
    const ny = (p.totalCount - countMin) / countSpan;
    const dist = Math.hypot(nx, ny);
    if (dist < bestDist) {
      bestDist = dist;
      knee = p;
    }
  }

  return [make(cheapest, 'cheapest'), make(knee, 'balanced'), make(fewest, 'fewest')];
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- candidates
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculator/candidates.ts src/lib/calculator/candidates.test.ts
git commit -m "feat(calculator): candidate selection (cheapest/fewest/balanced)"
```

---

## Task 7: Top-level `calculate()` entry point (TDD)

Composes feasibility check + DP + selection into a single API.

**Files:**
- Create: `src/lib/calculator/calculate.ts`, `src/lib/calculator/calculate.test.ts`, `src/lib/calculator/index.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/calculator/calculate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculate } from './calculate';
import type { CalculatorInput } from './types';

describe('calculate', () => {
  it('returns failure for empty input', () => {
    const result = calculate({ ticketUnitPrice: 1000, targetTickets: 10, cds: [] });
    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  it('returns failure for invalid input', () => {
    const result = calculate({ ticketUnitPrice: 0, targetTickets: 10, cds: [] });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns the cheapest solution as label "cheapest"', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [{ id: 'a', name: 'A', price: 1500 }]
    };
    const result = calculate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solutions[0].label).toBe('cheapest');
    expect(result.solutions[0].totalCost).toBe(10500);
    expect(result.solutions[0].ticketsObtained).toBe(10);
  });

  it('returns multiple labeled solutions when Pareto front has 2+ points', () => {
    const input: CalculatorInput = {
      ticketUnitPrice: 1000,
      targetTickets: 10,
      cds: [
        { id: 'a', name: 'A', price: 1000 },
        { id: 'b', name: 'B', price: 1500 },
        { id: 'c', name: 'C', price: 2200 }
      ]
    };
    const result = calculate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solutions.length).toBeGreaterThanOrEqual(2);
    expect(result.solutions[0].label).toBe('cheapest');
    expect(result.solutions[result.solutions.length - 1].label).toBe('fewest');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- calculate
```

Expected: FAIL.

- [ ] **Step 3: Implement calculate.ts**

```typescript
import type { CalculationResult, CalculatorInput } from './types';
import { checkInput } from './feasibility';
import { computeParetoFront } from './pareto';
import { selectCandidates } from './candidates';

export function calculate(input: CalculatorInput): CalculationResult {
  const check = checkInput(input);
  if (!check.ok) return { ok: false, reason: check.reason };

  const front = computeParetoFront(input);
  if (!front.ok) return { ok: false, reason: front.reason };

  const solutions = selectCandidates(front.points, input.ticketUnitPrice);
  return { ok: true, solutions };
}
```

- [ ] **Step 4: Add index.ts barrel export**

`src/lib/calculator/index.ts`:

```typescript
export { calculate } from './calculate';
export type {
  CalculatorInput,
  CdEntry,
  CalculationResult,
  Solution,
  SolutionLabel,
  Purchase,
  FailureReason
} from './types';
```

- [ ] **Step 5: Run all calculator tests**

```bash
npm test
```

Expected: all calculator tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculator/calculate.ts src/lib/calculator/calculate.test.ts src/lib/calculator/index.ts
git commit -m "feat(calculator): top-level calculate() entry point"
```

---

## Task 8: URL state encode/decode (TDD)

Round-trip the input as a base64url-encoded compact JSON.

**Files:**
- Create: `src/lib/url/state.ts`, `src/lib/url/state.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/url/state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { encodeState, decodeState } from './state';
import type { CalculatorInput } from '$lib/calculator/types';

const input: CalculatorInput = {
  ticketUnitPrice: 1000,
  targetTickets: 10,
  cds: [
    { id: 'a', name: 'Type A', price: 1500 },
    { id: 'b', name: 'Type B', price: 2200, minQuantity: 1, maxQuantity: 5 }
  ]
};

describe('url state', () => {
  it('round-trips an input', () => {
    const encoded = encodeState(input);
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.ticketUnitPrice).toBe(input.ticketUnitPrice);
    expect(decoded!.targetTickets).toBe(input.targetTickets);
    expect(decoded!.cds).toHaveLength(2);
    expect(decoded!.cds[0]).toMatchObject({ name: 'Type A', price: 1500 });
    expect(decoded!.cds[1]).toMatchObject({
      name: 'Type B',
      price: 2200,
      minQuantity: 1,
      maxQuantity: 5
    });
  });

  it('returns null for malformed base64', () => {
    expect(decodeState('!!!not-base64')).toBeNull();
  });

  it('returns null for non-JSON payload', () => {
    const garbage = btoa('not json').replace(/=+$/, '');
    expect(decodeState(garbage)).toBeNull();
  });

  it('returns null for JSON with wrong shape', () => {
    const wrong = btoa(JSON.stringify({ foo: 'bar' })).replace(/=+$/, '');
    expect(decodeState(wrong)).toBeNull();
  });

  it('rejects non-positive numbers in payload', () => {
    const wrong = btoa(JSON.stringify({ u: 0, t: 10, c: [] })).replace(/=+$/, '');
    expect(decodeState(wrong)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- url/state
```

Expected: FAIL.

- [ ] **Step 3: Implement state.ts**

```typescript
import type { CalculatorInput, CdEntry } from '$lib/calculator/types';
import { nanoid } from 'nanoid';

type CompactCd = [name: string, price: number, min?: number, max?: number];
type CompactPayload = {
  u: number;
  t: number;
  c: CompactCd[];
};

export function encodeState(input: CalculatorInput): string {
  const payload: CompactPayload = {
    u: input.ticketUnitPrice,
    t: input.targetTickets,
    c: input.cds.map((cd) => {
      const tuple: CompactCd = [cd.name, cd.price];
      if (cd.minQuantity !== undefined) tuple[2] = cd.minQuantity;
      if (cd.maxQuantity !== undefined) {
        if (tuple[2] === undefined) tuple[2] = 0;
        tuple[3] = cd.maxQuantity;
      }
      return tuple;
    })
  };
  return base64urlEncode(JSON.stringify(payload));
}

export function decodeState(s: string): CalculatorInput | null {
  try {
    const json = base64urlDecode(s);
    const obj = JSON.parse(json) as unknown;
    if (!isCompactPayload(obj)) return null;
    if (!isPosInt(obj.u) || !isPosInt(obj.t)) return null;
    const cds: CdEntry[] = [];
    for (const tuple of obj.c) {
      if (!Array.isArray(tuple) || tuple.length < 2) return null;
      const [name, price, min, max] = tuple;
      if (typeof name !== 'string' || !isPosInt(price)) return null;
      const cd: CdEntry = { id: nanoid(8), name, price };
      if (min !== undefined) {
        if (!Number.isInteger(min) || (min as number) < 0) return null;
        if ((min as number) > 0) cd.minQuantity = min as number;
      }
      if (max !== undefined) {
        if (!Number.isInteger(max) || (max as number) < (cd.minQuantity ?? 0)) return null;
        cd.maxQuantity = max as number;
      }
      cds.push(cd);
    }
    return { ticketUnitPrice: obj.u, targetTickets: obj.t, cds };
  } catch (err) {
    console.warn('[url/state] decode failed', err);
    return null;
  }
}

function isCompactPayload(obj: unknown): obj is CompactPayload {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'u' in obj &&
    't' in obj &&
    'c' in obj &&
    Array.isArray((obj as { c: unknown }).c)
  );
}

function isPosInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function base64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return atob(padded);
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- url/state
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/url/state.ts src/lib/url/state.test.ts
git commit -m "feat(url): encode/decode calculator state"
```

---

## Task 9: i18n setup (svelte-i18n + JA/EN messages)

**Files:**
- Create: `src/lib/i18n/index.ts`, `src/lib/i18n/ja.json`, `src/lib/i18n/en.json`, `src/lib/i18n/locale.test.ts`

- [ ] **Step 1: Write failing test for locale resolution**

`src/lib/i18n/locale.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveLocale } from './index';

describe('resolveLocale', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers URL lang param', () => {
    expect(resolveLocale({ urlLang: 'en', storedLang: 'ja', browserLang: 'ja' })).toBe('en');
  });

  it('falls back to stored lang when URL absent', () => {
    expect(resolveLocale({ urlLang: null, storedLang: 'en', browserLang: 'ja' })).toBe('en');
  });

  it('falls back to browser lang when URL and storage absent', () => {
    expect(resolveLocale({ urlLang: null, storedLang: null, browserLang: 'en-US' })).toBe('en');
  });

  it('defaults to ja when nothing matches', () => {
    expect(resolveLocale({ urlLang: null, storedLang: null, browserLang: 'fr' })).toBe('ja');
  });

  it('rejects invalid URL lang and falls through', () => {
    expect(resolveLocale({ urlLang: 'xx', storedLang: 'en', browserLang: 'ja' })).toBe('en');
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- i18n/locale
```

Expected: FAIL.

- [ ] **Step 3: Implement i18n/index.ts**

```typescript
import { addMessages, init, register, getLocaleFromNavigator } from 'svelte-i18n';
import ja from './ja.json';
import en from './en.json';

export type Locale = 'ja' | 'en';
const SUPPORTED: Locale[] = ['ja', 'en'];

export function resolveLocale(opts: {
  urlLang: string | null;
  storedLang: string | null;
  browserLang: string | null;
}): Locale {
  for (const candidate of [opts.urlLang, opts.storedLang, opts.browserLang]) {
    const normalized = normalize(candidate);
    if (normalized) return normalized;
  }
  return 'ja';
}

function normalize(lang: string | null): Locale | null {
  if (!lang) return null;
  const head = lang.toLowerCase().split('-')[0];
  return (SUPPORTED as string[]).includes(head) ? (head as Locale) : null;
}

export function setupI18n(): void {
  addMessages('ja', ja);
  addMessages('en', en);
  // initial locale; +layout.svelte may override after mount
  init({ fallbackLocale: 'ja', initialLocale: 'ja' });
}

export function detectBrowserLocale(): string | null {
  if (typeof window === 'undefined') return null;
  return getLocaleFromNavigator();
}
```

- [ ] **Step 4: Create `ja.json`**

`src/lib/i18n/ja.json`:

```json
{
  "header": {
    "title": "リリースイベント計算機",
    "share": "シェア",
    "shareCopied": "URLをコピーしました"
  },
  "rule": {
    "section": "1. 特典券ルール",
    "unitPrice": "特典券単価",
    "unitPriceSuffix": "円ごとに1枚",
    "targetTickets": "目標枚数",
    "targetTicketsSuffix": "枚"
  },
  "cd": {
    "section": "2. CD一覧",
    "name": "名前",
    "price": "価格",
    "priceSuffix": "円",
    "constraints": "制約を設定",
    "minQuantity": "最低購入数",
    "maxQuantity": "最大購入数",
    "remove": "削除",
    "add": "+ CD追加",
    "defaultName": "CD #{n}"
  },
  "result": {
    "section": "3. 結果",
    "empty": "CDを追加してください",
    "totalCost": "{cost}円",
    "totalCount": "{count}枚",
    "tickets": "{tickets}枚獲得",
    "labels": {
      "cheapest": "最安",
      "fewest": "最少枚数",
      "balanced": "バランス"
    },
    "errors": {
      "invalid": "入力に誤りがあります",
      "infeasible": "制約を満たす購入が見つかりません",
      "tooLarge": "入力規模が大きすぎます"
    }
  },
  "validation": {
    "positiveInt": "1以上の整数を入力してください",
    "maxLessThanMin": "最大値は最小値以上にしてください"
  }
}
```

- [ ] **Step 5: Create `en.json`**

`src/lib/i18n/en.json`:

```json
{
  "header": {
    "title": "Release Event Calculator",
    "share": "Share",
    "shareCopied": "URL copied to clipboard"
  },
  "rule": {
    "section": "1. Ticket Rule",
    "unitPrice": "Yen per ticket",
    "unitPriceSuffix": "JPY",
    "targetTickets": "Target tickets",
    "targetTicketsSuffix": "tickets"
  },
  "cd": {
    "section": "2. CDs",
    "name": "Name",
    "price": "Price",
    "priceSuffix": "JPY",
    "constraints": "Constraints",
    "minQuantity": "Minimum quantity",
    "maxQuantity": "Maximum quantity",
    "remove": "Remove",
    "add": "+ Add CD",
    "defaultName": "CD #{n}"
  },
  "result": {
    "section": "3. Results",
    "empty": "Add a CD to get started",
    "totalCost": "¥{cost}",
    "totalCount": "{count} CDs",
    "tickets": "{tickets} tickets",
    "labels": {
      "cheapest": "Cheapest",
      "fewest": "Fewest CDs",
      "balanced": "Balanced"
    },
    "errors": {
      "invalid": "Some inputs are invalid",
      "infeasible": "No purchase combination satisfies the constraints",
      "tooLarge": "Input is too large to compute"
    }
  },
  "validation": {
    "positiveInt": "Enter an integer ≥ 1",
    "maxLessThanMin": "Maximum must be ≥ minimum"
  }
}
```

- [ ] **Step 6: Run tests, verify pass**

```bash
npm test -- i18n/locale
```

Expected: all 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n
git commit -m "feat(i18n): JA/EN messages and locale resolution"
```

---

## Task 10: Shared input state (Svelte 5 runes)

A module that exposes the current input as a `$state` rune and helpers to mutate it.

**Files:**
- Create: `src/lib/stores/input.svelte.ts`

- [ ] **Step 1: Implement the state module**

```typescript
import { nanoid } from 'nanoid';
import type { CalculatorInput, CdEntry } from '$lib/calculator/types';

const DEFAULT: CalculatorInput = {
  ticketUnitPrice: 1000,
  targetTickets: 10,
  cds: [{ id: nanoid(8), name: '', price: 1500 }]
};

export function createInputState(initial?: CalculatorInput) {
  const state = $state<CalculatorInput>(initial ? clone(initial) : clone(DEFAULT));

  return {
    get value() {
      return state;
    },
    setUnit(v: number) {
      state.ticketUnitPrice = v;
    },
    setTarget(v: number) {
      state.targetTickets = v;
    },
    addCd() {
      state.cds.push({ id: nanoid(8), name: '', price: 1500 });
    },
    removeCd(id: string) {
      state.cds = state.cds.filter((c) => c.id !== id);
    },
    updateCd(id: string, patch: Partial<CdEntry>) {
      const idx = state.cds.findIndex((c) => c.id === id);
      if (idx >= 0) {
        state.cds[idx] = { ...state.cds[idx], ...patch };
      }
    },
    replaceAll(next: CalculatorInput) {
      state.ticketUnitPrice = next.ticketUnitPrice;
      state.targetTickets = next.targetTickets;
      state.cds = next.cds.map((c) => ({ ...c }));
    }
  };
}

function clone(input: CalculatorInput): CalculatorInput {
  return {
    ticketUnitPrice: input.ticketUnitPrice,
    targetTickets: input.targetTickets,
    cds: input.cds.map((c) => ({ ...c }))
  };
}

export type InputState = ReturnType<typeof createInputState>;
```

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/input.svelte.ts
git commit -m "feat(stores): shared input state"
```

---

## Task 11: RuleInput component

**Files:**
- Create: `src/lib/components/RuleInput.svelte`

- [ ] **Step 1: Write the component**

```svelte
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
```

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/RuleInput.svelte
git commit -m "feat(ui): RuleInput component"
```

---

## Task 12: CdRow component

**Files:**
- Create: `src/lib/components/CdRow.svelte`

- [ ] **Step 1: Write the component**

```svelte
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
```

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/CdRow.svelte
git commit -m "feat(ui): CdRow component"
```

---

## Task 13: CdList component

**Files:**
- Create: `src/lib/components/CdList.svelte`

- [ ] **Step 1: Write the component**

```svelte
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
```

- [ ] **Step 2: Type-check & commit**

```bash
npm run check
git add src/lib/components/CdList.svelte
git commit -m "feat(ui): CdList component"
```

---

## Task 14: ResultCard component

**Files:**
- Create: `src/lib/components/ResultCard.svelte`

- [ ] **Step 1: Write the component**

```svelte
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
      ／ {$_('result.totalCount', { values: { count: solution.totalCount } })}
      ／ {$_('result.tickets', { values: { tickets: solution.ticketsObtained } })}
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
```

- [ ] **Step 2: Type-check & commit**

```bash
npm run check
git add src/lib/components/ResultCard.svelte
git commit -m "feat(ui): ResultCard component"
```

---

## Task 15: LangSwitcher component

**Files:**
- Create: `src/lib/components/LangSwitcher.svelte`

- [ ] **Step 1: Write the component**

```svelte
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/LangSwitcher.svelte
git commit -m "feat(ui): LangSwitcher component"
```

---

## Task 16: ShareButton component

**Files:**
- Create: `src/lib/components/ShareButton.svelte`

- [ ] **Step 1: Write the component**

```svelte
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/ShareButton.svelte
git commit -m "feat(ui): ShareButton component"
```

---

## Task 17: Analytics (GA4) wrapper

**Files:**
- Create: `src/lib/analytics/ga.ts`

- [ ] **Step 1: Write the module**

```typescript
import { PUBLIC_GA_MEASUREMENT_ID } from '$env/static/public';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initGa(): void {
  if (initialized) return;
  if (!PUBLIC_GA_MEASUREMENT_ID) return;
  if (typeof window === 'undefined') return;

  const id = PUBLIC_GA_MEASUREMENT_ID;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
  initialized = true;
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (!window.gtag) return;
  window.gtag('event', name, params);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/analytics/ga.ts
git commit -m "feat(analytics): GA4 wrapper"
```

---

## Task 18: Layout (`+layout.svelte`)

**Files:**
- Modify: `src/routes/+layout.ts`
- Create: `src/routes/+layout.svelte`

- [ ] **Step 1: Replace `+layout.ts`**

`src/routes/+layout.ts`:

```typescript
export const prerender = true;
export const ssr = true;
export const trailingSlash = 'never';
```

- [ ] **Step 2: Create `+layout.svelte`**

```svelte
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
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/+layout.ts src/routes/+layout.svelte
git commit -m "feat(routes): root layout with i18n + analytics init"
```

---

## Task 19: Main page (`+page.svelte`)

Wires shared state, debounced calculation, and URL synchronization.

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Replace `+page.svelte`**

```svelte
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
```

- [ ] **Step 2: Build & smoke-check in browser**

```bash
npm run dev
```

Open http://localhost:5173, verify:
- Default state shows the form with one CD row at 1500 yen
- Adding/removing CDs works
- The result panel updates after changes
- Sharing button copies a URL; pasting it in a new tab restores the inputs

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(routes): main page wiring (state, debounce, URL sync)"
```

---

## Task 20: Inject GA4 via `app.html` snippet

The `initGa` runtime call works once mounted, but for snappier first-paint analytics we also include an inline conditional snippet.

**Files:**
- Modify: `src/app.html`

- [ ] **Step 1: Replace `src/app.html`**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Release Event Calculator</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

(No change in body — GA injection happens via `initGa()` in `+layout.svelte` to keep the measurement ID environment-driven and avoid hardcoding IDs in the HTML shell.)

- [ ] **Step 2: Verify build still succeeds**

```bash
npm run build
```

Expected: build completes; if `PUBLIC_GA_MEASUREMENT_ID` is empty, no gtag script is injected at runtime.

- [ ] **Step 3: Commit (no-op if no change)**

```bash
git status
```

If no changes, skip commit. Otherwise:

```bash
git add src/app.html
git commit -m "docs(app.html): note runtime GA injection"
```

---

## Task 21: CI workflow (test + check + build)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: type-check, unit tests, build, e2e"
```

---

## Task 22: Deploy workflow (GitHub Pages)

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          BASE_PATH: /release-event-calculator
          PUBLIC_GA_MEASUREMENT_ID: ${{ vars.PUBLIC_GA_MEASUREMENT_ID }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy to GitHub Pages"
```

---

## Task 23: E2E tests (Playwright)

**Files:**
- Create: `src/tests/e2e/calculate.spec.ts`, `src/tests/e2e/share.spec.ts`

- [ ] **Step 1: Calculate spec**

`src/tests/e2e/calculate.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('default state computes a solution', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'リリースイベント計算機' })).toBeVisible();
  // Default: unit 1000, target 10, CD price 1500 → cheapest 10500yen / 7 CDs
  await expect(page.getByText('最安')).toBeVisible();
  await expect(page.getByText('10,500')).toBeVisible();
});
```

- [ ] **Step 2: Share spec**

`src/tests/e2e/share.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('share URL restores state', async ({ page, context }) => {
  await page.goto('/');
  // Wait for initial calculation + debounce
  await expect(page.getByText('最安')).toBeVisible();
  // The URL should now contain ?s=
  await page.waitForFunction(() => window.location.search.includes('s='));
  const sharedUrl = page.url();
  const fresh = await context.newPage();
  await fresh.goto(sharedUrl);
  await expect(fresh.getByText('最安')).toBeVisible();
});
```

- [ ] **Step 3: Run E2E locally**

```bash
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
```

Expected: both tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/tests/e2e
git commit -m "test(e2e): default calculation and share-URL restore"
```

---

## Task 24: README and finishing touches

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# release-event-calculator

アイドル等のリリースイベントで、目標枚数の特典券を獲得するための最適なCD購入組み合わせを計算する静的Webアプリ。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # ユニットテスト
npm run check    # 型チェック
npm run build    # 本番ビルド
npm run test:e2e # Playwright E2E（要 `npx playwright install`）
```

## 環境変数

- `PUBLIC_GA_MEASUREMENT_ID` — GA4 Measurement ID（未設定なら GA は無効）

## デプロイ

`main` への push で GitHub Actions が GitHub Pages へデプロイ。`vars.PUBLIC_GA_MEASUREMENT_ID` をリポジトリ Variables に設定可能。
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README"
```

---

## Self-Review Notes

After writing the plan, the following spec-vs-plan mapping was checked:

| Spec section | Implemented in |
|---|---|
| §3 Architecture (SvelteKit + adapter-static + base path) | Task 1 |
| §4 Data Model | Task 3 (types), Task 10 (state) |
| §5 Algorithm (DP + Pareto + balanced=knee) | Tasks 5–6 |
| §5 DP operation safety valve | Task 5 |
| §6 UI Layout (vertical 1-column) | Tasks 11–16, Task 19 |
| §7 URL Sharing (base64url) | Task 8 |
| §8 i18n (svelte-i18n, JA/EN, locale priority) | Task 9, Task 18 |
| §9 GA4 (env var, IP masking, calculate/share/lang_switch events) | Tasks 17, 19, 20 |
| §10 Validation & Error Handling | Tasks 4, 11, 12, 19 |
| §11 Testing (Vitest unit, Playwright E2E) | Tasks 4–8, Task 23 |
| §12 Deployment (Actions + Pages) | Task 22 |

All sections covered. No "TBD"/"TODO" placeholders. Type names consistent across tasks (`CdEntry`, `Solution`, `CalculationResult`, `Purchase`, `SolutionLabel`).
