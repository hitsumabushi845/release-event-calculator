import { describe, it, expect } from 'vitest';
import { selectCandidates } from './candidates';
import type { ParetoPoint } from './pareto';

const pt = (totalCost: number, totalCount: number): ParetoPoint => ({
  purchases: [],
  totalCost,
  totalCount
});

describe('selectCandidates', () => {
  it('returns empty array for empty front', () => {
    expect(selectCandidates([], 1000)).toEqual([]);
  });

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
