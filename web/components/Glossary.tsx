import { GLOSSARY, type GlossaryTerm } from '@/lib/glossary';

const idFor = (term: string, key: string) => `g-${key}-${term.toLowerCase().replace(/[^a-z]+/g, '-')}`;

/**
 * A dotted-underline term that opens a one-sentence definition (spec 3.5).
 * Uses the native popover attribute, so it works without JavaScript.
 */
export function Glossary({ term, children, uid = '0' }: { term: GlossaryTerm; children?: React.ReactNode; uid?: string }) {
  const id = idFor(term, uid);
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        style={{
          font: 'inherit',
          color: 'inherit',
          background: 'none',
          border: 0,
          padding: 0,
          cursor: 'help',
          textDecoration: 'underline dotted',
          textUnderlineOffset: 3,
        }}
      >
        {children ?? term}
      </button>
      <span
        id={id}
        popover="auto"
        role="note"
        className="small"
        style={{
          maxWidth: 320,
          padding: 16,
          border: '1px solid var(--rule)',
          borderRadius: 6,
          background: 'var(--sheet)',
          color: 'var(--ink)',
          fontFamily: 'var(--font-hanken), system-ui, sans-serif',
        }}
      >
        <strong style={{ fontWeight: 600 }}>{term[0]!.toUpperCase() + term.slice(1)}.</strong> {GLOSSARY[term]}
      </span>
    </>
  );
}
