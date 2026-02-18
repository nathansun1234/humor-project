'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NextImage from 'next/image'
import { createClient } from '@/lib/supabase/client'

type CaptionRecord = {
  id: string
  content?: string | null
  title?: string | null
  image_id?: string | null
  image_url?: string | null
  imageUrl?: string | null
}

type ImageRecord = {
  url?: string | null
}

type VoteValue = -1 | 1
type SeenVoteRow = { caption_id: string }
type QueueSnapshot = {
  queue: CaptionRecord[]
  cursor: string | null
}

const MAX_LOADED_CAPTIONS = 2

export default function CaptionVotingPanel({
  initialCaptions,
  initialUserId,
}: {
  initialCaptions: CaptionRecord[]
  initialUserId: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const initialQueue = initialCaptions.slice(0, MAX_LOADED_CAPTIONS)

  const [captionQueue, setCaptionQueue] = useState<CaptionRecord[]>(initialQueue)
  const [scanCursor, setScanCursor] = useState<string | null>(
    initialQueue.length > 0 ? initialQueue[initialQueue.length - 1].id : null
  )
  const [voteInFlight, setVoteInFlight] = useState(false)
  const [activeVote, setActiveVote] = useState<VoteValue | null>(null)
  const [userId, setUserId] = useState<string | null>(initialUserId)
  const [message, setMessage] = useState<string | null>(null)
  const [seenCaptionIds, setSeenCaptionIds] = useState<Set<string>>(new Set())
  const [seenLookupReady, setSeenLookupReady] = useState(false)
  const [lastVoteAction, setLastVoteAction] = useState<QueueSnapshot | null>(null)
  const imageUrlCacheRef = useRef<Map<string, string | null>>(new Map())

  const currentCaption = captionQueue[0] ?? null
  const nextCaption = captionQueue[1] ?? null
  const canVote = Boolean(userId) && Boolean(currentCaption) && !voteInFlight && seenLookupReady
  const cardTheme =
    'border-slate-200 bg-white/90 text-slate-900 dark:border-white/10 dark:bg-slate-900/75 dark:text-slate-100'
  const mutedText = 'text-slate-600 dark:text-slate-300'
  const panelFrame = 'mx-auto flex h-[72dvh] w-full max-w-2xl flex-col rounded-2xl border shadow-2xl backdrop-blur'

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

  const fetchCaptionAfterCursor = useCallback(
    async (afterId: string | null) => {
      let query = supabase
        .from('captions')
        .select('*')
        .eq('is_public', true)
        .order('id', { ascending: false })
        .limit(1)

      if (afterId) {
        query = query.lt('id', afterId)
      }

      const { data, error } = await query
      if (error) {
        return { caption: null as CaptionRecord | null, cursor: afterId, errorMessage: error.message }
      }

      const caption = ((data as CaptionRecord[] | null)?.[0] ?? null) as CaptionRecord | null
      if (!caption) {
        return { caption: null as CaptionRecord | null, cursor: afterId, errorMessage: null as string | null }
      }

      return { caption, cursor: caption.id, errorMessage: null as string | null }
    },
    [supabase]
  )

  const resolveCaptionImage = useCallback(
    async (caption: CaptionRecord) => {
      const existingImageUrl = getCaptionImageUrl(caption)
      const imageId = caption.image_id

      if (!imageId) {
        return caption
      }

      if (existingImageUrl) {
        imageUrlCacheRef.current.set(imageId, existingImageUrl)
        return caption
      }

      if (imageUrlCacheRef.current.has(imageId)) {
        return {
          ...caption,
          image_url: imageUrlCacheRef.current.get(imageId) ?? null,
        }
      }

      const { data, error } = await supabase
        .from('images')
        .select('url')
        .eq('id', imageId)
        .eq('is_public', true)
        .maybeSingle()

      if (error) {
        return caption
      }

      const resolvedImageUrl = ((data as ImageRecord | null)?.url ?? null)
      imageUrlCacheRef.current.set(imageId, resolvedImageUrl)

      if (!resolvedImageUrl) {
        return caption
      }

      return {
        ...caption,
        image_url: resolvedImageUrl,
      }
    },
    [supabase]
  )

  const fetchNextUnseenCaption = useCallback(
    async (afterId: string | null, seenIds: Set<string>) => {
      let cursor = afterId

      while (true) {
        const { caption, cursor: nextCursor, errorMessage } = await fetchCaptionAfterCursor(cursor)

        if (errorMessage) {
          return { caption: null as CaptionRecord | null, cursor, errorMessage }
        }

        if (!caption) {
          return { caption: null as CaptionRecord | null, cursor: nextCursor, errorMessage: null as string | null }
        }

        cursor = nextCursor
        if (!seenIds.has(caption.id)) {
          const hydratedCaption = await resolveCaptionImage(caption)
          return { caption: hydratedCaption, cursor, errorMessage: null as string | null }
        }
      }
    },
    [fetchCaptionAfterCursor, resolveCaptionImage]
  )

  const refillQueue = useCallback(
    async (startQueue: CaptionRecord[], startCursor: string | null, seenIds: Set<string>) => {
      const queue = [...startQueue]
      let cursor = startCursor

      while (queue.length < MAX_LOADED_CAPTIONS) {
        const { caption, cursor: nextCursor, errorMessage } = await fetchNextUnseenCaption(cursor, seenIds)
        cursor = nextCursor

        if (errorMessage) {
          return { queue, cursor, errorMessage }
        }

        if (!caption) {
          break
        }

        queue.push(caption)
      }

      return { queue, cursor, errorMessage: null as string | null }
    },
    [fetchNextUnseenCaption]
  )

  useEffect(() => {
    let cancelled = false

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession()
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

    const hydrateQueue = async () => {
      if (seenLookupReady) return

      if (!userId) {
        setSeenLookupReady(true)
        return
      }

      const { seenIds, errorMessage } = await fetchSeenCaptionIds(userId)
      if (cancelled) return

      if (errorMessage) {
        setMessage(`Could not look up prior votes: ${errorMessage}`)
      }

      const unseenInitialQueue = captionQueue.filter((caption) => !seenIds.has(caption.id))
      const { queue, cursor, errorMessage: queueErrorMessage } = await refillQueue(unseenInitialQueue, scanCursor, seenIds)
      if (cancelled) return

      if (queueErrorMessage) {
        setMessage(`Could not load captions: ${queueErrorMessage}`)
      }

      setSeenCaptionIds(seenIds)
      setCaptionQueue(queue)
      setScanCursor(cursor)
      setSeenLookupReady(true)
    }

    void hydrateQueue()
    return () => {
      cancelled = true
    }
  }, [captionQueue, fetchSeenCaptionIds, refillQueue, scanCursor, seenLookupReady, userId])

  useEffect(() => {
    if (!nextCaption) return
    const nextImageUrl = getCaptionImageUrl(nextCaption)
    if (!nextImageUrl) return

    const image = new window.Image()
    image.src = nextImageUrl
  }, [nextCaption])

  const handleVote = async (vote: VoteValue) => {
    if (!currentCaption || !userId || voteInFlight || !seenLookupReady) return

    setVoteInFlight(true)
    setActiveVote(vote)
    setMessage(null)

    const { data: existingVoteRow, error: existingVoteError } = await supabase
      .from('caption_votes')
      .select('vote_value')
      .eq('caption_id', currentCaption.id)
      .eq('profile_id', userId)
      .maybeSingle()

    if (existingVoteError) {
      setVoteInFlight(false)
      setMessage(`Could not check prior vote: ${existingVoteError.message}`)
      return
    }

    const previousVote = ((existingVoteRow?.vote_value ?? null) as VoteValue | null)
    const now = new Date().toISOString()

    const votePayload = {
      profile_id: userId,
      caption_id: currentCaption.id,
      vote_value: vote,
      created_datetime_utc: now,
      modified_datetime_utc: now,
    }

    const { error: voteError } =
      previousVote === null
        ? await supabase.from('caption_votes').insert(votePayload)
        : await supabase
            .from('caption_votes')
            .update({
              vote_value: vote,
              modified_datetime_utc: now,
            })
            .eq('caption_id', currentCaption.id)
            .eq('profile_id', userId)

    if (voteError) {
      setVoteInFlight(false)
      setMessage(`Could not save vote: ${voteError.message}`)
      return
    }

    setLastVoteAction({
      queue: captionQueue,
      cursor: scanCursor,
    })

    const updatedSeenIds = new Set(seenCaptionIds)
    updatedSeenIds.add(currentCaption.id)
    setSeenCaptionIds(updatedSeenIds)

    const { queue, cursor, errorMessage } = await refillQueue(captionQueue.slice(1), scanCursor, updatedSeenIds)

    if (errorMessage) {
      setMessage(`Could not load next caption: ${errorMessage}`)
    }

    setCaptionQueue(queue)
    setScanCursor(cursor)
    setActiveVote(null)
    setVoteInFlight(false)
  }

  const handleUndo = () => {
    if (!lastVoteAction || voteInFlight) return

    setCaptionQueue(lastVoteAction.queue)
    setScanCursor(lastVoteAction.cursor)
    setLastVoteAction(null)
    setActiveVote(null)
    setMessage(null)
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
        <p className="text-lg font-medium">No more captions to vote on right now.</p>
        <p className={`mt-2 text-sm ${mutedText}`}>Check back later for another batch.</p>
      </section>
    )
  }

  const imageUrl = getCaptionImageUrl(currentCaption)

  return (
    <section className={`${panelFrame} p-3 sm:p-5 ${cardTheme}`}>
      <article
        key={currentCaption.id}
        className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100/70 p-3 opacity-100 transition-all duration-200 ease-out dark:border-white/10 dark:bg-black/15 sm:p-4"
      >
        <div className="grid h-full min-h-0 grid-rows-[72%_28%] gap-3">
          <div className="min-h-0 rounded-xl bg-slate-100/70 p-1 dark:bg-black/15 sm:p-2">
            {imageUrl ? (
              <NextImage
                src={imageUrl}
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
          <div className="min-h-0 overflow-y-auto rounded-xl bg-slate-100/70 px-3 py-3 dark:bg-black/15 sm:px-4">
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
            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:text-base ${
              activeVote === 1
                ? 'scale-[1.01] bg-emerald-500 text-white'
                : 'bg-emerald-500/20 text-emerald-800 hover:bg-emerald-500/35 disabled:opacity-40 dark:text-emerald-100'
            }`}
          >
            Upvote +1
          </button>
          <button
            type="button"
            onClick={() => void handleVote(-1)}
            disabled={!canVote}
            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:text-base ${
              activeVote === -1
                ? 'scale-[1.01] bg-rose-500 text-white'
                : 'bg-rose-500/20 text-rose-800 hover:bg-rose-500/35 disabled:opacity-40 dark:text-rose-100'
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

      <div className="mt-3 min-h-[2.5rem] shrink-0">
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
