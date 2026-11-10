import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ErrorState } from '@/components/ErrorState';
import { RolePicker } from '@/components/RolePicker';
import { SourceRow } from '@/components/SourceRow';
import { StateTag } from '@/components/StateTag';
import { Statement } from '@/components/Statement';
import { outlookHref } from '@/lib/links';
import { attempt, getDataset, getThawIndex } from '@/lib/queries';
import { resolveRole } from '@/lib/outlook';
import { countryInSentence } from '@/lib/site';

export const metadata: Metadata = { title: 'Outlook by role' };

type Search = { family?: string; country?: string; level?: string };

/** The role picker posts here; with a role it redirects to that outlook. */
export default async function OutlookIndex({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  if (sp.family) redirect(outlookHref(sp.family, sp.country ?? 'US', sp.level ?? 'mid'));

  const result = await attempt(async () => {
    const { families, countries, country } = await resolveRole(undefined, sp.country);
    if (!country) throw new Error('no countries');
    const scores = await Promise.all(families.map((f) => getThawIndex(f.id, country.code)));
    const dataset = await getDataset('indeed_jpi');
    return { families, countries, country, scores, dataset };
  });
  if (!result.ok) return <div className="page"><ErrorState /></div>;
  const { families, countries, country, scores, dataset } = result.data;
  const week = scores.find((s) => s)?.week ?? null;

  return (
    <div className="page stack-sections">
      <section>
        <Statement size="l">Every role we track in {countryInSentence(country.code, country.label)}, by Thaw Index.</Statement>
        <div style={{ marginTop: 32 }}>
          <RolePicker
            families={families.map((f) => ({ value: f.id, label: f.label }))}
            countries={countries.map((c) => ({ value: c.code, label: c.label }))}
            family="frontend"
            country={country.code}
            level={sp.level ?? 'mid'}
          />
        </div>
      </section>
      <section>
        {country.hasSectors ? (
          <table className="data">
            <caption className="sr-only">Thaw Index by role in {country.label}</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Indeed sector used</th>
                <th scope="col" className="num">Score</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f, i) => {
                const s = scores[i];
                return (
                  <tr key={f.id}>
                    <td>
                      <a href={outlookHref(f.id, country.code)}>{f.label}</a>
                    </td>
                    <td className="muted">{f.indeedSector}</td>
                    <td className="num">{s ? Math.round(s.score) : 'None'}</td>
                    <td>{s ? <StateTag state={s.state} /> : 'Not enough data'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="body-text">
            Indeed does not publish sector data for {country.label}, so there are no role-level scores. Try the United
            Kingdom, Germany or France for a nearby large market.
          </p>
        )}
        <SourceRow
          source="Indeed Hiring Lab; Thaw Index by Thawline"
          dataThrough={week}
          updated={dataset?.lastSuccessAt ?? null}
          methodHref="/method#thaw-index"
          csvHref="/exports/thaw_index.csv"
        />
      </section>
    </div>
  );
}
