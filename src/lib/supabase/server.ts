import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  type CookieOptionBag = Record<string, string | number | boolean | Date | undefined>

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptionBag) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // The `cookies().set()` method can only be called in a Server Component or Route Handler.
            // This error is typically caused by an attempt to set a cookie from a Client Component.
            // Any cookies set by a Client Component will be ignored.
          }
        },
        remove(name: string, options: CookieOptionBag) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // The `cookies().set()` method can only be called in a Server Component or Route Handler.
            // This error is typically caused by an attempt to set a cookie from a Client Component.
            // Any cookies set by a Client Component will be ignored.
          }
        },
      },
    }
  )
}
