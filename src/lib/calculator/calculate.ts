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
