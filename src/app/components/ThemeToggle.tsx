'use client'

const THEME_STORAGE_KEY = 'ui-theme'
type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export default function ThemeToggle() {
  const handleToggleTheme = () => {
    const currentTheme: Theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark'
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    applyTheme(nextTheme)
  }

  return (
    <button
      type="button"
      onClick={handleToggleTheme}
      className="fixed right-4 bottom-4 z-50 rounded-xl border border-slate-300 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-white/20 dark:bg-slate-900/75 dark:text-slate-100 dark:hover:bg-slate-800/85"
    >
      Toggle theme
    </button>
  )
}
