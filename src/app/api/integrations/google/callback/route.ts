import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { syncFromGCal } from '@/lib/gcal'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth', req.url))

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/settings?error=gcal_auth_failed', req.url))
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  try {
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    // Get the user's calendar list to find primary
    const calendar = google.calendar({ version: 'v3', auth: oauth2 })
    const calList = await calendar.calendarList.list({ minAccessRole: 'writer' })
    const primary = calList.data.items?.find(c => c.primary) || calList.data.items?.[0]

    await supabase.from('integrations').upsert({
      user_id: user.id,
      provider: 'google_calendar',
      access_token_encrypted: tokens.access_token!,
      refresh_token_encrypted: tokens.refresh_token || undefined,
      calendar_id: primary?.id || 'primary',
      connected_at: new Date().toISOString(),
      broken: false,
    }, { onConflict: 'user_id,provider' })

    // Backfill: pull last 30 days + next 14
    await syncFromGCal(user.id, 14, 30)

    // Push any pending events
    const { data: pendingEvents } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'event')
      .eq('sync_pending', true)

    if (pendingEvents?.length) {
      const { pushEventToGCal } = await import('@/lib/gcal')
      for (const item of pendingEvents) {
        const googleEventId = await pushEventToGCal(user.id, item)
        if (googleEventId) {
          await supabase.from('items').update({ google_event_id: googleEventId, sync_pending: false }).eq('id', item.id)
        }
      }
    }

    return NextResponse.redirect(new URL('/settings?connected=gcal', req.url))
  } catch (err) {
    console.error('GCal OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/settings?error=gcal_auth_failed', req.url))
  }
}
