import { ImageResponse } from 'next/og'

export const sizes = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#18181b',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 100, fontWeight: 700, color: '#f4f4f5', fontFamily: 'sans-serif', lineHeight: 1 }}>
          B
        </span>
      </div>
    ),
    { width: 180, height: 180 }
  )
}
