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

const NAV_ICONS: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/add-trade': 'add_circle',
  '/trades': 'receipt_long',
  '/stats': 'query_stats',
  '/portfolios': 'folder_open',
  '/settings': 'manage_accounts',
}

function Header({ sidebarOpen, setSidebarOpen }: any) {
  const { activePortfolio, portfolios, setActivePortfolio } = usePortfolio()
  const { language } = useApp()
  const tr = t[language]
  const [showMenu, setShowMenu] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const dotColor = activePortfolio ? getPortfolioColor(activePortfolio) : '#4a7fff'
  const isRTL = language === 'he'

  return (
    <header style={{
      height: '72px',
      background: 'var(--bg2)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 32px', gap: '16px',
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

      {/* Portfolio switcher — right side */}
      <div style={{ position: 'relative' }}>
        <div onClick={() => setShowMenu(!showMenu)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: '12px', padding: '7px 14px',
          fontSize: '12px', color: 'var(--text)', cursor: 'pointer',
          fontFamily: 'Heebo, Rubik, sans-serif', fontWeight: '600',
          transition: 'all 0.2s',
        }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
          <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activePortfolio ? activePortfolio.name : tr.selectPortfolio}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '1px' }}>▼</span>
        </div>

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
            <div style={{
              position: 'absolute', top: '48px',
              [isRTL ? 'right' : 'left']: 0,
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderRadius: '16px', zIndex: 200, minWidth: '220px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}>
              {portfolios.length === 0 ? (
                <div style={{ padding: '14px 18px', fontSize: '12px', color: 'var(--text3)' }}>
                  {tr.noPortfolios}
                </div>
              ) : portfolios.map(p => {
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
                padding: '12px 18px', fontSize: '12px', color: '#4a7fff',
                textDecoration: 'none', fontWeight: '700',
              }}>＋ {tr.newPortfolio}</Link>
            </div>
          </>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Current portfolio indicator — left side */}
      {activePortfolio && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: `${dotColor}12`,
          border: `1px solid ${dotColor}30`,
          borderRadius: '20px', padding: '4px 14px',
          fontSize: '11px', color: dotColor, fontWeight: '700',
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
          {activePortfolio.name}
        </div>
      )}

      {/* User — avatar first, then name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingInlineStart: '16px', borderInlineStart: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #4a7fff, #8b5cf6)',
            border: '1.5px solid rgba(74,127,255,0.4)',
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
        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', lineHeight: 1 }}>
            {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4a7fff', boxShadow: '0 0 6px #4a7fff' }} />
            <span style={{ fontSize: '9px', color: '#4a7fff', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {tr.freeAccount}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

function Sidebar({ sidebarOpen, setSidebarOpen, handleSignOut }: any) {
  const pathname = usePathname()
  const { language } = useApp()
  const tr = t[language]
  const isRTL = language === 'he'

  const NAV_ITEMS = [
    { href: '/dashboard', icon: 'dashboard', label: tr.dashboard },
    { href: '/add-trade', icon: 'add_circle', label: tr.addTrade },
    { href: '/trades', icon: 'receipt_long', label: tr.allTrades },
    { href: '/stats', icon: 'query_stats', label: tr.statistics },
  ]
  const BOTTOM_NAV = [
    { href: '/portfolios', icon: 'folder_open', label: tr.portfolioSettings },
    { href: '/portfolios/archive', icon: 'inventory_2', label: language === 'he' ? 'ארכיון תיקים' : 'Archive' },
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
            position: 'absolute',
            [isRTL ? 'right' : 'left']: 0,
            top: 0, bottom: 0,
            width: '2px',
            background: '#4a7fff',
            boxShadow: '0 0 12px rgba(74,127,255,0.8)',
            borderRadius: isRTL ? '2px 0 0 2px' : '0 2px 2px 0',
          }} />
        )}
        <span className="material-symbols-outlined" style={{
          fontSize: '18px',
          fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20",
          color: 'inherit',
        }}>{icon}</span>
        {label}
      </Link>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg2)',
    }}>
      {/* Logo */}
      <div style={{ padding: '32px 20px 40px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Logo icon - diamond shape */}
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, #4a7fff 0%, #8b5cf6 100%)',
            borderRadius: '5px', transform: 'rotate(-45deg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(74,127,255,0.4)',
            flexShrink: 0,
          }}>
            <div style={{
              width: '10px', height: '10px',
              border: '2px solid rgba(255,255,255,0.8)',
              borderLeft: '2px solid transparent',
              borderBottom: '2px solid transparent',
              transform: 'rotate(45deg)',
            }} />
          </div>
          <span style={{
            fontFamily: 'Manrope, Heebo, sans-serif',
            fontWeight: '800', fontSize: '20px',
            letterSpacing: '-0.02em', color: 'var(--text)',
          }}>
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
      {/* Google Material Symbols font */}
      <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@100;300;400;500;700;800;900&family=Manrope:wght@800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99, backdropFilter: 'blur(4px)' }} />}

      {/* Sidebar */}
      <div style={{
        width: '210px', minHeight: '100vh',
        borderInlineEnd: '1px solid var(--border)',
        position: 'fixed', [isRTL ? 'right' : 'left']: 0, top: 0, zIndex: 100,
        transition: 'transform 0.3s ease',
      }} className="sidebar-el">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} handleSignOut={handleSignOut} />
      </div>

      {/* Main */}
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
        @media (max-width: 640px) {
          .sidebar-el { transform: ${sidebarOpen ? 'translateX(0)' : isRTL ? 'translateX(100%)' : 'translateX(-100%)'}; }
          .main-content { margin-right: 0 !important; margin-left: 0 !important; }
          .hamburger-btn { display: flex !important; }
          .page-content { padding: 20px 16px !important; }
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
