'use client'

import { useEffect, useState } from 'react'
import DynamicPastelBackground from './DynamicPastelBackground'
import {
  type BooleanSettingEventDetail,
  DYNAMIC_BACKGROUND_EVENT,
  DYNAMIC_BACKGROUND_STORAGE_KEY,
  readStoredBoolean,
} from '@/lib/protected-settings'

const ORIGIN_BACKGROUND_CLASS =
  'pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_45%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.12),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_45%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.14),transparent_40%)]'

export default function ProtectedBackgroundLayer() {
  // Keep initial server/client render deterministic to avoid hydration mismatch.
  const [dynamicBackgroundEnabled, setDynamicBackgroundEnabled] = useState(true)

  useEffect(() => {
    const syncFromStorage = () => {
      setDynamicBackgroundEnabled(readStoredBoolean(DYNAMIC_BACKGROUND_STORAGE_KEY, true))
    }

    syncFromStorage()

    const handleDynamicBackgroundChange = (event: Event) => {
      const customEvent = event as CustomEvent<BooleanSettingEventDetail>
      const nextValue = customEvent.detail?.enabled

      if (typeof nextValue === 'boolean') {
        setDynamicBackgroundEnabled(nextValue)
        return
      }

      syncFromStorage()
    }

    window.addEventListener(DYNAMIC_BACKGROUND_EVENT, handleDynamicBackgroundChange as EventListener)
    return () => {
      window.removeEventListener(DYNAMIC_BACKGROUND_EVENT, handleDynamicBackgroundChange as EventListener)
    }
  }, [])

  if (dynamicBackgroundEnabled) {
    return <DynamicPastelBackground />
  }

  return <div className={ORIGIN_BACKGROUND_CLASS} aria-hidden />
}
