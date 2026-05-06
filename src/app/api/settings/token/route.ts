import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('shortcut_token').eq('id', user.id).single()

  let token = userData?.shortcut_token
  if (!token) {
    token = randomBytes(32).toString('hex')
    await supabase.from('users').update({ shortcut_token: token }).eq('id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return NextResponse.json({
    token,
    endpoint: `${appUrl}/api/shortcut/capture?t=${token}`,
  })
}
