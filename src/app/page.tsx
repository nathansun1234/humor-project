import { supabase } from "@/utils/supabase/server";

export const revalidate = 0; // optional: force SSR each request

export default async function Home() {
    const { data: captions, error } = await supabase.from("captions").select();

    return (
        <main className="flex min-h-screen flex-col items-center justify-start px-4 py-8">
            <h1 className="text-5xl font-bold mb-12">Captions</h1>
            <div className="flex flex-col gap-8 w-full">
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
        </main>
    );
}