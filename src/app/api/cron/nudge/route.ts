import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPush } from '@/lib/push'
import { toZonedTime } from 'date-fns-tz'

function authCheck(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - 30 * 60000)
  const windowEnd = new Date(now.getTime() + 30 * 60000)

  const { data: users } = await db
    .from('users')
    .select('id, timezone, user_settings!inner(morning_brief_time)')

  const results: string[] = []

  for (const user of users || []) {
    const userNow = toZonedTime(now, user.timezone)

    // Only nudge around 8pm user time
    const nudgeUtc = new Date(Date.UTC(
      userNow.getFullYear(), userNow.getMonth(), userNow.getDate(), 20, 0
    ))
    if (nudgeUtc < windowStart || nudgeUtc > windowEnd) continue

    // Skip if already nudged today
    const { data: alreadySent } = await db
      .from('reminder_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('channel', 'nudge')
      .gte('sent_at', new Date(now.getTime() - 20 * 3600000).toISOString())
      .single()
    if (alreadySent) continue

    // Skip if user captured anything in last 24h
    const { data: recentCaptures } = await db
      .from('items')
      .select('id')
      .eq('user_id', user.id)
      .in('source', ['manual', 'siri', 'web'])
      .gte('created_at', new Date(now.getTime() - 24 * 3600000).toISOString())
      .limit(1)
    if (recentCaptures?.length) continue

    await sendPush(user.id, {
      title: 'Anything on your mind?',
      body: 'Tap to capture it in Briefer.',
      url: '/today',
    }).catch(() => {})

    await db.from('reminder_log').insert({
      user_id: user.id,
      item_ids: [],
      channel: 'nudge',
      status: 'sent',
    })

    results.push(user.id)
  }

  return NextResponse.json({ sent: results.length })
}
