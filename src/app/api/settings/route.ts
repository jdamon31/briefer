import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: settings }, { data: userData }, { data: integration }] = await Promise.all([
    supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('integrations').select('id,calendar_id,connected_at,last_synced_at,broken').eq('user_id', user.id).eq('provider', 'google_calendar').single(),
  ])

  return NextResponse.json({ settings, user: userData, integration: integration || null })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { display_name, timezone, ...settingsUpdates } = body

  const promises: Promise<unknown>[] = []

  if (display_name !== undefined || timezone !== undefined) {
    promises.push(Promise.resolve(supabase.from('users').update({ display_name, timezone }).eq('id', user.id)))
  }
  if (Object.keys(settingsUpdates).length) {
    promises.push(Promise.resolve(supabase.from('user_settings').update({ ...settingsUpdates, updated_at: new Date().toISOString() }).eq('user_id', user.id)))
  }

  await Promise.all(promises)
  return NextResponse.json({ success: true })
}
