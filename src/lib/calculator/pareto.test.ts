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
