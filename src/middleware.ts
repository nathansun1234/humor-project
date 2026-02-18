import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieOptionBag = Record<string, string | number | boolean | Date | undefined>

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /protected path
  if (pathname.startsWith('/protected')) {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(..._args: [string, string, CookieOptionBag]) {
              // Normally middleware shouldn't set cookies unless needed
            },
            remove(..._args: [string, CookieOptionBag]) {
              // Normally middleware shouldn't remove cookies
            },
          },
        }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      const loginUrl = new URL('/', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/protected/:path*'], // Only run middleware on /protected and its subpaths
}
