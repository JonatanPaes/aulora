import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light')
  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    const followSystem = () => {
      try {
        const saved = localStorage.getItem('aulora.theme')
        if (saved === 'light' || saved === 'dark') return
      } catch {}
      setTheme(preference.matches ? 'dark' : 'light')
    }
    preference.addEventListener('change', followSystem)
    return () => preference.removeEventListener('change', followSystem)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#121816' : '#f4f6f5')
  }, [theme])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('aulora.theme', next)
    } catch {}
  }

  return { theme, toggleTheme }
}
