import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/server'

export interface PushPayload {
  title: string
  body: string
  url?: string
}

function initVapid() {
  if (process.env.VAPID_SUBJECT && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )
  }
}

export async function sendPush(userId: string, payload: PushPayload): Promise<void> {
  initVapid()
  const db = createServiceClient()
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  const expired: string[] = []

  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 410 || status === 404) expired.push(sub.id)
    }
  }))

  if (expired.length) {
    await db.from('push_subscriptions').delete().in('id', expired)
  }
}
