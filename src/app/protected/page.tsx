import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from './components/SignOutButton'

export const revalidate = 0; // optional: force SSR each request

export default async function ProtectedPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/')
    }

    const { data: captions, error } = await supabase.from("captions").select();

    return (
        <main className="flex min-h-screen flex-col items-center justify-start px-4 py-8">
            <h1 className="text-5xl font-bold mb-12">Captions</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                {captions?.map((caption) => (
                    <div
                        key={caption.id}
                        className="w-full rounded overflow-hidden shadow-lg bg-white p-6"
                    >
                        <div className="font-bold text-xl mb-2">{caption.title}</div>
                        <p className="text-gray-700 text-base">{caption.content}</p>
                    </div>
                ))}
            </div>
            {error && <p className="text-red-500 mt-4">Error: {error.message}</p>}

            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
                <SignOutButton />
            </div>
        </main>
    )
}
