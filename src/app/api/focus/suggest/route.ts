import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

const client = new Anthropic()

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ suggestions: [], reasoning: '' })

  const { data: userData } = await supabase.from('users').select('timezone').eq('id', user.id).single()
  const timezone = userData?.timezone || 'America/Los_Angeles'

  const now = toZonedTime(new Date(), timezone)
  const startOfDay = toZonedTime(new Date(), timezone)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = toZonedTime(new Date(), timezone)
  endOfDay.setHours(23, 59, 59, 999)

  const [todayRes, overdueRes] = await Promise.all([
    supabase.from('items').select('id, title, type, due_at, tags').eq('user_id', user.id)
      .in('status', ['inbox', 'active'])
      .gte('due_at', startOfDay.toISOString())
      .lte('due_at', endOfDay.toISOString()),
    supabase.from('items').select('id, title, type, due_at, tags').eq('user_id', user.id)
      .in('status', ['inbox', 'active'])
      .lt('due_at', startOfDay.toISOString())
      .not('due_at', 'is', null),
  ])

  const todayItems = todayRes.data || []
  const overdueItems = (overdueRes.data || []).slice(0, 5)
  const allItems = [...todayItems, ...overdueItems]

  if (!allItems.length) return NextResponse.json({ suggestions: [], reasoning: 'Nothing on your list!' })

  const dayOfWeek = format(now, 'EEEE')
  const itemLines = allItems.map(i => {
    const timeStr = i.due_at ? ` (${format(toZonedTime(new Date(i.due_at), timezone), 'h:mm a')})` : ''
    const isOverdue = i.due_at && new Date(i.due_at) < startOfDay
    const tags = (i.tags as string[]).length ? ` [${(i.tags as string[]).join(', ')}]` : ''
    return `id:${i.id} | ${i.type} | "${i.title}"${timeStr}${tags}${isOverdue ? ' [OVERDUE]' : ''}`
  }).join('\n')

  const prompt = `It's ${dayOfWeek}. Pick 1-3 Most Important Tasks (MITs) from this list.

${itemLines}

Rules:
- Prefer events with fixed times first (can't move them)
- Then work tasks on weekdays
- Then overdue items
- Max 3 suggestions
- Only pick IDs from the list above — never invent IDs

Respond with JSON only:
{"suggestions": ["id1", "id2"], "reasoning": "one short sentence"}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    const ownedIds = new Set(allItems.map(i => i.id))
    const suggestions = ((parsed.suggestions as string[]) || []).filter((id: string) => ownedIds.has(id)).slice(0, 3)

    return NextResponse.json({ suggestions, reasoning: parsed.reasoning || '' })
  } catch {
    return NextResponse.json({ suggestions: [], reasoning: '' })
  }
}
