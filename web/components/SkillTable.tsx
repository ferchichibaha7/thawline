'use client';

import { useState } from 'react';

export type SkillRow = { skill: string; share: number; change: number | null };
type Key = 'skill' | 'share' | 'change';

/** Skills by share of postings and 90-day change, sortable (spec 3.5). */
export function SkillTable({ rows, caption }: { rows: SkillRow[]; caption: string }) {
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: 'share', desc: true });
  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key] ?? -Infinity;
    const bv = b[sort.key] ?? -Infinity;
    const c = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sort.desc ? -c : c;
  });
  const max = Math.max(...rows.map((r) => r.share), 0.0001);
  const header = (key: Key, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'skill' }))}
        style={{ font: 'inherit', color: 'inherit', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
      >
        {label}
      </button>
    </th>
  );
  return (
    <table className="data">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {header('skill', 'Skill')}
          {header('share', 'Share of postings')}
          {header('change', 'Change over 90 days')}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.skill}>
            <td>{r.skill}</td>
            <td>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden
                  style={{ display: 'inline-block', height: 4, width: `${(r.share / max) * 120}px`, background: 'var(--ink)' }}
                />
                {Math.round(r.share * 100)}%
              </span>
            </td>
            <td className="num">
              {r.change === null
                ? 'None yet'
                : `${r.change > 0 ? '▲ +' : r.change < 0 ? '▼ ' : ''}${Math.round(r.change)} points`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
