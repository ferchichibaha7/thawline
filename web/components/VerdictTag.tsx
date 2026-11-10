export type Verdict = 'Walked back' | 'Mixed' | 'Too early' | 'Holding' | 'Unclear';

const TINT: Record<Verdict, string> = {
  Holding: 'tint-open',
  'Walked back': 'tint-frozen',
  Mixed: 'tint-cold',
  'Too early': 'tint-rule',
  Unclear: 'tint-rule',
};

/** Aftermath verdict (spec 3.5, 8.2). */
export function VerdictTag({ verdict }: { verdict: Verdict }) {
  return <span className={`tag ${TINT[verdict]}`}>{verdict}</span>;
}
