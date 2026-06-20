import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MoolaBiz — Your WhatsApp Store';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f2a24',
          color: '#eaf1ee',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Moola Bubble mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 28,
            backgroundColor: '#0e7c5a',
            color: '#f0a92b',
            fontSize: 56,
            fontWeight: 800,
            marginBottom: 28,
          }}
        >
          R
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>
          Moola<span style={{ color: '#f0a92b' }}>Biz</span>
        </div>
        <div style={{ fontSize: 32, opacity: 0.85, marginTop: 12 }}>
          Your WhatsApp store. Always open.
        </div>
        <div style={{ fontSize: 22, color: '#9cb3ac', marginTop: 22 }}>
          From R89/month · Built in South Africa
        </div>
      </div>
    ),
    { ...size }
  );
}
