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
          backgroundColor: '#059669',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 'bold', marginBottom: 16 }}>MoolaBiz</div>
        <div style={{ fontSize: 32, opacity: 0.9 }}>Your WhatsApp Store — Made in South Africa</div>
        <div style={{ fontSize: 24, opacity: 0.7, marginTop: 24 }}>From R89/month • No tech skills needed</div>
      </div>
    ),
    { ...size }
  );
}
