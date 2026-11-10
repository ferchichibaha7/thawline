import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Serves the pipeline's CSV and JSON snapshots from data/exports, the local
 * stand-in for Supabase Storage's public/exports (spec 9.3).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-z_]+\.(csv|json)$/.test(file)) return new Response('Not found', { status: 404 });
  const dir = process.env.THAWLINE_EXPORT_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), '..', 'data', 'exports');
  try {
    const body = await readFile(path.join(/*turbopackIgnore: true*/ dir, file));
    const csv = file.endsWith('.csv');
    return new Response(body, {
      headers: {
        'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json',
        'Content-Disposition': `attachment; filename="thawline-${file}"`,
        'Cache-Control': 'public, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
