import type { SupabaseClient } from '@supabase/supabase-js'

export function isStaleRefreshTokenError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : String(error ?? '')

  const normalizedMessage = message.toLowerCase()
  return normalizedMessage.includes('invalid refresh token') || normalizedMessage.includes('refresh token not found')
}

export async function safeSignOut(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.auth.signOut()
  } catch (error) {
    if (!isStaleRefreshTokenError(error)) {
      return
    }

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Ignore local cleanup failures; the stale token is already unusable.
    }
  }
}
