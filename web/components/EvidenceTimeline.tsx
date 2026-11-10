import { formatDate } from '@/lib/format';

export type EvidenceEntry = {
  id: string | number;
  date: string;
  type: string;
  summary: string;
  publisher: string;
  url: string;
  tier: 'A' | 'B' | 'C' | 'D';
};

function Entries({ entries }: { entries: EvidenceEntry[] }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, borderLeft: '1px solid var(--rule)', marginLeft: 4 }}>
      {entries.map((e) => (
        <li key={e.id} style={{ position: 'relative', padding: '0 0 24px 24px' }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: -5,
              top: 8,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: 'var(--ink)',
            }}
          />
          <p className="small muted">
            {formatDate(e.date)} <span className="tag tint-rule">{e.type}</span>
          </p>
          <p style={{ marginTop: 4 }}>{e.summary}</p>
          <p className="small" style={{ marginTop: 4 }}>
            <a href={e.url} rel="noopener noreferrer">
              {e.publisher}
            </a>{' '}
            <span className="muted">Tier {e.tier}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Dated evidence, newest first. Unverified reports sit apart (spec 3.5, 4.3). */
export function EvidenceTimeline({ entries }: { entries: EvidenceEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const verified = sorted.filter((e) => e.tier !== 'D');
  const unverified = sorted.filter((e) => e.tier === 'D');
  return (
    <div>
      <Entries entries={verified} />
      {unverified.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <h3 className="heading">Reports we could not verify</h3>
          <div style={{ marginTop: 12 }}>
            <Entries entries={unverified} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
