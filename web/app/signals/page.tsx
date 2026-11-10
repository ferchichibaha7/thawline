import type { Metadata } from 'next';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SignalList } from '@/components/SignalList';
import { SourceRow } from '@/components/SourceRow';
import { Statement } from '@/components/Statement';
import { signalHref } from '@/lib/links';
import { attempt, getCountries, getDataset, getSignals } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Signals',
  description: 'Dated one-sentence facts about job postings, produced by fixed rules.',
};

const KINDS = [
  { id: 'crossed_line', label: 'Crossed the line' },
  { id: 'streak', label: 'Streaks' },
  { id: 'state_change', label: 'State changes' },
];

type Search = { kind?: string; country?: string };

export default async function SignalsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const kind = KINDS.some((k) => k.id === sp.kind) ? sp.kind : undefined;
  const r = await attempt(async () => {
    const [signals, countries, dataset] = await Promise.all([
      getSignals({ limit: 200, kind, country: sp.country }),
      getCountries(),
      getDataset('indeed_jpi'),
    ]);
    return { signals, countries, dataset };
  });
  if (!r.ok) return <div className="page"><ErrorState /></div>;
  const { signals, countries, dataset } = r.data;
  const country = countries.find((c) => c.code === sp.country);
  const qs = (k?: string, c?: string) => {
    const p = new URLSearchParams();
    if (k) p.set('kind', k);
    if (c) p.set('country', c);
    const s = p.toString();
    return s ? `/signals?${s}` : '/signals';
  };

  return (
    <div className="page stack-sections">
      <section>
        <Statement size="l">
          {signals.length
            ? `${signals.length} signals${country ? ` for ${country.label}` : ''}, newest first. Each is a dated fact produced by a fixed rule.`
            : 'No signals match this filter.'}
        </Statement>
        <nav aria-label="Filter signals" style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <a href={qs(undefined, sp.country)} aria-current={!kind ? 'page' : undefined}>
            All kinds
          </a>
          {KINDS.map((k) => (
            <a key={k.id} href={qs(k.id, sp.country)} aria-current={kind === k.id ? 'page' : undefined}>
              {k.label}
            </a>
          ))}
        </nav>
        <nav aria-label="Filter by country" style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <a href={qs(kind)} aria-current={!country ? 'page' : undefined}>
            All countries
          </a>
          {countries.map((c) => (
            <a key={c.code} href={qs(kind, c.code)} aria-current={country?.code === c.code ? 'page' : undefined}>
              {c.label}
            </a>
          ))}
        </nav>
      </section>
      <section>
        {signals.length ? (
          <SignalList items={signals.map((s) => ({ id: s.id, date: s.signalDate, sentence: s.sentence, href: signalHref(s) }))} />
        ) : (
          <EmptyState>Signals cover the last 26 weeks of data. Try another filter.</EmptyState>
        )}
        <SourceRow
          source="Indeed Hiring Lab; signal rules by Thawline"
          dataThrough={dataset?.dataThrough ?? null}
          updated={dataset?.lastSuccessAt ?? null}
          methodHref="/method#signals"
          csvHref={`/api/v1/signals?format=csv${kind ? `&kind=${kind}` : ''}`}
        />
        <p className="small" style={{ marginTop: 8 }}>
          <a href="/signals/rss.xml">Follow by RSS</a>
        </p>
      </section>
    </div>
  );
}
