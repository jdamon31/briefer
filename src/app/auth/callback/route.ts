import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    // New users (no display_name yet) go to onboarding
    const { data: userData } = await supabase.from('users').select('display_name, created_at').single()
    const isNew = !userData?.display_name ||
      (userData?.created_at && Date.now() - new Date(userData.created_at).getTime() < 60000)

    if (isNew) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
  }

  return NextResponse.redirect(new URL('/today', req.url))
}
