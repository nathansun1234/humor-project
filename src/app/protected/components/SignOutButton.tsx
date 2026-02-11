'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/') // Redirect to home page after sign out
  }

  return (
    <button
      onClick={handleSignOut}
      className={`px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 ${className || ''}`}
    >
      Sign Out
    </button>
  )
}
