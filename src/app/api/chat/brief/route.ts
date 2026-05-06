import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import type { ChatMessage } from '@/types'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages }: { messages: ChatMessage[] } = await req.json()
  if (!messages?.length) return NextResponse.json({ reply: 'Say something!' })

  const { data: userData } = await supabase.from('users').select('timezone, display_name').eq('id', user.id).single()
  const timezone = userData?.timezone || 'America/Los_Angeles'
  const userName = userData?.display_name || 'there'

  const now = toZonedTime(new Date(), timezone)
  const hour = now.getHours()
  const dayOfWeek = format(now, 'EEEE')
  const dateStr = format(now, 'MMMM d')

  const startOfDay = toZonedTime(new Date(), timezone)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = toZonedTime(new Date(), timezone)
  endOfDay.setHours(23, 59, 59, 999)

  const [eventsRes, tasksRes, overdueRes, inboxRes] = await Promise.all([
    supabase.from('items').select('title, due_at, end_at, status').eq('user_id', user.id).eq('type', 'event')
      .gte('due_at', startOfDay.toISOString()).lte('due_at', endOfDay.toISOString()),
    supabase.from('items').select('id, title, due_at, tags, pinned, status').eq('user_id', user.id).eq('type', 'task')
      .in('status', ['inbox', 'active']).gte('due_at', startOfDay.toISOString()).lte('due_at', endOfDay.toISOString()),
    supabase.from('items').select('id, title, due_at').eq('user_id', user.id)
      .in('status', ['inbox', 'active']).lt('due_at', startOfDay.toISOString()).not('due_at', 'is', null),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'inbox').is('due_at', null),
  ])

  const todayEvents = eventsRes.data || []
  const todayTasks = tasksRes.data || []
  const overdueTasks = overdueRes.data || []
  const inboxCount = inboxRes.count || 0

  const eventLines = todayEvents.map(e => `  • ${e.title}${e.due_at ? ` at ${format(toZonedTime(new Date(e.due_at), timezone), 'h:mm a')}` : ''}`).join('\n') || '  (none)'
  const taskLines = todayTasks.map(t => `  • ${t.title}${(t as { pinned?: boolean }).pinned ? ' ★' : ''}`).join('\n') || '  (none)'
  const overdueLines = overdueTasks.slice(0, 5).map(t => `  • ${t.title}`).join('\n') || '  (none)'

  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const systemPrompt = `You are Briefer, a smart daily assistant for ${userName}. It's ${timeOfDay} on ${dayOfWeek}, ${dateStr}.

Today's context:
Events:
${eventLines}

Tasks due today:
${taskLines}

Overdue (${overdueTasks.length}):
${overdueLines}

Inbox items: ${inboxCount}

Keep replies short and direct (2-4 sentences max). Be friendly, practical, and specific to their actual items. Help them make decisions, prioritize, and feel in control of their day. Use their name occasionally.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'Something went wrong.'
    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: 'Something went wrong. Try again.' })
  }
}
