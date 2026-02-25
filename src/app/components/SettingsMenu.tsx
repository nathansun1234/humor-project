'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DYNAMIC_BACKGROUND_EVENT,
  DYNAMIC_BACKGROUND_STORAGE_KEY,
  emitBooleanSetting,
  readStoredBoolean,
  storeBoolean,
} from '@/lib/protected-settings'

const THEME_STORAGE_KEY = 'ui-theme'
type Theme = 'light' | 'dark'
type SettingsMenuProps = {
  showSignOut?: boolean
  showProtectedToggles?: boolean
  userEmail?: string | null
  profileId?: string | null
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export default function SettingsMenu({
  showSignOut = false,
  showProtectedToggles = false,
  userEmail = null,
  profileId = null,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [dynamicBackgroundEnabled, setDynamicBackgroundEnabled] = useState(() =>
    readStoredBoolean(DYNAMIC_BACKGROUND_STORAGE_KEY, true)
  )
  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    const htmlElement = document.documentElement
    const syncDarkMode = () => {
      setIsDarkMode(htmlElement.classList.contains('dark'))
    }

    syncDarkMode()

    const observer = new MutationObserver(syncDarkMode)
    observer.observe(htmlElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setIsOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleToggleTheme = () => {
    const nextTheme: Theme = isDarkMode ? 'light' : 'dark'
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    applyTheme(nextTheme)
    setIsDarkMode(nextTheme === 'dark')
  }

  const handleToggleDynamicBackground = () => {
    const nextValue = !dynamicBackgroundEnabled
    setDynamicBackgroundEnabled(nextValue)
    storeBoolean(DYNAMIC_BACKGROUND_STORAGE_KEY, nextValue)
    emitBooleanSetting(DYNAMIC_BACKGROUND_EVENT, nextValue)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[120] flex flex-col items-end sm:top-6 sm:right-6">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="settings-panel"
        aria-label="Open settings"
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-lg ring-1 ring-slate-400/35 transition hover:bg-slate-100 dark:border-white/15 dark:bg-black dark:text-neutral-100 dark:ring-white/20 dark:hover:bg-[#0d0d0d]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="11" cy="18" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {isOpen && (
        <div
          id="settings-panel"
          ref={panelRef}
          className="pointer-events-auto mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl dark:border-white/15 dark:bg-black"
        >
          <ToggleRow label="Dark mode" enabled={isDarkMode} onToggle={handleToggleTheme} />

          {showProtectedToggles && (
            <>
              <div className="mt-3 border-t border-slate-200 dark:border-white/10" />
              <ToggleRow
                className="mt-3"
                label="Dynamic background"
                enabled={dynamicBackgroundEnabled}
                onToggle={handleToggleDynamicBackground}
              />
            </>
          )}

          {showSignOut && (
            <>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="mt-4 w-full rounded-xl bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-500/35 dark:text-rose-100"
              >
                Sign Out
              </button>
              {userEmail && (
                <p className="mt-2 break-all text-center text-xs text-slate-600 dark:text-neutral-300">{userEmail}</p>
              )}
              {profileId && (
                <p className="mt-1 break-all text-center text-xs text-slate-500 dark:text-neutral-400">
                  Profile Id: {profileId}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ToggleRow({
  label,
  enabled,
  onToggle,
  className = '',
}: {
  label: string
  enabled: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`.trim()}>
      <span className="text-sm font-medium text-slate-800 dark:text-neutral-100">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative h-7 w-12 rounded-full transition ${
          enabled ? 'bg-emerald-500/20 dark:bg-emerald-500/35' : 'bg-rose-500/20 dark:bg-rose-500/35'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            enabled ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  )
}
