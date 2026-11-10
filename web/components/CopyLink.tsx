'use client';

import { useState } from 'react';

/** Copies the current page address (spec 4.2 section 10). */
export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button button-quiet"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
    >
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  );
}
