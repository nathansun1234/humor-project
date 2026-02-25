'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import NextImage from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { DYNAMIC_BACKGROUND_STORAGE_KEY, readStoredBoolean } from '@/lib/protected-settings'

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
type CaptionImageDetail = { imageUrl: string | null }
type BackgroundFeedbackDetail = { kind: 'upvote' | 'downvote' | 'undo' }

const BACKGROUND_EVENT_NAME = 'protected:caption-image'
const BACKGROUND_IMAGE_REQUEST_EVENT = 'protected:caption-image-request'
const BACKGROUND_FEEDBACK_EVENT = 'protected:background-feedback'
const FEEDBACK_FLASH_DELAY_MS = 120

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
}: {
  initialCaptions: CaptionRecord[]
  initialUserId: string
}) {
  const supabase = useMemo(() => createClient(), [])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [undoIndex, setUndoIndex] = useState<number | null>(null)
  const [voteInFlight, setVoteInFlight] = useState(false)
  const [activeVote, setActiveVote] = useState<VoteValue | null>(null)
  const [userId, setUserId] = useState<string | null>(initialUserId)
  const [message, setMessage] = useState<string | null>(null)
  const [seenCaptionIds, setSeenCaptionIds] = useState<Set<string>>(new Set())
  const [seenLookupReady, setSeenLookupReady] = useState(false)
  const [lastVoteAction, setLastVoteAction] = useState<UndoSnapshot | null>(null)
  const [undoReminderVote, setUndoReminderVote] = useState<VoteValue | null>(null)

  const unseenIndex = findNextUnseenIndex(initialCaptions, seenCaptionIds, currentIndex)
  const computedDisplayIndex = unseenIndex
  const displayIndex = undoIndex ?? computedDisplayIndex
  const currentCaption = initialCaptions[displayIndex] ?? null
  const nextCaptionIndex = currentCaption
    ? findNextUnseenIndex(initialCaptions, seenCaptionIds, displayIndex + 1)
    : initialCaptions.length
  const nextCaption = initialCaptions[nextCaptionIndex] ?? null
  const currentCaptionImageUrl = currentCaption ? getCaptionImageUrl(currentCaption) : null
  const nextCaptionImageUrl = nextCaption ? getCaptionImageUrl(nextCaption) : null
  const canVote = Boolean(userId) && Boolean(currentCaption) && !voteInFlight && seenLookupReady
  const cardTheme =
    'border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-black dark:text-slate-100'
  const mutedText = 'text-slate-600 dark:text-slate-300'
  const panelFrame = 'mx-auto flex h-[77dvh] w-full max-w-2xl flex-col rounded-2xl border shadow-2xl backdrop-blur'

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
    dispatchBackgroundImage(currentCaptionImageUrl)
  }, [currentCaptionImageUrl, dispatchBackgroundImage])

  useEffect(() => {
    const handleImageRequest = () => {
      dispatchBackgroundImage(currentCaptionImageUrl)
    }

    window.addEventListener(BACKGROUND_IMAGE_REQUEST_EVENT, handleImageRequest)
    return () => {
      window.removeEventListener(BACKGROUND_IMAGE_REQUEST_EVENT, handleImageRequest)
    }
  }, [currentCaptionImageUrl, dispatchBackgroundImage])

  useEffect(() => {
    if (!nextCaptionImageUrl) return

    const image = new window.Image()
    image.src = nextCaptionImageUrl
  }, [nextCaptionImageUrl])

  const handleVote = async (vote: VoteValue) => {
    if (!currentCaption || !userId || voteInFlight || !seenLookupReady) return

    setVoteInFlight(true)
    setActiveVote(vote)
    setUndoReminderVote(null)
    setMessage(null)

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

    await runBackgroundFeedback(vote === 1 ? 'upvote' : 'downvote')

    setLastVoteAction({
      index: displayIndex,
      vote,
    })

    const updatedSeenIds = new Set(seenCaptionIds)
    updatedSeenIds.add(currentCaption.id)
    setSeenCaptionIds(updatedSeenIds)
    setUndoIndex(null)
    setCurrentIndex(findNextUnseenIndex(initialCaptions, updatedSeenIds, displayIndex + 1))
    setActiveVote(null)
    setVoteInFlight(false)
  }

  const handleUndo = async () => {
    if (!lastVoteAction || voteInFlight) return
    const previousAction = lastVoteAction
    setVoteInFlight(true)
    setLastVoteAction(null)
    setActiveVote(null)
    setMessage(null)

    await runBackgroundFeedback('undo')

    setCurrentIndex(previousAction.index)
    setUndoIndex(previousAction.index)
    setUndoReminderVote(previousAction.vote)
    setVoteInFlight(false)
  }

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

  return (
    <section className={`${panelFrame} p-3 sm:p-5 ${cardTheme}`}>
      <article
        key={currentCaption.id}
        className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-3 opacity-100 transition-all duration-200 ease-out dark:border-white/10 dark:bg-[#0d0d0d] sm:p-4"
      >
        <div className="grid h-full min-h-0 grid-rows-[82%_18%] gap-0">
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
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:text-base ${
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
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:text-base ${
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
          disabled={!lastVoteAction || voteInFlight}
          className={`rounded-xl border px-3 py-1.5 transition ${
            !lastVoteAction || voteInFlight
              ? 'cursor-not-allowed border-slate-300 text-slate-400 dark:border-white/15'
              : 'border-amber-400/40 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-100'
          }`}
        >
          Go back
        </button>
      </div>

      <div className="mt-3 min-h-0 shrink-0 sm:mt-4">
        {message && (
          <p className="rounded-lg border border-amber-500/45 bg-amber-500/15 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
            {message}
          </p>
        )}
      </div>
    </section>
  )
}

function getCaptionImageUrl(caption: CaptionRecord): string | null {
  if (caption.image_url) return caption.image_url
  if (caption.imageUrl) return caption.imageUrl
  return null
}
