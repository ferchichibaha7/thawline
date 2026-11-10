import { getSignals } from '@/lib/queries';
import { signalHref } from '@/lib/links';
import { SITE_URL } from '@/lib/site';

export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The signals feed as RSS (spec 4.6). */
export async function GET() {
  const signals = await getSignals({ limit: 100 });
  const items = signals
    .map((s) => {
      const href = signalHref(s);
      const link = `${SITE_URL}${href ?? '/signals'}`;
      return `<item><title>${esc(s.sentence)}</title><link>${esc(link)}</link><guid isPermaLink="false">thawline-signal-${s.id}</guid><pubDate>${new Date(`${s.signalDate}T12:00:00Z`).toUTCString()}</pubDate><category>${esc(s.kind)}</category></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Thawline signals</title><link>${SITE_URL}/signals</link><description>Dated facts about job postings, produced by fixed rules. Data: Indeed Hiring Lab, CC BY 4.0.</description><language>en</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
