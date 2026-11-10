import { Lockup } from './Lockup';
import { ThemeToggle } from './ThemeToggle';

// Only sections that exist are linked. Aftermath, Pressure and Demand join the
// navigation when their phases ship (docs/DECISIONS.md D-012).
const NAV = [
  { href: '/outlook', label: 'Outlook' },
  { href: '/signals', label: 'Signals' },
  { href: '/method', label: 'Method' },
  { href: '/data', label: 'Data' },
];

export function SiteHeader() {
  return (
    <header style={{ borderBottom: '1px solid var(--rule)' }}>
      <div className="page" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', paddingTop: 16, paddingBottom: 16 }}>
        <Lockup />
        <nav aria-label="Main" style={{ marginLeft: 'auto' }}>
          <ul style={{ display: 'flex', gap: 24, listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} style={{ textDecoration: 'none', fontWeight: 500 }}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
