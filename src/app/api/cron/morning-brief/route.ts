import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateMorningBrief, generateFallbackBrief } from '@/lib/brief'
import { syncFromGCal } from '@/lib/gcal'
import { Resend } from 'resend'
import { startOfDay, endOfDay, addDays, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

function authCheck(req: NextRequest) {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - 7.5 * 60000)
  const windowEnd = new Date(now.getTime() + 7.5 * 60000)

  // Find users whose brief time falls in this 15-min window and haven't received one today
  const { data: users } = await db
    .from('users')
    .select('id, display_name, timezone, user_settings!inner(morning_brief_enabled, morning_brief_time)')

  const results: string[] = []

  for (const user of users || []) {
    const settings = (user as any).user_settings
    if (!settings?.morning_brief_enabled) continue

    const userNow = toZonedTime(now, user.timezone)
    const briefTime = settings.morning_brief_time // e.g. "07:00:00"
    const [h, m] = briefTime.split(':').map(Number)
    const todayBriefUtc = new Date(Date.UTC(
      userNow.getFullYear(), userNow.getMonth(), userNow.getDate(), h, m
    ) - (userNow.getTimezoneOffset?.() ?? 0) * 60000)

    if (todayBriefUtc < windowStart || todayBriefUtc > windowEnd) continue

    // Check if already sent today
    const { data: sentToday } = await db
      .from('reminder_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('channel', 'morning_brief')
      .gte('sent_at', startOfDay(userNow).toISOString())
      .single()

    if (sentToday) continue

    // Pre-sync GCal
    await syncFromGCal(user.id).catch(() => {})

    const todayStart = startOfDay(userNow).toISOString()
    const todayEnd = endOfDay(userNow).toISOString()
    const upcomingEnd = endOfDay(addDays(userNow, 3)).toISOString()

    const [
      { data: todayEvents },
      { data: todayTasks },
      { data: overdueTasks },
      { data: inboxItems },
      { data: upcomingItems },
      { data: authUser },
    ] = await Promise.all([
      db.from('items').select('*').eq('user_id', user.id).eq('type', 'event').eq('status', 'active').gte('due_at', todayStart).lte('due_at', todayEnd),
      db.from('items').select('*').eq('user_id', user.id).eq('type', 'task').eq('status', 'active').gte('due_at', todayStart).lte('due_at', todayEnd),
      db.from('items').select('*').eq('user_id', user.id).eq('status', 'active').lt('due_at', todayStart),
      db.from('items').select('id').eq('user_id', user.id).eq('status', 'inbox'),
      db.from('items').select('*').eq('user_id', user.id).eq('status', 'active').gt('due_at', todayEnd).lte('due_at', upcomingEnd).order('due_at'),
      db.auth.admin.getUserById(user.id),
    ])

    const userEmail = authUser.user?.email
    if (!userEmail) continue

    const briefInput = {
      userName: user.display_name || 'there',
      timezone: user.timezone,
      todayEvents: todayEvents || [],
      todayTasks: todayTasks || [],
      overdueTasks: overdueTasks || [],
      inboxCount: inboxItems?.length || 0,
      upcomingItems: upcomingItems || [],
      dayOfWeek: format(userNow, 'EEEE'),
    }

    let brief: { subject: string; body: string }
    try {
      brief = await generateMorningBrief(briefInput)
    } catch {
      brief = generateFallbackBrief(briefInput)
    }

    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: userEmail,
      subject: brief.subject,
      text: brief.body,
    })

    await db.from('reminder_log').insert({
      user_id: user.id,
      item_ids: [...(todayEvents || []), ...(todayTasks || [])].map(i => i.id),
      channel: 'morning_brief',
      status: 'sent',
    })

    results.push(user.id)
  }

  return NextResponse.json({ sent: results.length, users: results })
}
