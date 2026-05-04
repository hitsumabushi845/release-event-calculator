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
