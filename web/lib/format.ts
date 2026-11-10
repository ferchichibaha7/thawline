const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  // Dates from the database are calendar days; parse them as UTC midnight.
  return new Date(d.length === 10 ? `${d}T00:00:00Z` : d);
}

/** "6 Nov 2026" (spec 8.7). */
export function formatDate(d: string | Date): string {
  const x = toDate(d);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

/** "8 Nov" for update stamps within the current year. */
export function formatShortDate(d: string | Date, now = new Date()): string {
  const x = toDate(d);
  return x.getUTCFullYear() === now.getUTCFullYear()
    ? `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`
    : formatDate(x);
}

/** "early 2027" for Q1, "mid-2027" for Q2 and Q3, "late 2027" for Q4 (spec 8.7). */
export function formatQuarter(d: string | Date): string {
  const x = toDate(d);
  const m = x.getUTCMonth();
  const y = x.getUTCFullYear();
  if (m < 3) return `early ${y}`;
  if (m < 9) return `mid-${y}`;
  return `late ${y}`;
}

export const round = (n: number): number => Math.round(n);

/** Position against the line in words: "34% below", "at the line", "20% above". */
export function lineWords(index: number, band = 2): string {
  const d = index - 100;
  if (Math.abs(d) <= band) return 'at the line';
  return d < 0 ? `${Math.round(-d)}% below` : `${Math.round(d)}% above`;
}

/** Axis label for a gridline value. Exact 100 reads "at the line". */
export function axisWords(index: number): string {
  if (Math.round(index) === 100) return 'at the line';
  return index < 100 ? `${Math.round(100 - index)}% below` : `${Math.round(index - 100)}% above`;
}

export function signedPoints(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : `${r}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n);
}
