import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ErrorState } from '@/components/ErrorState';
import { Explain } from '@/components/Explain';
import { SourceRow } from '@/components/SourceRow';
import { StaleNotice } from '@/components/StaleNotice';
import { Statement } from '@/components/Statement';
import { TrendChart } from '@/components/TrendChart';
import { EXPLAIN } from '@/lib/explain';
import { isPaused } from '@/lib/freshness';
import { outlookHref } from '@/lib/links';
import { metrics, shortSectorLabel } from '@/lib/metrics';
import {
  attempt,
  fourWeekMeans,
  getCountries,
  getDataset,
  getFamilies,
  getForecast,
  getSeriesMeta,
  getWeekly,
} from '@/lib/queries';
import { countryInSentence, SITE_URL } from '@/lib/site';
import { changeOver, FORECAST_CAVEAT, notPredictableSentence, postingsNoun, recoverySentence, sectorSentence } from '@/lib/statements';

type Params = { id: string };

async function load(id: string) {
  const meta = await getSeriesMeta(id);
  if (!meta || meta.datasetId !== 'indeed_jpi' || !meta.country) return null;
  const [weekly, forecast, dataset, countries, families] = await Promise.all([
    getWeekly(id),
    getForecast(id),
    getDataset(meta.datasetId),
    getCountries(),
    getFamilies(),
  ]);
  const country = countries.find((c) => c.code === meta.country);
  const where = country ? countryInSentence(country.code, country.label) : meta.country;
  const four = fourWeekMeans(weekly).map((p) => p.value);
  const statement = four.length
    ? sectorSentence(postingsNoun(shortSectorLabel(meta.sector), where), four, weekly[weekly.length - 1]!.value)
    : 'No data has been imported for this series yet.';
  const paused = dataset ? isPaused(dataset.freshness) : true;
  const trend = paused
    ? 'Projections are paused until the source updates.'
    : forecast?.shipped && forecast.recovery
      ? recoverySentence(forecast.recovery)
      : notPredictableSentence(changeOver(four));
  const roles = meta.sector ? families.filter((f) => f.indeedSector === meta.sector) : [];
  return { meta, weekly, forecast, dataset, country, statement, trend, paused, roles };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const r = await attempt(() => load(id));
  if (!r.ok || !r.data) return { title: 'Series' };
  return { title: r.data.meta.label, description: r.data.statement, alternates: { canonical: `/series/${id}` } };
}

export default async function SeriesPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const r = await attempt(() => load(id));
  if (!r.ok) return <div className="page"><ErrorState /></div>;
  if (!r.data) notFound();
  const { meta, weekly, forecast, dataset, country, statement, trend, paused, roles } = r.data;
  const display = metrics.forecast.display_weeks;
  const p = forecast?.shipped && !paused ? forecast.paths : null;
  const fan =
    p && p.weeks && p.p10 && p.p25 && p.p50 && p.p75 && p.p90
      ? {
          weeks: p.weeks.slice(0, display),
          p10: p.p10.slice(0, display),
          p25: p.p25.slice(0, display),
          p50: p.p50.slice(0, display),
          p75: p.p75.slice(0, display),
          p90: p.p90.slice(0, display),
        }
      : null;
  const dataThrough = weekly[weekly.length - 1]?.week ?? null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: meta.label,
    description: `${meta.note ?? ''} ${meta.unit}.`.trim(),
    url: `${SITE_URL}/series/${meta.id}`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    creator: { '@type': 'Organization', name: dataset?.attribution ?? 'Indeed Hiring Lab' },
    temporalCoverage: weekly.length ? `${weekly[0]!.week}/${dataThrough}` : undefined,
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/api/v1/series/${meta.id}?format=csv` },
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE_URL}/api/v1/series/${meta.id}` },
    ],
  };

  return (
    <div className="page stack-sections">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section>
        <Statement size="l">{statement}</Statement>
        {dataset && dataset.freshness !== 'fresh' ? <StaleNotice lastData={dataset.dataThrough} stale={paused} /> : null}
      </section>
      <section className="panel">
        <Statement size="m" as="p">
          {trend}
        </Statement>
        {weekly.length ? (
          <div style={{ marginTop: 16 }}>
            <TrendChart
              label={`${meta.label} against the line since February 2020. ${trend}`}
              series={weekly.map((w) => ({ date: w.week, value: w.value }))}
              forecast={fan}
            />
          </div>
        ) : null}
        {fan ? (
          <p className="small" style={{ marginTop: 12 }}>
            {FORECAST_CAVEAT} <a href="/method#forecasts">Backtest scores</a>
          </p>
        ) : null}
        <Explain {...EXPLAIN.trend} />
        <SourceRow
          source={`Indeed Hiring Lab, ${meta.sector ?? 'All jobs'}, ${country?.label ?? meta.country}`}
          dataThrough={dataThrough}
          updated={dataset?.lastSuccessAt ?? null}
          methodHref="/method#forecasts"
          csvHref={`/api/v1/series/${meta.id}?format=csv`}
        />
      </section>
      {roles.length ? (
        <section aria-labelledby="roles">
          <h2 id="roles" className="heading">
            Roles that use this sector
          </h2>
          <ul className="bullets" style={{ marginTop: 12, paddingLeft: 24 }}>
            {roles.map((f) => (
              <li key={f.id} style={{ marginTop: 4 }}>
                <a href={outlookHref(f.id, meta.country!)}>{f.label}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
