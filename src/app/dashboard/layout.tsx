'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PortfolioProvider, usePortfolio } from '@/lib/portfolio-context'
import { AppProvider, useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Link from 'next/link'

const PORTFOLIO_COLOR_MAP: Record<string, string> = {
  blue: '#4a7fff', purple: '#8b5cf6', green: '#10b981',
  red: '#ef4444', amber: '#f59e0b', cyan: '#06b6d4',
  pink: '#ec4899', gray: '#6b7280',
}
function getPortfolioColor(portfolio: any) {
  return PORTFOLIO_COLOR_MAP[(portfolio as any)?.color || 'blue'] || '#4a7fff'
}

function Header({ sidebarOpen, setSidebarOpen }: any) {
  const { activePortfolio, portfolios, setActivePortfolio } = usePortfolio()
  const { language, isPro, subscriptionLoading } = useApp()
  const tr = t[language]
  const [showMenu, setShowMenu] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const isRTL = language === 'he'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const dotColor = activePortfolio ? getPortfolioColor(activePortfolio) : '#4a7fff'

  return (
    <header style={{
      height: '72px',
      background: 'var(--bg2)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
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
        <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>menu</span>
      </button>

      {/* Portfolio switcher */}
      {portfolios.length > 0 && <div style={{ position: 'relative' }}>
        <div onClick={() => setShowMenu(!showMenu)} style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          background: `${dotColor}12`,
          border: `1.5px solid ${dotColor}50`,
          borderRadius: '12px', padding: '8px 16px',
          fontSize: '13px', color: 'var(--text)', cursor: 'pointer',
          fontFamily: 'Heebo, Rubik, sans-serif', fontWeight: '700',
          transition: 'all 0.2s',
          boxShadow: `0 0 12px ${dotColor}18`,
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
          <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activePortfolio ? activePortfolio.name : tr.selectPortfolio}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: dotColor, fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>expand_more</span>
        </div>

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
            <div style={{
              position: 'absolute', top: '48px',
              [isRTL ? 'right' : 'left']: 0,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: '16px', zIndex: 200, minWidth: '220px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)', overflow: 'hidden',
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
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}` }} />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    {activePortfolio?.id === p.id && <span style={{ fontSize: '12px', color: c }}>✓</span>}
                  </div>
                )
              })}
              <Link href="/portfolios" onClick={() => setShowMenu(false)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 18px', fontSize: '13px', color: '#4a7fff',
                textDecoration: 'none', fontWeight: '800',
              }}>+ {tr.newPortfolio}</Link>
            </div>
          </>
        )}
      </div>}

      <div style={{ flex: 1 }} />

      {/* Upgrade to PRO banner — free users only */}
      {!subscriptionLoading && !isPro && (
        <Link href="/upgrade" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: '10px', padding: '7px 14px',
          fontSize: '11px', fontWeight: '800', color: '#fff',
          textDecoration: 'none', letterSpacing: '0.04em',
          boxShadow: '0 0 18px rgba(245,158,11,0.25)',
          transition: 'all 0.2s', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
          className="upgrade-btn"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' -25, 'opsz' 20" }}>bolt</span>
          {language === 'he' ? 'שדרג ל PRO' : 'Upgrade to PRO'}
        </Link>
      )}

      {/* User info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingInlineStart: '16px', borderInlineStart: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: isPro
              ? 'linear-gradient(135deg, #f59e0b, #f97316)'
              : 'linear-gradient(135deg, #4a7fff, #8b5cf6)',
            border: isPro ? '1.5px solid rgba(245,158,11,0.5)' : '1.5px solid rgba(74,127,255,0.4)',
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
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
                <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>PRO</span>
              </>
            ) : (
              <>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4a7fff', boxShadow: '0 0 6px #4a7fff' }} />
                <span style={{ fontSize: '9px', color: '#4a7fff', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {tr.freeAccount}
                </span>
              </>
            )}
          </div>
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
    { href: '/dashboard', icon: 'dashboard', label: tr.dashboard },
    { href: '/add-trade', icon: 'add_circle', label: tr.addTrade },
    { href: '/trades', icon: 'receipt_long', label: tr.allTrades },
    ...(isPro ? [{ href: '/stats', icon: 'query_stats', label: tr.statistics }] : []),
  ]
  const BOTTOM_NAV = [
    { href: '/portfolios', icon: 'folder_open', label: tr.portfolioSettings },
    ...(isPro ? [{ href: '/portfolios/archive', icon: 'inventory_2', label: language === 'he' ? 'ארכיון תיקים' : 'Archive' }] : []),
    { href: '/settings', icon: 'manage_accounts', label: tr.personalSettings },
  ]

  const NavLink = ({ href, icon, label }: any) => {
    const active = pathname === href
    return (
      <Link href={href} onClick={() => setSidebarOpen(false)} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 20px',
        color: active ? '#4a7fff' : 'var(--text3)',
        fontWeight: active ? '700' : '500',
        fontSize: '13px', textDecoration: 'none',
        background: active ? 'radial-gradient(circle at 100%, rgba(74,127,255,0.1) 0%, transparent 70%)' : 'transparent',
        transition: 'all 0.2s', marginBottom: '2px',
        position: 'relative', letterSpacing: '0.02em',
        fontFamily: 'Heebo, Rubik, sans-serif',
      }}
        onMouseOver={e => { if (!active) { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'var(--bg3)' } }}
        onMouseOut={e => { e.currentTarget.style.color = active ? '#4a7fff' : 'var(--text3)'; if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        {active && (
          <div style={{
            position: 'absolute', [isRTL ? 'right' : 'left']: 0,
            top: 0, bottom: 0, width: '2px',
            background: '#4a7fff', boxShadow: '0 0 12px rgba(74,127,255,0.8)',
            borderRadius: isRTL ? '2px 0 0 2px' : '0 2px 2px 0',
          }} />
        )}
        <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20", color: 'inherit' }}>{icon}</span>
        {label}
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg2)', overflowY: 'auto' }}>
      {/* Logo */}
      <div style={{ padding: '32px 20px 40px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, #4a7fff 0%, #8b5cf6 100%)',
            borderRadius: '5px', transform: 'rotate(-45deg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(74,127,255,0.4)', flexShrink: 0,
          }}>
            <div style={{ width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.8)', borderLeft: '2px solid transparent', borderBottom: '2px solid transparent', transform: 'rotate(45deg)' }} />
          </div>
          <span style={{ fontFamily: 'Manrope, Heebo, sans-serif', fontWeight: '800', fontSize: '20px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Trade<span style={{ background: 'linear-gradient(90deg, #4a7fff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IX</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 8px' }}>
        {NAV_ITEMS.map(item => <NavLink key={item.href} {...item} />)}
        <div style={{ height: '1px', background: 'var(--border)', margin: '12px 12px' }} />
        {BOTTOM_NAV.map(item => <NavLink key={item.href} {...item} />)}
      </nav>

      {/* Upgrade card for free users */}
      {!isPro && (
        <div style={{ margin: '0 12px 12px', padding: '14px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(249,115,22,0.06))', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' -25, 'opsz' 20" }}>bolt</span>
            {language === 'he' ? 'מנוי חינמי' : 'Free Plan'}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(245,158,11,0.6)', marginBottom: '10px', lineHeight: 1.5 }}>
            {language === 'he' ? 'שדרג לPRO לגישה מלאה' : 'Upgrade to PRO for full access'}
          </div>
          <Link href="/upgrade" onClick={() => setSidebarOpen(false)} style={{
            display: 'block', textAlign: 'center',
            background: 'linear-gradient(135deg, #f59e0b, #f97316)',
            color: '#fff', borderRadius: '9px', padding: '8px 12px',
            fontSize: '11px', fontWeight: '800', textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
          }}>
            {language === 'he' ? 'שדרג ל PRO — $20/חודש' : 'Upgrade to PRO — $20/mo'}
          </Link>
        </div>
      )}

      {/* Logout */}
      <div style={{ padding: '16px 8px', borderTop: '1px solid var(--border)' }}>
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
          <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>logout</span>
          {tr.logout}
        </button>
      </div>
    </div>
  )
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { language } = useApp()
  const router = useRouter()
  const supabase = createClient()
  const isRTL = language === 'he'

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@100;300;400;500;700;800;900&family=Manrope:wght@800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99, backdropFilter: 'blur(4px)' }} />}

      <div style={{
        width: '210px', height: '100vh',
        borderInlineEnd: '1px solid var(--border)',
        position: 'fixed', [isRTL ? 'right' : 'left']: 0, top: 0, zIndex: 100,
        transition: 'transform 0.3s ease', overflow: 'hidden',
      }} className="sidebar-el">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} handleSignOut={handleSignOut} />
      </div>

      <div style={{ [isRTL ? 'marginRight' : 'marginLeft']: '210px', flex: 1, minWidth: 0 }} className="main-content">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }} className="page-content">
          {children}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@100;300;400;500;700;800;900&family=Manrope:wght@800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
        body { font-family: 'Heebo', 'Rubik', sans-serif !important; background: var(--bg) !important; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20; }
        .upgrade-btn:hover { transform: scale(1.03); box-shadow: 0 0 24px rgba(245,158,11,0.4) !important; }
        @media (max-width: 640px) {
          .sidebar-el { transform: ${sidebarOpen ? 'translateX(0)' : isRTL ? 'translateX(100%)' : 'translateX(-100%)'}; }
          .main-content { margin-right: 0 !important; margin-left: 0 !important; }
          .hamburger-btn { display: flex !important; }
          .page-content { padding: 20px 16px !important; }
          .upgrade-btn span:last-child { display: none; }
          .user-name-block { display: none !important; }
        }
        @media (min-width: 641px) { .sidebar-el { transform: translateX(0) !important; } }
      `}</style>
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
