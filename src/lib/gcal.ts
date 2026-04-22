import { google } from 'googleapis'
import { Item } from '@/types'
import { createServiceClient } from './supabase/server'

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(state: string) {
  const oauth2 = getOAuthClient()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
    prompt: 'consent',
  })
}

async function getAuthedClient(userId: string) {
  const db = createServiceClient()
  const { data: integration } = await db
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')
    .single()

  if (!integration) return null

  const oauth2 = getOAuthClient()
  oauth2.setCredentials({
    access_token: integration.access_token_encrypted,
    refresh_token: integration.refresh_token_encrypted,
  })

  // Refresh token if needed and persist
  oauth2.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await db.from('integrations').update({
        access_token_encrypted: tokens.access_token,
        last_synced_at: new Date().toISOString(),
      }).eq('id', integration.id)
    }
  })

  return { oauth2, calendarId: integration.calendar_id || 'primary', integrationId: integration.id }
}

export async function pushEventToGCal(userId: string, item: Item): Promise<string | null> {
  const auth = await getAuthedClient(userId)
  if (!auth) return null

  const calendar = google.calendar({ version: 'v3', auth: auth.oauth2 })
  const startTime = item.due_at ? new Date(item.due_at) : new Date()
  const endTime = new Date(startTime.getTime() + (item.duration_minutes || 60) * 60000)

  const event = {
    summary: item.title,
    description: item.notes || undefined,
    location: item.location || undefined,
    start: { dateTime: startTime.toISOString() },
    end: { dateTime: endTime.toISOString() },
  }

  try {
    if (item.google_event_id) {
      const res = await calendar.events.update({
        calendarId: auth.calendarId,
        eventId: item.google_event_id,
        requestBody: event,
      })
      return res.data.id || null
    } else {
      const res = await calendar.events.insert({
        calendarId: auth.calendarId,
        requestBody: event,
      })
      return res.data.id || null
    }
  } catch (err) {
    console.error('GCal push failed:', err)
    return null
  }
}

export async function deleteGCalEvent(userId: string, googleEventId: string): Promise<void> {
  const auth = await getAuthedClient(userId)
  if (!auth) return
  const calendar = google.calendar({ version: 'v3', auth: auth.oauth2 })
  try {
    await calendar.events.delete({ calendarId: auth.calendarId, eventId: googleEventId })
  } catch (err) {
    console.error('GCal delete failed:', err)
  }
}

export async function syncFromGCal(userId: string, daysForward = 14, daysBack = 0): Promise<void> {
  const auth = await getAuthedClient(userId)
  if (!auth) return
  const db = createServiceClient()

  const calendar = google.calendar({ version: 'v3', auth: auth.oauth2 })
  const timeMin = new Date(Date.now() - daysBack * 86400000).toISOString()
  const timeMax = new Date(Date.now() + daysForward * 86400000).toISOString()

  try {
    const res = await calendar.events.list({
      calendarId: auth.calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = res.data.items || []
    for (const event of events) {
      if (!event.id || event.status === 'cancelled') continue
      const existing = await db.from('items')
        .select('id')
        .eq('user_id', userId)
        .eq('google_event_id', event.id)
        .single()

      const startAt = event.start?.dateTime || event.start?.date
      if (!startAt) continue

      if (existing.data) {
        await db.from('items').update({
          title: event.summary || 'Untitled',
          due_at: startAt,
          location: event.location || null,
          google_etag: event.etag || null,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.data.id)
      } else {
        await db.from('items').insert({
          user_id: userId,
          type: 'event',
          title: event.summary || 'Untitled',
          due_at: startAt,
          end_at: event.end?.dateTime || null,
          location: event.location || null,
          status: 'active',
          google_event_id: event.id,
          google_etag: event.etag || null,
          source: 'api',
        })
      }
    }

    await db.from('integrations').update({
      last_synced_at: new Date().toISOString(),
    }).eq('id', auth.integrationId)
  } catch (err) {
    console.error('GCal sync failed:', err)
    await db.from('integrations').update({ broken: true }).eq('id', auth.integrationId)
  }
}
