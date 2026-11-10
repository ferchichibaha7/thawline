type Props = { what: string; read: string; source: string; limits: string };

/** "How to read this" disclosure, inline, four short paragraphs (spec 3.5). */
export function Explain({ what, read, source, limits }: Props) {
  return (
    <details className="explain" style={{ marginTop: 16 }}>
      <summary>How to read this</summary>
      <div className="explain-body body-text small" style={{ marginTop: 12 }}>
        <p>{what}</p>
        <p>{read}</p>
        <p>{source}</p>
        <p>{limits}</p>
      </div>
    </details>
  );
}
