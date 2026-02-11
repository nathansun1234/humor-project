'use client'

import { createClient } from "@/lib/supabase/client";

export default function Home() {
    const supabase = createClient();

    const handleSignInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${location.origin}/auth/callback`,
            },
        });
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
            <h1 className="text-5xl font-bold mb-8">Welcome</h1>
            <p className="text-xl mb-8">Sign in to view captions.</p>
            <button
                onClick={handleSignInWithGoogle}
                className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
                Sign in with Google
            </button>
        </main>
    );
}