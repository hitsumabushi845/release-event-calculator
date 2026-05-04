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
