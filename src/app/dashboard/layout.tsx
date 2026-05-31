'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PortfolioProvider, usePortfolio } from '@/lib/portfolio-context'
import { AppProvider, useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Link from 'next/link'
import Icon from '@/components/Icon'

function forceViewportTop() {
  if (typeof window === 'undefined') return
  const scrollOptions: ScrollToOptions = { top: 0, left: 0, behavior: 'instant' as ScrollBehavior }
  window.scrollTo(scrollOptions)
  document.scrollingElement?.scrollTo(scrollOptions)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function scheduleViewportTopReset() {
  if (typeof window === 'undefined') return () => {}

  const frames: number[] = []
  const timers: number[] = []

  forceViewportTop()
  frames.push(window.requestAnimationFrame(() => {
    forceViewportTop()
    frames.push(window.requestAnimationFrame(forceViewportTop))
  }))
  timers.push(window.setTimeout(forceViewportTop, 40))
  timers.push(window.setTimeout(forceViewportTop, 120))
  timers.push(window.setTimeout(forceViewportTop, 260))

  return () => {
    frames.forEach(frame => window.cancelAnimationFrame(frame))
    timers.forEach(timer => window.clearTimeout(timer))
  }
}

function resetViewportBeforeNavigation() {
  forceViewportTop()
  if (typeof window === 'undefined') return
  window.setTimeout(forceViewportTop, 0)
}

const PORTFOLIO_COLOR_MAP: Record<string, string> = {
  green:  '#0f8d63',
  blue:   '#3b82f6',
  purple: '#8b5cf6',
  red:    '#ef4444',
  amber:  '#f59e0b',
  cyan:   '#06b6d4',
  pink:   '#ec4899',
  teal:   '#14b8a6',
  indigo: '#6366f1',
  rose:   '#f43f5e',
  // legacy aliases so previously saved values still resolve
  gray:   '#6b7280',
}
function getPortfolioColor(portfolio: any) {
  return PORTFOLIO_COLOR_MAP[(portfolio as any)?.color || 'green'] || '#0f8d63'
}

const PORTFOLIO_AGNOSTIC_PATHS = ['/portfolios', '/portfolios/archive', '/gallery', '/settings', '/upgrade']

function Header({ sidebarOpen, setSidebarOpen, handleSignOut }: any) {
  const { activePortfolio, portfolios, setActivePortfolio } = usePortfolio()
  const { language, isPro, isTemporaryPro, subscriptionLoading, isAdmin } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const tr = t[language]
  const hideSelector = PORTFOLIO_AGNOSTIC_PATHS.includes(pathname)
  const [showMenu, setShowMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [hasScrolled, setHasScrolled] = useState(false)
  const supabase = createClient()
  const isRTL = language === 'he'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    const updateScrolled = () => setHasScrolled(window.scrollY > 30)
    updateScrolled()
    window.addEventListener('scroll', updateScrolled, { passive: true })
    return () => window.removeEventListener('scroll', updateScrolled)
  }, [pathname])

  useLayoutEffect(() => {
    setHasScrolled(false)
    forceViewportTop()
  }, [pathname])

  const dotColor = activePortfolio ? getPortfolioColor(activePortfolio) : '#0f8d63'

  return (
    <header className={`dashboard-header ${hasScrolled ? 'dashboard-header-scrolled' : ''}`} style={{
      height: '72px',
      background: hasScrolled ? 'rgba(7,10,15,0.82)' : 'transparent',
      borderBottom: hasScrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
      position: 'fixed',
      top: 0,
      [isRTL ? 'right' : 'left']: '72px',
      [isRTL ? 'left' : 'right']: 0,
      zIndex: 90,
      backdropFilter: hasScrolled ? 'blur(18px)' : 'none',
      WebkitBackdropFilter: hasScrolled ? 'blur(18px)' : 'none',
      boxShadow: hasScrolled ? '0 10px 30px rgba(0,0,0,0.22)' : 'none',
      transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, backdrop-filter 0.25s ease',
    }}>
    <div className="header-inner" style={{
      height: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '0 40px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hamburger-btn" style={{
        display: 'none', width: '40px', height: '40px', flexShrink: 0,
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: '12px', cursor: 'pointer',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--text2)',
      }}>
        <Icon name="menu" size={20} color="currentColor" />
      </button>

      {/* Unified portfolio selector — hidden on portfolio-agnostic pages
          (Portfolio Settings, Gallery, Archive, Settings). */}
      {!hideSelector && activePortfolio && portfolios.length > 0 && (() => {
        const activeColor = getPortfolioColor(activePortfolio)
        return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => setShowMenu(!showMenu)}
            className="active-portfolio-badge"
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '6px 10px 6px 6px',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px',
              background: 'var(--bg4)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="account_balance_wallet" size={16} color="var(--text3)" />
            </div>
            <div style={{ minWidth: 0, textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: activeColor, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>
                {language === 'he' ? 'תיק פעיל' : 'Active'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: activeColor, lineHeight: 1.2, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                {activePortfolio.name}
              </div>
            </div>
            <div style={{
              paddingInlineStart: '10px',
              marginInlineStart: '2px',
              borderInlineStart: '1px solid var(--border)',
              display: 'flex', alignItems: 'center',
              color: 'var(--text3)', flexShrink: 0,
            }}>
              <Icon name="swap_horiz" size={16} color="var(--text3)" />
            </div>
          </div>

          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
              <div style={{
                position: 'absolute', top: '56px',
                insetInlineStart: 0, insetInlineEnd: 'auto',
                width: '100%',
                maxWidth: 'calc(100vw - 24px)',
                background: 'var(--modal-bg)', border: '1px solid var(--border)',
                borderRadius: '10px', zIndex: 200,
                overflow: 'hidden', padding: '6px',
                animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                transformOrigin: isRTL ? 'top right' : 'top left',
                boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              }}>
                {portfolios.map(p => {
                  const isActive = activePortfolio?.id === p.id
                  const pColor = getPortfolioColor(p)
                  return (
                    <div key={p.id} onClick={() => { resetViewportBeforeNavigation(); setActivePortfolio(p); setShowMenu(false); router.push('/dashboard') }}
                      className="portfolio-item-anim"
                      style={{
                        padding: '10px 14px', fontSize: '14px', cursor: 'pointer',
                        background: isActive ? 'var(--bg3)' : 'transparent',
                        color: pColor,
                        display: 'flex', alignItems: 'center', gap: '10px',
                        transition: 'all 0.15s', borderRadius: '6px',
                        fontWeight: isActive ? '700' : '600',
                        position: 'relative', marginBottom: '2px',
                        letterSpacing: '0.02em',
                        fontFamily: 'Heebo, Rubik, sans-serif',
                      }}
                      onMouseOver={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.transform = `translate${isRTL ? 'X(-4px)' : 'X(4px)'}` } }}
                      onMouseOut={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateX(0)' } }}
                    >
                      {/* Color stripe — always shown in the portfolio's own color */}
                      <div style={{
                        position: 'absolute', [isRTL ? 'right' : 'left']: 0,
                        top: '4px', bottom: '4px', width: '3px',
                        background: pColor,
                        borderRadius: '2px',
                        opacity: isActive ? 1 : 0.65,
                      }} />
                      <Icon name="account_balance_wallet" size={16} color={pColor} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      {isActive && <Icon name="check" size={14} color={pColor} />}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        )
      })()}

      <div style={{ flex: 1 }} />

      {/* Upgrade to PRO banner — free and trial users */}
      {!subscriptionLoading && (!isPro || isTemporaryPro) && (
        <Link href="/upgrade" onClick={resetViewportBeforeNavigation} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: '#0f8d63',
          border: '1px solid rgba(16,185,129,0.35)',
          borderRadius: '8px', padding: '7px 14px',
          fontSize: '12px', fontWeight: '700', color: '#fff',
          textDecoration: 'none', letterSpacing: '0.03em',
          transition: 'opacity 0.15s', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
          className="upgrade-btn"
        >
          <Icon name="bolt" size={14} color="#fff" />
          {language === 'he' ? 'שדרג ל PRO' : 'Upgrade to PRO'}
        </Link>
      )}

      {/* User info */}
      <div style={{ position: 'relative' }}>
        <div onClick={() => setShowUserMenu(!showUserMenu)} style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingInlineStart: '16px', borderInlineStart: '1px solid var(--border)', cursor: 'pointer' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: isAdmin ? '#0ea5e9' : isTemporaryPro ? '#ef4444' : '#0f8d63',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: '700', color: '#fff', overflow: 'hidden',
            }}>
              {user?.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : user ? ((user.user_metadata?.full_name || user.email || '?')[0] || '?').toUpperCase() : ''
              }
            </div>
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }} className="user-name-block">
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', lineHeight: 1, minHeight: '14px' }}>
              {user ? (user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || '') : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
              {isAdmin ? (
                <>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8' }} />
                  <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    ADMIN
                  </span>
                </>
              ) : isPro ? (
                <>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: isTemporaryPro ? '#ef4444' : '#0f8d63' }} />
                  <span style={{ fontSize: '10px', color: isTemporaryPro ? '#ef4444' : '#0f8d63', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {isTemporaryPro ? 'PRO-Trial' : 'PRO'}
                  </span>
                </>
              ) : (
                <>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0f8d63' }} />
                  <span style={{ fontSize: '10px', color: '#0f8d63', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {tr.freeAccount}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {showUserMenu && (
          <>
            <div onClick={() => setShowUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
            <div style={{
              position: 'absolute', top: '48px',
              right: 0,
              background: 'var(--modal-bg)', border: '1px solid var(--border)',
              borderRadius: '10px', zIndex: 200, minWidth: '150px',
              overflow: 'hidden', padding: '6px',
              animation: 'slideInRight 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
              transformOrigin: 'top right',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}>
              <button onClick={() => { setShowUserMenu(false); handleSignOut() }} style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '10px 14px', borderRadius: '8px',
                fontSize: '14px', fontWeight: '700', color: '#ef4444',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'Heebo, sans-serif', transition: 'background 0.15s',
              }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <Icon name="logout" size={15} color="#ef4444" />
                {language === 'he' ? 'יציאה' : 'Log out'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </header>
  )
}

function Sidebar({ sidebarOpen, setSidebarOpen, handleSignOut }: any) {
  const pathname = usePathname()
  const { language, isPro } = useApp()
  const tr = t[language]
  const isRTL = language === 'he'

  // Stats and archive hidden for free users in sidebar
  const NAV_ITEMS = [
    { href: '/dashboard', icon: 'space_dashboard', label: tr.dashboard },
    { href: '/add-trade', icon: 'post_add', label: tr.addTrade },
    { href: '/trades', icon: 'swap_horiz', label: tr.allTrades },
    { href: '/weekly-report', icon: 'menu_book', label: language === 'he' ? 'דוח שבועי' : 'Weekly Report' },
    ...(isPro ? [{ href: '/strategies', icon: 'psychology', label: tr.strategies }] : []),
    ...(isPro ? [{ href: '/stats', icon: 'monitoring', label: tr.statistics }] : []),
  ]
  const BOTTOM_NAV = [
    { href: '/gallery', icon: 'photo_library', label: language === 'he' ? 'גלריה' : 'Gallery' },
    ...(isPro ? [{ href: '/portfolios/archive', icon: 'inventory_2', label: language === 'he' ? 'ארכיון תיקים' : 'Archive' }] : []),
    { href: '/settings', icon: 'settings', label: language === 'he' ? 'הגדרות' : 'Settings' },
  ]

  const VISIBLE_BOTTOM_NAV = isPro ? BOTTOM_NAV : BOTTOM_NAV.filter(item => item.href !== '/gallery')

  const NavLink = ({ href, icon, label }: any) => {
    const active = pathname === href
    const weeklyReportLink = href === '/weekly-report'
    return (
      <Link href={href} scroll onClick={() => { resetViewportBeforeNavigation(); setSidebarOpen(false) }} title={label} className={`nav-link-anim sidebar-link${weeklyReportLink ? ' weekly-report-link' : ''}`} data-active={active ? '1' : '0'} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 20px',
        color: active ? '#0f8d63' : 'var(--text3)',
        fontWeight: active ? '700' : '500',
        fontSize: '14px', textDecoration: 'none',
        background: active ? 'var(--bg3)' : 'transparent',
        transition: 'background 0.15s, color 0.15s, transform 0.15s', marginBottom: '2px',
        position: 'relative', letterSpacing: '0.02em',
        fontFamily: 'Heebo, Rubik, sans-serif',
        borderRadius: '8px',
      }}
        onMouseOver={e => { if (!active) { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'var(--bg3)' } }}
        onMouseOut={e => { e.currentTarget.style.color = active ? '#0f8d63' : 'var(--text3)'; if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        {active && (
          <div className="sidebar-link-stripe" style={{
            position: 'absolute', [isRTL ? 'right' : 'left']: 0,
            top: 0, bottom: 0, width: '3px',
            background: '#0f8d63',
            borderRadius: isRTL ? '2px 0 0 2px' : '0 2px 2px 0',
            animation: 'pulseGlow 2s ease-in-out infinite',
          }} />
        )}
        <Icon name={icon} size={20} color="currentColor" />
        <span className="sidebar-label">{label}</span>
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--chrome-bg)', overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Logo */}
      <div className="sidebar-top" style={{ padding: '24px 16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <Link href="/dashboard" scroll onClick={() => { resetViewportBeforeNavigation(); setSidebarOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
          <img src="/uplotrade-mark-cropped.png" alt="" aria-hidden="true" style={{ width: '44px', height: '36px', objectFit: 'contain', flexShrink: 0 }} />
          <span className="sidebar-wordmark" style={{ fontFamily: 'Manrope, Heebo, sans-serif', fontWeight: '800', fontSize: '21px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
            UPLOTRADE
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 8px' }}>
        {NAV_ITEMS.map(item => <NavLink key={item.href} {...item} />)}
        <div style={{ height: '1px', background: 'var(--border)', margin: '12px 12px' }} />
        {VISIBLE_BOTTOM_NAV.map(item => <NavLink key={item.href} {...item} />)}
        <div style={{ height: '1px', background: 'var(--border)', margin: '12px 12px' }} />
        <button onClick={handleSignOut} className="sidebar-link" title={tr.logout} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '11px 20px', width: '100%',
          color: 'rgba(239,68,68,0.6)', fontSize: '14px', fontWeight: '500',
          cursor: 'pointer', background: 'transparent', border: 'none',
          fontFamily: 'Heebo, Rubik, sans-serif', letterSpacing: '0.02em',
          borderRadius: '8px', transition: 'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.05)' }}
          onMouseOut={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; e.currentTarget.style.background = 'transparent' }}
        >
          <Icon name="logout" size={20} color="currentColor" />
          <span className="sidebar-label">{tr.logout}</span>
        </button>
      </nav>
    </div>
  )
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Desktop: starts collapsed, expands on hover. Mobile (≤1024px) is forced
  // to 210px via CSS regardless of this state.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const [showDowngradePopup, setShowDowngradePopup] = useState(false)
  const [showUpgradePopup, setShowUpgradePopup] = useState(false)
  const [pageKey, setPageKey] = useState(0)
  const [trialChoiceLoading, setTrialChoiceLoading] = useState<'monthly' | 'yearly' | 'free' | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authedUser, setAuthedUser] = useState<any>(null)
  const { language, subscriptionLoading, isTemporaryPro, trialExpired, subscriptionTrialEndsAt, upgradeToPro, chooseFreePlan } = useApp()
  const { portfoliosLoaded } = usePortfolio()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const isRTL = language === 'he'
  const ready = authChecked && !!authedUser && portfoliosLoaded && !subscriptionLoading

  // Client-side auth guard — defense in depth on top of middleware. If the
  // user is somehow unauthenticated when reaching a protected page, we force
  // them to /auth/login instead of rendering the layout with a "User" / "U"
  // placeholder.
  useEffect(() => {
    let alive = true
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!alive) return
      if (!user) {
        router.replace('/auth/login')
        return
      }
      await fetch('/api/profile/ensure', { method: 'POST' }).catch(() => null)
      if (!alive) return
      setAuthedUser(user)
      setAuthChecked(true)
    })
    return () => { alive = false }
  }, [])

  // On every route change, briefly hide content so the new page renders invisibly
  // then fades in — eliminates the flash of stale/empty state
  // Also scroll to top (fixes mobile starting mid-page)
  useLayoutEffect(() => {
    setPageKey(k => k + 1)
    return scheduleViewportTopReset()
  }, [pathname])

  // Disable browser scroll restoration and force top on initial load, bfcache restores,
  // and when async content finishes loading (the spinner-to-page transition on mobile
  // was letting the browser restore a mid-page scroll position from a prior session).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const prev = history.scrollRestoration
    try { history.scrollRestoration = 'manual' } catch {}
    const cancelInitialReset = scheduleViewportTopReset()
    const onPageShow = () => { scheduleViewportTopReset() }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      cancelInitialReset()
      window.removeEventListener('pageshow', onPageShow)
      try { history.scrollRestoration = prev } catch {}
    }
  }, [])

  // When the ready gate flips (spinner → content), the page height suddenly grows;
  // force scroll back to top so the header is visible.
  useEffect(() => {
    if (!ready) return
    return scheduleViewportTopReset()
  }, [ready])

  useEffect(() => {
    if (localStorage.getItem('tradeix-show-downgrade') === '1') {
      localStorage.removeItem('tradeix-show-downgrade')
      setShowDowngradePopup(true)
    }
    if (localStorage.getItem('tradeix-show-upgrade') === '1') {
      localStorage.removeItem('tradeix-show-upgrade')
      setShowUpgradePopup(true)
    }
  }, [])

  useEffect(() => {
    if (!ready || !authedUser?.id || !authedUser?.created_at) return
    const storageKey = `tradeix-welcome-seen-${authedUser.id}`
    if (localStorage.getItem(storageKey) === '1') return

    const createdAt = new Date(authedUser.created_at).getTime()
    const isNewUser = Number.isFinite(createdAt) && Date.now() - createdAt < 10 * 60 * 1000
    if (!isNewUser) return

    localStorage.setItem(storageKey, '1')
    setShowWelcomePopup(true)
  }, [ready, authedUser?.id, authedUser?.created_at])

  const sidebarWidth = sidebarCollapsed ? '72px' : '210px'
  const trialEndsLabel = subscriptionTrialEndsAt
    ? new Date(subscriptionTrialEndsAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'long' })
    : null

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleTrialUpgrade = async (billingPeriod: 'monthly' | 'yearly') => {
    setTrialChoiceLoading(billingPeriod)
    try {
      await upgradeToPro(billingPeriod)
    } finally {
      setTrialChoiceLoading(null)
    }
  }

  const handleChooseFree = async () => {
    setTrialChoiceLoading('free')
    try {
      await chooseFreePlan()
      localStorage.setItem('tradeix-show-downgrade', '1')
      router.replace('/dashboard')
    } finally {
      setTrialChoiceLoading(null)
    }
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', alignItems: 'center', justifyContent: 'center' }}>
        <div className="grid-bg" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'var(--bg)', backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '50px 50px', animation: 'gridDrift 90s linear infinite' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: '44px', height: '44px', border: '3px solid rgba(15,141,99,0.15)', borderTopColor: '#0f8d63', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (trialExpired) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px', fontFamily: 'Heebo, sans-serif', position: 'relative', overflow: 'hidden' }}>
        <div className="grid-bg" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'var(--bg)', backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '50px 50px', animation: 'gridDrift 90s linear infinite' }} />
        <div style={{ width: '100%', maxWidth: '880px', position: 'relative', zIndex: 1, background: 'linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))', border: '1px solid rgba(16,185,129,0.24)', borderRadius: '28px', padding: '34px', boxShadow: '0 34px 90px rgba(0,0,0,0.44)', textAlign: 'center' }}>
          <div style={{ width: '74px', height: '74px', borderRadius: '24px', background: 'rgba(15,141,99,0.13)', border: '1px solid rgba(16,185,129,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="workspace_premium" size={36} color="#0f8d63" />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f8d63', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '10px' }}>
            {language === 'he' ? 'תקופת ניסיון הסתיימה' : 'Trial ended'}
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 950 }}>
            {language === 'he' ? 'רוצה להמשיך עם PRO?' : 'Want to keep PRO?'}
          </h1>
          <p style={{ margin: '0 auto 26px', maxWidth: '560px', color: 'var(--text2)', fontSize: '15px', lineHeight: 1.7, fontWeight: 650 }}>
            {language === 'he'
              ? 'תקופת הניסיון של PRO הסתיימה. כל התוכן, התיקים, העסקאות והנתונים שיצרת נשמרים וימשיכו איתך בכל בחירה: שדרוג ל-PRO או מעבר למנוי החינמי.'
              : 'Your PRO trial has ended. Everything you created, including portfolios, trades, and data, is saved and will continue with whichever option you choose: upgrade to PRO or switch to Free.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '18px' }}>
            <button className="trial-choice-button trial-choice-pro trial-choice-monthly" onClick={() => handleTrialUpgrade('monthly')} disabled={Boolean(trialChoiceLoading)} style={{ minHeight: '108px', border: '1px solid rgba(16,185,129,0.48)', borderRadius: '18px', background: 'linear-gradient(135deg, #0f8d63, #16a873)', color: '#fff', cursor: trialChoiceLoading ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'grid', placeItems: 'center', gap: '8px', padding: '14px', boxShadow: '0 20px 46px rgba(15,141,99,0.24)', position: 'relative', overflow: 'hidden' }}>
              <Icon name="bolt" size={24} color="#fff" />
              <span style={{ fontSize: '17px', fontWeight: 950 }}>{trialChoiceLoading === 'monthly' ? (language === 'he' ? 'פותח תשלום...' : 'Opening checkout...') : (language === 'he' ? 'התחל PRO חודשי' : 'Start monthly PRO')}</span>
              <span style={{ fontSize: '12px', fontWeight: 800, opacity: 0.86 }}>{language === 'he' ? '$20 לחודש • גמיש' : '$20/month • flexible'}</span>
            </button>
            <button className="trial-choice-button trial-choice-pro trial-choice-yearly" onClick={() => handleTrialUpgrade('yearly')} disabled={Boolean(trialChoiceLoading)} style={{ minHeight: '108px', border: '1px solid rgba(16,185,129,0.48)', borderRadius: '18px', background: 'linear-gradient(135deg, #0b7a56, #12a875)', color: '#fff', cursor: trialChoiceLoading ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'grid', placeItems: 'center', gap: '8px', padding: '14px', boxShadow: '0 20px 46px rgba(15,141,99,0.28)', position: 'relative', overflow: 'hidden' }}>
              <Icon name="rocket_launch" size={24} color="#fff" />
              <span style={{ fontSize: '17px', fontWeight: 950 }}>{trialChoiceLoading === 'yearly' ? (language === 'he' ? 'פותח תשלום...' : 'Opening checkout...') : (language === 'he' ? 'התחל PRO שנתי' : 'Start yearly PRO')}</span>
              <span style={{ fontSize: '12px', fontWeight: 800, opacity: 0.86 }}>{language === 'he' ? '$199 לשנה • חסוך $41' : '$199/year • save $41'}</span>
            </button>
            <button className="trial-choice-button trial-choice-free" onClick={handleChooseFree} disabled={Boolean(trialChoiceLoading)} style={{ minHeight: '108px', border: '1px solid var(--border)', borderRadius: '18px', background: 'var(--bg3)', color: 'var(--text)', cursor: trialChoiceLoading ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'grid', placeItems: 'center', gap: '8px', padding: '14px', position: 'relative', overflow: 'hidden' }}>
              <Icon name="verified" size={24} color="#0f8d63" />
              <span style={{ fontSize: '17px', fontWeight: 950 }}>{trialChoiceLoading === 'free' ? (language === 'he' ? 'מעביר לחינמי...' : 'Switching...') : (language === 'he' ? 'המשך בחינמי' : 'Continue Free')}</span>
              <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 800 }}>{language === 'he' ? 'ממשיך עם הגבלות החבילה החינמית' : 'Continue with free-plan limits'}</span>
            </button>
          </div>
        </div>
        <style>{`
          @keyframes gridDrift { from { background-position: 0 0; } to { background-position: 120px 80px; } }
          .trial-choice-button {
            isolation: isolate;
            transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
          }
          .trial-choice-button > * {
            position: relative;
            z-index: 1;
            transition: transform 0.22s ease, color 0.22s ease, opacity 0.22s ease;
          }
          .trial-choice-button::before {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 0;
            opacity: 0;
            transform: translateX(34%) skewX(-18deg);
            transition: opacity 0.22s ease, transform 0.55s ease;
            pointer-events: none;
          }
          .trial-choice-button::after {
            content: '';
            position: absolute;
            inset: 1px;
            border-radius: 17px;
            opacity: 0;
            transition: opacity 0.22s ease;
            pointer-events: none;
          }
          .trial-choice-button:not(:disabled):hover {
            transform: translateY(-4px) scale(1.012);
          }
          .trial-choice-button:not(:disabled):hover::before {
            opacity: 1;
            transform: translateX(-34%) skewX(-18deg);
          }
          .trial-choice-button:not(:disabled):hover::after {
            opacity: 1;
          }
          .trial-choice-button:not(:disabled):hover > :first-child {
            transform: translateY(-2px) scale(1.08);
          }
          .trial-choice-button:not(:disabled):active {
            transform: translateY(-1px) scale(0.995);
          }
          .trial-choice-button:disabled {
            opacity: 0.78;
          }
          .trial-choice-pro:not(:disabled):hover {
            border-color: rgba(255,255,255,0.42);
            box-shadow: 0 24px 58px rgba(16,185,129,0.32), 0 0 0 1px rgba(255,255,255,0.08) inset;
            filter: saturate(1.08);
          }
          .trial-choice-monthly:not(:disabled):hover {
            border-color: rgba(255,255,255,0.42);
            box-shadow: 0 24px 58px rgba(16,185,129,0.32), 0 0 0 1px rgba(255,255,255,0.08) inset;
          }
          .trial-choice-pro::before {
            background: linear-gradient(100deg, transparent 18%, rgba(255,255,255,0.34) 48%, transparent 72%);
          }
          .trial-choice-pro::after {
            background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.24), transparent 56%);
          }
          .trial-choice-free:not(:disabled):hover {
            border-color: rgba(16,185,129,0.55);
            box-shadow: 0 20px 46px rgba(16,185,129,0.18), 0 0 0 1px rgba(16,185,129,0.16) inset;
          }
          .trial-choice-free::before {
            background: linear-gradient(100deg, transparent 18%, rgba(16,185,129,0.17) 48%, transparent 72%);
          }
          .trial-choice-free::after {
            background: linear-gradient(135deg, rgba(16,185,129,0.13), transparent 62%);
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Animated grid background */}
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'var(--bg)', backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '50px 50px', animation: 'gridDrift 90s linear infinite' }} />
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99, backdropFilter: 'blur(4px)' }} />}

      <div
        style={{
          width: '72px', height: '100vh',
          borderInlineEnd: '1px solid var(--border)',
          position: 'fixed', [isRTL ? 'right' : 'left']: 0, top: 0, zIndex: 100,
          transition: 'transform 0.3s ease, width 0.25s ease, box-shadow 0.25s ease',
          overflow: 'hidden',
        }}
        className="sidebar-el"
        data-open={sidebarOpen ? '1' : '0'}
        data-collapsed="1"
      >
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} handleSignOut={handleSignOut} />
      </div>

      <div style={{ [isRTL ? 'marginRight' : 'marginLeft']: '72px', flex: 1, minWidth: 0 }} className="main-content">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} handleSignOut={handleSignOut} />
        <div
          key={pageKey}
          style={{ padding: '104px 40px 32px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}
          className="page-content page-ready"
        >
          {children}
        </div>
      </div>

      {/* ── NEW USER WELCOME POPUP ── */}
      {showWelcomePopup && (
        <div className="app-modal-overlay" onClick={() => setShowWelcomePopup(false)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'linear-gradient(135deg, #0f1117, #13151f)', border: '1px solid rgba(15,141,99,0.24)', borderRadius: '28px', padding: '38px 34px 30px', maxWidth: '470px', width: '100%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
            <button onClick={() => setShowWelcomePopup(false)} style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(229,226,225,0.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(229,226,225,0.45)' }}
            >
              <Icon name="close" size={18} color="currentColor" />
            </button>
            <div style={{ position: 'absolute', top: '-70px', left: '50%', transform: 'translateX(-50%)', width: '240px', height: '240px', background: 'rgba(15,141,99,0.11)', filter: 'blur(62px)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ width: '70px', height: '70px', borderRadius: '22px', background: 'linear-gradient(135deg, rgba(15,141,99,0.18), rgba(15,141,99,0.08))', border: '1px solid rgba(15,141,99,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="sentiment_satisfied" size={34} color="#0f8d63" />
            </div>
            <div style={{ fontSize: '25px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px', letterSpacing: '-0.02em' }}>
              {language === 'he' ? 'ברוכים הבאים ל-UPLOTRADE' : 'Welcome to UPLOTRADE'}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(229,226,225,0.56)', lineHeight: 1.75, marginBottom: '24px' }}>
              {isTemporaryPro ? (language === 'he'
                ? `אתה כרגע על PRO-Trial: פתחנו לך 5 ימי ניסיון מלאים ב-PRO${trialEndsLabel ? `, עד ${trialEndsLabel}` : ''}. בסיום התקופה תוכל לבחור אם לשדרג ל-PRO או להמשיך במנוי החינמי.`
                : `You are currently on PRO-Trial: you have 5 full days of PRO access${trialEndsLabel ? `, until ${trialEndsLabel}` : ''}. When the trial ends, you can choose whether to upgrade to PRO or continue on the free plan.`) : language === 'he'
                ? 'בהצלחה במסע המסחר שלך. כרגע אתה במנוי החינמי, ואפשר להתחיל לעבוד מיד.'
                : 'Good luck on your trading journey. You are currently on the free plan and can start right away.'}
            </div>
            {isTemporaryPro && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.24)', borderRadius: '16px', padding: '16px 18px', marginBottom: '24px', color: 'rgba(229,226,225,0.74)', fontSize: '13.5px', lineHeight: 1.7, fontWeight: 750 }}>
                {language === 'he'
                  ? 'חשוב לדעת: כל מה שתיצור בתקופת הניסיון נשמר וימשיך איתך גם אם תשדרג וגם אם תבחר להמשיך בחינמי.'
                  : 'Everything you create during the trial is saved and will continue with you whether you upgrade or stay on Free.'}
              </div>
            )}
            {!isTemporaryPro && (
              <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px', textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#0f8d63', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '12px', textAlign: 'center' }}>
                {language === 'he' ? 'מה כלול בחינם' : 'Free plan includes'}
              </div>
              {[
                { icon: 'folder_open', text: language === 'he' ? 'תיק מסחר אחד לניהול הפעילות שלך' : '1 trading portfolio to manage your activity', ok: true },
                { icon: 'receipt_long', text: language === 'he' ? 'עד 20 עסקאות לתיעוד ומעקב' : 'Up to 20 trades for tracking and journaling', ok: true },
                { icon: 'psychology', text: language === 'he' ? 'ניהול אסטרטגיות והצמדתן לעסקאות' : 'Strategy management and linking trades', ok: true },
                { icon: 'lock', text: language === 'he' ? 'סטטיסטיקות מלאות וארכיון זמינים ב-PRO' : 'Full statistics and archive are available in PRO', ok: false },
              ].map((item, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.055)' : 'none' }}>
                  <Icon name={item.icon} size={15} color={item.ok ? '#0f8d63' : 'rgba(255,255,255,0.28)'} />
                  <span style={{ fontSize: '14px', color: item.ok ? 'rgba(229,226,225,0.72)' : 'rgba(229,226,225,0.42)', fontWeight: '650', lineHeight: 1.45 }}>{item.text}</span>
                </div>
              ))}
            </div>
            )}
            {!isTemporaryPro && (
              <div style={{ fontSize: '12.5px', color: 'rgba(229,226,225,0.4)', lineHeight: 1.6, marginBottom: '18px' }}>
              {language === 'he'
                ? 'כשתרצה לפתוח את כל היכולות, כפתור שדרג ל-PRO מחכה בראש האתר מצד שמאל.'
                : 'When you are ready to unlock everything, the Upgrade to PRO button is waiting in the top bar.'}
            </div>
            )}
            <button onClick={() => setShowWelcomePopup(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', background: '#0f8d63', border: 'none',
              color: '#fff', borderRadius: '14px', padding: '13px',
              fontSize: '15px', fontWeight: '800', cursor: 'pointer',
              fontFamily: 'Heebo, sans-serif', boxShadow: '0 0 28px rgba(15,141,99,0.28)',
            }}>
              <Icon name="check" size={18} color="#fff" strokeWidth={2.5} />
              {language === 'he' ? 'הבנתי, בהצלחה' : 'Got it, good luck'}
            </button>
          </div>
        </div>
      )}

      {/* ── DOWNGRADE POPUP ── */}
      {showDowngradePopup && (
        <div className="app-modal-overlay" onClick={() => setShowDowngradePopup(false)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'linear-gradient(135deg, #0f1117, #13151f)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '28px', padding: '40px 36px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
            <button onClick={() => setShowDowngradePopup(false)} style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(229,226,225,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(229,226,225,0.3)' }}
            >
              <Icon name="close" size={18} color="currentColor" />
            </button>
            <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', background: 'rgba(15,141,99,0.08)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(15,141,99,0.12)', border: '1px solid rgba(15,141,99,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="sentiment_satisfied" size={32} color="#0f8d63" />
            </div>
            <div style={{ fontSize: '23px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px', letterSpacing: '-0.01em' }}>
              {language === 'he' ? 'חזרת לתכנית החינמית' : 'Back to Free Plan'}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(229,226,225,0.3)', lineHeight: 1.7, marginBottom: '28px' }}>
              {language === 'he'
                ? 'המנוי בוטל וכל הנתונים נמחקו. עדיין תוכל ליהנות מהמערכת!'
                : 'Your subscription was canceled and all data was cleared. You can still enjoy the app!'}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px 20px', marginBottom: '28px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>
                {language === 'he' ? 'תכנית חינמית כוללת' : 'Free Plan includes'}
              </div>
              {[
                { icon: 'folder_open', text: language === 'he' ? 'תיק מסחר אחד' : '1 trading portfolio', ok: true },
                { icon: 'receipt_long', text: language === 'he' ? 'עד 20 עסקאות' : 'Up to 20 trades', ok: true },
                { icon: 'lock', text: language === 'he' ? 'ללא עמוד סטטיסטיקות' : 'No statistics page', ok: false },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <Icon name={item.icon} size={15} color={item.ok ? '#0f8d63' : 'rgba(255,255,255,0.2)'} />
                  <span style={{ fontSize: '14px', color: item.ok ? 'rgba(229,226,225,0.6)' : 'rgba(229,226,225,0.3)', fontWeight: '600' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowDowngradePopup(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text2)', borderRadius: '14px', padding: '13px',
              fontSize: '15px', fontWeight: '700', cursor: 'pointer',
              fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
            }}>
              {language === 'he' ? 'הבנתי, תודה' : 'Got it, thanks'}
            </button>
          </div>
        </div>
      )}

      {/* ── UPGRADE / WELCOME PRO POPUP ── */}
      {showUpgradePopup && (
        <div className="app-modal-overlay" onClick={() => setShowUpgradePopup(false)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'linear-gradient(135deg, #0f1117, #13151f)', border: '1px solid rgba(15,141,99,0.2)', borderRadius: '28px', padding: '40px 36px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
            <button onClick={() => setShowUpgradePopup(false)} style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(229,226,225,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(229,226,225,0.3)' }}
            >
              <Icon name="close" size={18} color="currentColor" />
            </button>
            <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '220px', height: '220px', background: 'rgba(15,141,99,0.1)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ width: '72px', height: '72px', borderRadius: '22px', background: 'linear-gradient(135deg, rgba(15,141,99,0.15), rgba(18,168,117,0.1))', border: '1px solid rgba(15,141,99,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="bolt" size={36} color="#0f8d63" />
            </div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f8d63', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px' }}>PRO</div>
            <div style={{ fontSize: '25px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px', letterSpacing: '-0.02em' }}>
              {language === 'he' ? 'ברוכים הבאים למועדון!' : 'Welcome to PRO!'}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(229,226,225,0.4)', lineHeight: 1.7, marginBottom: '28px' }}>
              {language === 'he'
                ? 'המנוי שלך פעיל. עכשיו יש לך גישה מלאה לכל הכלים המקצועיים.'
                : 'Your subscription is now active. You have full access to all professional tools.'}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px 20px', marginBottom: '28px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>
                {language === 'he' ? 'מה כלול ב PRO' : 'PRO includes'}
              </div>
              {[
                { icon: 'folder_open', text: language === 'he' ? 'תיקים ללא הגבלה' : 'Unlimited portfolios' },
                { icon: 'receipt_long', text: language === 'he' ? 'עסקאות ללא הגבלה' : 'Unlimited trades' },
                { icon: 'query_stats', text: language === 'he' ? 'עמוד סטטיסטיקות מלא' : 'Full statistics page' },
                { icon: 'inventory_2', text: language === 'he' ? 'ארכיון תיקים' : 'Portfolio archive' },
              ].map((item, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <Icon name={item.icon} size={15} color="#0f8d63" />
                  <span style={{ fontSize: '14px', color: 'rgba(229,226,225,0.6)', fontWeight: '600' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowUpgradePopup(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
              background: 'linear-gradient(135deg, #0f8d63, #12a875)',
              color: '#fff', borderRadius: '14px', padding: '13px',
              fontSize: '15px', fontWeight: '800', border: 'none', cursor: 'pointer',
              boxShadow: '0 0 28px rgba(15,141,99,0.4)',
            }}>
              <Icon name="rocket_launch" size={18} color="#fff" />
              {language === 'he' ? 'בואו נתחיל!' : "Let's go!"}
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@100;300;400;500;700;800;900&family=Manrope:wght@800&display=swap');
        body { font-family: 'Heebo', 'Rubik', sans-serif !important; background: var(--bg) !important; }
        @keyframes pageFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .page-ready { animation: pageFadeIn 0.18s ease forwards; }
        .page-loading { opacity: 0; }
        .upgrade-btn:hover { opacity: 0.92; }

        /* Sidebar link interactions (desktop & mobile both benefit from the
           hover/active polish — they don't change layout). */
        .sidebar-link { will-change: transform; }
        .sidebar-link svg { flex-shrink: 0; }
        .sidebar-link .sidebar-label { min-width: 0; }
        .sidebar-link .material-symbols-outlined { transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1); }
        .sidebar-link:hover .material-symbols-outlined { transform: scale(1.15); }
        .sidebar-link[data-active="1"] {
          box-shadow: inset 0 0 0 1px rgba(15,141,99,0.18), 0 0 18px rgba(15,141,99,0.08);
        }

        /* Desktop sidebar is collapsed-rail by default and expands on hover.
           Pure CSS — no JS state, so it can't trigger React re-renders that
           previously caused content jitter on Settings/Archive pages. The
           main-content margin is pinned to 72px so the expanded sidebar
           overlays content rather than pushing it.

           The icon/logo positions stay pinned across collapsed↔expanded
           states (same padding, same justify-content), and labels stay
           mounted in the DOM. The slide-in is produced by the sidebar's
           own width transition revealing the labels through overflow:hidden,
           combined with an opacity fade — no display:none↔inline pop. */
        @media (min-width: 1025px) {
          .sidebar-el { width: 72px !important; }
          .sidebar-el .sidebar-link {
            justify-content: flex-start !important;
            padding: 11px 18px !important;
          }
          .sidebar-el .sidebar-top {
            justify-content: flex-start !important;
            padding-inline-start: 18px !important;
            padding-inline-end: 18px !important;
          }
          .sidebar-el .sidebar-label,
          .sidebar-el .sidebar-wordmark {
            opacity: 0;
            white-space: nowrap;
            transform: translateX(-8px);
            transition: opacity 0.14s ease, transform 0.14s ease;
          }
          [dir="rtl"] .sidebar-el .sidebar-label,
          [dir="rtl"] .sidebar-el .sidebar-wordmark {
            transform: translateX(8px);
          }
          .sidebar-el .sidebar-link[data-active="1"] {
            background: rgba(15,141,99,0.12) !important;
          }
          .sidebar-el .sidebar-link[data-active="1"] .material-symbols-outlined {
            filter: drop-shadow(0 0 8px rgba(15,141,99,0.45));
          }

          /* Hover: expand to 210px, then once the rail is essentially open
             reveal the labels as a single unit with a small slide. The
             opacity delay (0.22s) is set so the typewriter sweep of the
             expanding right edge has already passed the labels — they
             appear over a stationary, fully-uncovered position rather
             than being painted letter-by-letter. */
          .sidebar-el:hover { width: 210px !important; box-shadow: 4px 0 24px rgba(0,0,0,0.5); }
          [dir="rtl"] .sidebar-el:hover { box-shadow: -4px 0 24px rgba(0,0,0,0.5); }
          .sidebar-el:hover .sidebar-label,
          .sidebar-el:hover .sidebar-wordmark {
            opacity: 1;
            transform: translateX(0);
            transition:
              opacity 0.22s ease 0.22s,
              transform 0.28s cubic-bezier(0.16, 1, 0.3, 1) 0.20s;
          }
          .sidebar-el:hover .sidebar-link[data-active="1"] {
            background: var(--bg3) !important;
          }
          .sidebar-el:hover .sidebar-link[data-active="1"] .material-symbols-outlined {
            filter: none;
          }
        }

        @media (max-width: 1024px) {
          .sidebar-el { width: 210px !important; transform: ${sidebarOpen ? 'translateX(0)' : isRTL ? 'translateX(100%)' : 'translateX(-100%)'}; }
          .sidebar-rail-handle { display: none !important; }
          .main-content { margin-right: 0 !important; margin-left: 0 !important; }
          .dashboard-header { left: 0 !important; right: 0 !important; }
          .hamburger-btn { display: flex !important; }
          .page-content { padding: 96px 20px 24px !important; }
          .header-inner { padding: 0 20px !important; }
          .upgrade-btn span:last-child { display: none; }
        }
        @media (max-width: 640px) {
          .page-content { padding: 88px 14px 16px !important; }
          .header-inner { padding: 0 14px !important; gap: 8px !important; }
          .user-name-block { display: none !important; }
          .active-portfolio-badge { padding: 5px 10px 5px 5px !important; gap: 10px !important; }
          .active-portfolio-badge > div:nth-child(1) { width: 32px !important; height: 32px !important; }
          .active-portfolio-badge > div:nth-child(2) > div:first-child { font-size: 9px !important; }
          .active-portfolio-badge > div:nth-child(2) > div:last-child { max-width: 200px !important; font-size: 14px !important; }
          .active-portfolio-badge > div:nth-child(3) { padding-inline-start: 10px !important; margin-inline-start: 0 !important; }
          .upgrade-btn { padding: 6px 10px !important; font-size: 11px !important; }
        }
        .sidebar-logout { display: block; }
        @media (min-width: 1025px) { .sidebar-el { transform: translateX(0) !important; } }
      ` }} />
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortfolioProvider>
      <LayoutInner>{children}</LayoutInner>
    </PortfolioProvider>
  )
}
