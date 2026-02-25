import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CaptionVotingPanel from './components/CaptionVotingPanel'
import ProtectedBackgroundLayer from './components/ProtectedBackgroundLayer'
import SettingsMenu from '../components/SettingsMenu'

export const revalidate = 0; // optional: force SSR each request

type CaptionRecord = {
    id: string
    content?: string | null
    title?: string | null
    image_id?: string | null
    image_url?: string | null
    imageUrl?: string | null
}

type ImageRecord = {
    id: string
    url?: string | null
}

function shuffleCaptions(captions: CaptionRecord[]): CaptionRecord[] {
    const shuffled = [...captions]

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
    }

    return shuffled
}

export default async function ProtectedPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/')
    }

    const { data: captions, error } = await supabase
        .from('captions')
        .select('*')
        .eq('is_public', true)

    const baseCaptions = shuffleCaptions((captions ?? []) as CaptionRecord[])
    const imageIds = Array.from(
        new Set(baseCaptions.map((caption) => caption.image_id).filter((imageId): imageId is string => Boolean(imageId)))
    )

    let imageLookupError: string | null = null
    const imageUrlById = new Map<string, string | null>()

    if (imageIds.length > 0) {
        const { data: imageRows, error: imageError } = await supabase
            .from('images')
            .select('id,url')
            .in('id', imageIds)
            .eq('is_public', true)

        if (imageError) {
            imageLookupError = imageError.message
        } else {
            for (const image of ((imageRows ?? []) as ImageRecord[])) {
                imageUrlById.set(image.id, image.url ?? null)
            }
        }
    }

    const hydratedCaptions = baseCaptions.map((caption) => {
        if (!caption.image_id) {
            return caption
        }

        const resolvedImageUrl = imageUrlById.get(caption.image_id)
        if (resolvedImageUrl === undefined) {
            return caption
        }

        return {
            ...caption,
            image_url: caption.image_url ?? resolvedImageUrl,
        }
    })

    const loadErrorMessage = [
        error ? `Error loading captions: ${error.message}` : null,
        imageLookupError ? `Error loading caption images: ${imageLookupError}` : null,
    ]
        .filter((entry): entry is string => Boolean(entry))
        .join(' ')

    return (
        <main className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
            <ProtectedBackgroundLayer />
            <SettingsMenu
                showSignOut
                showProtectedToggles
                userEmail={user.email ?? null}
                profileId={user.id ?? null}
            />
            <div className="relative flex w-full flex-col gap-6">
                <header className="flex flex-wrap items-center gap-4">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Caption Voting</h1>
                </header>

                <CaptionVotingPanel initialCaptions={hydratedCaptions} initialUserId={user.id} />

                {loadErrorMessage && (
                    <p className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm text-red-800 dark:text-red-100">
                        {loadErrorMessage}
                    </p>
                )}
            </div>
        </main>
    )
}
