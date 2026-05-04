import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { formatDistanceToNow } from 'date-fns'

const client = new Anthropic()

interface TriageItem {
  id: string
  title: string
  due_at: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items }: { items: TriageItem[] } = await req.json()
  if (!items?.length) return NextResponse.json({ suggestions: {} })

  // Verify all items belong to this user
  const ids = items.slice(0, 10).map(i => i.id)
  const { data: owned } = await supabase.from('items').select('id').eq('user_id', user.id).in('id', ids)
  const ownedIds = new Set((owned || []).map(i => i.id))
  const verified = items.filter(i => ownedIds.has(i.id))
  if (!verified.length) return NextResponse.json({ suggestions: {} })

  const itemsText = verified.map(i => {
    const age = formatDistanceToNow(new Date(i.due_at), { addSuffix: false })
    return `- id:${i.id} | "${i.title}" | overdue by ${age}`
  }).join('\n')

  const prompt = `These tasks are overdue. For each one, suggest the best disposition.

${itemsText}

Respond with a JSON object mapping each id to one of: "today", "tomorrow", "next_week", "delete".
Use "delete" only if the task sounds irrelevant or time-sensitive (e.g. something that clearly expired).
Respond only with valid JSON, no explanation.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ suggestions: {} })
  }
}
