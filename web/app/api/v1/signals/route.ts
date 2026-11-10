import { failed, methodVersions, respond } from '@/lib/api';
import { attempt, getDataset, getSignals } from '@/lib/queries';

export const revalidate = 3600;

/** Signals, newest first (spec 9.3). */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const since = sp.get('since');
  const valid = since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : undefined;
  const r = await attempt(async () => ({
    signals: await getSignals({ limit: 500, since: valid, kind: sp.get('kind') ?? undefined, country: sp.get('country')?.toUpperCase() }),
    dataset: await getDataset('indeed_jpi'),
  }));
  if (!r.ok) return failed();
  const rows = r.data.signals.map((s) => ({
    date: s.signalDate,
    kind: s.kind,
    country: s.country,
    subject_type: s.subjectType,
    subject_id: s.subjectId,
    sentence: s.sentence,
    importance: s.importance,
  }));
  return respond(
    request,
    { source: 'Indeed Hiring Lab; signal rules by Thawline', license: 'CC BY 4.0', data_through: r.data.dataset?.dataThrough ?? null, method_version: methodVersions },
    rows,
    rows,
    'signals',
  );
}
