'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NextImage from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  type BooleanSettingEventDetail,
  DYNAMIC_BACKGROUND_STORAGE_KEY,
  KEYBOARD_CONTROLS_EVENT,
  KEYBOARD_CONTROLS_STORAGE_KEY,
  readStoredBoolean,
} from '@/lib/protected-settings'

type CaptionRecord = {
  id: string
  content?: string | null
  title?: string | null
  image_id?: string | null
  image_url?: string | null
  imageUrl?: string | null
}

type VoteValue = -1 | 1
type SeenVoteRow = { caption_id: string }
type UndoSnapshot = { index: number; vote: VoteValue }
type TurnDirection = 'forward' | 'backward'
type TurnState = {
  direction: TurnDirection
  outgoingCaption: CaptionRecord
  outgoingImageUrl: string | null
  incomingCaption: CaptionRecord
  incomingImageUrl: string | null
  active: boolean
}
type CaptionImageDetail = { imageUrl: string | null }
type BackgroundFeedbackDetail = { kind: 'upvote' | 'downvote' }

const BACKGROUND_EVENT_NAME = 'protected:caption-image'
const BACKGROUND_IMAGE_REQUEST_EVENT = 'protected:caption-image-request'
const BACKGROUND_FEEDBACK_EVENT = 'protected:background-feedback'
const FEEDBACK_FLASH_DELAY_MS = 120
const PANEL_TURN_DURATION_MS = 520

function findNextUnseenIndex(captions: CaptionRecord[], seenIds: Set<string>, startIndex: number): number {
  for (let index = startIndex; index < captions.length; index += 1) {
    if (!seenIds.has(captions[index].id)) {
      return index
    }
  }

  return captions.length
}

export default function CaptionVotingPanel({
  initialCaptions,
  initialUserId,
  isActive = true,
}: {
  initialCaptions: CaptionRecord[]
  initialUserId: string
  isActive?: boolean
}) {
  const supabase = useMemo(() => createClient(), [])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [undoIndex, setUndoIndex] = useState<number | null>(null)
  const [voteInFlight, setVoteInFlight] = useState(false)
  const [activeVote, setActiveVote] = useState<VoteValue | null>(null)
  const [activeUndo, setActiveUndo] = useState(false)
  const [userId, setUserId] = useState<string | null>(initialUserId)
  const [message, setMessage] = useState<string | null>(null)
  const [seenCaptionIds, setSeenCaptionIds] = useState<Set<string>>(new Set())
  const [seenLookupReady, setSeenLookupReady] = useState(false)
  const [lastVoteAction, setLastVoteAction] = useState<UndoSnapshot | null>(null)
  const [undoReminderVote, setUndoReminderVote] = useState<VoteValue | null>(null)
  const [keyboardControlsEnabled, setKeyboardControlsEnabled] = useState(() =>
    readStoredBoolean(KEYBOARD_CONTROLS_STORAGE_KEY, true)
  )
  const [turnState, setTurnState] = useState<TurnState | null>(null)
  const turnTimeoutRef = useRef<number | null>(null)
  const turnFrameRef = useRef<number | null>(null)

  const unseenIndex = findNextUnseenIndex(initialCaptions, seenCaptionIds, currentIndex)
  const computedDisplayIndex = unseenIndex
  const displayIndex = undoIndex ?? computedDisplayIndex
  const currentCaption = initialCaptions[displayIndex] ?? null
  const previousCaption = displayIndex > 0 ? (initialCaptions[displayIndex - 1] ?? null) : null
  const nextCaptionIndex = currentCaption
    ? findNextUnseenIndex(initialCaptions, seenCaptionIds, displayIndex + 1)
    : initialCaptions.length
  const nextCaption = initialCaptions[nextCaptionIndex] ?? null
  const currentCaptionImageUrl = currentCaption ? getCaptionImageUrl(currentCaption) : null
  const previousCaptionImageUrl = previousCaption ? getCaptionImageUrl(previousCaption) : null
  const nextCaptionImageUrl = nextCaption ? getCaptionImageUrl(nextCaption) : null
  const isTurning = turnState !== null
  const hasUndoHistory = Boolean(lastVoteAction)
  const canUndo = hasUndoHistory && !voteInFlight
  const showPreviousStackPanel = previousCaption !== null && undoIndex === null && hasUndoHistory
  const canVote = Boolean(userId) && Boolean(currentCaption) && !voteInFlight && !isTurning && seenLookupReady
  const cardTheme =
    'border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-black dark:text-slate-100'
  const mutedText = 'text-slate-600 dark:text-slate-300'
  const panelFrame = 'mx-auto flex h-[77dvh] w-full max-w-2xl flex-col rounded-2xl border shadow-2xl backdrop-blur'
  const panelStackFrame = 'flex h-full w-full flex-col rounded-2xl border shadow-2xl backdrop-blur'
  const panelStackStage = 'relative mx-auto h-[77dvh] w-full max-w-2xl'

  const clearTurnAnimation = useCallback(() => {
    if (turnTimeoutRef.current !== null) {
      window.clearTimeout(turnTimeoutRef.current)
      turnTimeoutRef.current = null
    }
    if (turnFrameRef.current !== null) {
      window.cancelAnimationFrame(turnFrameRef.current)
      turnFrameRef.current = null
    }
  }, [])

  const runTurnAnimation = useCallback(
    async (turnDetail: Omit<TurnState, 'active'>) => {
      clearTurnAnimation()
      setTurnState({ ...turnDetail, active: false })

      await new Promise<void>((resolve) => {
        turnFrameRef.current = window.requestAnimationFrame(() => {
          turnFrameRef.current = window.requestAnimationFrame(() => {
            setTurnState((current) => (current ? { ...current, active: true } : current))
            turnFrameRef.current = null
          })
        })

        turnTimeoutRef.current = window.setTimeout(() => {
          clearTurnAnimation()
          resolve()
        }, PANEL_TURN_DURATION_MS)
      })
    },
    [clearTurnAnimation]
  )

  const finishTurnAnimation = useCallback(() => {
    clearTurnAnimation()
    setTurnState(null)
  }, [clearTurnAnimation])

  const dispatchBackgroundImage = useCallback((imageUrl: string | null) => {
    window.dispatchEvent(
      new CustomEvent<CaptionImageDetail>(BACKGROUND_EVENT_NAME, {
        detail: { imageUrl },
      })
    )
  }, [])

  const runBackgroundFeedback = useCallback(async (kind: BackgroundFeedbackDetail['kind']) => {
    const dynamicBackgroundEnabled = readStoredBoolean(DYNAMIC_BACKGROUND_STORAGE_KEY, true)
    if (!dynamicBackgroundEnabled) {
      return
    }

    window.dispatchEvent(
      new CustomEvent<BackgroundFeedbackDetail>(BACKGROUND_FEEDBACK_EVENT, {
        detail: { kind },
      })
    )

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, FEEDBACK_FLASH_DELAY_MS)
    })
  }, [])

  const fetchSeenCaptionIds = useCallback(
    async (profileId: string) => {
      const { data, error } = await supabase
        .from('caption_votes')
        .select('caption_id')
        .eq('profile_id', profileId)

      if (error) {
        return { seenIds: new Set<string>(), errorMessage: error.message }
      }

      const seenIds = new Set((data as SeenVoteRow[] | null)?.map((row) => row.caption_id) ?? [])
      return { seenIds, errorMessage: null as string | null }
    },
    [supabase]
  )

  useEffect(() => {
    let cancelled = false

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        await supabase.auth.signOut()
        if (!cancelled) {
          setUserId(null)
          setMessage('Your session expired. Please sign in again.')
        }
        return
      }

      if (!cancelled) {
        setUserId(data.session?.user?.id ?? null)
      }
    }

    void syncSession()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false

    const hydrateSeenLookup = async () => {
      if (seenLookupReady) return

      if (!userId) {
        setCurrentIndex(0)
        setUndoIndex(null)
        setSeenLookupReady(true)
        return
      }

      const { seenIds, errorMessage } = await fetchSeenCaptionIds(userId)
      if (cancelled) return

      if (errorMessage) {
        setMessage(`Could not look up prior votes: ${errorMessage}`)
      }

      setSeenCaptionIds(seenIds)
      setCurrentIndex(findNextUnseenIndex(initialCaptions, seenIds, 0))
      setUndoIndex(null)
      setSeenLookupReady(true)
    }

    void hydrateSeenLookup()
    return () => {
      cancelled = true
    }
  }, [fetchSeenCaptionIds, initialCaptions, seenLookupReady, userId])

  useEffect(() => {
    if (!isActive) return
    dispatchBackgroundImage(currentCaptionImageUrl)
  }, [currentCaptionImageUrl, dispatchBackgroundImage, isActive])

  useEffect(() => {
    const handleImageRequest = () => {
      if (!isActive) return
      dispatchBackgroundImage(currentCaptionImageUrl)
    }

    window.addEventListener(BACKGROUND_IMAGE_REQUEST_EVENT, handleImageRequest)
    return () => {
      window.removeEventListener(BACKGROUND_IMAGE_REQUEST_EVENT, handleImageRequest)
    }
  }, [currentCaptionImageUrl, dispatchBackgroundImage, isActive])

  useEffect(() => {
    if (!nextCaptionImageUrl) return

    const image = new window.Image()
    image.src = nextCaptionImageUrl
  }, [nextCaptionImageUrl])

  useEffect(() => {
    const syncFromStorage = () => {
      setKeyboardControlsEnabled(readStoredBoolean(KEYBOARD_CONTROLS_STORAGE_KEY, true))
    }

    syncFromStorage()

    const handleKeyboardControlChange = (event: Event) => {
      const customEvent = event as CustomEvent<BooleanSettingEventDetail>
      const nextValue = customEvent.detail?.enabled
      if (typeof nextValue === 'boolean') {
        setKeyboardControlsEnabled(nextValue)
        return
      }
      syncFromStorage()
    }

    window.addEventListener(KEYBOARD_CONTROLS_EVENT, handleKeyboardControlChange as EventListener)
    return () => {
      window.removeEventListener(KEYBOARD_CONTROLS_EVENT, handleKeyboardControlChange as EventListener)
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTurnAnimation()
    }
  }, [clearTurnAnimation])

  const handleVote = useCallback(
    async (vote: VoteValue) => {
      if (!currentCaption || !userId || voteInFlight || !seenLookupReady) return

      setVoteInFlight(true)
      setActiveVote(vote)
      setActiveUndo(false)
      setUndoReminderVote(null)
      setMessage(null)
      const feedbackPromise = runBackgroundFeedback(vote === 1 ? 'upvote' : 'downvote')

      const { data: existingVoteRow, error: existingVoteError } = await supabase
        .from('caption_votes')
        .select('id,vote_value')
        .eq('caption_id', currentCaption.id)
        .eq('profile_id', userId)
        .maybeSingle()

      if (existingVoteError) {
        setVoteInFlight(false)
        setActiveVote(null)
        setMessage(`Could not check prior vote: ${existingVoteError.message}`)
        return
      }

      const now = new Date().toISOString()

      const votePayload = {
        profile_id: userId,
        caption_id: currentCaption.id,
        vote_value: vote,
        created_datetime_utc: now,
        modified_datetime_utc: now,
      }

      const hasExistingVoteRow = Boolean(existingVoteRow)
      const { error: voteError } =
        hasExistingVoteRow
          ? await supabase
              .from('caption_votes')
              .update({
                vote_value: vote,
                modified_datetime_utc: now,
              })
              .eq('caption_id', currentCaption.id)
              .eq('profile_id', userId)
          : await supabase.from('caption_votes').insert(votePayload)

      if (voteError) {
        setVoteInFlight(false)
        setActiveVote(null)
        setMessage(`Could not save vote: ${voteError.message}`)
        return
      }

      const updatedSeenIds = new Set(seenCaptionIds)
      updatedSeenIds.add(currentCaption.id)
      const nextIndex = findNextUnseenIndex(initialCaptions, updatedSeenIds, displayIndex + 1)
      const incomingCaption = initialCaptions[nextIndex] ?? null
      if (incomingCaption) {
        dispatchBackgroundImage(getCaptionImageUrl(incomingCaption))
      }

      await feedbackPromise

      setLastVoteAction({
        index: displayIndex,
        vote,
      })

      setSeenCaptionIds(updatedSeenIds)
      setUndoIndex(null)
      if (incomingCaption) {
        await runTurnAnimation({
          direction: 'forward',
          outgoingCaption: currentCaption,
          outgoingImageUrl: currentCaptionImageUrl,
          incomingCaption,
          incomingImageUrl: getCaptionImageUrl(incomingCaption),
        })
      }

      setCurrentIndex(nextIndex)
      setActiveVote(null)
      setVoteInFlight(false)
      finishTurnAnimation()
    },
    [
      currentCaption,
      currentCaptionImageUrl,
      dispatchBackgroundImage,
      displayIndex,
      initialCaptions,
      runBackgroundFeedback,
      finishTurnAnimation,
      runTurnAnimation,
      seenCaptionIds,
      seenLookupReady,
      supabase,
      userId,
      voteInFlight,
    ]
  )

  const handleUndo = useCallback(async () => {
    if (!lastVoteAction || voteInFlight) return
    const previousAction = lastVoteAction
    setVoteInFlight(true)
    setActiveUndo(true)
    setLastVoteAction(null)
    setActiveVote(null)
    setMessage(null)

    const incomingCaption = initialCaptions[previousAction.index] ?? null
    if (incomingCaption && currentCaption) {
      await runTurnAnimation({
        direction: 'backward',
        outgoingCaption: currentCaption,
        outgoingImageUrl: currentCaptionImageUrl,
        incomingCaption,
        incomingImageUrl: getCaptionImageUrl(incomingCaption),
      })
    }

    setCurrentIndex(previousAction.index)
    setUndoIndex(previousAction.index)
    setUndoReminderVote(previousAction.vote)
    setVoteInFlight(false)
    setActiveUndo(false)
    finishTurnAnimation()
  }, [
    currentCaption,
    currentCaptionImageUrl,
    finishTurnAnimation,
    initialCaptions,
    lastVoteAction,
    runTurnAnimation,
    voteInFlight,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isActive) return
      if (!keyboardControlsEnabled || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      ) {
        return
      }

      if (document.querySelector('[data-settings-menu-open="true"]')) {
        return
      }

      if (event.key === 'ArrowUp') {
        if (!canVote) return
        event.preventDefault()
        void handleVote(1)
        return
      }

      if (event.key === 'ArrowDown') {
        if (!canVote) return
        event.preventDefault()
        void handleVote(-1)
        return
      }

      if (event.key === 'ArrowLeft') {
        if (!lastVoteAction || voteInFlight) return
        event.preventDefault()
        void handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [canVote, isActive, keyboardControlsEnabled, lastVoteAction, voteInFlight, handleUndo, handleVote])

  if (!seenLookupReady) {
    return (
      <section className={`${panelFrame} p-5 sm:p-6 ${cardTheme}`}>
        <p className="text-lg font-medium">Finding your first unseen caption...</p>
        <p className={`mt-2 text-sm ${mutedText}`}>Checking your vote history.</p>
      </section>
    )
  }

  if (!currentCaption) {
    return (
      <section className={`${panelFrame} p-5 sm:p-6 ${cardTheme}`}>
        <p className="text-lg font-medium">No more unseen captions to vote on right now.</p>
        <p className={`mt-2 text-sm ${mutedText}`}>Check back later after more captions are added.</p>
      </section>
    )
  }

  const renderDecorativePanel = ({
    caption,
    imageUrl,
    className,
  }: {
    caption: CaptionRecord
    imageUrl: string | null
    className: string
  }) => (
    <section aria-hidden className={`${className} ${panelStackFrame} ${cardTheme} p-3 sm:p-5`}>
      <article className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-white/10 dark:bg-[#0d0d0d] sm:p-4">
        <div className="grid h-full min-h-0 grid-rows-[78%_22%] gap-0 sm:grid-rows-[82%_18%]">
          <div className="min-h-0 rounded-t-xl rounded-b-none bg-slate-100 p-1 dark:bg-[#0d0d0d] sm:p-2">
            {imageUrl ? (
              <NextImage
                src={imageUrl}
                alt="Caption visual"
                width={1200}
                height={800}
                className="h-full w-full rounded-xl object-contain"
                unoptimized
              />
            ) : (
              <div className={`flex h-full items-center justify-center rounded-xl text-sm ${mutedText}`}>
                No image available
              </div>
            )}
          </div>
          <div className="min-h-0 overflow-y-auto rounded-b-xl rounded-t-none bg-slate-100 px-3 py-3 dark:bg-[#0d0d0d] sm:px-4">
            <p className="text-center text-lg leading-relaxed sm:text-xl">
              {caption.content || caption.title || 'Untitled caption'}
            </p>
          </div>
        </div>
      </article>

      <div className="mt-4 shrink-0 px-3 sm:px-4">
        <div className="flex w-full gap-2.5">
          <button
            type="button"
            disabled
            className="flex-1 cursor-not-allowed rounded-xl border border-transparent bg-emerald-500/20 px-3 py-2.5 text-sm font-semibold text-emerald-800 opacity-70 dark:text-emerald-100 sm:text-base"
          >
            Upvote +1
          </button>
          <button
            type="button"
            disabled
            className="flex-1 cursor-not-allowed rounded-xl border border-transparent bg-rose-500/20 px-3 py-2.5 text-sm font-semibold text-rose-800 opacity-70 dark:text-rose-100 sm:text-base"
          >
            Downvote -1
          </button>
        </div>
      </div>

      <div className="mt-3 flex h-8 shrink-0 items-center justify-center text-sm">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-slate-300 px-3 py-1.5 text-slate-400 dark:border-white/15"
        >
          Go back
        </button>
      </div>

      <div className="mt-3 min-h-0 shrink-0 sm:mt-4" />
    </section>
  )

  const transitionPanelBase =
    'pointer-events-none absolute inset-0 transform-gpu overflow-hidden transition-all duration-500 ease-in-out'

  const outgoingTransitionClass =
    turnState === null
      ? ''
      : turnState.active
        ? turnState.direction === 'forward'
          ? `${transitionPanelBase} z-30 -translate-x-6 translate-y-3 rotate-[-1.75deg] scale-100 opacity-70 blur-[1.5px] sm:-translate-x-8`
          : `${transitionPanelBase} z-30 translate-x-24 opacity-0 sm:translate-x-28`
        : `${transitionPanelBase} z-30 translate-x-0 translate-y-0 scale-100 opacity-100 blur-0`

  const incomingTransitionClass =
    turnState === null
      ? ''
      : turnState.direction === 'forward'
        ? turnState.active
          ? `${transitionPanelBase} z-40 translate-x-0 translate-y-0 scale-100 opacity-100 blur-0`
          : `${transitionPanelBase} z-40 translate-x-24 opacity-0 sm:translate-x-28`
        : turnState.active
          ? `${transitionPanelBase} z-40 translate-x-0 translate-y-0 scale-100 opacity-100 blur-0`
          : `${transitionPanelBase} z-20 -translate-x-6 translate-y-3 rotate-[-1.75deg] scale-100 opacity-70 blur-[1.5px] sm:-translate-x-8`

  return (
    <div className={panelStackStage}>
      <div className={`relative h-full ${turnState ? 'pointer-events-none opacity-0' : ''}`}>
        {showPreviousStackPanel &&
          renderDecorativePanel({
            caption: previousCaption as CaptionRecord,
            imageUrl: previousCaptionImageUrl,
            className:
              'absolute inset-0 z-10 -translate-x-6 translate-y-3 rotate-[-1.75deg] overflow-hidden opacity-70 blur-[1.5px] sm:-translate-x-8',
          })}

        <section className={`relative z-20 ${panelStackFrame} ${cardTheme} p-3 sm:p-5`}>
          <article
            key={currentCaption.id}
            className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-3 opacity-100 transition-all duration-200 ease-out dark:border-white/10 dark:bg-[#0d0d0d] sm:p-4"
          >
            <div className="grid h-full min-h-0 grid-rows-[78%_22%] gap-0 sm:grid-rows-[82%_18%]">
              <div className="min-h-0 rounded-t-xl rounded-b-none bg-slate-100 p-1 dark:bg-[#0d0d0d] sm:p-2">
                {currentCaptionImageUrl ? (
                  <NextImage
                    src={currentCaptionImageUrl}
                    alt="Caption visual"
                    width={1200}
                    height={800}
                    className="h-full w-full rounded-xl object-contain"
                    priority
                    unoptimized
                  />
                ) : (
                  <div className={`flex h-full items-center justify-center rounded-xl text-sm ${mutedText}`}>
                    No image available
                  </div>
                )}
              </div>
              <div className="min-h-0 overflow-y-auto rounded-b-xl rounded-t-none bg-slate-100 px-3 py-3 dark:bg-[#0d0d0d] sm:px-4">
                <p className="text-center text-lg leading-relaxed sm:text-xl">
                  {currentCaption.content || currentCaption.title || 'Untitled caption'}
                </p>
              </div>
            </div>
          </article>

          <div className="mt-4 shrink-0 px-3 sm:px-4">
            <div className="flex w-full gap-2.5">
              <button
                type="button"
                onClick={() => void handleVote(1)}
                disabled={!canVote}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors transition-transform sm:text-base ${
                  activeVote === 1
                    ? 'scale-[1.01] border-emerald-500 bg-emerald-500 text-white'
                    : undoIndex !== null && undoReminderVote === 1
                      ? 'border-2 border-emerald-600 ring-2 ring-emerald-400/80 bg-emerald-500/25 text-emerald-900 shadow-sm hover:bg-emerald-500/35 disabled:opacity-40 dark:border-emerald-300 dark:ring-emerald-300/75 dark:text-emerald-100'
                      : 'border-transparent bg-emerald-500/20 text-emerald-800 hover:bg-emerald-500/35 disabled:opacity-40 dark:text-emerald-100'
                }`}
              >
                Upvote +1
              </button>
              <button
                type="button"
                onClick={() => void handleVote(-1)}
                disabled={!canVote}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors transition-transform sm:text-base ${
                  activeVote === -1
                    ? 'scale-[1.01] border-rose-500 bg-rose-500 text-white'
                    : undoIndex !== null && undoReminderVote === -1
                      ? 'border-2 border-rose-600 ring-2 ring-rose-400/80 bg-rose-500/25 text-rose-900 shadow-sm hover:bg-rose-500/35 disabled:opacity-40 dark:border-rose-300 dark:ring-rose-300/75 dark:text-rose-100'
                      : 'border-transparent bg-rose-500/20 text-rose-800 hover:bg-rose-500/35 disabled:opacity-40 dark:text-rose-100'
                }`}
              >
                Downvote -1
              </button>
            </div>
          </div>

          <div className="mt-3 flex h-8 shrink-0 items-center justify-center text-sm">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className={`rounded-xl border px-3 py-1.5 transition-colors transition-transform ${
                activeUndo
                  ? 'scale-[1.01] border-amber-500 bg-amber-500 text-white'
                  : !canUndo
                  ? 'cursor-not-allowed border-slate-300 text-slate-400 dark:border-white/15'
                  : 'border-amber-400/40 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-100'
              }`}
            >
              Go back
            </button>
          </div>

          <div className="mt-3 min-h-0 shrink-0 sm:mt-4">
            {message && (
              <p className="rounded-xl border border-amber-500/45 bg-amber-500/15 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                {message}
              </p>
            )}
          </div>
        </section>
      </div>

      {turnState &&
        renderDecorativePanel({
          caption: turnState.outgoingCaption,
          imageUrl: turnState.outgoingImageUrl,
          className: outgoingTransitionClass,
        })}
      {turnState &&
        renderDecorativePanel({
          caption: turnState.incomingCaption,
          imageUrl: turnState.incomingImageUrl,
          className: incomingTransitionClass,
        })}
    </div>
  )
}

function getCaptionImageUrl(caption: CaptionRecord): string | null {
  if (caption.image_url) return caption.image_url
  if (caption.imageUrl) return caption.imageUrl
  return null
}
