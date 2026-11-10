import metricsJson from '@config/metrics.json';

/** The shared metrics config, read by the pipeline and by /method (spec 15). */
export const metrics = metricsJson;

export type StateName = 'Frozen' | 'Cold' | 'Thawing' | 'Open';
export const STATES: StateName[] = ['Frozen', 'Cold', 'Thawing', 'Open'];

export function stateFor(score: number): StateName {
  let name: StateName = 'Frozen';
  for (const band of metrics.thaw_index.states) if (score >= band.min) name = band.name as StateName;
  return name;
}

/** Position of a postings index against the line, for line-strip dots and tints. */
export function positionState(index: number): StateName {
  const d = index - 100;
  if (d < -metrics.line_strip.frozen_below) return 'Frozen';
  if (d < 0) return 'Cold';
  if (d <= metrics.line_strip.thawing_above) return 'Thawing';
  return 'Open';
}

export const shortSectorLabel = (sector: string | null): string => {
  if (!sector) return 'All jobs';
  return metrics.line_strip.sectors.find((s) => s.sector === sector)?.short ?? sector;
};
