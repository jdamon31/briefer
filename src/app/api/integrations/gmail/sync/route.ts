import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncGmailTasks } from '@/lib/gmail'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const created = await syncGmailTasks(user.id)
    return NextResponse.json({ created })
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
