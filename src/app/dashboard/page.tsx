'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { Trade, Stats } from '@/types'
import Link from 'next/link'
import TradeModal from '@/components/TradeModal'

// Accent color — kept blue/purple per user request
const PRIMARY = '#4a7fff'
const PRIMARY_DARK = '#3c2f00'

export default function DashboardPage() {
  const { activePortfolio } = usePortfolio()
  const { language } = useApp()
  const tr = t[language]
  const [timeFilter, setTimeFilter] = useState(3) // יום active by default like HTML
  const [trades, setTrades] = useState<Trade[]>([])
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalTrades: 0, wins: 0, losses: 0, winRate: 0,
    totalPnl: 0, profitFactor: 0, avgRR: 0, bestTrade: 0, worstTrade: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const TIME_FILTERS = [tr.year, tr.month, tr.week, tr.day]

  useEffect(() => { if (activePortfolio) loadData() }, [activePortfolio])

  async function loadData() {
    setLoading(true)
    try {
      const { data: tradeData } = await supabase
        .from('trades').select('*')
        .eq('portfolio_id', activePortfolio!.id)
        .order('traded_at', { ascending: false }).limit(10)
      if (tradeData) setTrades(tradeData)

      const { data: all } = await supabase
        .from('trades').select('pnl, outcome')
        .eq('portfolio_id', activePortfolio!.id)

      if (all && all.length > 0) {
        const wins = all.filter((x: any) => x.outcome === 'win')
        const losses = all.filter((x: any) => x.outcome === 'loss')
        const totalPnl = all.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
        const gp = wins.reduce((s: number, x: any) => s + x.pnl, 0)
        const gl = Math.abs(losses.reduce((s: number, x: any) => s + x.pnl, 0))
        setStats({
          totalTrades: all.length, wins: wins.length, losses: losses.length,
          winRate: (wins.length / all.length) * 100, totalPnl,
          profitFactor: gl > 0 ? gp / gl : 0, avgRR: 0,
          bestTrade: Math.max(...all.map((x: any) => x.pnl || 0)),
          worstTrade: Math.min(...all.map((x: any) => x.pnl || 0)),
        })
      }
    } finally { setLoading(false) }
  }

  if (!activePortfolio && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', fontFamily: 'Heebo, sans-serif' }}>
        <div style={{ fontSize: '56px', marginBottom: '20px', opacity: 0.2 }}>📁</div>
        <div style={{ fontSize: '22px', fontWeight: '900', marginBottom: '10px' }}>{tr.noPortfolio}</div>
        <div style={{ fontSize: '13px', color: 'rgba(229,226,225,0.4)', marginBottom: '28px' }}>{tr.noPortfolioDesc}</div>
        <Link href="/portfolios" style={{ background: `linear-gradient(135deg, ${PRIMARY}, #3366dd)`, color: '#fff', padding: '12px 28px', borderRadius: '12px', textDecoration: 'none', fontSize: '13px', fontWeight: '700', boxShadow: `0 0 24px rgba(74,127,255,0.4)` }}>{tr.createPortfolio}</Link>
      </div>
    )
  }

  const pnlPositive = stats.totalPnl >= 0

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', color: '#e5e2e1' }}>

      {/* ── HEADER AREA ── */}
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div style={{ position: 'relative' }}>
          <h2 style={{ fontSize: '30px', fontWeight: '900', letterSpacing: '-0.02em', margin: 0 }}>סקירה כללית</h2>
          <div style={{ position: 'absolute', bottom: '-6px', insetInlineEnd: 0, width: '48px', height: '4px', background: PRIMARY, borderRadius: '999px' }} />
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', gap: '2px' }}>
          {TIME_FILTERS.map((label, i) => (
            <button key={i} onClick={() => setTimeFilter(i)} style={{
              padding: '6px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: '700',
              cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
              background: timeFilter === i ? PRIMARY : 'transparent',
              color: timeFilter === i ? '#fff' : 'rgba(229,226,225,0.4)',
              boxShadow: timeFilter === i ? `0 4px 16px rgba(74,127,255,0.35)` : 'none',
              transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>
      </section>

      {/* ── COMMAND CENTER STATS ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '4fr 8fr', gap: '16px', height: '100px', marginBottom: '32px' }} className="stats-hero">

        {/* P&L hero card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          border: `1px solid ${pnlPositive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          boxShadow: pnlPositive ? '0 0 30px -10px rgba(34,197,94,0.3)' : '0 0 30px -10px rgba(239,68,68,0.3)',
          borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '12px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', insetInlineEnd: '-40px', top: '-40px', width: '96px', height: '96px', background: pnlPositive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', filter: 'blur(50px)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={{ fontSize: '9px', fontWeight: '900', color: pnlPositive ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>ביצועי תיק סה״כ</p>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: pnlPositive ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>trending_up</span>
          </div>
          <div>
            <p style={{ fontWeight: '900', color: pnlPositive ? '#22c55e' : '#ef4444', fontSize: '24px', letterSpacing: '-0.02em', margin: '0 0 2px', textShadow: pnlPositive ? '0 0 20px rgba(34,197,94,0.4)' : '0 0 20px rgba(239,68,68,0.4)' }}>
              {pnlPositive ? '+' : ''}${stats.totalPnl.toLocaleString()}
            </p>
            <p style={{ fontSize: '9px', color: 'rgba(208,197,175,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>סה״כ P&L</p>
          </div>
        </div>

        {/* Right 2-col mini cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Profit Factor */}
          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'rgba(208,197,175,0.6)', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>analytics</span>
              </div>
            </div>
            <div style={{ marginTop: '4px' }}>
              <p style={{ fontWeight: '900', color: '#e5e2e1', fontSize: '20px', margin: '0 0 2px' }}>{stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'}</p>
              <p style={{ fontSize: '9px', color: 'rgba(208,197,175,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>גורם רווחיות</p>
            </div>
          </div>

          {/* Trades count — gold glow */}
          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: `1px solid rgba(74,127,255,0.2)`, boxShadow: `0 0 30px -10px rgba(74,127,255,0.3)`, borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: `rgba(74,127,255,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '12px', color: PRIMARY, fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>reorder</span>
              </div>
            </div>
            <div style={{ marginTop: '4px' }}>
              <p style={{ fontWeight: '900', color: '#e5e2e1', fontSize: '20px', margin: '0 0 2px' }}>{stats.totalTrades}</p>
              <p style={{ fontSize: '9px', color: 'rgba(208,197,175,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>עסקאות</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PERFORMANCE MATRIX ── */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.03)',
        borderRadius: '16px', padding: '24px',
        position: 'relative', overflow: 'hidden', marginBottom: '32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Win rate big number */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '4px' }}>אחוז הצלחה</span>
              <span style={{ fontSize: '30px', fontWeight: '900', color: '#22c55e', textShadow: '0 0 15px rgba(34,197,94,0.3)' }}>{stats.winRate.toFixed(0)}%</span>
            </div>
            <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.05)' }} />
            {/* Win/Loss pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '6px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,1)' }} />
                <span style={{ fontSize: '11px', fontWeight: '900', color: '#22c55e', letterSpacing: '0.05em' }}>ניצחונות {stats.wins}</span>
              </div>
              <div style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: '11px', fontWeight: '900', color: 'rgba(208,197,175,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>הפסדים {stats.losses}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '900', color: 'rgba(208,197,175,0.3)', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
            מטריצת ביצועים
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>security</span>
          </div>
        </div>

        {/* Segmented bar */}
        <div style={{ position: 'relative', height: '16px', width: '100%', display: 'flex', gap: '4px' }}>
          {stats.totalTrades > 0 ? (
            Array.from({ length: Math.min(stats.totalTrades, 20) }).map((_, i) => {
              const isWin = i < Math.round((stats.wins / stats.totalTrades) * Math.min(stats.totalTrades, 20))
              const isFirst = i === 0
              const isLast = i === Math.min(stats.totalTrades, 20) - 1
              return (
                <div key={i} style={{
                  flex: 1, height: '100%',
                  background: isWin ? '#22c55e' : 'rgba(255,255,255,0.08)',
                  boxShadow: isWin ? '0 0 20px rgba(34,197,94,0.2)' : 'none',
                  transition: 'all 0.7s',
                  borderRadius: isFirst ? '999px 0 0 999px' : isLast ? '0 999px 999px 0' : '0',
                }} />
              )
            })
          ) : (
            <div style={{ flex: 1, height: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '999px' }} />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(34,197,94,0.4)', display: 'inline-block' }} />
            <span style={{ fontSize: '10px', color: 'rgba(34,197,94,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em' }}>חוזק סשן פעיל: {stats.winRate >= 60 ? 'יוצא דופן' : stats.winRate >= 40 ? 'טוב' : 'נמוך'}</span>
          </div>
          <span style={{ fontSize: '10px', color: 'rgba(208,197,175,0.3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em' }}>עדכון בזמן אמת פעיל</span>
        </div>
      </section>

      {/* ── EQUITY CURVE ── */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '32px', padding: '32px',
        overflow: 'hidden', position: 'relative', marginBottom: '32px',
      }}>
        <div style={{ position: 'absolute', left: '-80px', bottom: '-80px', width: '256px', height: '256px', background: 'rgba(74,127,255,0.05)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px', letterSpacing: '-0.01em' }}>עקומת הון</h3>
            <p style={{ fontSize: '11px', color: 'rgba(208,197,175,0.4)', fontWeight: '700', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>ויזואליזציה של ציר זמן ביצועים</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: PRIMARY, letterSpacing: '0.05em', margin: '0 0 2px' }}>סה״כ P&L</p>
            <p style={{ fontSize: '20px', fontWeight: '900', color: '#e5e2e1', margin: 0 }}>
              {pnlPositive ? '+' : ''}${stats.totalPnl.toLocaleString()}
            </p>
          </div>
        </div>

        {/* SVG Chart — exact style from HTML */}
        <div style={{ position: 'relative', height: '200px', width: '100%', display: 'flex' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(208,197,175,0.3)', fontWeight: '900', paddingInlineEnd: '16px', height: '100%', borderInlineEnd: '1px solid rgba(255,255,255,0.05)', width: '56px' }}>
            {trades.length > 0 ? (
              <>
                <span>${Math.max(stats.bestTrade, 0)}</span>
                <span>$0</span>
                <span>${stats.worstTrade < 0 ? stats.worstTrade : 0}</span>
              </>
            ) : (
              <><span>ציר Y</span></>
            )}
          </div>
          <div style={{ flex: 1, position: 'relative', marginInlineStart: '16px', marginTop: '8px' }}>
            {/* Grid lines */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', opacity: 0.1 }}>
              {[0,1,2,3].map(i => <div key={i} style={{ borderTop: '1px solid white', width: '100%', height: '1px' }} />)}
            </div>
            {/* Animated ping dot */}
            <div style={{ position: 'absolute', right: '25%', top: '33%', transform: 'translate(50%, -50%)', zIndex: 20 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', width: '32px', height: '32px', borderRadius: '50%', background: `rgba(74,127,255,0.2)`, animation: 'ping 1.5s ease-in-out infinite' }} />
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white', boxShadow: `0 0 15px rgba(74,127,255,1)` }} />
                </div>
              </div>
            </div>
            {/* SVG line */}
            <svg style={{ width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartFill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 100 Q 25 80, 50 33.3 Q 75 30, 100 20 V 100 H 0 Z" fill="url(#chartFill)" />
              <path d="M 0 100 Q 25 80, 50 33.3 Q 75 30, 100 20" fill="none" stroke={PRIMARY} strokeLinecap="round" strokeWidth="3" style={{ filter: `drop-shadow(0 0 10px rgba(74,127,255,0.6))` }} />
            </svg>
            <div style={{ position: 'absolute', bottom: '-30px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: 'rgba(208,197,175,0.4)', fontWeight: '900', letterSpacing: '0.3em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>תחזית ציר זמן 2024</div>
          </div>
        </div>
      </section>

      {/* ── RECENT TRADES ── */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '24px', overflow: 'hidden', marginBottom: '32px',
      }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 4px', letterSpacing: '-0.01em' }}>עסקאות אחרונות</h4>
            <p style={{ fontSize: '10px', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', margin: 0 }}>פעילות מסחר חיה</p>
          </div>
          <Link href="/add-trade" style={{
            padding: '10px 20px', background: PRIMARY,
            color: '#fff', borderRadius: '12px', fontSize: '12px', fontWeight: '900',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: `0 8px 24px rgba(74,127,255,0.25)`, letterSpacing: '0.03em',
            transition: 'opacity 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>add</span>
            עסקה חדשה
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.2em', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>נכס</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>סוג</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>מחיר כניסה</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>SL / TP</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>תוצאה</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>רווח/הפסד</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <>
                  <tr style={{ opacity: 0.2 }}>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', fontSize: '11px', color: 'rgba(208,197,175,0.4)', fontWeight: '700', fontStyle: 'italic', letterSpacing: '0.2em' }}>
                      אין עסקאות נוספות להצגה
                    </td>
                  </tr>
                </>
              ) : trades.map(trade => (
                <tr key={trade.id}
                  onClick={() => setSelectedTrade(trade)}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '20px 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '12px',
                        background: trade.direction === 'long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${trade.direction === 'long' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'transform 0.2s',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: trade.direction === 'long' ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>
                          {trade.direction === 'long' ? 'trending_up' : 'trending_down'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 2px' }}>{trade.symbol}</p>
                        <p style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', fontWeight: '500', margin: 0 }}>{new Date(trade.traded_at).toLocaleDateString('he-IL')}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px 32px', fontSize: '14px', fontWeight: '900', color: trade.direction === 'long' ? '#60a5fa' : '#a78bfa' }}>
                    {trade.direction === 'long' ? 'לונג' : 'שורט'}
                  </td>
                  <td style={{ padding: '20px 32px', fontSize: '14px', fontWeight: '500', color: 'rgba(229,226,225,0.8)' }}>
                    ${trade.entry_price}
                  </td>
                  <td style={{ padding: '20px 32px', fontSize: '13px', color: 'rgba(208,197,175,0.5)' }}>
                    <span style={{ color: '#ef4444', fontWeight: '600' }}>{trade.stop_loss}</span>
                    {' / '}
                    <span style={{ color: '#22c55e', fontWeight: '600' }}>{trade.take_profit}</span>
                  </td>
                  <td style={{ padding: '20px 32px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '999px',
                      background: trade.outcome === 'win' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: trade.outcome === 'win' ? '#22c55e' : '#ef4444',
                      fontSize: '10px', fontWeight: '900',
                      border: `1px solid ${trade.outcome === 'win' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                      {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
                    </span>
                  </td>
                  <td style={{ padding: '20px 32px', fontSize: '14px', fontWeight: '900', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedTrade && (
        <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadData() }} />
      )}

      <style>{`
        @keyframes ping {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        @media (max-width: 768px) {
          .stats-hero { grid-template-columns: 1fr !important; height: auto !important; }
        }
      `}</style>
    </div>
  )
}
