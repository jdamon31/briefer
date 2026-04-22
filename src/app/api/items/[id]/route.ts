import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushEventToGCal, deleteGCalEvent } from '@/lib/gcal'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const updates = await req.json()

  // Fetch current item to detect type changes
  const { data: current } = await supabase.from('items').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (updates.status === 'done' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString()
  }
  if (updates.status && updates.status !== 'done') {
    updates.completed_at = null
  }

  const { data: updated, error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Handle GCal side effects
  const wasEvent = current.type === 'event'
  const isNowEvent = (updates.type ?? current.type) === 'event'

  if (wasEvent && !isNowEvent && current.google_event_id) {
    // Demoted to task — delete GCal entry
    await deleteGCalEvent(user.id, current.google_event_id)
    await supabase.from('items').update({ google_event_id: null, google_etag: null }).eq('id', id)
  } else if (isNowEvent && updated) {
    // Event updated — push to GCal
    const googleEventId = await pushEventToGCal(user.id, updated)
    if (googleEventId) {
      await supabase.from('items').update({ google_event_id: googleEventId, sync_pending: false }).eq('id', id)
    }
  }

  return NextResponse.json({ item: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: item } = await supabase.from('items').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (item.google_event_id) {
    await deleteGCalEvent(user.id, item.google_event_id)
  }

  const { error } = await supabase.from('items').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
