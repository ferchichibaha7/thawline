import { describe, expect, it } from 'vitest';
import { freshness, isPaused } from './freshness';

const now = Date.parse('2026-11-10T12:00:00Z');
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

describe('freshness', () => {
  it('follows 2x and 3x the cadence', () => {
    expect(freshness(hoursAgo(100), 168, now)).toBe('fresh');
    expect(freshness(hoursAgo(336), 168, now)).toBe('fresh');
    expect(freshness(hoursAgo(400), 168, now)).toBe('late');
    expect(freshness(hoursAgo(600), 168, now)).toBe('stale');
    expect(freshness(null, 168, now)).toBe('never');
  });
  it('pauses derived metrics when stale', () => {
    expect(isPaused('stale')).toBe(true);
    expect(isPaused('late')).toBe(false);
  });
});
