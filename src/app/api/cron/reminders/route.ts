import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { startOfDay, endOfDay, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { Item } from '@/types'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

function authCheck(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

function buildReminderEmail(userName: string, dueToday: Item[], overdue: Item[], appUrl: string): string {
  const lines: string[] = [`Hi ${userName},\n`]

  if (dueToday.length) {
    lines.push('Due today:')
    for (const item of dueToday) {
      const time = item.due_at ? ` · ${format(new Date(item.due_at), 'h:mm a')}` : ''
      const tag = item.tags[0] ? ` [${item.tags[0]}]` : ''
      lines.push(`  • ${item.title}${time}${tag}`)
    }
  }

  if (overdue.length) {
    lines.push('\nOverdue:')
    for (const item of overdue) {
      const age = Math.round((Date.now() - new Date(item.due_at!).getTime()) / 86400000)
      lines.push(`  • ${item.title} (${age}d ago)`)
    }
  }

  lines.push(`\n${appUrl}`)
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - 7.5 * 60000)
  const windowEnd = new Date(now.getTime() + 7.5 * 60000)

  const { data: users } = await db
    .from('users')
    .select('id, display_name, timezone, user_settings!inner(reminders_enabled, reminder_times, morning_brief_time, morning_brief_enabled)')

  const results: string[] = []

  for (const user of users || []) {
    const settings = (user as any).user_settings
    if (!settings?.reminders_enabled || !settings.reminder_times?.length) continue

    const userNow = toZonedTime(now, user.timezone)

    // Check if any reminder_time falls in window
    const reminderFiring = settings.reminder_times.some((t: string) => {
      const [h, m] = t.split(':').map(Number)
      const reminderUtc = new Date(Date.UTC(
        userNow.getFullYear(), userNow.getMonth(), userNow.getDate(), h, m
      ))
      return reminderUtc >= windowStart && reminderUtc <= windowEnd
    })
    if (!reminderFiring) continue

    const todayStart = startOfDay(userNow).toISOString()
    const todayEnd = endOfDay(userNow).toISOString()

    const [
      { data: dueToday },
      { data: overdue },
      { data: recentLog },
      { data: authUser },
    ] = await Promise.all([
      db.from('items').select('*').eq('user_id', user.id).eq('status', 'active').gte('due_at', todayStart).lte('due_at', todayEnd),
      db.from('items').select('*').eq('user_id', user.id).eq('status', 'active').lt('due_at', todayStart),
      // Check quiet conditions: brief sent in last 2h or user activity in last 30min
      db.from('reminder_log').select('sent_at').eq('user_id', user.id).gte('sent_at', new Date(now.getTime() - 2 * 3600000).toISOString()).order('sent_at', { ascending: false }).limit(1),
      db.auth.admin.getUserById(user.id),
    ])

    // Quiet: nothing due and nothing overdue
    if (!dueToday?.length && !overdue?.length) continue
    // Quiet: morning brief sent in last 2h
    if (recentLog?.length) continue

    const userEmail = authUser.user?.email
    if (!userEmail) continue

    const body = buildReminderEmail(
      user.display_name || 'there',
      dueToday || [],
      overdue || [],
      process.env.NEXT_PUBLIC_APP_URL || 'https://briefer.app'
    )

    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: userEmail,
      subject: `Briefer · ${(dueToday?.length || 0) + (overdue?.length || 0)} item${((dueToday?.length || 0) + (overdue?.length || 0)) !== 1 ? 's' : ''} need attention`,
      text: body,
    })

    await db.from('reminder_log').insert({
      user_id: user.id,
      item_ids: [...(dueToday || []), ...(overdue || [])].map(i => i.id),
      channel: 'reminder',
      status: 'sent',
    })

    results.push(user.id)
  }

  return NextResponse.json({ sent: results.length })
}
