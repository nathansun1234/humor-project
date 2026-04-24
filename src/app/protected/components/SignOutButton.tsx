'use client'

import { safeSignOut } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await safeSignOut(supabase)
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
