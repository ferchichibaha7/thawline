import { failed, methodVersions, respond } from '@/lib/api';
import { lineWords } from '@/lib/format';
import { attempt, getDataset, getSectorPositions } from '@/lib/queries';
import { sql } from '@/lib/db';

export const revalidate = 3600;

/** Latest weekly index, change over 13 weeks and position for each sector (spec 9.3). */
export async function GET(request: Request) {
  const country = (new URL(request.url).searchParams.get('country') ?? 'US').toUpperCase();
  const r = await attempt(async () => {
    const sectors = await sql`select distinct sector from series where dataset_id = 'indeed_jpi' and country = ${country} order by sector nulls first`;
    const positions = await getSectorPositions(country, sectors.map((s) => s.sector as string | null));
    const dataset = await getDataset('indeed_jpi');
    return { positions, dataset };
  });
  if (!r.ok) return failed();
  const { positions, dataset } = r.data;
  const rows = positions.map((p) => ({
    series_id: p.seriesId,
    country,
    sector: p.sector ?? 'All jobs',
    week: p.week,
    index: Number(p.value.toFixed(2)),
    change_13wk_pct: p.valueThen ? Number(((p.value / p.valueThen - 1) * 100).toFixed(2)) : null,
    position: lineWords(p.value),
  }));
  return respond(
    request,
    {
      source: 'Indeed Hiring Lab',
      license: 'CC BY 4.0',
      data_through: positions[0]?.week ?? dataset?.dataThrough ?? null,
      method_version: methodVersions,
    },
    rows,
    rows,
    `sectors-${country}`,
  );
}
