import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startOfDay, endOfDay, addDays } from 'date-fns'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') // today | inbox | completed | upcoming
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase.from('items').select('*').eq('user_id', user.id)

  if (filter === 'today') {
    const now = new Date()
    query = query
      .in('status', ['active', 'inbox'])
      .or(`due_at.lte.${endOfDay(now).toISOString()},status.eq.inbox`)
      .order('due_at', { ascending: true, nullsFirst: false })
  } else if (filter === 'inbox') {
    query = query.eq('status', 'inbox').order('created_at', { ascending: false })
  } else if (filter === 'completed') {
    query = query.eq('status', 'done').order('completed_at', { ascending: false })
  } else if (filter === 'upcoming') {
    const now = new Date()
    query = query
      .eq('status', 'active')
      .gte('due_at', startOfDay(addDays(now, 1)).toISOString())
      .lte('due_at', endOfDay(addDays(now, 14)).toISOString())
      .order('due_at', { ascending: true })
  } else if (from && to) {
    query = query
      .gte('due_at', from)
      .lte('due_at', to)
      .neq('status', 'cancelled')
      .order('due_at', { ascending: true })
  } else {
    query = query.neq('status', 'cancelled').order('due_at', { ascending: true })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}
