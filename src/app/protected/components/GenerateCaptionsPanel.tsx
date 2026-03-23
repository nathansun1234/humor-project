'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NextImage from 'next/image'
import { createClient } from '@/lib/supabase/client'

const PIPELINE_BASE_URL = 'https://api.almostcrackd.ai'
const BACKGROUND_EVENT_NAME = 'protected:caption-image'
const BACKGROUND_IMAGE_REQUEST_EVENT = 'protected:caption-image-request'
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
] as const
const FILE_ACCEPT_VALUE = SUPPORTED_IMAGE_TYPES.join(',')

type PresignedUploadResponse = {
  presignedUrl: string
  cdnUrl: string
}

type RegisterImageResponse = {
  imageId: string
}

type CaptionPipelineRecord = Record<string, unknown> | string
type CaptionImageDetail = { imageUrl: string | null }

export default function GenerateCaptionsPanel({ isActive = true }: { isActive?: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [captions, setCaptions] = useState<CaptionPipelineRecord[]>([])
  const [statusMessage, setStatusMessage] = useState('Select an image to generate captions.')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl(null)
      return
    }

    const nextUrl = URL.createObjectURL(selectedFile)
    setLocalPreviewUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [selectedFile])

  const imagePreviewUrl = uploadedImageUrl ?? localPreviewUrl
  const dispatchBackgroundImage = useCallback((imageUrl: string | null) => {
    window.dispatchEvent(
      new CustomEvent<CaptionImageDetail>(BACKGROUND_EVENT_NAME, {
        detail: { imageUrl },
      })
    )
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    setSelectedFile(nextFile)
    setUploadedImageUrl(null)
    setCaptions([])
    setErrorMessage(null)
    setStatusMessage(nextFile ? 'Image selected. Ready to upload and generate captions.' : 'Select an image to generate captions.')
  }

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  useEffect(() => {
    if (!isActive) return
    dispatchBackgroundImage(imagePreviewUrl)
  }, [dispatchBackgroundImage, imagePreviewUrl, isActive])

  useEffect(() => {
    const handleImageRequest = () => {
      if (!isActive) return
      dispatchBackgroundImage(imagePreviewUrl)
    }

    window.addEventListener(BACKGROUND_IMAGE_REQUEST_EVENT, handleImageRequest)
    return () => {
      window.removeEventListener(BACKGROUND_IMAGE_REQUEST_EVENT, handleImageRequest)
    }
  }, [dispatchBackgroundImage, imagePreviewUrl, isActive])

  const handleGenerateCaptions = async () => {
    if (!selectedFile) {
      setErrorMessage('Select an image first.')
      return
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(selectedFile.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
      setErrorMessage('Unsupported image type. Use JPEG, JPG, PNG, WEBP, GIF, or HEIC.')
      return
    }

    setIsSubmitting(true)
    setCaptions([])
    setUploadedImageUrl(null)
    setErrorMessage(null)

    try {
      const token = await getAccessToken(supabase)

      setStatusMessage('Generating upload URL...')
      const presignedData = await postJson<PresignedUploadResponse>(
        '/pipeline/generate-presigned-url',
        token,
        { contentType: selectedFile.type },
        'Could not generate upload URL.'
      )

      setStatusMessage('Uploading image...')
      const uploadResponse = await fetch(presignedData.presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type,
        },
        body: selectedFile,
      })

      if (!uploadResponse.ok) {
        throw new Error(await getResponseErrorMessage(uploadResponse, 'Could not upload the image bytes.'))
      }

      setUploadedImageUrl(presignedData.cdnUrl)

      setStatusMessage('Registering uploaded image...')
      const registrationData = await postJson<RegisterImageResponse>(
        '/pipeline/upload-image-from-url',
        token,
        {
          imageUrl: presignedData.cdnUrl,
          isCommonUse: false,
        },
        'Could not register uploaded image URL.'
      )

      setStatusMessage('Generating captions...')
      const captionsResponse = await postJson<unknown>(
        '/pipeline/generate-captions',
        token,
        {
          imageId: registrationData.imageId,
        },
        'Could not generate captions.'
      )

      const generatedCaptions = normalizeCaptionsResponse(captionsResponse)
      setCaptions(generatedCaptions)
      setStatusMessage(
        generatedCaptions.length > 0
          ? `Generated ${generatedCaptions.length} caption${generatedCaptions.length === 1 ? '' : 's'}.`
          : 'Caption generation returned no records.'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while generating captions.'
      setErrorMessage(message)
      setStatusMessage('Caption generation failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto flex h-[77dvh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-black sm:p-5">
      <div className="flex h-full min-h-0 flex-col">
        <article className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-white/10 dark:bg-[#0d0d0d] sm:p-4">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-white/10 dark:bg-black">
              {imagePreviewUrl ? (
                <div className="relative h-full w-full">
                  <NextImage src={imagePreviewUrl} alt="Uploaded preview" fill className="object-contain" unoptimized />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 px-3 py-1.5 text-xs text-white">
                    <p className="truncate">{selectedFile?.name ?? 'Selected image'}</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-600 dark:text-slate-400">
                  <p>Upload an image to preview it here.</p>
                  <p className="text-xs">Supported types: JPEG, JPG, PNG, WEBP, GIF, HEIC</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              id="generate-captions-file-input"
              type="file"
              accept={FILE_ACCEPT_VALUE}
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="sr-only"
            />

            <button
              type="button"
              onClick={handleChooseFile}
              disabled={isSubmitting}
              className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-[#161616] dark:text-slate-100 dark:hover:bg-[#1f1f1f]"
            >
              Upload Image
            </button>

            <button
              type="button"
              onClick={() => void handleGenerateCaptions()}
              disabled={!selectedFile || isSubmitting}
              className="mt-2 rounded-xl border border-transparent bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-100"
            >
              {isSubmitting ? 'Generating...' : 'Generate Captions'}
            </button>
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-white/10 dark:bg-[#050505] sm:p-4">
            <div className="min-h-0 flex-1">
              {captions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-600 dark:text-slate-400">
                  <p>Generated captions will appear here after a successful run.</p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {captions.map((caption, index) => (
                    <li
                      key={getCaptionKey(caption, index)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#121212]"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Caption {index + 1}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                        {extractCaptionText(caption)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </article>

        <div className="mt-3 shrink-0">
          <p className="w-full rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-center text-sm text-slate-700 dark:border-white/10 dark:bg-[#121212] dark:text-slate-200">
            {statusMessage}
          </p>
          {errorMessage && (
            <p className="mt-2 w-full rounded-xl border border-rose-500/45 bg-rose-500/15 px-3 py-2 text-center text-sm text-rose-800 dark:text-rose-100">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

async function getAccessToken(supabase: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      await safeSignOut(supabase)
      throw new Error('Your session expired. Please sign in again.')
    }

    const token = data.session?.access_token
    if (!token) {
      await safeSignOut(supabase)
      throw new Error('No JWT access token found. Please sign in again.')
    }

    return token
  } catch {
    await safeSignOut(supabase)
    throw new Error('Your session expired. Please sign in again.')
  }
}

async function safeSignOut(supabase: ReturnType<typeof createClient>): Promise<void> {
  try {
    await supabase.auth.signOut()
  } catch {
    // Ignore sign-out failures caused by stale refresh tokens.
  }
}

async function postJson<TResponse>(
  path: string,
  token: string,
  body: unknown,
  fallbackErrorMessage: string
): Promise<TResponse> {
  const response = await fetch(`${PIPELINE_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, fallbackErrorMessage))
  }

  return (await response.json()) as TResponse
}

async function getResponseErrorMessage(response: Response, fallbackErrorMessage: string): Promise<string> {
  const rawBody = await response.text()
  if (!rawBody) {
    return `${fallbackErrorMessage} (HTTP ${response.status})`
  }

  try {
    const parsedBody = JSON.parse(rawBody) as { message?: string; error?: string }
    if (typeof parsedBody.message === 'string' && parsedBody.message.trim()) {
      return parsedBody.message
    }
    if (typeof parsedBody.error === 'string' && parsedBody.error.trim()) {
      return parsedBody.error
    }
  } catch {
    return `${fallbackErrorMessage} (HTTP ${response.status})`
  }

  return `${fallbackErrorMessage} (HTTP ${response.status})`
}

function normalizeCaptionsResponse(payload: unknown): CaptionPipelineRecord[] {
  if (Array.isArray(payload)) {
    return payload as CaptionPipelineRecord[]
  }

  if (payload && typeof payload === 'object' && Array.isArray((payload as { captions?: unknown }).captions)) {
    return (payload as { captions: CaptionPipelineRecord[] }).captions
  }

  return []
}

function extractCaptionText(caption: CaptionPipelineRecord): string {
  if (typeof caption === 'string') {
    return caption
  }

  const candidateKeys = ['caption', 'content', 'text', 'title', 'generated_caption', 'caption_text'] as const
  for (const key of candidateKeys) {
    const value = caption[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return JSON.stringify(caption)
}

function getCaptionKey(caption: CaptionPipelineRecord, index: number): string {
  if (typeof caption === 'object' && caption !== null && typeof caption.id === 'string') {
    return caption.id
  }

  return `caption-${index}`
}
