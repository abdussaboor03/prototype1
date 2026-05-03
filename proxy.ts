import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (path.startsWith('/super-admin')) {
    const isLoginPage = path === '/super-admin/login'
    if (!user && !isLoginPage) {
      return NextResponse.redirect(new URL('/super-admin/login', request.url))
    }
    if (user && isLoginPage) {
      return NextResponse.redirect(new URL('/super-admin', request.url))
    }
  } else if (path.startsWith('/restaurant-admin')) {
    const isLoginPage = path === '/restaurant-admin/login'
    // Sign-out route always passes through so it can clear the session.
    const isSignOutRoute = path === '/restaurant-admin/sign-out'
    if (!user && !isLoginPage && !isSignOutRoute) {
      return NextResponse.redirect(
        new URL('/restaurant-admin/login', request.url),
      )
    }
    if (user && isLoginPage) {
      return NextResponse.redirect(new URL('/restaurant-admin', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/super-admin/:path*', '/restaurant-admin/:path*'],
}
