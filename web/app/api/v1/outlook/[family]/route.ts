import { failed, methodVersions, notFound, respond } from '@/lib/api';
import { shortSectorLabel } from '@/lib/metrics';
import { buildOutlook, resolveRole } from '@/lib/outlook';
import { attempt } from '@/lib/queries';
import { postingsNoun, sectorSentence } from '@/lib/statements';

export const revalidate = 3600;

/** Thaw Index, components, state and statement (spec 9.3). */
export async function GET(request: Request, { params }: { params: Promise<{ family: string }> }) {
  const { family: familyId } = await params;
  const country = new URL(request.url).searchParams.get('country')?.toUpperCase() ?? 'US';
  const r = await attempt(async () => {
    const { family, country: c } = await resolveRole(familyId, country);
    if (!family || !c || c.code !== country) return null;
    return buildOutlook(family, c);
  });
  if (!r.ok) return failed();
  if (!r.data) return notFound(`No outlook for ${familyId} in ${country}`);
  const o = r.data;
  const t = o.paused ? null : o.thaw;
  const values = o.fourWeek.map((p) => p.value);
  const data = {
    family: o.family.id,
    family_label: o.family.label,
    country: o.country.code,
    indeed_sector: o.hasSector ? o.family.indeedSector : null,
    week: t?.week ?? null,
    score: t ? Number(t.score.toFixed(2)) : null,
    state: t?.state ?? null,
    components: t
      ? { level: t.level, momentum: t.momentum, breadth: t.breadth, entry_access: t.entryAccess, competition: t.competition }
      : null,
    weights: t?.weights ?? null,
    paused: o.paused,
    statement: o.statement,
    sector_sentence: values.length
      ? sectorSentence(postingsNoun(o.hasSector ? shortSectorLabel(o.family.indeedSector) : null, o.where), values, o.weekly[o.weekly.length - 1]?.value)
      : null,
    trend_statement: o.trendStatement,
    series_id: o.seriesId,
  };
  const { components, weights, ...flat } = data;
  return respond(
    request,
    {
      source: 'Indeed Hiring Lab; Thaw Index by Thawline',
      license: 'CC BY 4.0',
      data_through: t?.week ?? o.dataset?.dataThrough ?? null,
      method_version: methodVersions,
    },
    data,
    [{ ...flat, ...(components ?? {}), weights: weights ? JSON.stringify(weights) : null }],
    `outlook-${o.family.id}-${o.country.code}`,
  );
}
