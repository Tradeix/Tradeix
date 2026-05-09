'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

type Theme = 'dark' | 'light'
type Language = 'he' | 'en'
type SubscriptionTier = 'free' | 'pro'

type AppContextType = {
  theme: Theme
  language: Language
  setTheme: (t: Theme) => void
  setLanguage: (l: Language) => void
  subscription: SubscriptionTier
  isPro: boolean
  subscriptionLoading: boolean
  upgradeToPro: () => Promise<void>
  cancelSubscription: () => Promise<void>
}

const AppContext = createContext<AppContextType>({
  theme: 'dark', language: 'he',
  setTheme: () => {}, setLanguage: () => {},
  subscription: 'free', isPro: false, subscriptionLoading: true,
  upgradeToPro: async () => {}, cancelSubscription: async () => {},
})

function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'light') {
    root.setAttribute('data-theme', 'light')
    // Page is a soft gray, cards sit ABOVE it in white. This gives the
    // dashboard a clear card-on-canvas hierarchy in light mode instead of
    // the previous "everything is off-white" flatness.
    root.style.setProperty('--bg', '#eef0f4')
    root.style.setProperty('--bg2', '#ffffff')
    root.style.setProperty('--bg3', '#f4f5f8')
    root.style.setProperty('--bg4', '#e8eaef')
    root.style.setProperty('--chrome-bg', 'rgba(255,255,255,0.94)')
    root.style.setProperty('--modal-bg', '#ffffff')
    root.style.setProperty('--border', 'rgba(15,23,42,0.08)')
    root.style.setProperty('--border2', 'rgba(15,23,42,0.14)')
    root.style.setProperty('--text', '#0f1117')
    root.style.setProperty('--text2', '#374151')
    root.style.setProperty('--text3', '#6b7280')
    root.style.setProperty('--glass-bg', 'rgba(255,255,255,0.85)')
    root.style.setProperty('--glass-border', 'rgba(15,23,42,0.08)')
    document.body.style.cssText = 'background: #eef0f4 !important; color: #0f1117 !important;'
    const style = document.getElementById('tradeix-theme-style') || document.createElement('style')
    style.id = 'tradeix-theme-style'
    style.textContent = `
      [data-theme="light"] { color-scheme: light; }
      [data-theme="light"] body { color: #0f1117 !important; }
      [data-theme="light"] h1, [data-theme="light"] h2, [data-theme="light"] h3,
      [data-theme="light"] h4, [data-theme="light"] h5, [data-theme="light"] p,
      [data-theme="light"] span, [data-theme="light"] div, [data-theme="light"] label,
      [data-theme="light"] td, [data-theme="light"] th, [data-theme="light"] button {
        border-color: inherit;
      }
      [data-theme="light"] input, [data-theme="light"] select, [data-theme="light"] textarea {
        background: #fff !important;
        color: #0f1117 !important;
        border-color: rgba(0,0,0,0.12) !important;
      }
      [data-theme="light"] input::placeholder, [data-theme="light"] textarea::placeholder {
        color: #9ca3af !important;
      }
      [data-theme="light"] .btn-ghost {
        background: rgba(0,0,0,0.04) !important;
        border-color: rgba(0,0,0,0.1) !important;
        color: #374151 !important;
      }
    `
    document.head.appendChild(style)
  } else {
    root.setAttribute('data-theme', 'dark')
    root.style.setProperty('--bg', '#05080d')
    root.style.setProperty('--bg2', 'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))')
    root.style.setProperty('--bg3', 'rgba(255,255,255,0.035)')
    root.style.setProperty('--bg4', 'rgba(255,255,255,0.06)')
    root.style.setProperty('--chrome-bg', 'rgba(5, 8, 13, 0.96)')
    root.style.setProperty('--modal-bg', '#070b12')
    root.style.setProperty('--border', 'rgba(255,255,255,0.075)')
    root.style.setProperty('--border2', 'rgba(255,255,255,0.13)')
    root.style.setProperty('--text', '#f4f7fb')
    root.style.setProperty('--text2', '#b1bdcc')
    root.style.setProperty('--text3', '#768397')
    root.style.setProperty('--glass-bg', 'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))')
    root.style.setProperty('--glass-border', 'rgba(255,255,255,0.075)')
    document.body.style.cssText = 'background: #05080d !important; color: #f4f7fb !important;'
    const styleEl = document.getElementById('tradeix-theme-style')
    if (styleEl) styleEl.textContent = '[data-theme="dark"] { color-scheme: dark; }'
  }
}

function applyLanguage(l: Language) {
  document.documentElement.dir = l === 'en' ? 'ltr' : 'rtl'
  document.documentElement.lang = l
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [language, setLanguageState] = useState<Language>('he')
  const [subscription, setSubscription] = useState<SubscriptionTier>('free')
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)
  const supabase = createClient()

  // Global ESC-to-close handler for every modal in the app. Modals already
  // attach their close action to the overlay's onClick, so we just synthesize
  // a click on the topmost overlay when the user presses Escape. Layered
  // overlays (--top, --top2) close from the top down.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const top2 = document.querySelector('.app-modal-overlay.app-modal-overlay--top2') as HTMLElement | null
      const top1 = document.querySelector('.app-modal-overlay.app-modal-overlay--top') as HTMLElement | null
      const all = document.querySelectorAll('.app-modal-overlay')
      const target = top2 || top1 || (all.length ? (all[all.length - 1] as HTMLElement) : null)
      if (target) {
        e.preventDefault()
        target.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const savedTheme = (localStorage.getItem('tradeix-theme') as Theme) || 'dark'
    setThemeState(savedTheme)
    applyTheme(savedTheme)

    const savedLang = (localStorage.getItem('tradeix-lang') as Language) || 'he'
    setLanguageState(savedLang)
    applyLanguage(savedLang)

    if (!isSupabaseConfigured) {
      setSubscriptionLoading(false)
      return
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setSubscriptionLoading(false); return }
      supabase.from('profiles')
        .select('language, subscription_tier, subscription_status')
        .eq('id', user.id).single()
        .then(({ data }) => {
          if (!data) { setSubscriptionLoading(false); return }
          const l = (data.language as Language) || savedLang
          setLanguageState(l)
          applyLanguage(l)
          localStorage.setItem('tradeix-lang', l)
          const tier = (data.subscription_tier as SubscriptionTier) || 'free'
          setSubscription(tier)
          setSubscriptionLoading(false)
        })
    })
  }, [])

  async function setTheme(t: Theme) {
    setThemeState(t); applyTheme(t)
    localStorage.setItem('tradeix-theme', t)
    if (!isSupabaseConfigured) return
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').upsert({ id: user.id, theme: t }, { onConflict: 'id' })
  }

  async function setLanguage(l: Language) {
    setLanguageState(l); applyLanguage(l)
    localStorage.setItem('tradeix-lang', l)
    if (!isSupabaseConfigured) return
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').upsert({ id: user.id, language: l }, { onConflict: 'id' })
  }

  async function upgradeToPro() {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured')

    const response = await fetch('/api/billing/checkout', { method: 'POST' })
    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error || 'Could not start checkout')
    }

    window.location.assign(payload.url)
    return
  }

  async function cancelSubscription() {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured')

    const response = await fetch('/api/billing/portal')
    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error || 'Could not open billing portal')
    }

    window.location.assign(payload.url)
    return
  }

  const isPro = subscription === 'pro'

  return (
    <AppContext.Provider value={{
      theme, language, setTheme, setLanguage,
      subscription, isPro, subscriptionLoading,
      upgradeToPro, cancelSubscription,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
