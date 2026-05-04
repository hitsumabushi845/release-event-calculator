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
