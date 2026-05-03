import { describe, it, expect } from 'vitest';
import { calculate } from './calculate';
import type { CalculatorInput } from './types';

describe('calculate', () => {
  it('returns failure for empty input', () => {
    const result = calculate({ ticketUnitPrice: 1000, targetTickets: 10, cds: [] });
    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  it('returns failure for invalid input', () => {
    const result = calculate({
      ticketUnitPrice: 0,
      targetTickets: 10,
      cds: [{ id: 'a', name: 'A', price: 1500 }]
    });
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
