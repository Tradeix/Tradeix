'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { Trade, Stats } from '@/types'
import Link from 'next/link'
import TradeModal from '@/components/TradeModal'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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
  const [equityCurve, setEquityCurve] = useState<{date: string; value: number}[]>([])
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
        // equity curve
        const { data: allTrades } = await supabase
          .from('trades').select('pnl, traded_at')
          .eq('portfolio_id', activePortfolio!.id)
          .order('traded_at', { ascending: true })
        if (allTrades && allTrades.length > 0) {
          const curve = allTrades.reduce((acc: any[], x: any, i: number) => {
            const prev = i === 0 ? 0 : acc[i-1].value
            acc.push({ date: new Date(x.traded_at).toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit' }), value: Math.round(prev + (x.pnl || 0)) })
            return acc
          }, [])
          setEquityCurve(curve)
        } else { setEquityCurve([]) }
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
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }} className="stats-hero">

        {/* עסקאות */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(74,127,255,0.08) 0%, rgba(139,92,246,0.05) 100%)',
          border: '1px solid rgba(74,127,255,0.2)',
          boxShadow: '0 0 40px -10px rgba(74,127,255,0.2)',
          borderRadius: '20px', padding: '20px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', insetInlineEnd: '-20px', top: '-20px', width: '100px', height: '100px', background: 'rgba(74,127,255,0.12)', filter: 'blur(40px)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(74,127,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>סה״כ</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(74,127,255,0.15)', border: '1px solid rgba(74,127,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4a7fff', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>receipt_long</span>
            </div>
          </div>
          <p style={{ fontSize: '38px', fontWeight: '900', color: '#e5e2e1', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1 }}>{stats.totalTrades}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(229,226,225,0.5)', margin: 0 }}>{language === 'he' ? 'עסקאות' : 'Trades'}</p>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '1px 6px', borderRadius: '4px' }}>{stats.wins}W</span>
              <span style={{ fontSize: '10px', fontWeight: '800', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: '4px' }}>{stats.losses}L</span>
            </div>
          </div>
        </div>

        {/* גורם רווחיות */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(74,127,255,0.05) 100%)',
          border: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '0 0 40px -10px rgba(139,92,246,0.2)',
          borderRadius: '20px', padding: '20px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', insetInlineEnd: '-20px', top: '-20px', width: '100px', height: '100px', background: 'rgba(139,92,246,0.12)', filter: 'blur(40px)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(139,92,246,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{language === 'he' ? 'יחס' : 'Ratio'}</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#8b5cf6', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>analytics</span>
            </div>
          </div>
          <p style={{ fontSize: '38px', fontWeight: '900', color: '#8b5cf6', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1, textShadow: '0 0 30px rgba(139,92,246,0.4)' }}>
            {stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'}
          </p>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(229,226,225,0.5)', margin: 0 }}>{language === 'he' ? 'גורם רווחיות' : 'Profit Factor'}</p>
        </div>

        {/* P&L hero */}
        <div style={{
          background: pnlPositive
            ? 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(16,185,129,0.05) 100%)'
            : 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.05) 100%)',
          border: `1px solid ${pnlPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          boxShadow: pnlPositive ? '0 0 40px -10px rgba(34,197,94,0.25)' : '0 0 40px -10px rgba(239,68,68,0.25)',
          borderRadius: '20px', padding: '20px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', insetInlineEnd: '-20px', top: '-20px', width: '100px', height: '100px', background: pnlPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', filter: 'blur(40px)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '10px', fontWeight: '900', color: pnlPositive ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>ביצועי תיק</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: pnlPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${pnlPositive ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: pnlPositive ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{pnlPositive ? 'trending_up' : 'trending_down'}</span>
            </div>
          </div>
          <p style={{ fontSize: '34px', fontWeight: '900', color: pnlPositive ? '#22c55e' : '#ef4444', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1, textShadow: pnlPositive ? '0 0 30px rgba(34,197,94,0.5)' : '0 0 30px rgba(239,68,68,0.5)' }}>
            {pnlPositive ? '+' : ''}${stats.totalPnl.toLocaleString()}
          </p>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(229,226,225,0.5)', margin: 0 }}>{language === 'he' ? 'סה״כ P&L' : 'Total P&L'}</p>
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
              <span style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '4px' }}>{language === 'he' ? 'אחוז הצלחה' : 'Win Rate'}</span>
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
            <span style={{ fontSize: '10px', color: 'rgba(34,197,94,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em' }}>חוזק סשן פעיל: {stats.winRate >= 60 ? 'Outstanding' : stats.winRate >= 40 ? (language === 'he' ? 'טוב' : 'Good') : (language === 'he' ? 'נמוך' : 'Low')}</span>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', position: 'relative', zIndex: 1 }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px', letterSpacing: '-0.01em' }}>עקומת הון</h3>
            <p style={{ fontSize: '11px', color: 'rgba(208,197,175,0.4)', fontWeight: '700', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>{language === 'he' ? 'ויזואליזציה של ציר זמן ביצועים' : 'Performance timeline visualization'}</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: PRIMARY, letterSpacing: '0.05em', margin: '0 0 2px' }}>{language === 'he' ? 'סה״כ P&L' : 'Total P&L'}</p>
            <p style={{ fontSize: '20px', fontWeight: '900', color: pnlPositive ? '#22c55e' : '#ef4444', margin: 0 }}>
              {pnlPositive ? '+' : ''}${stats.totalPnl.toLocaleString()}
            </p>
          </div>
        </div>

        {equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(208,197,175,0.3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(208,197,175,0.3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} width={55} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px', fontFamily: 'Heebo', color: '#e5e2e1', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                formatter={(v: any) => [`$${v}`, 'P&L מצטבר']}
              />
              <Area type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={2.5} fill="url(#equityGrad)" strokeLinecap="round" dot={false} activeDot={{ r: 6, fill: PRIMARY, strokeWidth: 0, filter: 'drop-shadow(0 0 8px rgba(74,127,255,0.8))' }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'rgba(74,127,255,0.2)', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 40" }}>show_chart</span>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(208,197,175,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>אין נתונים עדיין — הוסף עסקאות</p>
          </div>
        )}
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
            <p style={{ fontSize: '10px', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', margin: 0 }}>{language === 'he' ? 'פעילות מסחר חיה' : 'Live trading activity'}</p>
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
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>{language === 'he' ? 'נכס' : 'Asset'}</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>{language === 'he' ? 'סוג' : 'Type'}</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>{language === 'he' ? 'מחיר כניסה' : 'Entry'}</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>SL / TP</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>{language === 'he' ? 'תוצאה' : 'Result'}</th>
                <th style={{ padding: '16px 32px', fontWeight: '900' }}>{language === 'he' ? 'רווח/הפסד' : 'P&L'}</th>
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
                    {trade.direction === 'long' ? language === 'he' ? 'לונג' : 'שורט'}
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
