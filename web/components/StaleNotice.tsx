import { formatDate } from '@/lib/format';

/** Inline notice for a late or stale source (spec 3.5, 4.9). */
export function StaleNotice({ lastData, stale = false }: { lastData: string | null; stale?: boolean }) {
  return (
    <p
      role="status"
      className="small"
      style={{ borderLeft: '3px solid var(--flare)', padding: '8px 12px', background: 'var(--sheet)', margin: '12px 0' }}
    >
      This source is late.{lastData ? ` Last data: ${formatDate(lastData)}.` : ''}
      {stale ? ' Projections and scores that depend on it are paused until the source updates.' : ''}
    </p>
  );
}
