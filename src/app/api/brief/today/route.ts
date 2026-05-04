import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInAppBrief, generateInAppBriefFallback } from '@/lib/brief'
import { startOfDay, endOfDay, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('display_name, timezone')
    .eq('id', user.id)
    .single()

  const timezone = userData?.timezone ?? 'America/Los_Angeles'
  const userNow = toZonedTime(new Date(), timezone)
  const todayStart = startOfDay(userNow).toISOString()
  const todayEnd = endOfDay(userNow).toISOString()

  const [
    { data: todayEvents },
    { data: todayTasks },
    { data: completedToday },
    { data: overdueTasks },
    { data: inboxItems },
  ] = await Promise.all([
    supabase.from('items').select('*').eq('user_id', user.id).eq('type', 'event').eq('status', 'active').gte('due_at', todayStart).lte('due_at', todayEnd),
    supabase.from('items').select('*').eq('user_id', user.id).eq('type', 'task').eq('status', 'active').gte('due_at', todayStart).lte('due_at', todayEnd),
    supabase.from('items').select('*').eq('user_id', user.id).eq('status', 'done').gte('completed_at', todayStart).lte('completed_at', todayEnd),
    supabase.from('items').select('*').eq('user_id', user.id).eq('status', 'active').lt('due_at', todayStart),
    supabase.from('items').select('id').eq('user_id', user.id).eq('status', 'inbox'),
  ])

  const briefInput = {
    userName: userData?.display_name || 'there',
    currentHour: userNow.getHours(),
    dayOfWeek: format(userNow, 'EEEE'),
    todayEvents: todayEvents || [],
    todayTasks: todayTasks || [],
    completedToday: completedToday || [],
    overdueTasks: overdueTasks || [],
    inboxCount: inboxItems?.length || 0,
  }

  const brief = await generateInAppBrief(briefInput).catch(() => generateInAppBriefFallback(briefInput))

  return NextResponse.json({ brief, generatedAt: new Date().toISOString() })
}
