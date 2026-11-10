import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import type { Metadata } from 'next';
import { ErrorState } from '@/components/ErrorState';
import { Statement } from '@/components/Statement';
import { formatDate } from '@/lib/format';
import { metrics } from '@/lib/metrics';
import { attempt, getForecastScores } from '@/lib/queries';
import { sql } from '@/lib/db';
import { unstable_cache } from 'next/cache';

export const metadata: Metadata = {
  title: 'Method',
  description: 'How Thawline calculates every number it shows, in plain language and in formulas.',
};
export const revalidate = 3600;

const CONTENT = path.join(process.cwd(), 'content', 'method');

function listWords(xs: unknown[]): string {
  const s = xs.map(String);
  return s.length < 2 ? s.join('') : `${s.slice(0, -1).join(', ')} or ${s[s.length - 1]}`;
}

const w = metrics.thaw_index.weights;
const CONTEXT = {
  ...metrics,
  derived: {
    level_share: Math.round((w.level / (w.level + w.momentum)) * 100),
    momentum_share: Math.round((w.momentum / (w.level + w.momentum)) * 100),
  },
};

/** Replace {{a.b.c}} with values from config/metrics.json, so the page matches the code. */
function fill(md: string): string {
  return md.replace(/\{\{([a-z0-9_.]+)\}\}/g, (_, key: string) => {
    let v: unknown = CONTEXT;
    for (const k of key.split('.')) v = (v as Record<string, unknown>)?.[k];
    if (Array.isArray(v)) return listWords(v);
    if (v === undefined) throw new Error(`Unknown method placeholder ${key}`);
    return String(v);
  });
}

async function sections() {
  const files = (await readdir(CONTENT)).filter((f) => f.endsWith('.md')).sort();
  return Promise.all(
    files.map(async (f) => ({
      id: f.replace(/^\d+-/, '').replace(/\.md$/, ''),
      html: await marked.parse(fill(await readFile(path.join(CONTENT, f), 'utf8'))),
    })),
  );
}

/** The sanity check from spec 8.1, computed live from the stored index. */
const sanity = unstable_cache(
  async () => {
    const v = metrics.thaw_index.version;
    const [early] = await sql`
      select round(avg(score)::numeric, 1) as score, mode() within group (order by state) as state
      from thaw_index where family_id = 'backend' and country = 'US' and version = ${v}
        and week between '2022-01-01' and '2022-03-31'`;
    const [low] = await sql`
      select week, score, state from thaw_index
      where family_id = 'backend' and country = 'US' and version = ${v}
      order by score asc, week asc limit 1`;
    return { early, low };
  },
  ['method-sanity'],
  { revalidate: 3600, tags: ['thaw_index'] },
);

const fmt = (n: number | null) => (n === null ? 'None' : n.toFixed(2));

export default async function MethodPage() {
  const r = await attempt(async () => {
    const [secs, scores, check] = await Promise.all([sections(), getForecastScores(), sanity()]);
    return { secs, scores, check };
  });
  if (!r.ok) return <div className="page"><ErrorState /></div>;
  const { secs, scores, check } = r.data;
  const shipped = scores.filter((s) => s.shipped).length;

  return (
    <div className="page">
      <Statement size="l">Every number on Thawline comes from a public source and a fixed rule written here.</Statement>
      <div className="prose-method" style={{ marginTop: 24 }}>
        {secs.map((s) => (
          <section key={s.id} id={s.id}>
            <div dangerouslySetInnerHTML={{ __html: s.html }} />
            {s.id === 'thaw-index' && check.early && check.low ? (
              <>
                <h3>Sanity check</h3>
                <p>
                  The index is checked against the United States software series. In January to March
                  2022 it averaged {String(check.early.score)}, which is {String(check.early.state)}. Its lowest reading
                  was {Number(check.low.score).toFixed(1)}, {String(check.low.state)}, in the week to{' '}
                  {formatDate(String(check.low.week))}. The rule is that the first should read Open and the second Frozen
                  or Cold.
                </p>
              </>
            ) : null}
            {s.id === 'forecasts' ? (
              <>
                <h3>Current backtest scores</h3>
                <p>
                  {shipped} of {scores.length} series currently have a published projection. A MASE below{' '}
                  {metrics.forecast.ship_mase_26} at 26 weeks is required.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th scope="col">Series</th>
                        <th scope="col">Chosen model</th>
                        <th scope="col" className="num">MASE 13 weeks</th>
                        <th scope="col" className="num">MASE 26 weeks</th>
                        <th scope="col" className="num">MASE 52 weeks</th>
                        <th scope="col">Published</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s) => (
                        <tr key={s.seriesId}>
                          <td>
                            <a href={`/series/${s.seriesId}`}>{s.label}</a>
                          </td>
                          <td>{s.model}</td>
                          <td className="num">{fmt(s.mase13)}</td>
                          <td className="num">{fmt(s.mase26)}</td>
                          <td className="num">{fmt(s.mase52)}</td>
                          <td>{s.shipped ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
