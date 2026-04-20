'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

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
    root.style.setProperty('--bg', '#d6dff2')
    root.style.setProperty('--bg2', '#e0e9f8')
    root.style.setProperty('--bg3', '#c8d3e8')
    root.style.setProperty('--bg4', '#bbc8de')
    root.style.setProperty('--border', 'rgba(74,127,255,0.13)')
    root.style.setProperty('--border2', 'rgba(74,127,255,0.22)')
    root.style.setProperty('--text', '#111827')
    root.style.setProperty('--text2', '#2d3452')
    root.style.setProperty('--text3', '#6b7280')
    root.style.setProperty('--glass-bg', 'rgba(255,255,255,0.55)')
    root.style.setProperty('--glass-border', 'rgba(74,127,255,0.13)')
    document.body.style.cssText = 'background: #d6dff2 !important; color: #111827 !important;'
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
    root.style.setProperty('--bg', '#080808')
    root.style.setProperty('--bg2', '#0c0c0c')
    root.style.setProperty('--bg3', '#131313')
    root.style.setProperty('--bg4', '#1c1b1b')
    root.style.setProperty('--border', 'rgba(255,255,255,0.06)')
    root.style.setProperty('--border2', 'rgba(255,255,255,0.1)')
    root.style.setProperty('--text', '#e5e2e1')
    root.style.setProperty('--text2', 'rgba(229,226,225,0.6)')
    root.style.setProperty('--text3', 'rgba(229,226,225,0.3)')
    root.style.setProperty('--glass-bg', 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)')
    root.style.setProperty('--glass-border', 'rgba(255,255,255,0.06)')
    document.body.style.cssText = 'background: #080808 !important; color: #e5e2e1 !important;'
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

  useEffect(() => {
    const savedTheme = (localStorage.getItem('tradeix-theme') as Theme) || 'dark'
    setThemeState(savedTheme)
    applyTheme(savedTheme)

    const savedLang = (localStorage.getItem('tradeix-lang') as Language) || 'he'
    setLanguageState(savedLang)
    applyLanguage(savedLang)

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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').upsert({ id: user.id, theme: t }, { onConflict: 'id' })
  }

  async function setLanguage(l: Language) {
    setLanguageState(l); applyLanguage(l)
    localStorage.setItem('tradeix-lang', l)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').upsert({ id: user.id, language: l }, { onConflict: 'id' })
  }

  async function upgradeToPro() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').upsert(
      { id: user.id, subscription_tier: 'pro', subscription_status: 'active' },
      { onConflict: 'id' }
    )
    setSubscription('pro')
    localStorage.setItem('tradeix-show-upgrade', '1')
  }

  async function cancelSubscription() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Get all portfolio IDs for this user
    const { data: portfolios } = await supabase
      .from('portfolios').select('id').eq('user_id', user.id)
    const portfolioIds = portfolios?.map((p: any) => p.id) || []

    // 2. Delete all trades in those portfolios
    if (portfolioIds.length > 0) {
      await supabase.from('trades').delete().in('portfolio_id', portfolioIds)
    }

    // 3. Delete all portfolios
    await supabase.from('portfolios').delete().eq('user_id', user.id)

    // 4. Reset profile to free (keep the user account)
    await supabase.from('profiles').upsert(
      { id: user.id, subscription_tier: 'free', subscription_status: 'canceled' },
      { onConflict: 'id' }
    )

    // 5. Update local state — stay logged in as free user
    setSubscription('free')
    localStorage.setItem('tradeix-show-downgrade', '1')
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
