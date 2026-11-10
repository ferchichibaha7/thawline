/** Mark at 28 px, 10 px gap, live-text wordmark (spec 2.3). */
export function Lockup() {
  return (
    <a href="/" aria-label="Thawline home" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true" style={{ display: 'block' }}>
        <path d="M8 37 C16 39 22 34 26 28" fill="none" stroke="var(--mark-ice)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M26 28 C29 23.5 32 18 36.5 14.5" fill="none" stroke="var(--mark-moss)" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="38.5" cy="12.5" r="3.6" fill="var(--mark-moss)" />
        <path d="M6 28 H42" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontWeight: 600, fontSize: 20, lineHeight: '24px', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
        thawline
      </span>
    </a>
  );
}
