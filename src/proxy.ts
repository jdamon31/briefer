import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { pathname } = req.nextUrl

  // Cron routes use Bearer auth, not session auth
  if (pathname.startsWith('/api/cron')) return res

  const isAuth = pathname.startsWith('/auth')
  const isOnboarding = pathname.startsWith('/onboarding')
  const isPublic = pathname === '/' || isAuth

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && !isPublic && !isOnboarding) {
      return NextResponse.redirect(new URL('/auth', req.url))
    }
    if (user && isAuth) {
      return NextResponse.redirect(new URL('/today', req.url))
    }
  } catch (err) {
    console.error('[proxy] Supabase auth error:', err)
    // On auth failure, allow public routes through and redirect protected routes to /auth
    if (!isPublic) {
      return NextResponse.redirect(new URL('/auth', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
