'use client';

import { useEffect, useRef, useState } from 'react';

export type PickerOption = { value: string; label: string };
type Props = {
  families: PickerOption[];
  countries: PickerOption[];
  family: string;
  country: string;
  level: string;
  /** On the home page, pre-fill from the last choice in local storage (spec 9.4). */
  prefill?: boolean;
  buttonLabel?: string;
};

type Saved = { family: string; country: string; level: string };

export const LEVELS: PickerOption[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
];

export const ROLE_KEY = 'thawline.role';

/**
 * Role, country and level (spec 3.5). A plain GET form, so it works without
 * JavaScript; with it, the choice is also remembered in local storage.
 */
export function RolePicker({ families, countries, family, country, level, prefill = false, buttonLabel = 'Show my outlook' }: Props) {
  const form = useRef<HTMLFormElement>(null);
  // With a stored role and unchanged selects, the button becomes a link to it (spec 4.1).
  const [saved, setSaved] = useState<Saved | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!prefill || !form.current) return;
    try {
      const stored = JSON.parse(localStorage.getItem(ROLE_KEY) ?? 'null') as Saved | null;
      if (!stored) return;
      for (const name of ['family', 'country', 'level'] as const) {
        const el = form.current.elements.namedItem(name) as HTMLSelectElement | null;
        if (!el || !stored[name] || ![...el.options].some((o) => o.value === stored[name])) return;
        el.value = stored[name];
      }
      setSaved(stored);
    } catch {}
  }, [prefill]);

  const savedLabel = saved
    ? `${families.find((f) => f.value === saved.family)?.label}, ${countries.find((c) => c.value === saved.country)?.label}`
    : '';

  const remember = () => {
    if (!form.current) return;
    const data = new FormData(form.current);
    try {
      localStorage.setItem(
        ROLE_KEY,
        JSON.stringify({ family: data.get('family'), country: data.get('country'), level: data.get('level') }),
      );
    } catch {}
  };

  const select = (name: string, label: string, options: PickerOption[], value: string) => (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <select name={name} defaultValue={value} className="select">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form ref={form} action="/outlook" method="get" onSubmit={remember} onChange={() => setDirty(true)}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        {select('family', 'I work in', families, family)}
        {select('country', 'in', countries, country)}
        {select('level', 'at', LEVELS, level)}
      </div>
      {saved && !dirty ? (
        <p style={{ marginTop: 16, minHeight: 40, display: 'flex', alignItems: 'center' }}>
          <a href={`/outlook/${saved.family}?country=${saved.country}&level=${saved.level}`}>Your outlook: {savedLabel}</a>
        </p>
      ) : (
        <button type="submit" className="button" style={{ marginTop: 16 }}>
          {buttonLabel}
        </button>
      )}
    </form>
  );
}
