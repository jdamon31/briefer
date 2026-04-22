import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyInput } from '@/lib/classifier'
import { pushEventToGCal } from '@/lib/gcal'
import { ItemSource } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { raw_input, source = 'manual' }: { raw_input: string; source?: ItemSource } = body

  if (!raw_input?.trim()) {
    return NextResponse.json({ error: 'raw_input required' }, { status: 400 })
  }

  // Get user timezone
  const { data: userData } = await supabase.from('users').select('timezone').eq('id', user.id).single()
  const timezone = userData?.timezone || 'America/Los_Angeles'

  // Create a placeholder item immediately so the UI can show it
  const { data: placeholder, error: insertErr } = await supabase.from('items').insert({
    user_id: user.id,
    type: 'task',
    title: raw_input.trim(),
    raw_input: raw_input.trim(),
    status: 'inbox',
    source,
  }).select().single()

  if (insertErr || !placeholder) {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }

  // Run classifier async-style but await it (fast enough at ~1-2s)
  try {
    const result = await classifyInput(raw_input, timezone)
    const itemType = result.type === 'unclear' ? 'task' : result.type
    const status = result.datetime ? 'active' : 'inbox'

    const { data: updated } = await supabase.from('items').update({
      type: itemType,
      title: result.title,
      notes: result.notes,
      due_at: result.datetime,
      duration_minutes: result.duration_minutes,
      status,
      tags: result.tags,
      location: result.location,
      classifier_confidence: result.classifier_confidence,
      needs_review: result.needs_review,
    }).eq('id', placeholder.id).select().single()

    // Push to GCal if it's an event
    if (updated && itemType === 'event' && result.datetime) {
      const { data: integration } = await supabase
        .from('integrations')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'google_calendar')
        .single()

      if (integration) {
        const googleEventId = await pushEventToGCal(user.id, updated)
        if (googleEventId) {
          await supabase.from('items').update({ google_event_id: googleEventId }).eq('id', updated.id)
          updated.google_event_id = googleEventId
        }
      } else {
        await supabase.from('items').update({ sync_pending: true }).eq('id', updated.id)
      }
    }

    return NextResponse.json({ item: updated || placeholder })
  } catch (err) {
    console.error('Classifier failed:', err)
    // Return the placeholder — the item is saved, just not classified
    return NextResponse.json({ item: placeholder, classifier_error: true })
  }
}
