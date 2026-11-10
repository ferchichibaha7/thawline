import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** 180 px icon on Paper with 4 px padding (spec 2.3). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#F5F7F6', display: 'flex', padding: 4 }}>
        <svg viewBox="0 0 48 48" width="172" height="172">
          <path d="M8 37 C16 39 22 34 26 28" fill="none" stroke="#7FA8CC" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M26 28 C29 23.5 32 18 36.5 14.5" fill="none" stroke="#3E7F5A" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="38.5" cy="12.5" r="3.6" fill="#3E7F5A" />
          <path d="M6 28 H42" fill="none" stroke="#12222E" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
