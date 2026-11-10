import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { STORIES } from '@/components/stories';

export const metadata: Metadata = { title: 'Component gallery', robots: { index: false } };

/**
 * Every component in spec 3.5, in both themes (phase 0). Not served in
 * production unless THAWLINE_GALLERY=1 is set.
 */
export default function Gallery() {
  if (process.env.NODE_ENV === 'production' && process.env.THAWLINE_GALLERY !== '1') notFound();
  return (
    <div className="page">
      <h1 className="heading">Component gallery</h1>
      <p className="small muted" style={{ marginTop: 8 }}>
        Market components use fixtures recorded from real pipeline output. Components for later phases show layout only.
      </p>
      {STORIES.map((m) => (
        <section key={m.title} style={{ marginTop: 48 }}>
          <h2 className="heading">{m.title}</h2>
          {m.stories.map((s) => (
            <div key={s.name} style={{ marginTop: 16 }}>
              <p className="small muted">{s.name}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))', gap: 16, marginTop: 8 }}>
                {(['light', 'dark'] as const).map((theme) => (
                  <div
                    key={theme}
                    data-theme={theme}
                    style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--rule)', borderRadius: 14, padding: 24, overflow: 'hidden' }}
                  >
                    {s.render()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
