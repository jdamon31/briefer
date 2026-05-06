import { NextRequest, NextResponse } from 'next/server'
import { handleGmailCallback } from '@/lib/gmail'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user ID passed as state

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?error=gmail_auth', req.url))
  }

  try {
    await handleGmailCallback(state, code)
    return NextResponse.redirect(new URL('/settings?gmail=connected', req.url))
  } catch {
    return NextResponse.redirect(new URL('/settings?error=gmail_auth', req.url))
  }
}
