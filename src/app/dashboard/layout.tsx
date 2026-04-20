'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PortfolioProvider, usePortfolio } from '@/lib/portfolio-context'
import { AppProvider, useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Link from 'next/link'
import Icon from '@/components/Icon'

const PORTFOLIO_COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6', purple: '#8b5cf6', green: '#10b981',
  red: '#ef4444', amber: '#f59e0b', cyan: '#06b6d4',
  pink: '#ec4899', gray: '#6b7280',
}
function getPortfolioColor(portfolio: any) {
  return PORTFOLIO_COLOR_MAP[(portfolio as any)?.color || 'blue'] || '#3b82f6'
}

function Header({ sidebarOpen, setSidebarOpen, handleSignOut }: any) {
  const { activePortfolio, portfolios, setActivePortfolio } = usePortfolio()
  const { language, isPro, subscriptionLoading } = useApp()
  const tr = t[language]
  const [showMenu, setShowMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const isRTL = language === 'he'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const dotColor = activePortfolio ? getPortfolioColor(activePortfolio) : '#3b82f6'

  return (
    <header style={{
      height: '72px',
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: '12px',
      position: 'sticky', top: 0, zIndex: 50,
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

      {/* Portfolio switcher */}
      {portfolios.length > 0 && <div style={{ position: 'relative' }}>
        <div onClick={() => setShowMenu(!showMenu)} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px 14px',
          fontSize: '13px', color: 'var(--text)', cursor: 'pointer',
          fontFamily: 'Heebo, Rubik, sans-serif', fontWeight: '600',
          transition: 'background 0.15s, border-color 0.15s',
        }}>
          <Icon name="account_balance_wallet" size={16} color={dotColor} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap' }}>
            {language === 'he' ? 'בחירת תיק' : 'Portfolio'}
          </span>
          <Icon name="expand_more" size={16} color="var(--text3)" />
        </div>

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
            <div style={{
              position: 'absolute', top: '48px',
              [isRTL ? 'right' : 'left']: 0,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: '8px', zIndex: 200, minWidth: '220px',
              overflow: 'hidden',
              animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              transformOrigin: isRTL ? 'top right' : 'top left',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}>
              {portfolios.map(p => {
                const c = getPortfolioColor(p)
                return (
                  <div key={p.id} onClick={() => { setActivePortfolio(p); setShowMenu(false) }} style={{
                    padding: '12px 18px', fontSize: '13px', cursor: 'pointer',
                    background: activePortfolio?.id === p.id ? 'var(--bg3)' : 'transparent',
                    color: activePortfolio?.id === p.id ? c : 'var(--text2)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    transition: 'background 0.15s', borderBottom: '1px solid var(--border)',
                    fontWeight: '600',
                  }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseOut={e => (e.currentTarget.style.background = activePortfolio?.id === p.id ? 'var(--bg3)' : 'transparent')}
                  >
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: c }} />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    {activePortfolio?.id === p.id && <span style={{ fontSize: '12px', color: c }}>✓</span>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>}

      <div style={{ flex: 1 }} />

      {/* Upgrade to PRO banner — free users only */}
      {!subscriptionLoading && !isPro && (
        <Link href="/upgrade" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: '#f59e0b',
          border: '1px solid rgba(180,83,9,0.35)',
          borderRadius: '8px', padding: '7px 14px',
          fontSize: '11px', fontWeight: '700', color: '#fff',
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
              background: isPro ? '#f59e0b' : '#3b82f6',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '700', color: '#fff', overflow: 'hidden',
            }}>
              {user?.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase()
              }
            </div>
            <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '9px', height: '9px', background: '#10b981', border: '2px solid var(--bg)', borderRadius: '50%' }} />
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }} className="user-name-block">
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', lineHeight: 1 }}>
              {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
              {isPro ? (
                <>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b' }} />
                  <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>PRO</span>
                </>
              ) : (
                <>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3b82f6' }} />
                  <span style={{ fontSize: '9px', color: '#3b82f6', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
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
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: '10px', zIndex: 200, minWidth: '180px',
              overflow: 'hidden', padding: '6px',
              animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              transformOrigin: isRTL ? 'top left' : 'top right',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}>
              <Link href="/settings" onClick={() => setShowUserMenu(false)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px',
                fontSize: '13px', fontWeight: '600', color: 'var(--text2)',
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
                fontSize: '13px', fontWeight: '700', color: '#ef4444',
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
    ...(isPro ? [{ href: '/stats', icon: 'monitoring', label: tr.statistics }] : []),
  ]
  const BOTTOM_NAV = [
    { href: '/portfolios', icon: 'cases', label: tr.portfolioSettings },
    ...(isPro ? [{ href: '/portfolios/archive', icon: 'inventory_2', label: language === 'he' ? 'ארכיון תיקים' : 'Archive' }] : []),
    { href: '/settings', icon: 'settings', label: tr.personalSettings },
  ]

  const NavLink = ({ href, icon, label }: any) => {
    const active = pathname === href
    return (
      <Link href={href} onClick={() => setSidebarOpen(false)} className="nav-link-anim" style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 20px',
        color: active ? '#10b981' : 'var(--text3)',
        fontWeight: active ? '700' : '500',
        fontSize: '13px', textDecoration: 'none',
        background: active ? 'var(--bg3)' : 'transparent',
        transition: 'background 0.15s, color 0.15s, transform 0.15s', marginBottom: '2px',
        position: 'relative', letterSpacing: '0.02em',
        fontFamily: 'Heebo, Rubik, sans-serif',
        borderRadius: '6px',
      }}
        onMouseOver={e => { if (!active) { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'var(--bg3)' } }}
        onMouseOut={e => { e.currentTarget.style.color = active ? '#10b981' : 'var(--text3)'; if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        {active && (
          <div style={{
            position: 'absolute', [isRTL ? 'right' : 'left']: 0,
            top: 0, bottom: 0, width: '3px',
            background: '#10b981',
            borderRadius: isRTL ? '2px 0 0 2px' : '0 2px 2px 0',
            animation: 'pulseGlow 2s ease-in-out infinite',
          }} />
        )}
        <Icon name={icon} size={18} color="currentColor" />
        {label}
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg2)', overflowY: 'auto' }}>
      {/* Logo */}
      <div style={{ padding: '28px 20px 36px', display: 'flex', justifyContent: 'center' }}>
        <Link href="/dashboard" onClick={() => setSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          {/* Icon */}
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="38" height="38" rx="8" fill="#10b981"/>
            {/* Bars */}
            <rect x="7" y="22" width="5" height="9" rx="1.5" fill="rgba(255,255,255,0.45)"/>
            <rect x="14" y="17" width="5" height="14" rx="1.5" fill="rgba(255,255,255,0.65)"/>
            <rect x="21" y="12" width="5" height="19" rx="1.5" fill="rgba(255,255,255,0.85)"/>
            {/* Arrow up-right */}
            <polyline points="16,14 26,7 26,14" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="10" y1="20" x2="26" y2="7" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          {/* Text */}
          <span style={{ fontFamily: 'Manrope, Heebo, sans-serif', fontWeight: '800', fontSize: '20px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Trade<span style={{ color: '#10b981' }}>IX</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 8px' }}>
        {NAV_ITEMS.map(item => <NavLink key={item.href} {...item} />)}
        <div style={{ height: '1px', background: 'var(--border)', margin: '12px 12px' }} />
        {BOTTOM_NAV.map(item => <NavLink key={item.href} {...item} />)}
      </nav>

      {/* Logout — mobile only (below Personal Settings) */}
      <div className="sidebar-logout" style={{ padding: '8px 8px 16px' }}>
        <div style={{ height: '1px', background: 'var(--border)', margin: '0 12px 8px' }} />
        <button onClick={handleSignOut} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '11px 20px', width: '100%',
          color: 'rgba(239,68,68,0.6)', fontSize: '13px', fontWeight: '500',
          cursor: 'pointer', background: 'transparent', border: 'none',
          fontFamily: 'Heebo, Rubik, sans-serif', letterSpacing: '0.02em',
          borderRadius: '8px', transition: 'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.05)' }}
          onMouseOut={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; e.currentTarget.style.background = 'transparent' }}
        >
          <Icon name="logout" size={18} color="currentColor" />
          {tr.logout}
        </button>
      </div>
    </div>
  )
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showDowngradePopup, setShowDowngradePopup] = useState(false)
  const [showUpgradePopup, setShowUpgradePopup] = useState(false)
  const [pageKey, setPageKey] = useState(0)
  const { language, subscriptionLoading } = useApp()
  const { portfoliosLoaded } = usePortfolio()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const isRTL = language === 'he'
  const ready = portfoliosLoaded && !subscriptionLoading

  // On every route change, briefly hide content so the new page renders invisibly
  // then fades in — eliminates the flash of stale/empty state
  useEffect(() => {
    setPageKey(k => k + 1)
  }, [pathname])

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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Animated grid background */}
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'var(--bg)', backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '50px 50px', animation: 'gridDrift 90s linear infinite' }} />
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99, backdropFilter: 'blur(4px)' }} />}

      <div style={{
        width: '210px', height: '100vh',
        borderInlineEnd: '1px solid var(--border)',
        position: 'fixed', [isRTL ? 'right' : 'left']: 0, top: 0, zIndex: 100,
        transition: 'transform 0.3s ease', overflow: 'hidden',
      }} className="sidebar-el" data-open={sidebarOpen ? '1' : '0'}>
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} handleSignOut={handleSignOut} />
      </div>

      <div style={{ [isRTL ? 'marginRight' : 'marginLeft']: '210px', flex: 1, minWidth: 0 }} className="main-content">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} handleSignOut={handleSignOut} />
        <div
          key={pageKey}
          style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}
          className={`page-content ${ready ? 'page-ready' : 'page-loading'}`}
        >
          {ready ? children : null}
        </div>
      </div>

      {/* ── DOWNGRADE POPUP ── */}
      {showDowngradePopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'linear-gradient(135deg, #0f1117, #13151f)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '28px', padding: '40px 36px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
            <button onClick={() => setShowDowngradePopup(false)} style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(229,226,225,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(229,226,225,0.3)' }}
            >
              <Icon name="close" size={18} color="currentColor" />
            </button>
            <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', background: 'rgba(16,185,129,0.08)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="sentiment_satisfied" size={32} color="#10b981" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px', letterSpacing: '-0.01em' }}>
              {language === 'he' ? 'חזרת לתכנית החינמית' : 'Back to Free Plan'}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(229,226,225,0.3)', lineHeight: 1.7, marginBottom: '28px' }}>
              {language === 'he'
                ? 'המנוי בוטל וכל הנתונים נמחקו. עדיין תוכל ליהנות מהמערכת!'
                : 'Your subscription was canceled and all data was cleared. You can still enjoy the app!'}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px 20px', marginBottom: '28px' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>
                {language === 'he' ? 'תכנית חינמית כוללת' : 'Free Plan includes'}
              </div>
              {[
                { icon: 'folder_open', text: language === 'he' ? 'תיק מסחר אחד' : '1 trading portfolio', ok: true },
                { icon: 'receipt_long', text: language === 'he' ? 'עד 20 עסקאות' : 'Up to 20 trades', ok: true },
                { icon: 'lock', text: language === 'he' ? 'ללא עמוד סטטיסטיקות' : 'No statistics page', ok: false },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <Icon name={item.icon} size={15} color={item.ok ? '#10b981' : 'rgba(255,255,255,0.2)'} />
                  <span style={{ fontSize: '13px', color: item.ok ? 'rgba(229,226,225,0.6)' : 'rgba(229,226,225,0.3)', fontWeight: '600' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowDowngradePopup(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text2)', borderRadius: '14px', padding: '13px',
              fontSize: '14px', fontWeight: '700', cursor: 'pointer',
              fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
            }}>
              {language === 'he' ? 'הבנתי, תודה' : 'Got it, thanks'}
            </button>
          </div>
        </div>
      )}

      {/* ── UPGRADE / WELCOME PRO POPUP ── */}
      {showUpgradePopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'linear-gradient(135deg, #0f1117, #13151f)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '28px', padding: '40px 36px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
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
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px' }}>PRO</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px', letterSpacing: '-0.02em' }}>
              {language === 'he' ? 'ברוכים הבאים למועדון!' : 'Welcome to PRO!'}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(229,226,225,0.4)', lineHeight: 1.7, marginBottom: '28px' }}>
              {language === 'he'
                ? 'המנוי שלך פעיל. עכשיו יש לך גישה מלאה לכל הכלים המקצועיים.'
                : 'Your subscription is now active. You have full access to all professional tools.'}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px 20px', marginBottom: '28px' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>
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
                  <span style={{ fontSize: '13px', color: 'rgba(229,226,225,0.6)', fontWeight: '600' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowUpgradePopup(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              color: '#fff', borderRadius: '14px', padding: '13px',
              fontSize: '14px', fontWeight: '800', border: 'none', cursor: 'pointer',
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
        @media (max-width: 1024px) {
          .sidebar-el { transform: ${sidebarOpen ? 'translateX(0)' : isRTL ? 'translateX(100%)' : 'translateX(-100%)'}; }
          .main-content { margin-right: 0 !important; margin-left: 0 !important; }
          .hamburger-btn { display: flex !important; }
          .page-content { padding: 24px 20px !important; }
          .upgrade-btn span:last-child { display: none; }
        }
        @media (max-width: 640px) {
          .page-content { padding: 16px 14px !important; }
          .user-name-block { display: none !important; }
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
