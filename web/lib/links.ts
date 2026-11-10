import type { Family, Signal } from './queries';

/** Where a signal links: its subject's page (spec 3.5 SignalList). */
export function signalHref(s: Signal, _families?: Family[]): string | null {
  if ((s.subjectType === 'series' || s.subjectType === 'sector') && s.subjectId) return `/series/${s.subjectId}`;
  return null;
}

export const outlookHref = (family: string, country: string, level = 'mid') =>
  `/outlook/${family}?country=${country}&level=${level}`;
