import type { Metadata } from 'next';
import { ErrorState } from '@/components/ErrorState';
import { Statement } from '@/components/Statement';
import { formatDate } from '@/lib/format';
import { attempt, datasetsWithFreshness, getRuns } from '@/lib/queries';

export const metadata: Metadata = { title: 'Status', description: 'The last run of every pipeline job.' };
export const revalidate = 300;

const time = (iso: string) => `${formatDate(iso)}, ${iso.slice(11, 16)} UTC`;

export default async function StatusPage() {
  const r = await attempt(async () => ({ runs: await getRuns(), datasets: await datasetsWithFreshness() }));
  if (!r.ok) return <div className="page"><ErrorState /></div>;
  const { runs, datasets } = r.data;
  const failed = runs.filter((x) => x.status !== 'ok');
  const late = datasets.filter((d) => d.freshness !== 'fresh');
  return (
    <div className="page stack-sections">
      <Statement size="l">
        {failed.length === 0 && late.length === 0
          ? 'Every job ran successfully on its last run and every source is on time.'
          : `${failed.length} of ${runs.length} jobs failed on their last run. ${late.length} of ${datasets.length} sources are late.`}
      </Statement>
      <section>
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Last run</th>
              <th scope="col">Result</th>
              <th scope="col" className="num">Rows</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((x) => (
              <tr key={x.job}>
                <td>{x.job}</td>
                <td>{time(x.startedAt)}</td>
                <td style={x.status === 'ok' ? undefined : { borderLeft: '3px solid var(--flare)', paddingLeft: 8 }}>
                  {x.status === 'ok' ? 'Succeeded' : x.status === 'running' ? 'Running' : 'Failed'}
                </td>
                <td className="num">{x.rowsWritten ?? 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
