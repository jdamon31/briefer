import { ImageResponse } from 'next/og'

export const sizes = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#18181b',
          borderRadius: 128,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 280, fontWeight: 700, color: '#f4f4f5', fontFamily: 'sans-serif', lineHeight: 1 }}>
          B
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
