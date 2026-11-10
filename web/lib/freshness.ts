import { metrics } from './metrics';

/** Source states from spec 4.9. */
export type Freshness = 'fresh' | 'late' | 'stale' | 'never';

export function freshness(lastSuccessAt: string | null, cadenceHours: number, now = Date.now()): Freshness {
  if (!lastSuccessAt) return 'never';
  const ageHours = (now - new Date(lastSuccessAt).getTime()) / 3_600_000;
  if (ageHours <= cadenceHours * metrics.freshness.late_multiple) return 'fresh';
  if (ageHours <= cadenceHours * metrics.freshness.stale_multiple) return 'late';
  return 'stale';
}

/** Forecasts and the Thaw Index pause while their source is stale (spec 4.9). */
export const isPaused = (f: Freshness) => f === 'stale' || f === 'never';
