type Segment = { name: string; color: string };

const THAW: Segment[] = [
  { name: 'Frozen', color: 'var(--frozen)' },
  { name: 'Cold', color: 'var(--cold)' },
  { name: 'Thawing', color: 'var(--thawing)' },
  { name: 'Open', color: 'var(--open)' },
];

export const PRESSURE: Segment[] = [
  { name: 'Calm', color: 'var(--rule)' },
  { name: 'Stretched', color: 'var(--slate)' },
  { name: 'Strained', color: 'var(--flare)' },
];

type Props = {
  score: number;
  state: string;
  segments?: Segment[];
  /** Accessible description, for example "Thaw Index 31 of 100, Cold". */
  label: string;
  /** Mini variant for ComponentBreakdown: 4 px track, no figure or state. */
  mini?: boolean;
};

/** A score on a tinted track (spec 3.5). */
export function PositionBar({ score, state, segments = THAW, label, mini = false }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  const track = (
    <div
      role="img"
      aria-label={label}
      style={{ position: 'relative', height: mini ? 4 : 8, display: 'flex', flex: 1, minWidth: mini ? 80 : 160 }}
    >
      {segments.map((s) => (
        <span
          key={s.name}
          style={{ flex: 1, background: `color-mix(in srgb, ${s.color} 35%, transparent)` }}
        />
      ))}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: `calc(${pct}% - 1px)`,
          top: mini ? -4 : -6,
          width: 2,
          height: mini ? 12 : 20,
          background: 'var(--ink)',
        }}
      />
    </div>
  );
  if (mini) return track;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span className="figure" style={{ minWidth: '2.2ch' }}>
        {Math.round(score)}
      </span>
      {track}
      <span className="heading" style={{ minWidth: '5.5em' }}>
        {state}
      </span>
    </div>
  );
}
