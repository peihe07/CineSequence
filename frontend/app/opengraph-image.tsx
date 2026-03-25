import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'CineSequence — Decode Your Cinema DNA'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F172A',
          fontFamily: 'sans-serif',
        }}
      >
        {/* DNA icon */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 32 32"
          fill="none"
        >
          <circle cx="16" cy="16" r="15" fill="#0F172A" />
          <path
            d="M16 4C22.6274 4 28 9.37258 28 16C28 22.6274 22.6274 28 16 28C9.37258 28 4 22.6274 4 16C4 9.37258 9.37258 4 16 4Z"
            stroke="#1E293B"
            strokeWidth="2"
            strokeDasharray="2 4"
          />
          <path
            d="M12 8C12 8 16 12 16 16C16 20 12 24 12 24"
            stroke="#2DD4BF"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M20 8C20 8 16 12 16 16C16 20 20 24 20 24"
            stroke="#38BDF8"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="16" cy="16" r="1.5" fill="#2DD4BF" />
        </svg>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            color: '#F8FAFC',
            marginTop: 32,
            letterSpacing: '-0.02em',
          }}
        >
          CineSequence
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: '#94A3B8',
            marginTop: 16,
            letterSpacing: '0.05em',
          }}
        >
          Decode Your Cinema DNA
        </div>

        {/* Subtle divider */}
        <div
          style={{
            display: 'flex',
            width: 60,
            height: 2,
            backgroundColor: '#2DD4BF',
            marginTop: 32,
            borderRadius: 1,
            opacity: 0.6,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
