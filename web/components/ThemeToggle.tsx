'use client';

/** Switches between light and dark and remembers the choice (spec 3.1). */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('thawline.theme', next);
    } catch {}
  };
  return (
    <button type="button" onClick={toggle} className="button button-quiet" style={{ height: 32, padding: '0 12px' }}>
      <span className="theme-label-dark">Dark theme</span>
      <span className="theme-label-light">Light theme</span>
    </button>
  );
}
