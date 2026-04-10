'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PortfolioProvider, usePortfolio } from '@/lib/portfolio-context'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/dashboard', icon: '⬛', label: 'דשבורד' },
  { href: '/add-trade', icon: '＋', label: 'הוספת עסקה' },
  { href: '/trades', icon: '≡', label: 'כל העסקאות' },
  { href: '/stats', icon: '↗', label: 'סטטיסטיקות' },
]
const BOTTOM_NAV = [
  { href: '/portfolios', icon: '◈', label: 'הגדרות תיקים' },
  { href: '/settings', icon: '⚙', label: 'הגדרות אישיות' },
]

function Header({ sidebarOpen, setSidebarOpen }: any) {
  const { activePortfolio, portfolios, setActivePortfolio } = usePortfolio()
  const [showMenu, setShowMenu] = useState(false)
  const pathname = usePathname()

  const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'דשבורד',
    '/add-trade': 'הוספת עסקה',
    '/trades': 'כל העסקאות',
    '/stats': 'סטטיסטיקות',
    '/portfolios': 'הגדרות תיקים',
    '/settings': 'הגדרות אישיות',
  }

  return (
    <div style={{
      height: '60px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: '12px',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hamburger-btn" style={{
        display: 'none', width: '36px', height: '36px',
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
      }}>
        <span style={{ display: 'block', width: '16px', height: '1.5px', background: 'var(--text)' }} />
        <span style={{ display: 'block', width: '16px', height: '1.5px', background: 'var(--text)' }} />
        <span style={{ display: 'block', width: '16px', height: '1.5px', background: 'var(--text)' }} />
      </button>

      {/* Page title + portfolio name */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>
          {PAGE_TITLES[pathname] || ''}
        </div>
        {activePortfolio && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'linear-gradient(135deg, #1a3a8f22, #7c3aed22)',
            border: '1px solid #4a7fff44',
            borderRadius: '20px', padding: '3px 12px',
            fontSize: '12px', color: 'var(--blue)', fontWeight: '500',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--blue)', boxShadow: '0 0 6px var(--blue)' }} />
            {activePortfolio.name}
          </div>
        )}
      </div>

      {/* Portfolio switcher */}
      <div style={{ position: 'relative' }}>
        <div onClick={() => setShowMenu(!showMenu)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '6px 12px',
          fontSize: '13px', color: 'var(--text)', cursor: 'pointer',
          transition: 'border 0.2s',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activePortfolio ? 'var(--blue)' : 'var(--text3)', boxShadow: activePortfolio ? '0 0 6px var(--blue)' : 'none' }} />
          <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activePortfolio ? activePortfolio.name : 'בחר תיק'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>▼</span>
        </div>

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
            <div style={{
              position: 'absolute', top: '44px', left: 0,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', zIndex: 200, minWidth: '200px',
              boxShadow: '0 8px 24px #00000066', overflow: 'hidden',
            }}>
              {portfolios.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text3)' }}>
                  אין תיקים — <Link href="/portfolios" style={{ color: 'var(--blue)' }}>צור תיק</Link>
                </div>
              ) : (
                portfolios.map(p => (
                  <div key={p.id} onClick={() => { setActivePortfolio(p); setShowMenu(false) }} style={{
                    padding: '12px 16px', fontSize: '13px', cursor: 'pointer',
                    background: activePortfolio?.id === p.id ? 'var(--bg3)' : 'transparent',
                    color: activePortfolio?.id === p.id ? 'var(--blue)' : 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    transition: 'background 0.2s', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: activePortfolio?.id === p.id ? 'var(--blue)' : 'var(--border2)',
                    }} />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    {activePortfolio?.id === p.id && <span style={{ fontSize: '12px' }}>✓</span>}
                  </div>
                ))
              )}
              <Link href="/portfolios" onClick={() => setShowMenu(false)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 16px', fontSize: '13px', color: 'var(--blue)',
                textDecoration: 'none', transition: 'background 0.2s',
              }}>
                <span>＋</span> תיק חדש
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Sidebar({ sidebarOpen, setSidebarOpen, user, handleSignOut }: any) {
  const pathname = usePathname()

  const NavLink = ({ href, icon, label }: any) => {
    const active = pathname === href
    return (
      <Link href={href} onClick={() => setSidebarOpen(false)} style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--blue)' : 'var(--text2)',
        fontWeight: active ? '500' : '400', fontSize: '14px',
        textDecoration: 'none',
        background: active ? 'linear-gradient(135deg, #1a3a8f22, #8b5cf622)' : 'transparent',
        transition: 'all 0.2s', marginBottom: '2px', position: 'relative',
      }}>
        {active && <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: '3px', height: '20px',
          background: 'linear-gradient(var(--blue), var(--purple))',
          borderRadius: '0 2px 2px 0',
        }} />}
        <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{icon}</span>
        {label}
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--blue), var(--purple))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: '700', color: '#fff',
          boxShadow: '0 0 20px var(--blueglow)', flexShrink: 0,
        }}>TX</div>
        <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '1px' }}>
          <span style={{ background: 'linear-gradient(90deg, var(--blue), var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TRADE</span>
          <span style={{ color: 'var(--text)' }}>IX</span>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {NAV_ITEMS.map(item => <NavLink key={item.href} {...item} />)}
        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 12px' }} />
        {BOTTOM_NAV.map(item => <NavLink key={item.href} {...item} />)}
      </nav>
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <button onClick={handleSignOut} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          color: 'var(--red)', fontSize: '14px', cursor: 'pointer',
          background: 'transparent', border: 'none', width: '100%',
          fontFamily: 'Rubik, sans-serif', marginBottom: '8px',
        }}>↩ יציאה</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--blue), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '600', color: '#fff', flexShrink: 0, overflow: 'hidden',
          }}>
            {user?.user_metadata?.avatar_url
              ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.user_metadata?.full_name || user?.email || 'משתמש'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>חשבון חינמי</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useState(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 99 }} />}

      <div style={{
        width: '220px', minHeight: '100vh', background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)', position: 'fixed', right: 0, top: 0, zIndex: 100,
        transition: 'transform 0.3s ease',
      }} className="sidebar-el">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} handleSignOut={handleSignOut} />
      </div>

      <div style={{ marginRight: '220px', flex: 1, minWidth: 0 }} className="main-content">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div style={{ padding: '24px' }}>{children}</div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .sidebar-el { transform: ${sidebarOpen ? 'translateX(0)' : 'translateX(100%)'}; }
          .main-content { margin-right: 0 !important; }
          .hamburger-btn { display: flex !important; }
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
