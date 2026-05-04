import type { ParetoPoint } from './pareto';
import type { Solution, SolutionLabel } from './types';

export function selectCandidates(front: ParetoPoint[], ticketUnitPrice: number): Solution[] {
  if (front.length === 0) return [];

  const sorted = [...front].sort((a, b) => a.totalCost - b.totalCost);
  const cheapest = sorted[0];
  const fewest = sorted[sorted.length - 1];

  const ticketsOf = (p: ParetoPoint) => Math.floor(p.totalCost / ticketUnitPrice);
  const make = (p: ParetoPoint, label: SolutionLabel): Solution => ({
    purchases: p.purchases,
    totalCost: p.totalCost,
    totalCount: p.totalCount,
    ticketsObtained: ticketsOf(p),
    label
  });

  if (sorted.length === 1) return [make(cheapest, 'cheapest')];
  if (sorted.length === 2) return [make(cheapest, 'cheapest'), make(fewest, 'fewest')];

  const interior = sorted.slice(1, -1);
  const costMin = sorted[0].totalCost;
  const costMax = sorted[sorted.length - 1].totalCost;
  const countMin = sorted[sorted.length - 1].totalCount;
  const countMax = sorted[0].totalCount;
  const costSpan = Math.max(1, costMax - costMin);
  const countSpan = Math.max(1, countMax - countMin);

  let knee = interior[0];
  let bestDist = Infinity;
  for (const p of interior) {
    const nx = (p.totalCost - costMin) / costSpan;
    const ny = (p.totalCount - countMin) / countSpan;
    const dist = Math.hypot(nx, ny);
    if (dist < bestDist) {
      bestDist = dist;
      knee = p;
    }
  }

  return [make(cheapest, 'cheapest'), make(knee, 'balanced'), make(fewest, 'fewest')];
}
