/** A failed query never leaves a blank area (spec 4.9). "Try again" reloads the same URL. */
export function ErrorState({ href = '' }: { href?: string }) {
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <p>This section could not load. Try again.</p>
      <a href={href} className="button button-quiet">
        Try again
      </a>
    </div>
  );
}
