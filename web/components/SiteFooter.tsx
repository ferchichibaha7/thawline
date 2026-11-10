const LINKS = [
  { href: '/method', label: 'Method' },
  { href: '/data', label: 'Data and API' },
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/status', label: 'Status' },
];

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--rule)', marginTop: 112 }}>
      <div className="page" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <ul style={{ display: 'flex', gap: 24, listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ marginTop: 16, maxWidth: '68ch' }}>
          Thawline uses only sourced public data. Code is MIT licensed. Data produced by Thawline is CC BY 4.0. Job
          postings data: Indeed Hiring Lab, CC BY 4.0.
        </p>
      </div>
    </footer>
  );
}
