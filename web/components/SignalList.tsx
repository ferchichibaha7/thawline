import { formatDate } from '@/lib/format';

export type SignalItem = { id: string | number; date: string; sentence: string; href: string | null };

/** Dated one-sentence items, newest first (spec 3.5). */
export function SignalList({ items }: { items: SignalItem[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {items.map((s) => (
        <li key={s.id} style={{ display: 'grid', gridTemplateColumns: '7.5em 1fr', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
          <span className="small muted" style={{ paddingTop: 2 }}>
            {formatDate(s.date)}
          </span>
          <span>{s.href ? <a href={s.href}>{s.sentence}</a> : s.sentence}</span>
        </li>
      ))}
    </ul>
  );
}
