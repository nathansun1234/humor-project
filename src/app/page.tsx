'use client'

import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "./components/ThemeToggle";

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
        <main className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-50 sm:px-6">
            <ThemeToggle />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_45%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.12),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_45%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.14),transparent_40%)]" />
            <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center justify-center">
                <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-7 text-center shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-900/75 sm:p-10">
                    <p className="text-xs tracking-[0.2em] text-slate-600 uppercase dark:text-slate-300">Welcome</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Caption Voting</h1>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                        Sign in to view and vote on captions.
                    </p>
                    <button
                        onClick={handleSignInWithGoogle}
                        className="mt-8 inline-flex items-center justify-center rounded-xl bg-emerald-500/20 px-5 py-3 text-base font-semibold text-emerald-800 transition hover:bg-emerald-500/35 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 dark:text-emerald-100"
                    >
                        Sign in with Google
                    </button>
                </section>
            </div>
        </main>
    );
}
