import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { google } from 'googleapis'

function getOAuthClient() {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/settings?error=gcal_auth_failed', req.url))
  }

  const oauth2 = getOAuthClient()

  try {
    const { tokens } = await oauth2.getToken(code)

    const db = createServiceClient()
    await db.from('integrations').upsert({
      user_id: userId,
      provider: 'google_calendar',
      access_token_encrypted: tokens.access_token!,
      refresh_token_encrypted: tokens.refresh_token ?? null,
      calendar_id: 'primary',
      connected_at: new Date().toISOString(),
      broken: false,
    }, { onConflict: 'user_id,provider' })

    return NextResponse.redirect(new URL('/settings?connected=gcal', req.url))
  } catch (err) {
    console.error('GCal OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/settings?error=gcal_auth_failed', req.url))
  }
}
