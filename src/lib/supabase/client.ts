import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isStaleRefreshTokenError, safeSignOut } from './auth'

let browserClient: SupabaseClient | null = null
let staleAuthRejectionHandlerInstalled = false

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  installStaleAuthRejectionHandler(browserClient)
  return browserClient
}

function installStaleAuthRejectionHandler(supabase: SupabaseClient) {
  if (typeof window === 'undefined' || staleAuthRejectionHandlerInstalled) {
    return
  }

  staleAuthRejectionHandlerInstalled = true
  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleRefreshTokenError(event.reason)) {
      return
    }

    event.preventDefault()
    void safeSignOut(supabase)
  })
}
