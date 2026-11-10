import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

const FONTS = path.join(process.cwd(), 'assets', 'fonts');

async function fonts() {
  const [news, hanken500, hanken600] = await Promise.all([
    readFile(path.join(FONTS, 'newsreader-400.ttf')),
    readFile(path.join(FONTS, 'hanken-grotesk-500.ttf')),
    readFile(path.join(FONTS, 'hanken-grotesk-600.ttf')),
  ]);
  return [
    { name: 'Newsreader', data: news, weight: 400 as const, style: 'normal' as const },
    { name: 'Hanken Grotesk', data: hanken500, weight: 500 as const, style: 'normal' as const },
    { name: 'Hanken Grotesk', data: hanken600, weight: 600 as const, style: 'normal' as const },
  ];
}

const C = { paper: '#F5F7F6', ink: '#12222E', slate: '#5B6B76', frozen: '#3F6E99', cold: '#9DBEDB', thawing: '#9CCBAE', open: '#3E7F5A' };

function Mark() {
  return (
    <svg viewBox="0 0 48 48" width="56" height="56">
      <path d="M8 37 C16 39 22 34 26 28" fill="none" stroke="#7FA8CC" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M26 28 C29 23.5 32 18 36.5 14.5" fill="none" stroke="#3E7F5A" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="38.5" cy="12.5" r="3.6" fill="#3E7F5A" />
      <path d="M6 28 H42" fill="none" stroke="#12222E" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Share image (spec 9.6): Paper, the mark, the statement, and for outlooks a position bar. */
export async function shareImage(statement: string, bar?: { score: number; state: string }) {
  const segs = [C.frozen, C.cold, C.thawing, C.open];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: C.paper, display: 'flex', flexDirection: 'column', padding: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Mark />
          <span style={{ fontFamily: 'Hanken Grotesk', fontWeight: 600, fontSize: 36, color: C.ink, letterSpacing: '-0.01em' }}>thawline</span>
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <p style={{ fontFamily: 'Newsreader', fontSize: statement.length > 120 ? 46 : 56, lineHeight: 1.15, color: C.ink, margin: 0, maxWidth: 1000 }}>
            {statement}
          </p>
        </div>
        {bar ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ fontFamily: 'Hanken Grotesk', fontWeight: 500, fontSize: 56, color: C.ink }}>{Math.round(bar.score)}</span>
            <div style={{ display: 'flex', position: 'relative', width: 700, height: 14 }}>
              {segs.map((c) => (
                <div key={c} style={{ flex: 1, height: 14, background: c, opacity: 0.35 }} />
              ))}
              <div style={{ position: 'absolute', left: `${(bar.score / 100) * 700 - 2}px`, top: -10, width: 4, height: 34, background: C.ink }} />
            </div>
            <span style={{ fontFamily: 'Hanken Grotesk', fontWeight: 600, fontSize: 32, color: C.ink }}>{bar.state}</span>
          </div>
        ) : null}
      </div>
    ),
    { width: 1200, height: 630, fonts: await fonts() },
  );
}
