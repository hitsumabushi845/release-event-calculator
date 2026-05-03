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
