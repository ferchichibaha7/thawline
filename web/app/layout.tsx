import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Newsreader } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { DESCRIPTION, SITE_URL } from '@/lib/site';
import './globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal'],
  variable: '--font-newsreader',
  display: 'swap',
});
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Thawline', template: '%s | Thawline' },
  description: DESCRIPTION,
  openGraph: { siteName: 'Thawline', type: 'website' },
  twitter: { card: 'summary_large_image' },
  alternates: { types: { 'application/rss+xml': '/signals/rss.xml' } },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F7F6' },
    { media: '(prefers-color-scheme: dark)', color: '#101C24' },
  ],
};

// Runs before paint: applies the stored theme (or the system one on a first
// visit) and lets the line-strip animation play once per session (spec 3.1, 3.7).
const bootScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('thawline.theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.dataset.theme=t}catch(e){}try{if(sessionStorage.getItem('thawline.strip')){d.dataset.stripPlayed='1'}else{sessionStorage.setItem('thawline.strip','1')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" style={{ flex: 1, paddingTop: 48 }}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
