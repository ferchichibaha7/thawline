/** Says what is missing and when it will appear (spec 3.5). */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="body-text" style={{ color: 'var(--slate)' }}>
      {children}
    </p>
  );
}
