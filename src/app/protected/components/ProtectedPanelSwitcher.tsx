'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import CaptionVotingPanel from './CaptionVotingPanel'
import GenerateCaptionsPanel from './GenerateCaptionsPanel'

type CaptionRecord = {
  id: string
  content?: string | null
  title?: string | null
  image_id?: string | null
  image_url?: string | null
  imageUrl?: string | null
}

type ProtectedPanelMode = 'caption-voting' | 'generate-captions'
const MODE_FADE_DURATION_MS = 260

export default function ProtectedPanelSwitcher({
  initialCaptions,
  initialUserId,
}: {
  initialCaptions: CaptionRecord[]
  initialUserId: string
}) {
  const transitionTimeoutRef = useRef<number | null>(null)
  const [activePanel, setActivePanel] = useState<ProtectedPanelMode>('caption-voting')
  const [renderedPanel, setRenderedPanel] = useState<ProtectedPanelMode>('caption-voting')
  const [contentVisible, setContentVisible] = useState(true)
  const isCaptionVotingModeSelected = activePanel === 'caption-voting'
  const isCaptionVotingModeRendered = renderedPanel === 'caption-voting'

  const clearTransitionTimeout = useCallback(() => {
    if (transitionTimeoutRef.current === null) return
    window.clearTimeout(transitionTimeoutRef.current)
    transitionTimeoutRef.current = null
  }, [])

  const handlePanelChange = useCallback(
    (nextPanel: ProtectedPanelMode) => {
      if (nextPanel === activePanel && nextPanel === renderedPanel && contentVisible) {
        return
      }

      setActivePanel(nextPanel)
      setContentVisible(false)
      clearTransitionTimeout()

      transitionTimeoutRef.current = window.setTimeout(() => {
        setRenderedPanel(nextPanel)
        setContentVisible(true)
        transitionTimeoutRef.current = null
      }, MODE_FADE_DURATION_MS)
    },
    [activePanel, clearTransitionTimeout, contentVisible, renderedPanel]
  )

  useEffect(() => {
    return () => {
      clearTransitionTimeout()
    }
  }, [clearTransitionTimeout])

  const animatedVisibilityClass = contentVisible
    ? 'opacity-100 translate-y-0'
    : 'pointer-events-none opacity-0 translate-y-1'
  const panelStageClass = 'relative h-[77dvh]'
  const getPanelVisibilityClass = (panel: ProtectedPanelMode) =>
    `absolute inset-0 transition-all ease-in-out ${
      renderedPanel === panel && contentVisible
        ? 'opacity-100 translate-y-0'
        : 'pointer-events-none opacity-0 translate-y-1'
    }`

  return (
    <>
      <div
        className="fixed left-1/2 top-4 z-[110] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 sm:top-5"
      >
        <div
          role="group"
          aria-label="Protected page panel selector"
          className="w-full rounded-full border border-slate-300 bg-slate-200/85 p-1 shadow-lg backdrop-blur-sm dark:border-white/15 dark:bg-black/40"
        >
          <div className="relative grid h-10 w-full grid-cols-2 overflow-hidden rounded-full">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-[2px] left-[2px] z-0 w-[calc(50%-2px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out dark:bg-black"
              style={{ transform: isCaptionVotingModeSelected ? 'translateX(0%)' : 'translateX(100%)' }}
            />
            <button
              type="button"
              onClick={() => handlePanelChange('caption-voting')}
              aria-pressed={isCaptionVotingModeSelected}
              className={`relative z-10 rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:text-base ${
                isCaptionVotingModeSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              Caption Voting
            </button>
            <button
              type="button"
              onClick={() => handlePanelChange('generate-captions')}
              aria-pressed={!isCaptionVotingModeSelected}
              className={`relative z-10 rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:text-base ${
                !isCaptionVotingModeSelected
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              Generate Captions
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <header
          className={`flex flex-wrap items-center gap-4 transition-all ease-in-out ${animatedVisibilityClass}`}
          style={{ transitionDuration: `${MODE_FADE_DURATION_MS}ms` }}
        >
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {isCaptionVotingModeRendered ? 'Caption Voting' : 'Generate Captions'}
          </h1>
        </header>

        <div
          className={`transition-all ease-in-out ${animatedVisibilityClass}`}
          style={{ transitionDuration: `${MODE_FADE_DURATION_MS}ms` }}
        >
          <div className={panelStageClass}>
            <div className={getPanelVisibilityClass('caption-voting')} style={{ transitionDuration: `${MODE_FADE_DURATION_MS}ms` }}>
              <CaptionVotingPanel
                initialCaptions={initialCaptions}
                initialUserId={initialUserId}
                isActive={isCaptionVotingModeRendered && contentVisible}
              />
            </div>
            <div className={getPanelVisibilityClass('generate-captions')} style={{ transitionDuration: `${MODE_FADE_DURATION_MS}ms` }}>
              <GenerateCaptionsPanel isActive={!isCaptionVotingModeRendered && contentVisible} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
