import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Where the pipeline's CSV and JSON snapshots live: Supabase Storage's public
 * `exports` bucket when configured, otherwise data/exports on this machine.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const LOCAL_DIR = process.env.THAWLINE_EXPORT_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), '..', 'data', 'exports');

export const remoteExportUrl = (file: string): string | null =>
  SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/exports/${file}` : null;

export async function readExport(file: string): Promise<Buffer | null> {
  const remote = remoteExportUrl(file);
  try {
    if (remote) {
      const r = await fetch(remote, { next: { revalidate: 3600 } });
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
    }
    return await readFile(path.join(/*turbopackIgnore: true*/ LOCAL_DIR, file));
  } catch {
    return null;
  }
}
