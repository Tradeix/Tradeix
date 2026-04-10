'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

type Theme = 'dark' | 'light'
type Language = 'he' | 'en'

type AppContextType = {
  theme: Theme
  language: Language
  setTheme: (t: Theme) => void
  setLanguage: (l: Language) => void
}

const AppContext = createContext<AppContextType>({
  theme: 'dark', language: 'he',
  setTheme: () => {}, setLanguage: () => {},
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [language, setLanguageState] = useState<Language>('he')
  const supabase = createClient()

  useEffect(() => {
    loadPreferences()
  }, [])

  async function loadPreferences() {
    // First load from localStorage for instant apply
    const savedTheme = localStorage.getItem('tradeix-theme') as Theme || 'dark'
    const savedLang = localStorage.getItem('tradeix-lang') as Language || 'he'
    applyTheme(savedTheme)
    applyLanguage(savedLang)
    setThemeState(savedTheme)
    setLanguageState(savedLang)

    // Then sync from Supabase profile
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('theme, language').eq('id', user.id).single()
    if (profile) {
      const t = (profile.theme as Theme) || 'dark'
      const l = (profile.language as Language) || 'he'
      applyTheme(t)
      applyLanguage(l)
      setThemeState(t)
      setLanguageState(l)
      localStorage.setItem('tradeix-theme', t)
      localStorage.setItem('tradeix-lang', l)
    }
  }

  function applyTheme(t: Theme) {
    const root = document.documentElement
    if (t === 'light') {
      root.style.setProperty('--bg', '#f4f5f9')
      root.style.setProperty('--bg2', '#ffffff')
      root.style.setProperty('--bg3', '#eef0f6')
      root.style.setProperty('--bg4', '#e5e7f0')
      root.style.setProperty('--border', '#dde0ed')
      root.style.setProperty('--border2', '#c8ccdf')
      root.style.setProperty('--text', '#111827')
      root.style.setProperty('--text2', '#374151')
      root.style.setProperty('--text3', '#6b7280')
    } else {
      root.style.setProperty('--bg', '#0a0b0f')
      root.style.setProperty('--bg2', '#12141a')
      root.style.setProperty('--bg3', '#1a1d26')
      root.style.setProperty('--bg4', '#222636')
      root.style.setProperty('--border', '#2a2f42')
      root.style.setProperty('--border2', '#363d55')
      root.style.setProperty('--text', '#e8eaf6')
      root.style.setProperty('--text2', '#9096b4')
      root.style.setProperty('--text3', '#5a6080')
    }
  }

  function applyLanguage(l: Language) {
    document.documentElement.dir = l === 'en' ? 'ltr' : 'rtl'
    document.documentElement.lang = l
  }

  async function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem('tradeix-theme', t)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ theme: t }).eq('id', user.id)
  }

  async function setLanguage(l: Language) {
    setLanguageState(l)
    applyLanguage(l)
    localStorage.setItem('tradeix-lang', l)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ language: l }).eq('id', user.id)
  }

  return (
    <AppContext.Provider value={{ theme, language, setTheme, setLanguage }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
