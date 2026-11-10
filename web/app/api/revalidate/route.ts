import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const Body = z.object({ tags: z.array(z.string().regex(/^[a-z_]+$/)).max(50) });

/** Called by the pipeline's last step with an HMAC-signed list of changed tags (spec 9.4). */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: 'Revalidation is not configured.' }, { status: 501 });
  const raw = await request.text();
  const given = request.headers.get('x-thawline-signature') ?? '';
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 401 });
  }
  const parsed = Body.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json({ error: 'Bad body.' }, { status: 400 });
  for (const tag of parsed.data.tags) revalidateTag(tag, 'max');
  return NextResponse.json({ revalidated: parsed.data.tags });
}
