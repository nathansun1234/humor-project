'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DYNAMIC_BACKGROUND_EVENT,
  DYNAMIC_BACKGROUND_STORAGE_KEY,
  emitBooleanSetting,
  KEYBOARD_CONTROLS_EVENT,
  KEYBOARD_CONTROLS_STORAGE_KEY,
  readStoredBoolean,
  storeBoolean,
} from '@/lib/protected-settings'

const THEME_STORAGE_KEY = 'ui-theme'
const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
type Theme = 'light' | 'dark'
type ThemePreference = (typeof THEME_PREFERENCES)[number]
type SettingsMenuProps = {
  showSignOut?: boolean
  showProtectedToggles?: boolean
  userEmail?: string | null
  profileId?: string | null
}

function readStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function normalizeThemePreference(preference: string | null): ThemePreference {
  return THEME_PREFERENCES.includes((preference ?? '') as ThemePreference)
    ? (preference as ThemePreference)
    : 'system'
}

function applyThemePreference(preference: ThemePreference): Theme {
  const effectiveTheme = preference === 'system' ? getSystemTheme() : preference
  const root = document.documentElement
  root.classList.toggle('dark', effectiveTheme === 'dark')
  root.style.colorScheme = effectiveTheme
  root.dataset.themePreference = preference
  return effectiveTheme
}

export default function SettingsMenu({
  showSignOut = false,
  showProtectedToggles = false,
  userEmail = null,
  profileId = null,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>('system')
  const [dynamicBackgroundEnabled, setDynamicBackgroundEnabled] = useState(true)
  const [keyboardControlsEnabled, setKeyboardControlsEnabled] = useState(true)
  const [keyboardInfoOpen, setKeyboardInfoOpen] = useState(false)
  const keyboardInfoCloseTimeoutRef = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const router = useRouter()

  const closeKeyboardInfo = useCallback(() => {
    if (keyboardInfoCloseTimeoutRef.current !== null) {
      window.clearTimeout(keyboardInfoCloseTimeoutRef.current)
      keyboardInfoCloseTimeoutRef.current = null
    }
    setKeyboardInfoOpen(false)
  }, [])

  useEffect(() => {
    applyThemePreference(themePreference)
  }, [themePreference])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setThemePreference(readStoredThemePreference())
      setDynamicBackgroundEnabled(readStoredBoolean(DYNAMIC_BACKGROUND_STORAGE_KEY, true))
      setKeyboardControlsEnabled(readStoredBoolean(KEYBOARD_CONTROLS_STORAGE_KEY, true))
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (themePreference !== 'system') return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
    const handlePreferenceChange = () => {
      applyThemePreference('system')
    }

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handlePreferenceChange)
      return () => mediaQueryList.removeEventListener('change', handlePreferenceChange)
    }

    mediaQueryList.addListener(handlePreferenceChange)
    return () => mediaQueryList.removeListener(handlePreferenceChange)
  }, [themePreference])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      closeKeyboardInfo()
      setIsOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeKeyboardInfo()
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [closeKeyboardInfo, isOpen])

  useEffect(() => {
    return () => {
      if (keyboardInfoCloseTimeoutRef.current !== null) {
        window.clearTimeout(keyboardInfoCloseTimeoutRef.current)
      }
    }
  }, [])

  const handleThemeChange = (nextPreference: ThemePreference) => {
    const normalizedPreference = normalizeThemePreference(nextPreference)
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizedPreference)
    setThemePreference(normalizedPreference)
  }

  const handleToggleDynamicBackground = () => {
    const nextValue = !dynamicBackgroundEnabled
    setDynamicBackgroundEnabled(nextValue)
    storeBoolean(DYNAMIC_BACKGROUND_STORAGE_KEY, nextValue)
    emitBooleanSetting(DYNAMIC_BACKGROUND_EVENT, nextValue)
  }

  const handleToggleKeyboardControls = () => {
    const nextValue = !keyboardControlsEnabled
    setKeyboardControlsEnabled(nextValue)
    storeBoolean(KEYBOARD_CONTROLS_STORAGE_KEY, nextValue)
    emitBooleanSetting(KEYBOARD_CONTROLS_EVENT, nextValue)
  }

  const openKeyboardInfo = () => {
    if (keyboardInfoCloseTimeoutRef.current !== null) {
      window.clearTimeout(keyboardInfoCloseTimeoutRef.current)
      keyboardInfoCloseTimeoutRef.current = null
    }
    setKeyboardInfoOpen(true)
  }

  const closeKeyboardInfoSoon = () => {
    if (keyboardInfoCloseTimeoutRef.current !== null) {
      window.clearTimeout(keyboardInfoCloseTimeoutRef.current)
    }
    keyboardInfoCloseTimeoutRef.current = window.setTimeout(() => {
      setKeyboardInfoOpen(false)
      keyboardInfoCloseTimeoutRef.current = null
    }, 120)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore sign-out failures caused by stale refresh tokens.
    }
    router.replace('/')
  }

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[120] flex flex-col items-end sm:top-6 sm:right-6"
      data-settings-menu-root="true"
      data-settings-menu-open={isOpen ? 'true' : 'false'}
    >
      <div
        aria-hidden
        className={`fixed inset-0 z-[110] pointer-events-none backdrop-blur-[1.5px] transition-opacity duration-200 ${
          isOpen ? 'bg-slate-900/[0.03] opacity-100 dark:bg-black/[0.08]' : 'bg-transparent opacity-0'
        }`}
      />
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen((open) => {
            const nextOpen = !open
            if (!nextOpen) {
              closeKeyboardInfo()
            }
            return nextOpen
          })
        }}
        aria-expanded={isOpen}
        aria-controls="settings-panel"
        aria-label="Open settings"
        className="pointer-events-auto relative z-[130] flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-lg ring-1 ring-slate-400/35 transition hover:bg-slate-100 dark:border-white/15 dark:bg-black dark:text-neutral-100 dark:ring-white/20 dark:hover:bg-[#0d0d0d]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="11" cy="18" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <div
        id="settings-panel"
        ref={panelRef}
        className={`relative z-[130] mt-2 w-60 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl transition-all duration-200 ease-out dark:border-white/15 dark:bg-black ${
          isOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
        }`}
      >
        <ThemeSegmentRow themePreference={themePreference} onChange={handleThemeChange} />

        {showProtectedToggles && (
          <>
            <ToggleRow
              className="mt-3"
              label="Dynamic background"
              enabled={dynamicBackgroundEnabled}
              onToggle={handleToggleDynamicBackground}
            />
            <div className="mt-3 border-t border-slate-200 dark:border-white/10" />
            <ToggleRow
              className="mt-3"
              label={
                <span className="inline-flex items-center gap-1.5">
                  Keyboard controls
                  <button
                    type="button"
                    aria-label="Keyboard controls information"
                    onMouseEnter={openKeyboardInfo}
                    onMouseLeave={closeKeyboardInfoSoon}
                    onFocus={openKeyboardInfo}
                    onBlur={closeKeyboardInfoSoon}
                    onClick={() => {
                      setKeyboardInfoOpen((current) => {
                        const nextOpen = !current
                        if (!nextOpen && keyboardInfoCloseTimeoutRef.current !== null) {
                          window.clearTimeout(keyboardInfoCloseTimeoutRef.current)
                          keyboardInfoCloseTimeoutRef.current = null
                        }
                        return nextOpen
                      })
                    }}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-semibold leading-none text-slate-600 transition hover:bg-slate-100 dark:border-white/35 dark:text-neutral-300 dark:hover:bg-[#111111]"
                  >
                    i
                  </button>
                </span>
              }
              enabled={keyboardControlsEnabled}
              onToggle={handleToggleKeyboardControls}
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

      {isOpen && showProtectedToggles && keyboardInfoOpen && (
        <div
          className="pointer-events-auto relative z-[130] mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl dark:border-white/15 dark:bg-black"
          onMouseEnter={openKeyboardInfo}
          onMouseLeave={closeKeyboardInfoSoon}
        >
          <p className="text-xs font-medium text-slate-800 dark:text-neutral-100">Keyboard controls</p>
          <p className="mt-2 text-xs text-slate-600 dark:text-neutral-300">
            Press <span className="font-semibold">Up</span> to upvote, <span className="font-semibold">Down</span> to
            downvote, <span className="font-semibold">Left</span> to go back, and{' '}
            <span className="font-semibold">Right</span> to skip.
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-neutral-300">
            Turn this toggle off to disable all keyboard voting shortcuts.
          </p>
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
  label: ReactNode
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

function ThemeSegmentRow({
  themePreference,
  onChange,
}: {
  themePreference: ThemePreference
  onChange: (nextPreference: ThemePreference) => void
}) {
  const activeThemeIndex = Math.max(THEME_PREFERENCES.indexOf(themePreference), 0)

  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-sm font-medium text-slate-800 dark:text-neutral-100">Theme</span>
      <div
        role="radiogroup"
        aria-label="Theme preference"
        className="w-full rounded-full border border-slate-300 bg-slate-200/90 p-[3px] shadow-[0_8px_20px_-16px_rgba(15,23,42,0.42)] dark:border-white/15 dark:bg-[rgba(30,30,36,0.82)]"
      >
        <div className="relative grid min-h-8 grid-cols-3 items-stretch">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 rounded-full bg-white shadow-[0_8px_14px_-12px_rgba(15,23,42,0.38),inset_0_0_0_1px_rgba(15,23,42,0.08)] transition-transform duration-[250ms] ease-[cubic-bezier(0.2,0.78,0.18,1)] dark:bg-[#050505] dark:shadow-[0_10px_22px_-12px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            style={{ transform: `translateX(${activeThemeIndex * 100}%)` }}
          />
          {THEME_PREFERENCES.map((preference) => {
            const isActive = themePreference === preference
            return (
              <button
                key={preference}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onChange(preference)}
                className={`relative z-10 rounded-full bg-transparent px-1 py-[0.35rem] text-center text-[0.72rem] font-semibold tracking-[-0.01em] transition-colors ${
                  isActive ? 'text-slate-900 dark:text-slate-50' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {preference.charAt(0).toUpperCase() + preference.slice(1)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
