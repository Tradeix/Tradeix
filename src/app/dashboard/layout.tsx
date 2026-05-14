'use client'

import { useState, useEffect } from 'react'
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

const PORTFOLIO_AGNOSTIC_PATHS = ['/portfolios', '/portfolios/archive', '/gallery', '/settings']

function Header({ sidebarOpen, setSidebarOpen, handleSignOut }: any) {
  const { activePortfolio, portfolios, setActivePortfolio } = usePortfolio()
  const { language, isPro, subscriptionLoading } = useApp()
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
    const updateScrolled = () => setHasScrolled(window.scrollY > 8)
    updateScrolled()
    window.addEventListener('scroll', updateScrolled, { passive: true })
    return () => window.removeEventListener('scroll', updateScrolled)
  }, [pathname])

  const dotColor = activePortfolio ? getPortfolioColor(activePortfolio) : '#0f8d63'

  return (
    <header style={{
      height: '72px',
      background: 'var(--chrome-bg)',
      borderBottom: '1px solid var(--border2)',
      position: hasScrolled ? 'sticky' : 'relative',
      top: hasScrolled ? 0 : undefined,
      zIndex: 50,
      backdropFilter: hasScrolled ? 'blur(18px)' : 'none',
      WebkitBackdropFilter: hasScrolled ? 'blur(18px)' : 'none',
      boxShadow: hasScrolled ? '0 10px 30px rgba(0,0,0,0.22)' : 'none',
      transition: 'box-shadow 0.18s ease, backdrop-filter 0.18s ease',
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
                    <div key={p.id} onClick={() => { setActivePortfolio(p); setShowMenu(false); router.push('/dashboard') }}
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

      {/* Upgrade to PRO banner — free users only */}
      {!subscriptionLoading && !isPro && (
        <Link href="/upgrade" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: '#f59e0b',
          border: '1px solid rgba(180,83,9,0.35)',
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
              background: isPro ? '#f59e0b' : '#0f8d63',
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
              {isPro ? (
                <>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b' }} />
                  <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>PRO</span>
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
              [isRTL ? 'left' : 'right']: 0,
              background: 'var(--modal-bg)', border: '1px solid var(--border)',
              borderRadius: '10px', zIndex: 200, minWidth: '180px',
              overflow: 'hidden', padding: '6px',
              animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              transformOrigin: isRTL ? 'top left' : 'top right',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}>
              <Link href="/settings" onClick={() => setShowUserMenu(false)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px',
                fontSize: '14px', fontWeight: '600', color: 'var(--text2)',
                textDecoration: 'none', transition: 'background 0.15s',
              }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <Icon name="settings" size={15} color="var(--text3)" />
                {language === 'he' ? 'הגדרות' : 'Settings'}
              </Link>
              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
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
    ...(isPro ? [{ href: '/strategies', icon: 'psychology', label: tr.strategies }] : []),
    ...(isPro ? [{ href: '/stats', icon: 'monitoring', label: tr.statistics }] : []),
  ]
  const BOTTOM_NAV = [
    { href: '/gallery', icon: 'photo_library', label: language === 'he' ? 'גלריה' : 'Gallery' },
    { href: '/portfolios', icon: 'cases', label: tr.portfolioSettings },
    ...(isPro ? [{ href: '/portfolios/archive', icon: 'inventory_2', label: language === 'he' ? 'ארכיון תיקים' : 'Archive' }] : []),
    { href: '/settings', icon: 'settings', label: language === 'he' ? 'הגדרות' : 'Settings' },
  ]

  const NavLink = ({ href, icon, label }: any) => {
    const active = pathname === href
    return (
      <Link href={href} onClick={() => setSidebarOpen(false)} title={label} className="nav-link-anim sidebar-link" data-active={active ? '1' : '0'} style={{
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
        <Link href="/dashboard" onClick={() => setSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
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
        {BOTTOM_NAV.map(item => <NavLink key={item.href} {...item} />)}
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
  const [authChecked, setAuthChecked] = useState(false)
  const [authedUser, setAuthedUser] = useState<any>(null)
  const { language, subscriptionLoading } = useApp()
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
  useEffect(() => {
    setPageKey(k => k + 1)
    forceViewportTop()
    requestAnimationFrame(forceViewportTop)
    const soon = window.setTimeout(forceViewportTop, 40)
    const afterPaint = window.setTimeout(forceViewportTop, 120)
    return () => {
      window.clearTimeout(soon)
      window.clearTimeout(afterPaint)
    }
  }, [pathname])

  // Disable browser scroll restoration and force top on initial load, bfcache restores,
  // and when async content finishes loading (the spinner-to-page transition on mobile
  // was letting the browser restore a mid-page scroll position from a prior session).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const prev = history.scrollRestoration
    try { history.scrollRestoration = 'manual' } catch {}
    const toTop = forceViewportTop
    toTop()
    requestAnimationFrame(toTop)
    const onPageShow = () => { toTop(); requestAnimationFrame(toTop) }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      try { history.scrollRestoration = prev } catch {}
    }
  }, [])

  // When the ready gate flips (spinner → content), the page height suddenly grows;
  // force scroll back to top so the header is visible.
  useEffect(() => {
    if (!ready) return
    forceViewportTop()
    requestAnimationFrame(forceViewportTop)
    const afterPaint = window.setTimeout(forceViewportTop, 80)
    return () => window.clearTimeout(afterPaint)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
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
          style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}
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
              {language === 'he'
                ? 'בהצלחה במסע המסחר שלך. כרגע אתה במנוי החינמי, ואפשר להתחיל לעבוד מיד.'
                : 'Good luck on your trading journey. You are currently on the free plan and can start right away.'}
            </div>
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
            <div style={{ fontSize: '12.5px', color: 'rgba(229,226,225,0.4)', lineHeight: 1.6, marginBottom: '18px' }}>
              {language === 'he'
                ? 'כשתרצה לפתוח את כל היכולות, כפתור שדרג ל-PRO מחכה בראש האתר מצד שמאל.'
                : 'When you are ready to unlock everything, the Upgrade to PRO button is waiting in the top bar.'}
            </div>
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
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'linear-gradient(135deg, #0f1117, #13151f)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '28px', padding: '40px 36px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
            <button onClick={() => setShowUpgradePopup(false)} style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(229,226,225,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(229,226,225,0.3)' }}
            >
              <Icon name="close" size={18} color="currentColor" />
            </button>
            <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '220px', height: '220px', background: 'rgba(245,158,11,0.1)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ width: '72px', height: '72px', borderRadius: '22px', background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.1))', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="bolt" size={36} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px' }}>PRO</div>
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
                  <Icon name={item.icon} size={15} color="#f59e0b" />
                  <span style={{ fontSize: '14px', color: 'rgba(229,226,225,0.6)', fontWeight: '600' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowUpgradePopup(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              color: '#fff', borderRadius: '14px', padding: '13px',
              fontSize: '15px', fontWeight: '800', border: 'none', cursor: 'pointer',
              boxShadow: '0 0 28px rgba(245,158,11,0.4)',
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
          .hamburger-btn { display: flex !important; }
          .page-content { padding: 24px 20px !important; }
          .header-inner { padding: 0 20px !important; }
          .upgrade-btn span:last-child { display: none; }
        }
        @media (max-width: 640px) {
          .page-content { padding: 16px 14px !important; }
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
