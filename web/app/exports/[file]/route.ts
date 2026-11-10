import { NextResponse } from 'next/server';
import { readExport, remoteExportUrl } from '@/lib/exports';

/** CSV and JSON snapshots (spec 9.3): Supabase Storage in production, data/exports locally. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-z_]+\.(csv|json)$/.test(file)) return new Response('Not found', { status: 404 });
  const remote = remoteExportUrl(file);
  if (remote) return NextResponse.redirect(remote, 302);
  const body = await readExport(file);
  if (!body) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': file.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/json',
      'Content-Disposition': `attachment; filename="thawline-${file}"`,
      'Cache-Control': 'public, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
