import { shareImage } from '@/lib/og';
import { buildOutlook, resolveRole } from '@/lib/outlook';
import { attempt } from '@/lib/queries';
import { TAGLINE } from '@/lib/site';

export const revalidate = 3600;

/** Share image for an outlook: /api/og?family=frontend&country=FR (spec 9.6). */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const r = await attempt(async () => {
    const { family, country } = await resolveRole(sp.get('family') ?? undefined, sp.get('country')?.toUpperCase());
    if (!family || !country) return null;
    return buildOutlook(family, country);
  });
  if (!r.ok || !r.data) return shareImage(TAGLINE);
  const o = r.data;
  return shareImage(o.statement, o.thaw && !o.paused ? { score: o.thaw.score, state: o.thaw.state } : undefined);
}
