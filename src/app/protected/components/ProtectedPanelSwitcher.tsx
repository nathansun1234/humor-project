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
  const seenModeHintRef = useRef<Record<ProtectedPanelMode, boolean>>({
    'caption-voting': false,
    'generate-captions': false,
  })
  const [activePanel, setActivePanel] = useState<ProtectedPanelMode>('caption-voting')
  const [renderedPanel, setRenderedPanel] = useState<ProtectedPanelMode>('caption-voting')
  const [contentVisible, setContentVisible] = useState(true)
  const [activeHintMode, setActiveHintMode] = useState<ProtectedPanelMode | null>('caption-voting')
  const isCaptionVotingModeSelected = activePanel === 'caption-voting'
  const isCaptionVotingModeRendered = renderedPanel === 'caption-voting'
  const isGenerateModeRendered = renderedPanel === 'generate-captions'

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

      if (activeHintMode) {
        seenModeHintRef.current[activeHintMode] = true
      }

      setActivePanel(nextPanel)
      setActiveHintMode(null)
      setContentVisible(false)
      clearTransitionTimeout()

      transitionTimeoutRef.current = window.setTimeout(() => {
        setRenderedPanel(nextPanel)
        setContentVisible(true)
        if (seenModeHintRef.current[nextPanel]) {
          setActiveHintMode(null)
        } else {
          setActiveHintMode(nextPanel)
        }
        transitionTimeoutRef.current = null
      }, MODE_FADE_DURATION_MS)
    },
    [activeHintMode, activePanel, clearTransitionTimeout, contentVisible, renderedPanel]
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
      <div className="fixed top-4 left-1/2 z-[110] w-[min(calc(100vw-1rem),44rem)] -translate-x-1/2 sm:top-6">
        <div
          role="group"
          aria-label="Protected page panel selector"
          className="w-full rounded-full border border-slate-300 bg-slate-200/90 p-1 shadow-lg backdrop-blur-sm dark:border-slate-300/25 dark:bg-slate-900/80"
        >
          <div className="relative grid h-10 w-full grid-cols-2 overflow-hidden rounded-full">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-[2px] left-[2px] z-0 w-[calc(50%-2px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out dark:bg-slate-950"
              style={{ transform: isCaptionVotingModeSelected ? 'translateX(0%)' : 'translateX(100%)' }}
            />
            <button
              type="button"
              onClick={() => handlePanelChange('caption-voting')}
              aria-pressed={isCaptionVotingModeSelected}
              className={`relative z-10 rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:text-base ${
                isCaptionVotingModeSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'
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
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              Generate Captions
            </button>
          </div>
        </div>
      </div>

      {activeHintMode && (
        <div className="fixed bottom-3 left-1/2 z-[130] w-[min(calc(100vw-1.25rem),20rem)] -translate-x-1/2 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-2xl dark:border-white/15 dark:bg-black sm:bottom-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-800 dark:text-neutral-100">
              {activeHintMode === 'caption-voting' ? 'How voting works' : 'How generation works'}
            </p>
            <button
              type="button"
              aria-label="Close guidance"
              onClick={() => {
                if (activeHintMode) {
                  seenModeHintRef.current[activeHintMode] = true
                }
                setActiveHintMode(null)
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold leading-none text-slate-600 transition hover:bg-slate-100 dark:border-white/25 dark:text-neutral-300 dark:hover:bg-[#111111]"
            >
              ×
            </button>
          </div>
          {activeHintMode === 'caption-voting' ? (
            <>
              <p className="mt-2 text-xs text-slate-600 dark:text-neutral-300">
                Review each caption, then upvote, downvote, skip, or go back to revise earlier choices.
              </p>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-neutral-300">
                Keyboard shortcuts: Up upvote, Down downvote, Left go back, Right skip.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-xs text-slate-600 dark:text-neutral-300">
                Upload an image, then click Generate Captions. Generate More keeps prior results visible.
              </p>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-neutral-300">
                After generating, use the top switcher to return to Caption Voting.
              </p>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:gap-6">
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
              <GenerateCaptionsPanel isActive={isGenerateModeRendered && contentVisible} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
