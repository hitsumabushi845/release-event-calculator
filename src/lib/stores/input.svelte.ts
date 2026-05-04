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
