export function getTopPercent(candidatePercentile: number): number {
  return Math.min(100, Math.max(1, 101 - candidatePercentile))
}

export function formatPercentileSummary(
  t: (key: string, vars?: Record<string, string | number>) => string,
  candidatePercentile: number | null | undefined,
): { above: string; top: string } | null {
  if (candidatePercentile == null) {
    return null
  }

  return {
    above: t('ticket.percentileAbove', { percentile: candidatePercentile }),
    top: t('ticket.percentileTop', { topPercent: getTopPercent(candidatePercentile) }),
  }
}
