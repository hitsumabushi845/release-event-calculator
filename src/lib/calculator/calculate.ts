import type { CalculationResult, CalculatorInput } from './types';
import { checkInput } from './feasibility';
import { computeParetoFront } from './pareto';
import { selectCandidates } from './candidates';

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

export function calculate(input: CalculatorInput): CalculationResult {
  if (!isPositiveInt(input.ticketUnitPrice) || !isPositiveInt(input.targetTickets)) {
    return { ok: false, reason: 'invalid' };
  }

  const check = checkInput(input);
  if (!check.ok) return { ok: false, reason: check.reason };

  const front = computeParetoFront(input);
  if (!front.ok) return { ok: false, reason: front.reason };

  const solutions = selectCandidates(front.points, input.ticketUnitPrice);
  return { ok: true, solutions };
}
