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

const PRIMARY = '#4a7fff'

export default function DashboardPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language } = useApp()
  const tr = t[language]
  const [timeFilter, setTimeFilter] = useState(2) // 0=daily 1=weekly 2=monthly 3=yearly — default: monthly
  const [tradeTimeFilter, setTradeTimeFilter] = useState(2) // 0=daily 1=weekly 2=monthly — for recent trades list
  const [trades, setTrades] = useState<Trade[]>([])
  const [tradePage, setTradePage] = useState(0)
  const [tradeTotal, setTradeTotal] = useState(0)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalTrades: 0, wins: 0, losses: 0, winRate: 0,
    totalPnl: 0, profitFactor: 0, avgRR: 0, bestTrade: 0, worstTrade: 0,
  })
  const [equityCurve, setEquityCurve] = useState<{date: string; value: number}[]>([])
  const [portfolioValue, setPortfolioValue] = useState({ currentValue: 0, allTimePnl: 0, totalReturn: 0, maxDrawdown: 0 })
  const supabase = createClient()

  const TIME_FILTERS = [tr.daily, tr.weekly, tr.monthly, tr.yearly]

  function getStartDate(filter: number): string {
    const now = new Date()
    if (filter === 0) { // daily
      const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString()
    } else if (filter === 1) { // weekly
      const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d.toISOString()
    } else if (filter === 2) { // monthly
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    } else { // yearly
      return new Date(now.getFullYear(), 0, 1).toISOString()
    }
  }

  useEffect(() => {
    if (activePortfolio) { setTradePage(0); loadData(0) }
  }, [activePortfolio, timeFilter, tradeTimeFilter])

  // Realtime subscription
  useEffect(() => {
    if (!activePortfolio) return
    const channel = supabase
      .channel('dashboard-trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `portfolio_id=eq.${activePortfolio.id}` }, () => {
        loadData(0); setTradePage(0)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activePortfolio])

  async function loadData(page = 0, overrideTradeFilter?: number) {
    try {
      const startDate = getStartDate(timeFilter)
      const tFilter = overrideTradeFilter !== undefined ? overrideTradeFilter : tradeTimeFilter
      const tradeStartDate = getStartDate(tFilter)

      // Recent trades with pagination (6 per page) — filtered by tradeTimeFilter
      const from = page * 6
      const { data: tradeData, count } = await supabase
        .from('trades').select('*', { count: 'exact' })
        .eq('portfolio_id', activePortfolio!.id)
        .gte('traded_at', tradeStartDate)
        .order('created_at', { ascending: false })
        .range(from, from + 5)
      if (tradeData) setTrades(tradeData)
      if (count !== null) setTradeTotal(count)

      // Stats (filtered by time)
      const { data: all } = await supabase
        .from('trades').select('pnl, outcome')
        .eq('portfolio_id', activePortfolio!.id)
        .gte('traded_at', startDate)

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
      } else {
        setStats({ totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, profitFactor: 0, avgRR: 0, bestTrade: 0, worstTrade: 0 })
      }

      // All-time portfolio value + drawdown
      const { data: allTimeTrades } = await supabase
        .from('trades').select('pnl, traded_at')
        .eq('portfolio_id', activePortfolio!.id)
        .order('traded_at', { ascending: true })
      if (allTimeTrades) {
        const allTimePnl = allTimeTrades.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
        const initialCapital = activePortfolio!.initial_capital || 0
        const currentValue = initialCapital + allTimePnl
        const totalReturn = initialCapital > 0 ? (allTimePnl / initialCapital) * 100 : 0
        let peak = initialCapital, maxDD = 0, running = initialCapital
        for (const t of allTimeTrades) {
          running += (t.pnl || 0)
          if (running > peak) peak = running
          if (peak > 0) { const dd = ((peak - running) / peak) * 100; if (dd > maxDD) maxDD = dd }
        }
        setPortfolioValue({ currentValue, allTimePnl, totalReturn, maxDrawdown: maxDD })
      }

      // Equity curve (filtered by time)
      const { data: allTrades } = await supabase
        .from('trades').select('pnl, traded_at')
        .eq('portfolio_id', activePortfolio!.id)
        .gte('traded_at', startDate)
        .order('traded_at', { ascending: true })
      if (allTrades && allTrades.length > 0) {
        const curve = allTrades.reduce((acc: any[], x: any, i: number) => {
          const prev = i === 0 ? 0 : acc[i-1].value
          acc.push({ date: new Date(x.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day:'2-digit', month:'2-digit' }), value: Math.round(prev + (x.pnl || 0)) })
          return acc
        }, [])
        setEquityCurve(curve)
      } else { setEquityCurve([]) }
    } finally {}
  }

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', fontFamily: 'Heebo, sans-serif' }}>
        <div style={{ fontSize: '56px', marginBottom: '20px', opacity: 0.2 }}>📁</div>
        <div style={{ fontSize: '22px', fontWeight: '900', marginBottom: '10px', color: 'var(--text)' }}>
          {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '28px' }}>
          {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
        </div>
        <Link href="/portfolios" style={{ background: `linear-gradient(135deg, ${PRIMARY}, #3366dd)`, color: '#fff', padding: '12px 28px', borderRadius: '12px', textDecoration: 'none', fontSize: '13px', fontWeight: '700', boxShadow: `0 0 24px rgba(74,127,255,0.4)` }}>
          {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
        </Link>
      </div>
    )
  }

  const pnlPositive = stats.totalPnl >= 0
  const initialCapital = activePortfolio?.initial_capital || 0
  const portfolioPositive = portfolioValue.allTimePnl >= 0
  const marketTypeLabels: Record<string, string> = {
    forex: 'FOREX', stocks: 'STOCKS', crypto: 'CRYPTO', commodities: 'COMMOD', other: 'OTHER',
  }
  const marketTypeColors: Record<string, string> = {
    forex: '#06b6d4', stocks: '#4a7fff', crypto: '#f59e0b', commodities: '#f97316', other: '#8b5cf6',
  }
  const mktColor = marketTypeColors[activePortfolio?.market_type || 'other'] || '#8b5cf6'
  const mktLabel = marketTypeLabels[activePortfolio?.market_type || 'other'] || 'OTHER'
  // Progress bar: how much of initial capital is the current value (capped 0–200%)
  const progressPct = initialCapital > 0
    ? Math.min(200, Math.max(0, (portfolioValue.currentValue / initialCapital) * 100))
    : 0

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', color: 'var(--text)' }}>

      {/* ── PORTFOLIO DATA SECTION ── */}
      <section style={{ marginBottom: '28px', position: 'relative', overflow: 'hidden', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>

        {/* Ambient glow */}
        <div style={{ position: 'absolute', insetInlineEnd: '-60px', top: '-60px', width: '200px', height: '200px', background: `${mktColor}18`, filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', insetInlineStart: '-40px', bottom: '-40px', width: '160px', height: '160px', background: portfolioPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />

        {/* Top row: portfolio name + market type */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: `${mktColor}18`, border: `1px solid ${mktColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: mktColor, fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>account_balance</span>
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1 }}>{activePortfolio?.name}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {language === 'he' ? 'נתוני תיק' : 'Portfolio Overview'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: mktColor, background: `${mktColor}15`, border: `1px solid ${mktColor}30`, padding: '4px 10px', borderRadius: '999px', letterSpacing: '0.12em' }}>{mktLabel}</span>
            {initialCapital > 0 && (
              <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '999px' }}>
                {language === 'he' ? 'הון' : 'Capital'}: ${initialCapital.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Current value + return side by side */}
        <div className="portfolio-main-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', marginBottom: '20px', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>
              {language === 'he' ? 'שווי תיק נוכחי' : 'Current Value'}
            </div>
            <div dir="ltr" style={{ fontSize: '40px', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1, color: portfolioPositive ? '#22c55e' : '#ef4444', textShadow: portfolioPositive ? '0 0 40px rgba(34,197,94,0.3)' : '0 0 40px rgba(239,68,68,0.3)' }}>
              ${portfolioValue.currentValue > 0 ? portfolioValue.currentValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : initialCapital.toLocaleString()}
            </div>
          </div>
          <div style={{ paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: portfolioPositive ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>
              {portfolioPositive ? 'trending_up' : 'trending_down'}
            </span>
            <span dir="ltr" style={{ fontSize: '22px', fontWeight: '900', color: portfolioPositive ? '#22c55e' : '#ef4444', letterSpacing: '-0.02em' }}>
              {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {initialCapital > 0 && (
          <div style={{ marginBottom: '20px', position: 'relative', zIndex: 1 }}>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '999px',
                width: `${Math.min(100, progressPct)}%`,
                background: portfolioPositive
                  ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                  : 'linear-gradient(90deg, #dc2626, #ef4444)',
                boxShadow: portfolioPositive ? '0 0 12px rgba(34,197,94,0.5)' : '0 0 12px rgba(239,68,68,0.4)',
                transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)' }}>$0</span>
              <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)' }}>${initialCapital.toLocaleString()} {language === 'he' ? 'הון התחלתי' : 'initial'}</span>
            </div>
          </div>
        )}

        {/* Bottom stats row */}
        <div className="portfolio-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', position: 'relative', zIndex: 1 }}>

          {/* All-time P&L */}
          <div style={{ background: portfolioPositive ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${portfolioPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: '14px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              {language === 'he' ? 'רווח/הפסד כולל' : 'All-time P&L'}
            </div>
            <div dir="ltr" style={{ fontSize: '18px', fontWeight: '900', color: portfolioPositive ? '#22c55e' : '#ef4444', letterSpacing: '-0.02em' }}>
              {portfolioValue.allTimePnl >= 0 ? '+' : '-'}${Math.abs(portfolioValue.allTimePnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* ROI */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>ROI</div>
            <div dir="ltr" style={{ fontSize: '18px', fontWeight: '900', color: portfolioPositive ? '#22c55e' : '#ef4444', letterSpacing: '-0.02em' }}>
              {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(2)}%
            </div>
          </div>

          {/* Max Drawdown */}
          <div style={{ background: portfolioValue.maxDrawdown > 20 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${portfolioValue.maxDrawdown > 20 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '14px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              {language === 'he' ? 'ירידה מקסימלית' : 'Max Drawdown'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: portfolioValue.maxDrawdown > 20 ? '#ef4444' : portfolioValue.maxDrawdown > 10 ? '#f59e0b' : '#22c55e', letterSpacing: '-0.02em' }}>
              -{portfolioValue.maxDrawdown.toFixed(1)}%
            </div>
          </div>
        </div>
      </section>

      {/* ── HEADER AREA ── */}
      <section className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div style={{ position: 'relative' }}>
          <h2 style={{ fontSize: '30px', fontWeight: '900', letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>{tr.overview}</h2>
          <div style={{ position: 'absolute', bottom: '-6px', insetInlineEnd: 0, width: '48px', height: '4px', background: PRIMARY, borderRadius: '999px' }} />
        </div>
        <div className="time-filter-bar" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)', gap: '2px' }}>
          {TIME_FILTERS.map((label, i) => (
            <button key={i} onClick={() => setTimeFilter(i)} style={{
              padding: '6px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: '700',
              cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
              background: timeFilter === i ? PRIMARY : 'transparent',
              color: timeFilter === i ? '#fff' : 'var(--text3)',
              boxShadow: timeFilter === i ? `0 4px 16px rgba(74,127,255,0.35)` : 'none',
              transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>
      </section>

      {/* ── COMMAND CENTER STATS ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }} className="stats-hero">

        {/* Trades card */}
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, rgba(74,127,255,0.08) 0%, rgba(139,92,246,0.05) 100%)',
          border: '1px solid rgba(74,127,255,0.2)',
          boxShadow: '0 0 40px -10px rgba(74,127,255,0.2)',
          borderRadius: '20px', padding: '20px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', insetInlineEnd: '-20px', top: '-20px', width: '100px', height: '100px', background: 'rgba(74,127,255,0.12)', filter: 'blur(40px)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: 'rgba(74,127,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {tr.total} {tr.trades}
            </span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(74,127,255,0.15)', border: '1px solid rgba(74,127,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4a7fff', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>receipt_long</span>
            </div>
          </div>
          <p style={{ fontSize: '38px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1 }}>{stats.totalTrades}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{stats.wins} {language === 'he' ? 'נצח' : 'W'}</span>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{stats.losses} {language === 'he' ? 'הפס' : 'L'}</span>
            </div>
          </div>
        </div>

        {/* Profit Factor card */}
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(74,127,255,0.05) 100%)',
          border: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '0 0 40px -10px rgba(139,92,246,0.2)',
          borderRadius: '20px', padding: '20px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', insetInlineEnd: '-20px', top: '-20px', width: '100px', height: '100px', background: 'rgba(139,92,246,0.12)', filter: 'blur(40px)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: 'rgba(139,92,246,0.8)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{tr.profitFactor}</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#8b5cf6', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>analytics</span>
            </div>
          </div>
          <p style={{ fontSize: '38px', fontWeight: '900', color: '#8b5cf6', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1, textShadow: '0 0 30px rgba(139,92,246,0.4)' }}>
            {stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'}
          </p>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', margin: 0 }}>{tr.ratio}</p>
        </div>

        {/* P&L hero card */}
        <div className="stat-card" style={{
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
            <span style={{ fontSize: '12px', fontWeight: '900', color: pnlPositive ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{tr.portfolioPerformance}</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: pnlPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${pnlPositive ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: pnlPositive ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{pnlPositive ? 'trending_up' : 'trending_down'}</span>
            </div>
          </div>
          <p style={{ fontSize: '34px', fontWeight: '900', color: pnlPositive ? '#22c55e' : '#ef4444', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1, textShadow: pnlPositive ? '0 0 30px rgba(34,197,94,0.5)' : '0 0 30px rgba(239,68,68,0.5)' }}>
            {pnlPositive ? '+' : ''}${stats.totalPnl.toLocaleString()}
          </p>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', margin: 0 }}>{tr.totalPnl}</p>
        </div>

        {/* WIN RATE card */}
        <div className="stat-card" style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.05) 100%)',
          border: '1px solid rgba(34,197,94,0.2)',
          boxShadow: '0 0 40px -10px rgba(34,197,94,0.2)',
          borderRadius: '20px', padding: '20px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', insetInlineEnd: '-20px', top: '-20px', width: '100px', height: '100px', background: 'rgba(34,197,94,0.12)', filter: 'blur(40px)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: 'rgba(34,197,94,0.8)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{tr.winRate}</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#22c55e', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>emoji_events</span>
            </div>
          </div>
          <p style={{ fontSize: '38px', fontWeight: '900', color: '#22c55e', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1, textShadow: '0 0 30px rgba(34,197,94,0.5)' }}>
            {stats.winRate.toFixed(0)}%
          </p>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{stats.wins} {language === 'he' ? 'נצח' : 'W'}</span>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{stats.losses} {language === 'he' ? 'הפס' : 'L'}</span>
          </div>
        </div>

      </section>

      {/* ── RECENT TRADES ── */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '24px', overflow: 'hidden', marginBottom: '32px',
      }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h4 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 4px', letterSpacing: '-0.01em', color: 'var(--text)' }}>{tr.recentTrades}</h4>
            <p style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', margin: 0 }}>{tr.liveActivity}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Time filter — always visible */}
            <div className="trade-filter-pills" style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[tr.daily, tr.weekly, tr.monthly].map((label, i) => (
                <button key={i} onClick={() => { setTradeTimeFilter(i); setTradePage(0); loadData(0, i) }} style={{
                  padding: '4px 12px', borderRadius: '7px', fontSize: '10px', fontWeight: '700',
                  cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
                  background: tradeTimeFilter === i ? '#4a7fff' : 'transparent',
                  color: tradeTimeFilter === i ? '#fff' : 'var(--text3)',
                  boxShadow: tradeTimeFilter === i ? '0 2px 8px rgba(74,127,255,0.4)' : 'none',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}>{label}</button>
              ))}
            </div>
            {/* Pagination arrows — only when more than one page */}
            {tradeTotal > 6 && (() => {
              const isRTL      = language === 'he'
              const totalPages = Math.max(1, Math.ceil(tradeTotal / 6))
              const canOlder   = tradePage < totalPages - 1
              const canNewer   = tradePage > 0
              const olderIcon  = isRTL ? 'chevron_right' : 'chevron_left'
              const newerIcon  = isRTL ? 'chevron_left'  : 'chevron_right'
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => { const p = tradePage + 1; setTradePage(p); loadData(p, tradeTimeFilter) }}
                    disabled={!canOlder}
                    style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text2)', cursor: canOlder ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canOlder ? 1 : 0.25, transition: 'all 0.2s' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>{olderIcon}</span>
                  </button>
                  <button
                    onClick={() => { const p = tradePage - 1; setTradePage(p); loadData(p, tradeTimeFilter) }}
                    disabled={!canNewer}
                    style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text2)', cursor: canNewer ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canNewer ? 1 : 0.25, transition: 'all 0.2s' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>{newerIcon}</span>
                  </button>
                </div>
              )
            })()}
          </div>
        </div>

        <div style={{ padding: '8px 12px' }}>
          {trades.length === 0 ? (

            <div style={{ padding: '40px', textAlign: 'center', opacity: 0.4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--text3)', display: 'block', marginBottom: '8px', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 32" }}>receipt_long</span>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>{tr.noMoreTrades}</p>
            </div>
          ) : trades.map((trade, idx) => (
            <div
              key={trade.id}
              onClick={() => setSelectedTrade(trade)}
              style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 90px 100px', alignItems: 'center', gap: '12px', padding: '14px 8px', borderRadius: '14px', marginBottom: idx < trades.length - 1 ? '2px' : '0', cursor: 'pointer', transition: 'background 0.15s', borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(74,127,255,0.04)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
              className="recent-trade-row"
            >
              {/* Pair */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: trade.direction === 'long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${trade.direction === 'long' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: trade.direction === 'long' ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>
                    {trade.direction === 'long' ? 'trending_up' : 'trending_down'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)', lineHeight: 1 }}>{trade.symbol}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '600', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {tr.pair}
                  </div>
                </div>
              </div>

              {/* RR */}
              <div className="trade-col-rr" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: PRIMARY }}>1:{trade.rr_ratio?.toFixed(1) || '—'}</div>
                <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>RR</div>
              </div>

              {/* P&L */}
              <div style={{ textAlign: 'center' }}>
                <div dir="ltr" style={{ fontSize: '14px', fontWeight: '900', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                  {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl)}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>P&L</div>
              </div>

              {/* Date */}
              <div className="trade-col-date" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text2)' }}>
                  {new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit' })}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>{tr.dateLabel}</div>
              </div>

              {/* Status */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '4px 10px', borderRadius: '999px',
                  background: trade.outcome === 'win' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: trade.outcome === 'win' ? '#22c55e' : '#ef4444',
                  fontSize: '10px', fontWeight: '900',
                  border: `1px solid ${trade.outcome === 'win' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  whiteSpace: 'nowrap',
                }}>
                  {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
                </span>
              </div>
            </div>
          ))}
        </div>

      </section>

      {/* ── EQUITY CURVE ── */}
      <section className="equity-section" style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '32px', padding: '32px',
        overflow: 'hidden', position: 'relative', marginBottom: '32px',
      }}>
        <div style={{ position: 'absolute', left: '-80px', bottom: '-80px', width: '256px', height: '256px', background: 'rgba(74,127,255,0.05)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', position: 'relative', zIndex: 1 }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px', letterSpacing: '-0.01em', color: 'var(--text)' }}>{tr.equityCurve}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>{tr.performanceTimeline}</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: PRIMARY, letterSpacing: '0.05em', margin: '0 0 2px' }}>{tr.totalPnl}</p>
            <p dir="ltr" style={{ fontSize: '20px', fontWeight: '900', color: pnlPositive ? '#22c55e' : '#ef4444', margin: 0 }}>
              {pnlPositive ? '+' : '-'}${Math.abs(stats.totalPnl).toLocaleString()}
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
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} width={55} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px', fontFamily: 'Heebo', color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                formatter={(v: any) => [`$${v}`, tr.cumulativePnl]}
              />
              <Area type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={2.5} fill="url(#equityGrad)" strokeLinecap="round" dot={false} activeDot={{ r: 6, fill: PRIMARY, strokeWidth: 0, filter: 'drop-shadow(0 0 8px rgba(74,127,255,0.8))' }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'rgba(74,127,255,0.2)', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 40" }}>show_chart</span>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>{tr.noDataAddTrades}</p>
          </div>
        )}
      </section>

      {selectedTrade && (
        <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadData() }} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ══════════════════════════════════════════
           TABLET + MOBILE — APP MODE  (≤ 1024px)
           ══════════════════════════════════════════ */
        @media (max-width: 1024px) {
          /* Header */
          .dash-header { flex-wrap: wrap !important; gap: 10px !important; margin-bottom: 20px !important; }
          .time-filter-bar { width: 100% !important; }
          .time-filter-bar button { flex: 1 !important; font-size: 10px !important; padding: 5px 8px !important; }

          /* Stat cards → 2×2 */
          .stats-hero { grid-template-columns: 1fr 1fr !important; gap: 12px !important; margin-bottom: 20px !important; }
          .stat-card { padding: 16px !important; border-radius: 16px !important; }

          /* Trade rows: hide RR + Date */
          .recent-trade-row { grid-template-columns: 1fr 110px 90px !important; gap: 8px !important; padding: 12px 10px !important; }
          .trade-col-rr { display: none !important; }
          .trade-col-date { display: none !important; }
          .trade-filter-pills button { font-size: 9px !important; padding: 3px 8px !important; }

          /* Portfolio section */
          .portfolio-stats-row { grid-template-columns: 1fr 1fr 1fr !important; gap: 10px !important; }

          /* Equity */
          .equity-section { padding: 20px !important; border-radius: 20px !important; }
        }

        /* ══════════════════════════════════════════
           MOBILE SMALL  (≤ 640px)
           ══════════════════════════════════════════ */
        @media (max-width: 640px) {
          .stats-hero { gap: 10px !important; }
          .stat-card { padding: 14px !important; }
          .recent-trade-row { grid-template-columns: 1fr 90px 72px !important; gap: 6px !important; padding: 10px 8px !important; }
          .portfolio-stats-row { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .portfolio-main-row > div:first-child div[dir="ltr"] { font-size: 28px !important; }
        }
      `}</style>
    </div>
  )
}
