import 'server-only';
import { NextResponse } from 'next/server';
import { metrics } from './metrics';

export type Meta = {
  source: string;
  license: string;
  data_through: string | null;
  method_version: string | Record<string, string>;
};

const HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  'Access-Control-Allow-Origin': '*',
};

export const methodVersions = {
  thaw_index: metrics.thaw_index.version,
  forecast: metrics.forecast.version,
};

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]!);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

/**
 * Public API response (spec 9.3): JSON by default, CSV with ?format=csv, open CORS,
 * and a `meta` block with source, license, data_through, generated_at and method_version.
 */
export function respond(
  request: Request,
  meta: Meta,
  data: unknown,
  csvRows?: Record<string, unknown>[],
  filename = 'thawline',
) {
  const format = new URL(request.url).searchParams.get('format');
  const fullMeta = { ...meta, generated_at: new Date().toISOString() };
  if (format === 'csv') {
    const rows = csvRows ?? (Array.isArray(data) ? (data as Record<string, unknown>[]) : [data as Record<string, unknown>]);
    const header = `# Source: ${meta.source}. License: ${meta.license}. Data through: ${meta.data_through ?? 'n/a'}.\n`;
    return new NextResponse(header + toCsv(rows), {
      headers: {
        ...HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }
  return NextResponse.json({ meta: fullMeta, data }, { headers: HEADERS });
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404, headers: HEADERS });
}

export function failed() {
  return NextResponse.json({ error: 'The database could not be reached. Try again.' }, { status: 503, headers: HEADERS });
}
