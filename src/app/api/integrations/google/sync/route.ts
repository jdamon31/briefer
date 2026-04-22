import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncFromGCal } from '@/lib/gcal'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await syncFromGCal(user.id)
  return NextResponse.json({ success: true })
}
