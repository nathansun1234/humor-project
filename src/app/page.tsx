import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const { data: captions, error } = await supabase.from("captions").select();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-5xl font-bold mb-12">Captions</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {captions?.map((caption) => (
          <div key={caption.id} className="max-w-sm rounded overflow-hidden shadow-lg bg-white p-6">
            <div className="font-bold text-xl mb-2">{caption.title}</div>
            <p className="text-gray-700 text-base">{caption.content}</p>
          </div>
        ))}
      </div>
      {error && <p className="text-red-500 mt-4">Error: {error.message}</p>}
    </main>
  );
}
