import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/gcal'
import crypto from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = crypto.randomBytes(16).toString('hex')
  // Store state in a cookie for CSRF validation
  const url = getAuthUrl(state)
  const response = NextResponse.redirect(url)
  response.cookies.set('gcal_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/' })
  return response
}
