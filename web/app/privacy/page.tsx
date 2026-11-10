import type { Metadata } from 'next';
import { Statement } from '@/components/Statement';

export const metadata: Metadata = { title: 'Privacy', description: 'What Thawline stores about visitors: almost nothing.' };

export default function PrivacyPage() {
  return (
    <div className="page">
      <Statement size="l">Thawline stores nothing about you on its servers.</Statement>
      <div className="body-text" style={{ marginTop: 32 }}>
        <p>Reading the site needs no account. There are no cookies, no trackers and no third-party analytics.</p>
        <p>
          Your browser remembers three things on your own device: the role, country and level you last chose, your light
          or dark theme, and whether the home page animation has already played this session. You can clear them by
          clearing this site&apos;s data in your browser.
        </p>
        <p>
          Later features, such as email alerts and evidence submissions, will store only an email address, and only
          after you confirm it. This page will say so before they open, with an address for deleting your data.
        </p>
        <p>Server logs kept by the hosting provider may record IP addresses for a short time to keep the site running.</p>
      </div>
    </div>
  );
}
