import { shareImage } from '@/lib/og';
import { attempt, fourWeekMeans, getWeekly, indeedSeriesId } from '@/lib/queries';
import { postingsNoun, sectorSentence } from '@/lib/statements';
import { TAGLINE } from '@/lib/site';

export const alt = 'Thawline: where software job postings stand against the line';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image() {
  const r = await attempt(() => getWeekly(indeedSeriesId('US', 'Software Development')));
  const values = r.ok ? fourWeekMeans(r.data).map((p) => p.value) : [];
  const latest = r.ok ? r.data[r.data.length - 1]?.value : undefined;
  return shareImage(values.length ? sectorSentence(postingsNoun('Software', 'the United States'), values, latest) : TAGLINE);
}
