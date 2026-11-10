import 'server-only';
import { unstable_cache } from 'next/cache';
import { sql } from './db';
import { freshness, type Freshness } from './freshness';
import { metrics, shortSectorLabel } from './metrics';

/**
 * Typed read queries (spec 9.2). Each is cached for an hour and tagged by the
 * dataset it reads, so the pipeline's revalidation call refreshes exactly what
 * changed (spec 9.4).
 */
function cached<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, tags: string[]) {
  return unstable_cache(fn, [key], { revalidate: 3600, tags });
}

// ------------------------------------------------------------------ types

export type Country = { code: string; label: string; sort: number; hasSectors: boolean };
export type Family = { id: string; label: string; grp: string; indeedSector: string; sort: number };
export type Dataset = {
  id: string;
  name: string;
  sourceUrl: string;
  license: string;
  attribution: string;
  cadenceHours: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: string | null;
  dataThrough: string | null;
  rowCount: number | null;
  notes: string | null;
  freshness: Freshness;
};
export type WeeklyPoint = { week: string; value: number };
export type SectorPosition = {
  seriesId: string;
  sector: string | null;
  short: string;
  week: string;
  value: number;
  valueThen: number | null;
};
export type ThawRow = {
  week: string;
  familyId: string;
  country: string;
  score: number;
  state: string;
  level: number | null;
  momentum: number | null;
  breadth: number | null;
  entryAccess: number | null;
  competition: number | null;
  weights: Record<string, number>;
  version: string;
};
export type ForecastPaths = {
  start: string;
  weeks: string[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  backtest: Record<string, Record<string, number | null>>;
};
export type ForecastRow = {
  seriesId: string;
  madeOn: string;
  model: string;
  mase13: number | null;
  mase26: number | null;
  mase52: number | null;
  shipped: boolean;
  paths: Partial<ForecastPaths> | null;
  recovery: { status: 'above' | 'range' | 'earliest' | 'none'; q20: string | null; q80: string | null } | null;
  version: string;
};
export type Signal = {
  id: number;
  kind: string;
  subjectType: string | null;
  subjectId: string | null;
  country: string | null;
  signalDate: string;
  sentence: string;
  importance: number;
};
export type SeriesMeta = {
  id: string;
  datasetId: string;
  label: string;
  unit: string;
  country: string | null;
  sector: string | null;
  frequency: string;
  seasonalAdj: boolean | null;
  note: string | null;
};
export type Run = {
  job: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  rowsWritten: number | null;
  error: string | null;
};

export const indeedSeriesId = (country: string, sector: string | null) =>
  `indeed.${country}.${
    sector
      ? sector
          .toLowerCase()
          .replace(/&/g, 'and')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : 'all'
  }`;

// ------------------------------------------------------------------ reference

export const getCountries = cached(
  async (): Promise<Country[]> => {
    const rows = await sql`
      select c.code, c.label, c.sort,
             exists (select 1 from series s where s.country = c.code and s.sector is not null) as has_sectors
      from countries c where c.sort is not null order by c.sort`;
    return rows.map((r) => ({ code: r.code, label: r.label, sort: r.sort, hasSectors: r.has_sectors }));
  },
  'countries',
  ['indeed_jpi'],
);

export const getFamilies = cached(
  async (): Promise<Family[]> => {
    const rows = await sql`select id, label, grp, indeed_sector, sort from role_families order by sort`;
    return rows.map((r) => ({ id: r.id, label: r.label, grp: r.grp, indeedSector: r.indeed_sector, sort: r.sort }));
  },
  'families',
  ['reference'],
);

export const getDatasets = cached(
  async (): Promise<Omit<Dataset, 'freshness'>[]> => {
    const rows = await sql`
      select id, name, source_url, license, attribution, cadence_hours, last_attempt_at, last_success_at,
             last_status, data_through, row_count, notes
      from datasets order by id`;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceUrl: r.source_url,
      license: r.license,
      attribution: r.attribution,
      cadenceHours: r.cadence_hours,
      lastAttemptAt: r.last_attempt_at,
      lastSuccessAt: r.last_success_at,
      lastStatus: r.last_status,
      dataThrough: r.data_through,
      rowCount: r.row_count === null ? null : Number(r.row_count),
      notes: r.notes,
    }));
  },
  'datasets',
  ['datasets'],
);

/** Datasets with freshness computed at request time, not cache time. */
export async function datasetsWithFreshness(): Promise<Dataset[]> {
  const rows = await getDatasets();
  return rows.map((d) => ({ ...d, freshness: freshness(d.lastSuccessAt, d.cadenceHours) }));
}

export async function getDataset(id: string): Promise<Dataset | null> {
  return (await datasetsWithFreshness()).find((d) => d.id === id) ?? null;
}

// ------------------------------------------------------------------ series

export const getSeriesMeta = cached(
  async (id: string): Promise<SeriesMeta | null> => {
    const [r] = await sql`
      select id, dataset_id, label, unit, country, sector, frequency, seasonal_adj, note
      from series where id = ${id}`;
    if (!r) return null;
    return {
      id: r.id,
      datasetId: r.dataset_id,
      label: r.label,
      unit: r.unit,
      country: r.country,
      sector: r.sector,
      frequency: r.frequency,
      seasonalAdj: r.seasonal_adj,
      note: r.note,
    };
  },
  'series-meta',
  ['indeed_jpi', 'bls', 'fred'],
);

export const getWeekly = cached(
  async (seriesId: string): Promise<WeeklyPoint[]> => {
    const rows = await sql`select week, value from series_weekly where series_id = ${seriesId} order by week`;
    return rows.map((r) => ({ week: r.week, value: Number(r.value) }));
  },
  'weekly',
  ['indeed_jpi'],
);

export const getObservations = cached(
  async (seriesId: string): Promise<{ date: string; value: number }[]> => {
    const rows = await sql`select date, value from observations where series_id = ${seriesId} order by date`;
    return rows.map((r) => ({ date: r.date, value: Number(r.value) }));
  },
  'observations',
  ['indeed_jpi', 'bls', 'fred'],
);

export function fourWeekMeans(points: WeeklyPoint[]): WeeklyPoint[] {
  const out: WeeklyPoint[] = [];
  for (let i = 3; i < points.length; i++) {
    const v = (points[i]!.value + points[i - 1]!.value + points[i - 2]!.value + points[i - 3]!.value) / 4;
    out.push({ week: points[i]!.week, value: v });
  }
  return out;
}

/** Latest weekly reading per sector and the reading 13 weeks earlier, for the line strip. */
export const getSectorPositions = cached(
  async (country: string, sectors: (string | null)[]): Promise<SectorPosition[]> => {
    const ids = sectors.map((s) => indeedSeriesId(country, s));
    const tail = metrics.line_strip.tail_weeks;
    const rows = await sql`
      with w as (
        select series_id, week, value as m4,
               row_number() over (partition by series_id order by week desc) as rn
        from series_weekly where series_id = any(${ids}))
      select w.series_id, w.week, w.m4, w.rn, s.sector
      from w join series s on s.id = w.series_id
      where w.rn = 1 or w.rn = ${tail + 1}`;
    const out: SectorPosition[] = [];
    for (const id of ids) {
      const now = rows.find((r) => r.series_id === id && Number(r.rn) === 1);
      if (!now) continue;
      const then = rows.find((r) => r.series_id === id && Number(r.rn) === tail + 1);
      out.push({
        seriesId: id,
        sector: now.sector,
        short: shortSectorLabel(now.sector),
        week: now.week,
        value: Number(now.m4),
        valueThen: then ? Number(then.m4) : null,
      });
    }
    return out;
  },
  'sector-positions',
  ['indeed_jpi'],
);

// ------------------------------------------------------------------ derived

export const getThawIndex = cached(
  async (familyId: string, country: string): Promise<ThawRow | null> => {
    const [r] = await sql`
      select * from thaw_index
      where family_id = ${familyId} and country = ${country} and version = ${metrics.thaw_index.version}
      order by week desc limit 1`;
    if (!r) return null;
    return {
      week: r.week,
      familyId: r.family_id,
      country: r.country,
      score: Number(r.score),
      state: r.state,
      level: r.level,
      momentum: r.momentum,
      breadth: r.breadth,
      entryAccess: r.entry_access,
      competition: r.competition,
      weights: r.weights,
      version: r.version,
    };
  },
  'thaw-index',
  ['thaw_index'],
);

export const getForecast = cached(
  async (seriesId: string): Promise<ForecastRow | null> => {
    const [r] = await sql`
      select * from forecasts where series_id = ${seriesId} and version = ${metrics.forecast.version}
      order by made_on desc limit 1`;
    if (!r) return null;
    return {
      seriesId: r.series_id,
      madeOn: r.made_on,
      model: r.model,
      mase13: r.mase_13,
      mase26: r.mase_26,
      mase52: r.mase_52,
      shipped: r.shipped,
      paths: r.paths,
      recovery: r.recovery,
      version: r.version,
    };
  },
  'forecast',
  ['forecasts'],
);

/** Latest forecast per series: model chosen and backtest scores, for /method. */
export const getForecastScores = cached(
  async () => {
    const rows = await sql`
      select distinct on (f.series_id) f.series_id, f.made_on, f.model, f.mase_13, f.mase_26, f.mase_52,
             f.shipped, s.label, s.country, s.sector
      from forecasts f join series s on s.id = f.series_id
      where f.version = ${metrics.forecast.version}
      order by f.series_id, f.made_on desc`;
    return rows.map((r) => ({
      seriesId: r.series_id as string,
      madeOn: r.made_on as string,
      model: r.model as string,
      mase13: r.mase_13 as number | null,
      mase26: r.mase_26 as number | null,
      mase52: r.mase_52 as number | null,
      shipped: r.shipped as boolean,
      label: r.label as string,
      country: r.country as string,
      sector: r.sector as string | null,
    }));
  },
  'forecast-scores',
  ['forecasts'],
);

export const getSignals = cached(
  async (opts: { limit?: number; kind?: string; country?: string; since?: string } = {}): Promise<Signal[]> => {
    const limit = Math.min(opts.limit ?? 50, 500);
    const rows = await sql`
      select id, kind, subject_type, subject_id, country, signal_date, sentence, importance from signals
      where (${opts.kind ?? null}::text is null or kind = ${opts.kind ?? null})
        and (${opts.country ?? null}::text is null or country = ${opts.country ?? null})
        and (${opts.since ?? null}::date is null or signal_date >= ${opts.since ?? null}::date)
      order by signal_date desc, importance desc, id desc limit ${limit}`;
    return rows.map((r) => ({
      id: Number(r.id),
      kind: r.kind,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      country: r.country,
      signalDate: r.signal_date,
      sentence: r.sentence,
      importance: r.importance,
    }));
  },
  'signals',
  ['signals'],
);

export const getRuns = cached(
  async (): Promise<Run[]> => {
    const rows = await sql`
      select distinct on (job) job, started_at, finished_at, status, rows_written, error
      from pipeline_runs order by job, started_at desc`;
    return rows.map((r) => ({
      job: r.job,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      status: r.status,
      rowsWritten: r.rows_written === null ? null : Number(r.rows_written),
      error: r.error,
    }));
  },
  'runs',
  ['datasets'],
);

/** Run a query and turn a failure into an error state instead of a crashed page (spec 4.9). */
export async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    console.error('[thawline] query failed', error);
    return { ok: false };
  }
}
