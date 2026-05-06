import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from './supabase/server'

function getOAuthClient() {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
}

export function getGmailAuthUrl(state: string) {
  const oauth2 = getOAuthClient()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state,
    prompt: 'consent',
  })
}

export async function handleGmailCallback(userId: string, code: string) {
  const oauth2 = getOAuthClient()
  const { tokens } = await oauth2.getToken(code)
  const db = createServiceClient()

  await db.from('integrations').upsert({
    user_id: userId,
    provider: 'gmail',
    access_token_encrypted: tokens.access_token ?? null,
    refresh_token_encrypted: tokens.refresh_token ?? null,
    connected_at: new Date().toISOString(),
    broken: false,
  }, { onConflict: 'user_id,provider' })
}

async function getAuthedGmailClient(userId: string) {
  const db = createServiceClient()
  const { data: integration } = await db
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'gmail')
    .single()

  if (!integration) return null

  const oauth2 = getOAuthClient()
  oauth2.setCredentials({
    access_token: integration.access_token_encrypted,
    refresh_token: integration.refresh_token_encrypted,
  })

  oauth2.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await db.from('integrations').update({
        access_token_encrypted: tokens.access_token,
        last_synced_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('provider', 'gmail')
    }
  })

  return { oauth2, integrationId: integration.id, lastSyncedAt: integration.last_synced_at as string | null }
}

export async function syncGmailTasks(userId: string): Promise<number> {
  const auth = await getAuthedGmailClient(userId)
  if (!auth) return 0

  const gmail = google.gmail({ version: 'v1', auth: auth.oauth2 })
  const db = createServiceClient()

  // Fetch since last sync or last 24h
  const since = auth.lastSyncedAt
    ? new Date(auth.lastSyncedAt)
    : new Date(Date.now() - 24 * 60 * 60 * 1000)
  const afterEpoch = Math.floor(since.getTime() / 1000)

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${afterEpoch} -category:promotions -category:social -category:updates is:inbox`,
    maxResults: 25,
  }).catch(() => ({ data: { messages: [] } }))

  const messages = listRes.data.messages || []
  if (!messages.length) {
    await db.from('integrations').update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId).eq('provider', 'gmail')
    return 0
  }

  // Fetch subject + snippet for each
  const emailContents = (await Promise.all(
    messages.map(async (msg) => {
      if (!msg.id) return null
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From'],
      }).catch(() => ({ data: null }))
      if (!data) return null

      const headers = data.payload?.headers || []
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)'
      const from = headers.find(h => h.name === 'From')?.value || ''
      const snippet = data.snippet || ''
      return { id: msg.id, subject, from, snippet }
    })
  )).filter(Boolean) as { id: string; subject: string; from: string; snippet: string }[]

  if (!emailContents.length) return 0

  // AI extraction
  const client = new Anthropic()
  const prompt = `You are analyzing emails to find action items the recipient needs to do.

Skip: newsletters, automated notifications, marketing, FYI-only emails, order confirmations, receipts, social updates.
Include: emails where someone is asking for something, deadlines, meeting requests needing a response, tasks assigned to the recipient.

Emails:
${emailContents.map((e, i) => `[${i}] From: ${e.from}\nSubject: ${e.subject}\nPreview: ${e.snippet}`).join('\n\n')}

Return a JSON array. Each object: { "email_index": number, "title": string (clear action, max 80 chars), "notes": string (brief context, max 100 chars, optional) }
If no emails require action, return [].
JSON:`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return 0

  let actionItems: { email_index: number; title: string; notes?: string }[] = []
  try { actionItems = JSON.parse(jsonMatch[0]) } catch { return 0 }

  let created = 0
  for (const item of actionItems) {
    const email = emailContents[item.email_index]
    if (!email) continue
    await db.from('items').insert({
      user_id: userId,
      type: 'task',
      title: item.title,
      notes: item.notes ?? null,
      status: 'inbox',
      source: 'api',
      tags: [],
    })
    created++
  }

  await db.from('integrations').update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId).eq('provider', 'gmail')

  return created
}
