import { failed, methodVersions, respond } from '@/lib/api';
import { attempt, datasetsWithFreshness } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/** Freshness and licenses (spec 9.3, 11.2). */
export async function GET(request: Request) {
  const r = await attempt(datasetsWithFreshness);
  if (!r.ok) return failed();
  const rows = r.data.map((d) => ({
    id: d.id,
    name: d.name,
    license: d.license,
    attribution: d.attribution,
    source_url: d.sourceUrl,
    cadence_hours: d.cadenceHours,
    last_success_at: d.lastSuccessAt,
    last_status: d.lastStatus,
    data_through: d.dataThrough,
    row_count: d.rowCount,
    freshness: d.freshness,
  }));
  return respond(
    request,
    { source: 'Thawline', license: 'CC BY 4.0', data_through: null, method_version: methodVersions },
    rows,
    rows,
    'datasets',
  );
}
