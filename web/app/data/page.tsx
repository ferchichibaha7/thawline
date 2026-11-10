import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import { ErrorState } from '@/components/ErrorState';
import { Statement } from '@/components/Statement';
import { formatDate, formatNumber } from '@/lib/format';
import { attempt, datasetsWithFreshness } from '@/lib/queries';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Data and API',
  description: 'Every dataset behind Thawline, with licenses, freshness, downloads and a free read-only API.',
};

export const revalidate = 3600;

const FRESHNESS_WORDS = { fresh: 'On time', late: 'Late', stale: 'Stale', never: 'Not yet collected' } as const;

type Manifest = { generated_at: string; files: { name: string; rows: number; csv: string; json: string; license: string; attribution: string }[] };

async function manifest(): Promise<Manifest | null> {
  const dir = process.env.THAWLINE_EXPORT_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), '..', 'data', 'exports');
  try {
    return JSON.parse(await readFile(path.join(/*turbopackIgnore: true*/ dir, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

const ROUTES = [
  ['GET /api/v1/sectors?country=US', 'Latest weekly index, 13-week change and position for each sector'],
  ['GET /api/v1/series/{id}', 'Daily observations and the latest published forecast'],
  ['GET /api/v1/outlook/{family}?country=US', 'Thaw Index, its parts, state and statement'],
  ['GET /api/v1/signals?since=2026-01-01', 'Signals, newest first'],
  ['GET /api/v1/datasets', 'Freshness and licenses of every source'],
];

export default async function DataPage() {
  const r = await attempt(async () => ({ datasets: await datasetsWithFreshness(), files: await manifest() }));
  if (!r.ok) return <div className="page"><ErrorState /></div>;
  const { datasets, files } = r.data;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: 'Thawline data',
    url: `${SITE_URL}/data`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    dataset: datasets.map((d) => ({
      '@type': 'Dataset',
      name: d.name,
      description: d.notes ?? d.name,
      license: d.license,
      creator: { '@type': 'Organization', name: d.attribution },
      url: d.sourceUrl,
    })),
  };

  return (
    <div className="page stack-sections">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section>
        <Statement size="l">
          {datasets.length} public sources feed Thawline. All of them, and everything Thawline derives from them, can be
          downloaded.
        </Statement>
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources" className="heading">
          Sources
        </h2>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Dataset</th>
                <th scope="col">License and credit</th>
                <th scope="col">Data to</th>
                <th scope="col">Last update</th>
                <th scope="col" className="num">Rows</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={d.sourceUrl} rel="noopener noreferrer">
                      {d.name}
                    </a>
                  </td>
                  <td>
                    {d.license}. {d.attribution}.
                  </td>
                  <td>{d.dataThrough ? formatDate(d.dataThrough) : 'None'}</td>
                  <td>{d.lastSuccessAt ? formatDate(d.lastSuccessAt) : 'Never'}</td>
                  <td className="num">{d.rowCount !== null ? formatNumber(d.rowCount) : 'None'}</td>
                  <td style={d.freshness === 'fresh' ? undefined : { borderLeft: '3px solid var(--flare)', paddingLeft: 8 }}>
                    {FRESHNESS_WORDS[d.freshness]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="downloads">
        <h2 id="downloads" className="heading">
          Downloads
        </h2>
        {files ? (
          <>
            <p className="small muted" style={{ marginTop: 8 }}>
              Snapshots made {formatDate(files.generated_at)}. Data produced by Thawline is CC BY 4.0; source data keeps its
              own license, shown per file.
            </p>
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">File</th>
                    <th scope="col" className="num">Rows</th>
                    <th scope="col">License and credit</th>
                    <th scope="col">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {files.files.map((f) => (
                    <tr key={f.name}>
                      <td>{f.name.replace(/_/g, ' ')}</td>
                      <td className="num">{formatNumber(f.rows)}</td>
                      <td>
                        {f.license}. {f.attribution}.
                      </td>
                      <td>
                        <a href={`/exports/${f.csv}`}>Download CSV</a> <a href={`/exports/${f.json}`}>Download JSON</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p style={{ marginTop: 12 }}>Snapshots appear after the pipeline&apos;s first export.</p>
        )}
      </section>

      <section aria-labelledby="api" className="body-text">
        <h2 id="api" className="heading">
          API
        </h2>
        <p>
          Read-only, free, no key, open to any origin. Responses are JSON with a <code>meta</code> block giving the source,
          license, data date and method version. Add <code>?format=csv</code> for CSV; its first line states the source and
          license. The full description is at <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>.
        </p>
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Returns</th>
            </tr>
          </thead>
          <tbody>
            {ROUTES.map(([route, what]) => (
              <tr key={route}>
                <td>
                  <code>{route}</code>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
