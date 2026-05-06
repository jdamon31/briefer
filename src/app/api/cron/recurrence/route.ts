import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPush } from '@/lib/push'

function authCheck(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const oneDayAgo = new Date(Date.now() - 24 * 3600000).toISOString()

  // Find recurring items that are overdue and still active
  const { data: missed } = await db
    .from('items')
    .select('id, user_id, title, streak')
    .not('recurrence', 'is', null)
    .eq('status', 'active')
    .lt('due_at', oneDayAgo)

  const notified = new Set<string>()

  for (const item of missed || []) {
    // Only push if streak was meaningful (>2) — not worth notifying for new habits
    if (item.streak > 2 && !notified.has(item.user_id)) {
      await sendPush(item.user_id, {
        title: 'Streak at risk',
        body: `Don't forget: ${item.title} (${item.streak} day streak)`,
        url: '/today',
      }).catch(() => {})
      notified.add(item.user_id)
    }
  }

  return NextResponse.json({ checked: missed?.length ?? 0, notified: notified.size })
}
