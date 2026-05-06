import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { classifyInput } from '@/lib/classifier'

export async function GET() {
  return NextResponse.json({ ok: true, ping: true })
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const raw_input = (await req.text()).trim()
  if (!raw_input) return NextResponse.json({ error: 'Empty input' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: userData } = await supabase.from('users').select('id, timezone').eq('shortcut_token', token).single()
  if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const timezone = userData.timezone || 'America/Los_Angeles'

  const { data: placeholder } = await supabase.from('items').insert({
    user_id: userData.id,
    type: 'task',
    title: raw_input,
    raw_input,
    status: 'inbox',
    source: 'siri',
  }).select().single()

  if (placeholder) {
    try {
      const result = await classifyInput(raw_input, timezone)
      const itemType = result.type === 'unclear' ? 'task' : result.type
      await supabase.from('items').update({
        type: itemType,
        title: result.title,
        notes: result.notes,
        due_at: result.datetime,
        duration_minutes: result.duration_minutes,
        status: result.datetime ? 'active' : 'inbox',
        tags: result.tags,
        location: result.location,
        classifier_confidence: result.classifier_confidence,
        needs_review: result.needs_review,
        recurrence: result.recurrence ?? null,
      }).eq('id', placeholder.id)
    } catch {}
  }

  return NextResponse.json({ ok: true })
}
