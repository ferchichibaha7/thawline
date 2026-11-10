import { PositionBar } from './PositionBar';

export type ComponentRow = {
  name: string;
  score: number | null;
  reading: string;
  weight: number | null;
};

/** The parts of the Thaw Index (spec 3.5). Missing parts are listed with the reason. */
export function ComponentBreakdown({ rows }: { rows: ComponentRow[] }) {
  return (
    <table className="data" style={{ marginTop: 24 }}>
      <caption className="sr-only">Thaw Index components</caption>
      <thead>
        <tr>
          <th scope="col">Part</th>
          <th scope="col" className="hide-narrow" style={{ width: '22%' }}>
            Score
          </th>
          <th scope="col" className="num">
            Of 100
          </th>
          <th scope="col">Reading</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <th scope="row" style={{ fontWeight: 500, color: 'var(--ink)', verticalAlign: 'top' }}>
              {r.name}
              {r.weight !== null ? <span className="muted small"> {Math.round(r.weight)}% of score</span> : null}
            </th>
            <td className="hide-narrow" style={{ verticalAlign: 'middle' }}>
              {r.score !== null ? (
                <PositionBar mini score={r.score} state="" label={`${r.name} ${Math.round(r.score)} of 100`} />
              ) : (
                <span className="muted">Not used</span>
              )}
            </td>
            <td className="num">{r.score !== null ? Math.round(r.score) : 'None'}</td>
            <td>{r.reading}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
