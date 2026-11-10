import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ComponentBreakdown, type ComponentRow } from '@/components/ComponentBreakdown';
import { CopyLink } from '@/components/CopyLink';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Explain } from '@/components/Explain';
import { Glossary } from '@/components/Glossary';
import { PositionBar } from '@/components/PositionBar';
import { RolePicker } from '@/components/RolePicker';
import { SourceRow } from '@/components/SourceRow';
import { StaleNotice } from '@/components/StaleNotice';
import { StateTag } from '@/components/StateTag';
import { Statement } from '@/components/Statement';
import { TrendChart } from '@/components/TrendChart';
import { EXPLAIN } from '@/lib/explain';
import { formatDate, lineWords } from '@/lib/format';
import { metrics } from '@/lib/metrics';
import { buildOutlook, resolveRole, type Outlook } from '@/lib/outlook';
import { attempt } from '@/lib/queries';
import { FORECAST_CAVEAT } from '@/lib/statements';

type Params = { family: string };
type Search = { country?: string; level?: string };

async function load(params: Promise<Params>, searchParams: Promise<Search>) {
  const [{ family: familyId }, sp] = await Promise.all([params, searchParams]);
  const { families, countries, family, country } = await resolveRole(familyId, sp.country);
  if (!family || !country) return null;
  const outlook = await buildOutlook(family, country);
  return { families, countries, outlook, level: ['junior', 'mid', 'senior'].includes(sp.level ?? '') ? sp.level! : 'mid' };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const r = await attempt(() => load(params, searchParams));
  if (!r.ok || !r.data) return { title: 'Outlook' };
  const o = r.data.outlook;
  const short = o.thaw && !o.paused ? `${o.family.label} in ${o.country.label}: ${o.thaw.state}, ${Math.round(o.thaw.score)} of 100` : `${o.family.label} in ${o.country.label}`;
  return {
    title: short,
    description: o.statement,
    alternates: { canonical: `/outlook/${o.family.id}?country=${o.country.code}` },
    openGraph: { images: [{ url: `/api/og?family=${o.family.id}&country=${o.country.code}`, width: 1200, height: 630 }] },
  };
}

function componentRows(o: Outlook): ComponentRow[] {
  const t = o.thaw!;
  const four = o.fourWeek[o.fourWeek.length - 1];
  const reasons = metrics.thaw_index.missing_reasons as Record<string, string>;
  const level = four ? `Four-week average ${four.value.toFixed(1)}: ${lineWords(four.value)}${lineWords(four.value) === 'at the line' ? '' : ' the line'}.` : '';
  const m = o.change13;
  const momentum = m === null ? '' : `${m >= 0 ? 'Up' : 'Down'} ${Math.abs(m).toFixed(1)}% in 13 weeks.`;
  return [
    { name: 'Level', score: t.level, reading: level, weight: t.weights.level ?? null },
    { name: 'Momentum', score: t.momentum, reading: momentum, weight: t.weights.momentum ?? null },
    { name: 'Breadth', score: t.breadth, reading: reasons.breadth ?? '', weight: t.weights.breadth ?? null },
    { name: 'Entry access', score: t.entryAccess, reading: reasons.entry_access ?? '', weight: t.weights.entry_access ?? null },
    { name: 'Competition', score: t.competition, reading: reasons.competition ?? '', weight: t.weights.competition ?? null },
  ];
}

export default async function OutlookPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const r = await attempt(() => load(params, searchParams));
  if (!r.ok) return <div className="page"><ErrorState /></div>;
  if (!r.data) notFound();
  const { families, countries, outlook: o, level } = r.data;
  const ds = o.dataset;
  const late = ds && ds.freshness !== 'fresh';
  const fc = o.forecast?.shipped && !o.paused ? o.forecast.paths : null;
  const display = metrics.forecast.display_weeks;
  const forecast =
    fc && fc.weeks && fc.p10 && fc.p25 && fc.p50 && fc.p75 && fc.p90
      ? {
          weeks: fc.weeks.slice(0, display),
          p10: fc.p10.slice(0, display),
          p25: fc.p25.slice(0, display),
          p50: fc.p50.slice(0, display),
          p75: fc.p75.slice(0, display),
          p90: fc.p90.slice(0, display),
        }
      : null;
  const sectorName = o.hasSector ? o.family.indeedSector : 'All jobs';
  const dataThrough = o.weekly[o.weekly.length - 1]?.week ?? ds?.dataThrough ?? null;
  const csv = `/api/v1/series/${o.seriesId}?format=csv`;

  return (
    <div className="page stack-sections">
      {/* 1. statement and picker */}
      <section>
        <Statement size="l">{o.statement}</Statement>
        {late ? <StaleNotice lastData={ds?.dataThrough ?? null} stale={o.paused} /> : null}
        <div style={{ marginTop: 32 }}>
          <RolePicker
            families={families.map((f) => ({ value: f.id, label: f.label }))}
            countries={countries.map((c) => ({ value: c.code, label: c.label }))}
            family={o.family.id}
            country={o.country.code}
            level={level}
            buttonLabel="Show this outlook"
          />
        </div>
      </section>

      {/* 2. where you stand */}
      <section aria-labelledby="stand" className="reading" style={{ maxWidth: 'none' }}>
        <h2 id="stand" className="heading">
          Where you stand
        </h2>
        <div style={{ marginTop: 16 }}>
          {!o.hasSector ? (
            <EmptyState>
              {o.country.hasSectors
                ? `Indeed does not publish its ${o.family.indeedSector} sector for ${o.country.label}, so there is no role-level score here. The United States, the United Kingdom and Germany have it.`
                : `Indeed does not publish sector data for ${o.country.label}, so there is no role-level score. The remote view arrives with job-board data. The nearest large markets with role scores are the United Kingdom, France and Germany.`}
            </EmptyState>
          ) : o.paused ? (
            <EmptyState>Paused until the source updates.</EmptyState>
          ) : o.thaw ? (
            <>
              <p>
                The <Glossary term="Thaw Index" uid="stand" /> for {o.family.label} in {o.where} is{' '}
                {Math.round(o.thaw.score)} of 100, <StateTag state={o.thaw.state} />, for the week to {formatDate(o.thaw.week)}.
              </p>
              <div style={{ marginTop: 24, maxWidth: 640 }}>
                <PositionBar
                  score={o.thaw.score}
                  state={o.thaw.state}
                  label={`Thaw Index ${Math.round(o.thaw.score)} of 100, ${o.thaw.state}`}
                />
              </div>
              <ComponentBreakdown rows={componentRows(o)} />
              <p className="small muted" style={{ marginTop: 12 }}>
                This role uses Indeed&apos;s {o.family.indeedSector} sector. Every role mapped to that sector shares this score
                until role-level data arrives.
              </p>
              <Explain {...EXPLAIN.thawIndex} />
              <SourceRow
                source="Indeed Hiring Lab; Thaw Index by Thawline"
                dataThrough={o.thaw.week}
                updated={ds?.lastSuccessAt ?? null}
                methodHref="/method#thaw-index"
                csvHref={`/api/v1/outlook/${o.family.id}?country=${o.country.code}&format=csv`}
              />
            </>
          ) : (
            <EmptyState>The score needs 17 weeks of sector data. It appears after the next import.</EmptyState>
          )}
        </div>
      </section>

      {/* 3. which way it is moving */}
      <section aria-labelledby="moving" className="panel">
        <h2 id="moving" className="sr-only">
          Which way it is moving
        </h2>
        <Statement size="m" as="p">
          {o.trendStatement}
        </Statement>
        {o.weekly.length ? (
          <div style={{ marginTop: 16 }}>
            <TrendChart
              label={`${sectorName} postings in ${o.country.label} against the line since February 2020. ${o.trendStatement}`}
              series={o.weekly.map((p) => ({ date: p.week, value: p.value }))}
              forecast={forecast}
            />
          </div>
        ) : (
          <EmptyState>Postings data for this sector has not been imported yet.</EmptyState>
        )}
        {forecast ? (
          <p className="small" style={{ marginTop: 12 }}>
            {FORECAST_CAVEAT} <a href="/method#forecasts">Backtest scores</a>
          </p>
        ) : null}
        <Explain {...EXPLAIN.trend} />
        <SourceRow
          source={`Indeed Hiring Lab, ${sectorName}, ${o.country.label}`}
          dataThrough={dataThrough}
          updated={ds?.lastSuccessAt ?? null}
          methodHref="/method#forecasts"
          csvHref={csv}
        />
      </section>

      {/* 4 to 9: later phases */}
      <section aria-labelledby="ask">
        <h2 id="ask" className="heading">
          What employers ask for
        </h2>
        <div style={{ marginTop: 12 }}>
          <EmptyState>
            Skills appear after 90 days of job-board collection, with at least 200 postings for this role and country.
            Collection has not started yet.
          </EmptyState>
        </div>
      </section>
      <section aria-labelledby="titles">
        <h2 id="titles" className="heading">
          Titles to search for
        </h2>
        <div style={{ marginTop: 12 }}>
          <EmptyState>Titles appear once job-board collection starts and a title has 15 open postings at 5 companies.</EmptyState>
        </div>
      </section>
      <section aria-labelledby="fit">
        <h2 id="fit" className="heading">
          Where else your skills fit
        </h2>
        <div style={{ marginTop: 12 }}>
          <EmptyState>Nearby roles appear once there are 180 days of skill data for each role.</EmptyState>
        </div>
      </section>
      <section aria-labelledby="hiring">
        <h2 id="hiring" className="heading">
          Who is hiring
        </h2>
        <div style={{ marginTop: 12 }}>
          <EmptyState>Companies with open roles appear once job-board collection starts.</EmptyState>
        </div>
      </section>
      <section aria-labelledby="correction">
        <h2 id="correction" className="heading">
          What a correction would mean
        </h2>
        <div style={{ marginTop: 12 }}>
          <EmptyState>
            The table of past tech-job corrections appears with the pressure gauge. It is computed from US employment data,
            never typed in.
          </EmptyState>
        </div>
      </section>

      {/* 10. share */}
      <section aria-labelledby="share">
        <h2 id="share" className="heading">
          Share
        </h2>
        <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <CopyLink />
          <a href={`/api/og?family=${o.family.id}&country=${o.country.code}`}>Share image</a>
        </div>
      </section>
    </div>
  );
}
