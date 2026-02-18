import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /protected path
  if (pathname.startsWith('/protected')) {
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
              for (const { name, value } of cookiesToSet) {
                request.cookies.set(name, value)
              }

              response = NextResponse.next({ request })

              for (const { name, value, options } of cookiesToSet) {
                response.cookies.set(name, value, options)
              }
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

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/protected/:path*'], // Only run middleware on /protected and its subpaths
}
