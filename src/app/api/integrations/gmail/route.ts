import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailAuthUrl } from '@/lib/gmail'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect('/auth')

  const url = getGmailAuthUrl(user.id)
  return NextResponse.redirect(url)
}
