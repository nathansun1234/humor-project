'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type CaptionImageDetail = { imageUrl: string | null }
type BackgroundFeedbackDetail = { kind: 'upvote' | 'downvote' }
type BackgroundState = {
  layers: [string | null, string | null]
  activeLayer: 0 | 1
}

const BACKGROUND_EVENT_NAME = 'protected:caption-image'
const BACKGROUND_IMAGE_REQUEST_EVENT = 'protected:caption-image-request'
const BACKGROUND_FEEDBACK_EVENT = 'protected:background-feedback'
const FEEDBACK_FLASH_TRANSITION_MS = 320

const FALLBACK_BACKGROUND =
  'radial-gradient(circle at 18% 14%, rgba(56, 189, 248, 0.35), transparent 48%), radial-gradient(circle at 82% 82%, rgba(129, 140, 248, 0.32), transparent 44%), radial-gradient(circle at 84% 16%, rgba(251, 191, 36, 0.24), transparent 52%)'

export default function DynamicPastelBackground() {
  const [backgroundState, setBackgroundState] = useState<BackgroundState>({
    layers: [null, null],
    activeLayer: 0,
  })
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [feedbackFlashColor, setFeedbackFlashColor] = useState<string | null>(null)
  const [feedbackFlashOpacity, setFeedbackFlashOpacity] = useState(0)
  const loadedImageUrlsRef = useRef<Set<string>>(new Set())
  const transitionRequestRef = useRef(0)
  const feedbackFlashFrameRef = useRef<number | null>(null)
  const feedbackFlashTimeoutRef = useRef<number | null>(null)

  const transitionToImage = useCallback((imageUrl: string | null) => {
    setBackgroundState((previousState) => {
      const activeImageUrl = previousState.layers[previousState.activeLayer]
      if (activeImageUrl === imageUrl) {
        return previousState
      }

      const nextActiveLayer: 0 | 1 = previousState.activeLayer === 0 ? 1 : 0
      const nextLayers = [...previousState.layers] as [string | null, string | null]
      nextLayers[nextActiveLayer] = imageUrl

      return {
        layers: nextLayers,
        activeLayer: nextActiveLayer,
      }
    })
  }, [])

  const preloadImage = useCallback(async (imageUrl: string | null): Promise<string | null> => {
    if (!imageUrl) {
      return null
    }

    if (loadedImageUrlsRef.current.has(imageUrl)) {
      return imageUrl
    }

    return new Promise((resolve) => {
      const image = new window.Image()
      image.onload = () => {
        loadedImageUrlsRef.current.add(imageUrl)
        resolve(imageUrl)
      }
      image.onerror = () => resolve(null)
      image.src = imageUrl
    })
  }, [])

  const scheduleTransition = useCallback(
    async (imageUrl: string | null) => {
      transitionRequestRef.current += 1
      const requestId = transitionRequestRef.current
      const preparedImageUrl = await preloadImage(imageUrl)

      if (requestId !== transitionRequestRef.current) {
        return
      }

      transitionToImage(preparedImageUrl)
    },
    [preloadImage, transitionToImage]
  )

  const getFeedbackFlashColor = useCallback((kind: BackgroundFeedbackDetail['kind'], darkMode: boolean): string => {
    if (kind === 'upvote') {
      return darkMode ? 'rgba(16, 185, 129, 0.34)' : 'rgba(16, 185, 129, 0.5)'
    }

    return darkMode ? 'rgba(244, 63, 94, 0.34)' : 'rgba(244, 63, 94, 0.5)'
  }, [])

  const triggerFeedbackFlash = useCallback(
    (kind: BackgroundFeedbackDetail['kind']) => {
      const peakOpacity = isDarkMode ? 0.34 : 0.46
      setFeedbackFlashColor(getFeedbackFlashColor(kind, isDarkMode))
      setFeedbackFlashOpacity(0)

      if (feedbackFlashFrameRef.current !== null) {
        window.cancelAnimationFrame(feedbackFlashFrameRef.current)
      }
      if (feedbackFlashTimeoutRef.current !== null) {
        window.clearTimeout(feedbackFlashTimeoutRef.current)
      }

      feedbackFlashFrameRef.current = window.requestAnimationFrame(() => {
        feedbackFlashFrameRef.current = window.requestAnimationFrame(() => {
          setFeedbackFlashOpacity(peakOpacity)
          feedbackFlashTimeoutRef.current = window.setTimeout(() => {
            setFeedbackFlashOpacity(0)
          }, FEEDBACK_FLASH_TRANSITION_MS)
        })
      })
    },
    [getFeedbackFlashColor, isDarkMode]
  )

  useEffect(() => {
    const handleCaptionImage = (event: Event) => {
      const customEvent = event as CustomEvent<CaptionImageDetail>
      void scheduleTransition(customEvent.detail?.imageUrl ?? null)
    }

    window.addEventListener(BACKGROUND_EVENT_NAME, handleCaptionImage as EventListener)
    window.dispatchEvent(new Event(BACKGROUND_IMAGE_REQUEST_EVENT))

    return () => {
      window.removeEventListener(BACKGROUND_EVENT_NAME, handleCaptionImage as EventListener)
    }
  }, [scheduleTransition])

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
    const handleBackgroundFeedback = (event: Event) => {
      const customEvent = event as CustomEvent<BackgroundFeedbackDetail>
      const kind = customEvent.detail?.kind
      if (!kind) return
      triggerFeedbackFlash(kind)
    }

    window.addEventListener(BACKGROUND_FEEDBACK_EVENT, handleBackgroundFeedback as EventListener)
    return () => {
      window.removeEventListener(BACKGROUND_FEEDBACK_EVENT, handleBackgroundFeedback as EventListener)
    }
  }, [triggerFeedbackFlash])

  useEffect(() => {
    return () => {
      if (feedbackFlashFrameRef.current !== null) {
        window.cancelAnimationFrame(feedbackFlashFrameRef.current)
      }
      if (feedbackFlashTimeoutRef.current !== null) {
        window.clearTimeout(feedbackFlashTimeoutRef.current)
      }
    }
  }, [])

  const layerFilter = isDarkMode
    ? 'blur(96px) saturate(0.9) contrast(0.98) brightness(0.5)'
    : 'blur(96px) saturate(0.9) contrast(0.94) brightness(1.18)'
  const overlayClassName = isDarkMode ? 'bg-black/60' : 'bg-white/52'
  const baseClassName = isDarkMode ? 'bg-slate-900' : 'bg-slate-50'
  const textureOpacity = isDarkMode ? 0.06 : 0.05
  const firstLayerTransform = isDarkMode
    ? 'scale(1.3) rotate(-2.2deg) translate3d(-1.5%, -1%, 0)'
    : 'scale(1.3) rotate(-1.8deg) translate3d(-1%, -1%, 0)'
  const secondLayerTransform = isDarkMode
    ? 'scale(1.26) rotate(2.1deg) translate3d(1.2%, 0.8%, 0)'
    : 'scale(1.26) rotate(1.7deg) translate3d(0.9%, 0.6%, 0)'

  return (
    <div className="pointer-events-none fixed inset-0">
      <div className={`absolute inset-0 ${baseClassName}`} />
      <BackgroundImageLayer
        imageUrl={backgroundState.layers[0]}
        isActive={backgroundState.activeLayer === 0}
        filter={layerFilter}
        transform={firstLayerTransform}
      />
      <BackgroundImageLayer
        imageUrl={backgroundState.layers[1]}
        isActive={backgroundState.activeLayer === 1}
        filter={layerFilter}
        transform={secondLayerTransform}
      />
      <div
        className="absolute inset-0"
        style={{
          opacity: textureOpacity,
          backgroundImage:
            'radial-gradient(circle at 20% 28%, rgba(255,255,255,0.28), transparent 52%), radial-gradient(circle at 79% 66%, rgba(0,0,0,0.22), transparent 54%)',
          mixBlendMode: isDarkMode ? 'screen' : 'multiply',
        }}
      />
      <div className={`absolute inset-0 ${overlayClassName}`} />
      {feedbackFlashColor && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: feedbackFlashColor,
            opacity: feedbackFlashOpacity,
            transition: `opacity ${FEEDBACK_FLASH_TRANSITION_MS}ms ease-in-out`,
          }}
        />
      )}
    </div>
  )
}

function BackgroundImageLayer({
  imageUrl,
  isActive,
  filter,
  transform,
}: {
  imageUrl: string | null
  isActive: boolean
  filter: string
  transform: string
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden transition-opacity duration-1000 ease-in-out"
      style={{ opacity: isActive ? 1 : 0 }}
    >
      {imageUrl ? (
        // Decorative blurred background layer; direct img avoids URL serialization issues in CSS backgrounds.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="absolute select-none object-cover"
          style={{
            top: '-18%',
            left: '-18%',
            width: '136%',
            height: '136%',
            maxWidth: 'none',
            filter,
            transform,
            transformOrigin: 'center',
          }}
        />
      ) : (
        <div
          className="absolute"
          style={{
            top: '-18%',
            left: '-18%',
            width: '136%',
            height: '136%',
            backgroundImage: FALLBACK_BACKGROUND,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '136% 136%',
            filter,
            transform,
            transformOrigin: 'center',
          }}
        />
      )}
    </div>
  )
}
