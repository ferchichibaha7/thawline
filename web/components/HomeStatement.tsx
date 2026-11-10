'use client';

import { useEffect, useState } from 'react';
import { ROLE_KEY } from './RolePicker';

/**
 * The home statement for the visitor's stored role, or for software in the
 * United States on a first visit (spec 4.1). The server renders the default.
 */
export function HomeStatement({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    let saved: { family?: string; country?: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(ROLE_KEY) ?? 'null');
    } catch {}
    if (!saved?.family || !saved.country) return;
    const ctrl = new AbortController();
    fetch(`/api/v1/outlook/${encodeURIComponent(saved.family)}?country=${encodeURIComponent(saved.country)}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.data?.sector_sentence) setText(body.data.sector_sentence);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  return <h1 className="statement statement-xl">{text}</h1>;
}
