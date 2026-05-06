import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: 'user_id,endpoint' }
  )

  return NextResponse.json({ ok: true })
}
