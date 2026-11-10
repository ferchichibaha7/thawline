'use client';

import { bisector } from 'd3-array';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, line } from 'd3-shape';
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { axisWords, formatDate, lineWords, toDate } from '@/lib/format';

export type ChartPoint = { date: string; value: number };
export type ChartForecast = {
  weeks: string[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
};

type Props = {
  /** The statement sentence; also the chart's accessible name (spec 3.6). */
  label: string;
  series: ChartPoint[];
  comparisons?: { label: string; points: ChartPoint[] }[];
  subjectLabel?: string;
  forecast?: ChartForecast | null;
  baseline?: number;
};

type Layout = { width: number; height: number; left: number; right: number; top: number; bottom: number };
const WIDE: Layout = { width: 1072, height: 300, left: 76, right: 104, top: 24, bottom: 28 };
const NARROW: Layout = { width: 358, height: 240, left: 70, right: 80, top: 24, bottom: 28 };

type Hover = { kind: 'data'; i: number } | { kind: 'forecast'; i: number } | null;

const byDate = bisector((d: { t: number }) => d.t).center;

function Svg({
  layout,
  props,
  hover,
  setHover,
  clipId,
}: {
  layout: Layout;
  props: Props;
  hover: Hover;
  setHover: (h: Hover) => void;
  clipId: string;
}) {
  const { series, forecast, comparisons = [], baseline = 100 } = props;
  // The right margin holds direct labels; without any, the plot uses the width.
  const L = forecast || comparisons.length ? layout : { ...layout, right: 8 };
  const data = useMemo(() => series.map((p) => ({ t: toDate(p.date).getTime(), v: p.value })), [series]);
  const fc = useMemo(
    () =>
      forecast
        ? forecast.weeks.map((w, i) => ({
            t: toDate(w).getTime(),
            p10: forecast.p10[i]!,
            p25: forecast.p25[i]!,
            p50: forecast.p50[i]!,
            p75: forecast.p75[i]!,
            p90: forecast.p90[i]!,
          }))
        : [],
    [forecast],
  );
  const comps = comparisons.map((c) => ({
    label: c.label,
    pts: c.points.map((p) => ({ t: toDate(p.date).getTime(), v: p.value })),
  }));

  const t0 = data[0]?.t ?? 0;
  const tLast = data[data.length - 1]?.t ?? 0;
  const tEnd = fc.length ? fc[fc.length - 1]!.t : tLast;
  const values = [
    baseline,
    ...data.map((d) => d.v),
    ...fc.flatMap((f) => [f.p10, f.p90]),
    ...comps.flatMap((c) => c.pts.map((p) => p.v)),
  ];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || 5;

  const x = scaleUtc()
    .domain([new Date(t0), new Date(tEnd)])
    .range([L.left, L.width - L.right]);
  const y = scaleLinear()
    .domain([lo - pad, hi + pad])
    .range([L.height - L.bottom, L.top])
    .nice(5);
  const yBase = y(baseline);

  const ticks = y.ticks(5).filter((v) => Math.abs(v - baseline) > (y.domain()[1]! - y.domain()[0]!) * 0.06);
  const span = tEnd - t0;
  const years: Date[] = [];
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(tEnd).getUTCFullYear(); yr++) {
    years.push(new Date(Date.UTC(yr, 0, 1)));
  }
  const showQuarters = span < 2 * 365.25 * 864e5;
  const quarterTicks: Date[] = [];
  if (showQuarters) {
    const start = new Date(t0);
    for (let d = new Date(Date.UTC(start.getUTCFullYear(), Math.ceil(start.getUTCMonth() / 3) * 3, 1)); d.getTime() <= tEnd; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1))) {
      if (d.getUTCMonth() !== 0) quarterTicks.push(d);
    }
  }
  // On narrow charts, label every other year when there are many.
  const yearStep = L.width < 500 && years.length > 4 ? 2 : 1;

  const linePath = line<{ t: number; v: number }>()
    .x((d) => x(d.t))
    .y((d) => y(d.v))(data);
  const areaPath = area<{ t: number; v: number }>()
    .x((d) => x(d.t))
    .y0(yBase)
    .y1((d) => y(d.v))(data);
  const band = (a: 'p10' | 'p25', b: 'p75' | 'p90') =>
    area<(typeof fc)[number]>()
      .x((d) => x(d.t))
      .y0((d) => y(d[a]))
      .y1((d) => y(d[b]))(fc);
  const median = line<(typeof fc)[number]>()
    .x((d) => x(d.t))
    .y((d) => y(d.p50))(fc);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * L.width;
    const t = x.invert(px).getTime();
    if (fc.length && t > tLast) setHover({ kind: 'forecast', i: byDate(fc, t) });
    else setHover({ kind: 'data', i: byDate(data, t) });
  };

  const guideT = hover
    ? hover.kind === 'data'
      ? data[hover.i]?.t
      : fc[hover.i]?.t
    : undefined;

  const lastFc = fc[fc.length - 1];
  const lastComp = comps.map((c) => c.pts[c.pts.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${L.width} ${L.height}`}
      width="100%"
      style={{ display: 'block', touchAction: 'pan-y', overflow: 'visible' }}
      aria-hidden="true"
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <clipPath id={`${clipId}-above`}>
          <rect x={0} y={0} width={L.width} height={yBase} />
        </clipPath>
        <clipPath id={`${clipId}-below`}>
          <rect x={0} y={yBase} width={L.width} height={L.height - yBase} />
        </clipPath>
      </defs>

      {/* gridlines and y labels */}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L.left} x2={L.width - L.right} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={1} />
          <text x={0} y={y(v) + 4} fill="var(--slate)" style={{ fontSize: 13, fontWeight: 500 }}>
            {axisWords(v)}
          </text>
        </g>
      ))}

      {/* area between the series and the line */}
      {areaPath ? (
        <>
          <path d={areaPath} fill="var(--thawing)" fillOpacity={0.25} clipPath={`url(#${clipId}-above)`} />
          <path d={areaPath} fill="var(--cold)" fillOpacity={0.25} clipPath={`url(#${clipId}-below)`} />
        </>
      ) : null}

      {/* forecast fan */}
      {fc.length ? (
        <g>
          <line x1={x(tLast)} x2={x(tLast)} y1={L.top - 8} y2={L.height - L.bottom} stroke="var(--rule)" strokeWidth={1} />
          <text x={x(tLast) + 4} y={L.top - 12} fill="var(--slate)" style={{ fontSize: 13, fontWeight: 500 }}>
            Today
          </text>
          <path d={band('p10', 'p90') ?? ''} fill="var(--slate)" fillOpacity={0.11} />
          <path d={band('p25', 'p75') ?? ''} fill="var(--slate)" fillOpacity={0.22} />
          <path d={median ?? ''} fill="none" stroke="var(--ink)" strokeWidth={2} strokeDasharray="6 5" />
          {lastFc
            ? (() => {
                // Likely range sits at the middle of the inner band; Wider range at the
                // outer band's upper edge, at least one text line above it.
                const likelyY = y((lastFc.p25 + lastFc.p75) / 2) + 4;
                const widerY = Math.max(L.top + 10, Math.min(y(lastFc.p90) + 4, likelyY - 16));
                return (
                  <>
                    <text x={L.width - L.right + 8} y={likelyY} fill="var(--slate)" style={{ fontSize: 13, fontWeight: 500 }}>
                      Likely range
                    </text>
                    <text x={L.width - L.right + 8} y={widerY} fill="var(--slate)" style={{ fontSize: 13, fontWeight: 500 }}>
                      Wider range
                    </text>
                  </>
                );
              })()
            : null}
        </g>
      ) : null}

      {/* the line */}
      <line x1={L.left} x2={L.width - L.right} y1={yBase} y2={yBase} stroke="var(--ink)" strokeWidth={1.5} />
      <text x={0} y={yBase + 4} fill="var(--ink)" style={{ fontSize: 13, fontWeight: 500 }}>
        The line
      </text>

      {/* comparison series in Slate, subject in Ink, direct labels at the right end */}
      {comps.map((c, i) => (
        <g key={c.label}>
          <path
            d={line<{ t: number; v: number }>().x((d) => x(d.t)).y((d) => y(d.v))(c.pts) ?? ''}
            fill="none"
            stroke="var(--slate)"
            strokeWidth={2}
          />
          {lastComp[i] && !fc.length ? (
            <text x={x(lastComp[i]!.t) + 6} y={y(lastComp[i]!.v) + 4} fill="var(--slate)" style={{ fontSize: 13, fontWeight: 500 }}>
              {c.label}
            </text>
          ) : null}
        </g>
      ))}
      <path d={linePath ?? ''} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
      {comps.length && props.subjectLabel && !fc.length && data.length ? (
        <text x={x(tLast) + 6} y={y(data[data.length - 1]!.v) + 4} fill="var(--ink)" style={{ fontSize: 13, fontWeight: 500 }}>
          {props.subjectLabel}
        </text>
      ) : null}

      {/* x labels */}
      {years.map((d, i) =>
        i % yearStep === 0 ? (
          <text key={d.toISOString()} x={x(d)} y={L.height - 6} fill="var(--slate)" style={{ fontSize: 13, fontWeight: 500 }}>
            {d.getUTCFullYear()}
          </text>
        ) : null,
      )}
      {quarterTicks.map((d) => (
        <text key={d.toISOString()} x={x(d)} y={L.height - 6} fill="var(--slate)" style={{ fontSize: 13, fontWeight: 500 }}>
          Q{d.getUTCMonth() / 3 + 1}
        </text>
      ))}

      {/* hover guide */}
      {guideT !== undefined ? (
        <line x1={x(guideT)} x2={x(guideT)} y1={L.top} y2={L.height - L.bottom} stroke="var(--ink)" strokeWidth={1} />
      ) : null}
    </svg>
  );
}

function readout(hover: Hover, series: ChartPoint[], forecast: ChartForecast | null | undefined, baseline: number): string {
  if (!hover) {
    const last = series[series.length - 1];
    return last ? `${formatDate(last.date)}: ${words(last.value, baseline)}` : '';
  }
  if (hover.kind === 'data') {
    const p = series[hover.i];
    return p ? `${formatDate(p.date)}: ${words(p.value, baseline)}` : '';
  }
  if (!forecast) return '';
  const i = hover.i;
  return `Projected ${formatDate(forecast.weeks[i]!)}: ${words(forecast.p50[i]!, baseline)}. Likely range ${Math.round(
    forecast.p25[i]!,
  )} to ${Math.round(forecast.p75[i]!)}`;
}

function words(v: number, baseline: number): string {
  if (baseline !== 100) return v.toFixed(1);
  const w = lineWords(v);
  return `${w === 'at the line' ? w : `${w} the line`} (index ${v.toFixed(1)})`;
}

/** Monthly rows for the visually hidden data table. */
function monthly(points: ChartPoint[]): ChartPoint[] {
  const out = new Map<string, ChartPoint>();
  for (const p of points) out.set(p.date.slice(0, 7), p);
  return [...out.values()];
}

/**
 * Time series against the line, with an optional forecast fan (spec 3.6).
 * Rendered on the server for both widths; hydration only adds the readout.
 */
export function TrendChart(props: Props) {
  const [hover, setHover] = useState<Hover>(null);
  const clipId = useId().replace(/:/g, '');
  const { series, forecast, baseline = 100 } = props;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = series.length;
    const fcn = forecast?.weeks.length ?? 0;
    const cur = hover ?? { kind: 'data' as const, i: n - 1 };
    let next: Hover = cur;
    if (e.key === 'ArrowLeft') {
      next = cur.kind === 'forecast' ? (cur.i > 0 ? { kind: 'forecast', i: cur.i - 1 } : { kind: 'data', i: n - 1 }) : { kind: 'data', i: Math.max(0, cur.i - 1) };
    } else if (e.key === 'ArrowRight') {
      next = cur.kind === 'data' ? (cur.i < n - 1 ? { kind: 'data', i: cur.i + 1 } : fcn ? { kind: 'forecast', i: 0 } : cur) : { kind: 'forecast', i: Math.min(fcn - 1, cur.i + 1) };
    } else if (e.key === 'Home') next = { kind: 'data', i: 0 };
    else if (e.key === 'End') next = fcn ? { kind: 'forecast', i: fcn - 1 } : { kind: 'data', i: n - 1 };
    else return;
    e.preventDefault();
    setHover(next);
  };

  const text = readout(hover, series, forecast, baseline);

  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden="true" className="micro" style={{ display: 'flex', justifyContent: 'flex-end', minHeight: 36 }}>
        <p style={{ margin: 0, maxWidth: '100%' }}>{text}</p>
      </div>
      <p className="sr-only" aria-live="polite">
        {hover ? text : ''}
      </p>
      <div role="img" aria-label={props.label} tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)}>
        <div className="only-wide">
          <Svg layout={WIDE} props={props} hover={hover} setHover={setHover} clipId={`${clipId}w`} />
        </div>
        <div className="only-narrow">
          <Svg layout={NARROW} props={props} hover={hover} setHover={setHover} clipId={`${clipId}n`} />
        </div>
      </div>
      <table className="sr-only">
        <caption>{props.label}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Index</th>
            <th scope="col">Position</th>
          </tr>
        </thead>
        <tbody>
          {monthly(series).map((p) => (
            <tr key={p.date}>
              <td>{formatDate(p.date)}</td>
              <td>{p.value.toFixed(1)}</td>
              <td>{lineWords(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
