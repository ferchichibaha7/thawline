import { EmptyState } from '@/components/EmptyState';
import { Explain } from '@/components/Explain';
import { EXPLAIN } from '@/lib/explain';
import { ErrorState } from '@/components/ErrorState';
import { HomeStatement } from '@/components/HomeStatement';
import { LineStrip, type StripItem } from '@/components/LineStrip';
import { RolePicker } from '@/components/RolePicker';
import { SignalList } from '@/components/SignalList';
import { SourceRow } from '@/components/SourceRow';
import { StaleNotice } from '@/components/StaleNotice';
import { Statement } from '@/components/Statement';
import { metrics } from '@/lib/metrics';
import {
  attempt,
  datasetsWithFreshness,
  fourWeekMeans,
  getCountries,
  getFamilies,
  getSectorPositions,
  getSignals,
  getWeekly,
  indeedSeriesId,
} from '@/lib/queries';
import { signalHref } from '@/lib/links';
import { postingsNoun, sectorSentence } from '@/lib/statements';

export const revalidate = 3600;

const HOME_COUNTRY = 'US';
const HOME_SECTOR = 'Software Development';

export default async function Home() {
  const result = await attempt(async () => {
    const [families, countries, datasets, positions, weekly, signals] = await Promise.all([
      getFamilies(),
      getCountries(),
      datasetsWithFreshness(),
      getSectorPositions(HOME_COUNTRY, [...metrics.line_strip.sectors.map((s) => s.sector), null]),
      getWeekly(indeedSeriesId(HOME_COUNTRY, HOME_SECTOR)),
      getSignals({ limit: 5, country: HOME_COUNTRY }),
    ]);
    return { families, countries, datasets, positions, weekly, signals };
  });

  if (!result.ok) {
    return (
      <div className="page">
        <ErrorState />
      </div>
    );
  }
  const { families, countries, datasets, positions, weekly, signals } = result.data;
  const indeed = datasets.find((d) => d.id === 'indeed_jpi');
  const fourWeek = fourWeekMeans(weekly).map((p) => p.value);
  const statement = fourWeek.length
    ? sectorSentence(postingsNoun('Software', 'the United States'), fourWeek, weekly[weekly.length - 1]!.value)
    : 'Job postings data has not been collected yet.';

  const items: StripItem[] = positions.map((p) => ({
    id: p.seriesId,
    name: p.sector ?? 'All jobs',
    short: p.short,
    value: p.value,
    valueThen: p.valueThen,
    href: `/series/${p.seriesId}`,
    reference: p.sector === null,
  }));
  const dataThrough = positions[0]?.week ?? indeed?.dataThrough ?? null;

  return (
    <div className="page stack-sections">
      <section aria-labelledby="home-statement">
        <div id="home-statement">
          <HomeStatement initial={statement} />
        </div>
        <div style={{ marginTop: 32 }}>
          <RolePicker
            prefill
            families={families.map((f) => ({ value: f.id, label: f.label }))}
            countries={countries.map((c) => ({ value: c.code, label: c.label }))}
            family="frontend"
            country={HOME_COUNTRY}
            level="mid"
          />
        </div>
      </section>

      <section aria-label="Sectors against the line">
        {indeed && indeed.freshness !== 'fresh' ? (
          <StaleNotice lastData={indeed.dataThrough} stale={indeed.freshness === 'stale'} />
        ) : null}
        {items.length && dataThrough ? (
          <>
            <LineStrip items={items} dataThrough={dataThrough} />
            <p className="small muted" style={{ marginTop: 16 }}>
              United States. Each dot is a sector, placed by its latest weekly reading against the line. The faint tail
              shows where it stood 13 weeks earlier. The hollow dot is all jobs.
            </p>
            <Explain {...EXPLAIN.strip} />
            <SourceRow
              source="Indeed Hiring Lab"
              dataThrough={dataThrough}
              updated={indeed?.lastSuccessAt ?? null}
              methodHref="/method#the-line"
              csvHref={`/api/v1/sectors?country=${HOME_COUNTRY}&format=csv`}
            />
          </>
        ) : (
          <EmptyState>Sector data appears here after the first Indeed import.</EmptyState>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div className="panel">
          <h2 className="heading">This week</h2>
          <div style={{ marginTop: 12 }}>
            {signals.length ? (
              <SignalList items={signals.map((s) => ({ id: s.id, date: s.signalDate, sentence: s.sentence, href: signalHref(s, families) }))} />
            ) : (
              <EmptyState>No new signals in the last 26 weeks of data.</EmptyState>
            )}
          </div>
          <p style={{ marginTop: 16 }}>
            <a href="/signals">See all signals</a>
          </p>
        </div>
        <div className="panel">
          <h2 className="heading">Did replacing people with AI work?</h2>
          <div style={{ marginTop: 12 }}>
            <EmptyState>
              Company tracking is being built. A company appears here once a public source confirms its cut and what it
              said about AI. The first set needs 25 confirmed companies.
            </EmptyState>
          </div>
        </div>
      </section>

      <section className="panel">
        <Statement size="m">How much pressure is the AI boom under?</Statement>
        <div style={{ marginTop: 12 }}>
          <EmptyState>
            The pressure gauge is being built from public filings, survey data and hiring at AI companies. It will
            measure pressure, not predict a date.
          </EmptyState>
        </div>
      </section>
    </div>
  );
}
