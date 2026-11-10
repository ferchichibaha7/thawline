const TINT: Record<string, string> = {
  Frozen: 'tint-frozen',
  Cold: 'tint-cold',
  Thawing: 'tint-thawing',
  Open: 'tint-open',
};

/** A state word on its state tint. Never colour alone (spec 3.5, 3.9). */
export function StateTag({ state }: { state: string }) {
  return <span className={`tag ${TINT[state] ?? 'tint-rule'}`}>{state}</span>;
}
