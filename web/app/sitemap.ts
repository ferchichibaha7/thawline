import type { MetadataRoute } from 'next';
import { attempt, getCountries, getFamilies } from '@/lib/queries';
import { SITE_URL } from '@/lib/site';

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', '/outlook', '/signals', '/method', '/data', '/about', '/privacy', '/status'].map((p) => ({ url: `${SITE_URL}${p}` }));
  const r = await attempt(async () => ({ families: await getFamilies(), countries: await getCountries() }));
  if (!r.ok) return pages;
  const outlooks = r.data.countries
    .filter((c) => c.hasSectors)
    .flatMap((c) => r.data.families.map((f) => ({ url: `${SITE_URL}/outlook/${f.id}?country=${c.code}` })));
  return [...pages, ...outlooks];
}
