'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore sign-out failures caused by stale refresh tokens.
    }
    router.push('/') // Redirect to home page after sign out
  }

  return (
    <button
      onClick={handleSignOut}
      className={`rounded-xl bg-rose-500/20 px-4 py-2 font-semibold text-rose-800 transition hover:bg-rose-500/35 dark:text-rose-100 ${className || ''}`}
    >
      Sign Out
    </button>
  )
}
