import { formatDate, lineWords } from '@/lib/format';
import { metrics, positionState, type StateName } from '@/lib/metrics';

export type StripItem = {
  id: string;
  /** Full name for the accessible label, for example "Software Development". */
  name: string;
  /** Short label drawn next to the dot. */
  short: string;
  value: number;
  valueThen: number | null;
  href: string;
  reference?: boolean;
};

const FILL: Record<StateName, string> = {
  Frozen: 'var(--frozen)',
  Cold: 'var(--cold)',
  Thawing: 'var(--thawing)',
  Open: 'var(--open)',
};

const cfg = metrics.line_strip;
const clampPts = (v: number) => Math.max(-cfg.clamp_points, Math.min(cfg.clamp_points, v - 100));

function direction(item: StripItem): string {
  if (item.valueThen === null) return '';
  const d = item.value - item.valueThen;
  if (d > 0.5) return 'rising';
  if (d < -0.5) return 'falling';
  return 'flat';
}

export function accessibleName(item: StripItem): string {
  const pos = lineWords(item.value);
  const where = pos === 'at the line' ? 'at the line' : `${pos} the line`;
  const dir = direction(item);
  return `${item.name}, ${where}${dir ? `, ${dir}` : ''}`;
}

/** Greedy wrap at about 11 characters, never hiding text. */
function wrap(text: string, max = 11): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + word).length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

const R = 7; // 14 px dot
const NAME_LH = 20;
const VALUE_LH = 18;

function Dot({ item, x, y }: { item: StripItem; x: number; y: number }) {
  const state = positionState(item.value);
  return (
    <>
      <circle className="strip-halo" cx={x} cy={y} r={R + 4} fill="none" stroke="transparent" strokeWidth={2} />
      {item.reference ? (
        <circle cx={x} cy={y} r={R - 0.75} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.5} />
      ) : (
        <circle cx={x} cy={y} r={R} fill={FILL[state]} />
      )}
      <title>{accessibleName(item)}</title>
    </>
  );
}

// ------------------------------------------------------------------ wide layout

function Wide({ items, dataThrough }: { items: StripItem[]; dataThrough: string }) {
  const W = 1072;
  const gutter = 104;
  const slot = (W - gutter) / items.length;
  const s = cfg.scale_desktop_px;
  const placed = items.map((item, i) => {
    const x = gutter + slot * i + R + 2;
    const y = -clampPts(item.value) * s;
    const yThen = item.valueThen === null ? null : -clampPts(item.valueThen) * s;
    const above = item.value >= 100;
    const lines = wrap(item.short);
    const blockH = lines.length * NAME_LH + VALUE_LH;
    const extreme = above ? Math.min(y, yThen ?? y) - R - 8 : Math.max(y, yThen ?? y) + R + 8;
    const top = above ? extreme - blockH : extreme;
    return { item, i, x, y, yThen, lines, top, blockH };
  });
  const minY = Math.min(-60, ...placed.map((p) => p.top));
  const maxY = Math.max(60, ...placed.map((p) => p.top + p.blockH));
  const vb = `0 ${minY - 8} ${W} ${maxY - minY + 16}`;
  return (
    <svg
      viewBox={vb}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      role="group"
      aria-label={`Job postings by sector against the line, data to ${formatDate(dataThrough)}`}
    >
      <line x1={0} x2={W} y1={0} y2={0} stroke="var(--ink)" strokeWidth={2} />
      <text x={0} y={-44} fill="var(--slate)" style={{ fontSize: 13, fontWeight: 500 }}>
        <tspan x={0}>The line:</tspan>
        <tspan x={0} dy={18}>
          postings on
        </tspan>
        <tspan x={0} dy={18}>
          1 Feb 2020
        </tspan>
      </text>
      {placed.map((p) => (
        <g key={p.item.id}>
          <line
            className="strip-after"
            style={{ ['--n' as string]: items.length }}
            x1={p.x}
            x2={p.x}
            y1={0}
            y2={p.y}
            stroke="var(--rule)"
            strokeWidth={1}
          />
          {p.yThen !== null ? (
            <g className="strip-after" style={{ ['--n' as string]: items.length }} opacity={0.4}>
              <line x1={p.x - 16} y1={p.yThen} x2={p.x} y2={p.y} stroke="var(--ink)" strokeWidth={1} />
              <circle cx={p.x - 16} cy={p.yThen} r={3} fill="var(--ink)" />
            </g>
          ) : null}
          <a href={p.item.href} aria-label={accessibleName(p.item)} className="strip-link">
            <g className="strip-rise" style={{ ['--i' as string]: p.i, ['--dy' as string]: `${-p.y}px` }}>
              <Dot item={p.item} x={p.x} y={p.y} />
              <text x={p.x - R} y={p.top} style={{ fontSize: 14 }} fill="var(--ink)">
                {p.lines.map((line, k) => (
                  <tspan key={k} x={p.x - R} dy={k === 0 ? 15 : NAME_LH}>
                    {line}
                  </tspan>
                ))}
                <tspan x={p.x - R} dy={VALUE_LH} style={{ fontSize: 13, fontWeight: 500 }} fill="var(--slate)">
                  {lineWords(p.item.value)}
                </tspan>
              </text>
            </g>
          </a>
        </g>
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ narrow layout

function Narrow({ items }: { items: StripItem[] }) {
  const W = 358;
  const lineX = 134;
  const rowH = 52;
  const top = 28;
  const s = cfg.scale_mobile_px;
  const H = top + items.length * rowH + 8;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      role="group"
      aria-label="Job postings by sector against the line"
    >
      <text x={lineX + 8} y={14} style={{ fontSize: 13, fontWeight: 500 }} fill="var(--slate)">
        The line: postings on 1 Feb 2020
      </text>
      <line x1={lineX} x2={lineX} y1={top - 6} y2={H} stroke="var(--ink)" strokeWidth={2} />
      {items.map((item, i) => {
        const rowTop = top + i * rowH;
        const cy = rowTop + 36;
        const x = lineX + clampPts(item.value) * s;
        const xThen = item.valueThen === null ? null : lineX + clampPts(item.valueThen) * s;
        return (
          <g key={item.id}>
            <line x1={lineX} x2={x} y1={cy} y2={cy} stroke="var(--rule)" strokeWidth={1} />
            {xThen !== null ? (
              <g opacity={0.4}>
                <line x1={xThen} y1={cy} x2={x} y2={cy} stroke="var(--ink)" strokeWidth={1} />
                <circle cx={xThen} cy={cy} r={3} fill="var(--ink)" />
              </g>
            ) : null}
            <a href={item.href} aria-label={accessibleName(item)} className="strip-link">
              <text
                x={0}
                y={rowTop + 14}
                style={{ fontSize: 14, paintOrder: 'stroke' }}
                fill="var(--ink)"
                stroke="var(--paper)"
                strokeWidth={5}
                strokeLinejoin="round"
              >
                {item.short}
                <tspan dx={8} style={{ fontSize: 13, fontWeight: 500 }} fill="var(--slate)">
                  {lineWords(item.value)}
                </tspan>
              </text>
              <Dot item={item} x={x} y={cy} />
            </a>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The signature element (spec 3.4): every tracked sector as a dot above or below
 * the line, with a tail to where it stood 13 weeks ago.
 */
export function LineStrip({ items, dataThrough }: { items: StripItem[]; dataThrough: string }) {
  return (
    <figure>
      <div className="only-wide">
        <Wide items={items} dataThrough={dataThrough} />
      </div>
      <div className="only-narrow">
        <Narrow items={items} />
      </div>
      <figcaption className="sr-only">
        Each sector is a dot above or below the line, with a faint tail to where it stood 13 weeks earlier. Data to{' '}
        {formatDate(dataThrough)}.
      </figcaption>
    </figure>
  );
}
