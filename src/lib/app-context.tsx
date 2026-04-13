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

// Apply theme to DOM immediately
function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'light') {
    root.setAttribute('data-theme', 'light')
    root.style.setProperty('--bg', '#f0f2f8')
    root.style.setProperty('--bg2', '#ffffff')
    root.style.setProperty('--bg3', '#e8eaf2')
    root.style.setProperty('--bg4', '#dde0ee')
    root.style.setProperty('--border', 'rgba(0,0,0,0.08)')
    root.style.setProperty('--border2', 'rgba(0,0,0,0.13)')
    root.style.setProperty('--text', '#0f1117')
    root.style.setProperty('--text2', '#2d3148')
    root.style.setProperty('--text3', '#6b7280')
    // Override body background for light mode
    document.body.style.background = '#f0f2f8'
    document.body.style.color = '#0f1117'
  } else {
    root.setAttribute('data-theme', 'dark')
    root.style.setProperty('--bg', '#080808')
    root.style.setProperty('--bg2', '#0c0c0c')
    root.style.setProperty('--bg3', '#131313')
    root.style.setProperty('--bg4', '#1c1b1b')
    root.style.setProperty('--border', 'rgba(255,255,255,0.06)')
    root.style.setProperty('--border2', 'rgba(255,255,255,0.1)')
    root.style.setProperty('--text', '#e5e2e1')
    root.style.setProperty('--text2', 'rgba(229,226,225,0.6)')
    root.style.setProperty('--text3', 'rgba(229,226,225,0.3)')
    document.body.style.background = '#080808'
    document.body.style.color = '#e5e2e1'
  }
}

function applyLanguage(l: Language) {
  document.documentElement.dir = l === 'en' ? 'ltr' : 'rtl'
  document.documentElement.lang = l
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [language, setLanguageState] = useState<Language>('he')
  const supabase = createClient()

  useEffect(() => {
    // Apply from localStorage immediately (no flash)
    const savedTheme = (localStorage.getItem('tradeix-theme') as Theme) || 'dark'
    const savedLang = (localStorage.getItem('tradeix-lang') as Language) || 'he'
    setThemeState(savedTheme)
    setLanguageState(savedLang)
    applyTheme(savedTheme)
    applyLanguage(savedLang)

    // Then sync from Supabase
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('theme, language').eq('id', user.id).single()
        .then(({ data }) => {
          if (!data) return
          const t = (data.theme as Theme) || savedTheme
          const l = (data.language as Language) || savedLang
          setThemeState(t)
          setLanguageState(l)
          applyTheme(t)
          applyLanguage(l)
          localStorage.setItem('tradeix-theme', t)
          localStorage.setItem('tradeix-lang', l)
        })
    })
  }, [])

  async function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem('tradeix-theme', t)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({ id: user.id, theme: t }, { onConflict: 'id' })
    }
  }

  async function setLanguage(l: Language) {
    setLanguageState(l)
    applyLanguage(l)
    localStorage.setItem('tradeix-lang', l)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({ id: user.id, language: l }, { onConflict: 'id' })
    }
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
