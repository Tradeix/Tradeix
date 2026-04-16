'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { Trade, Stats } from '@/types'
import TradeModal from '@/components/TradeModal'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const PRIMARY = '#4a7fff'

export default function DashboardPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language } = useApp()
  const router = useRouter()
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
        <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: PRIMARY, color: '#fff', padding: '12px 28px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
          {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
        </button>
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

      {/* ── PAGE TITLE ── */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>{tr.overview}</h2>
      </div>

      {/* ── PORTFOLIO DATA SECTION ── */}
      <section style={{ marginBottom: '28px', position: 'relative', overflow: 'hidden', borderRadius: '12px', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '24px' }}>

        {/* Top row: portfolio name + market type */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <span style={{ fontSize: '10px', fontWeight: '700', color: mktColor, background: 'var(--bg3)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '6px', letterSpacing: '0.08em' }}>{mktLabel}</span>
            {initialCapital > 0 && (
              <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '6px' }}>
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
            <div dir="ltr" style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-0.03em', lineHeight: 1, color: portfolioPositive ? '#22c55e' : '#ef4444' }}>
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
            <div style={{ height: '6px', background: 'var(--bg3)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{
                height: '100%', borderRadius: '3px',
                width: `${Math.min(100, progressPct)}%`,
                background: portfolioPositive ? '#22c55e' : '#ef4444',
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
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              {language === 'he' ? 'רווח/הפסד כולל' : 'All-time P&L'}
            </div>
            <div dir="ltr" style={{ fontSize: '18px', fontWeight: '900', color: portfolioPositive ? '#22c55e' : '#ef4444', letterSpacing: '-0.02em' }}>
              {portfolioValue.allTimePnl >= 0 ? '+' : '-'}${Math.abs(portfolioValue.allTimePnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* ROI */}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>ROI</div>
            <div dir="ltr" style={{ fontSize: '18px', fontWeight: '900', color: portfolioPositive ? '#22c55e' : '#ef4444', letterSpacing: '-0.02em' }}>
              {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(2)}%
            </div>
          </div>

          {/* Max Drawdown */}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px' }}>
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
      <section className="dash-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '32px', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
          {language === 'he' ? 'נתונים לפי:' : 'Data by:'}
        </span>
        <div className="time-filter-bar" style={{ display: 'flex', background: 'var(--bg2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)', gap: '2px' }}>
          {TIME_FILTERS.map((label, i) => (
            <button key={i} onClick={() => setTimeFilter(i)} style={{
              padding: '6px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
              cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
              background: timeFilter === i ? PRIMARY : 'transparent',
              color: timeFilter === i ? '#fff' : 'var(--text3)',
              transition: 'background 0.15s, color 0.15s',
            }}>{label}</button>
          ))}
        </div>
      </section>

      {/* ── COMMAND CENTER STATS ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }} className="stats-hero">

        {/* Trades card */}
        <div className="stat-card" style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderInlineStart: '3px solid #4a7fff',
          borderRadius: '12px', padding: '20px',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {tr.total} {tr.trades}
            </span>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderInlineStart: '3px solid #8b5cf6',
          borderRadius: '12px', padding: '20px',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.profitFactor}</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#8b5cf6', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>analytics</span>
            </div>
          </div>
          <p style={{ fontSize: '38px', fontWeight: '800', color: '#8b5cf6', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1 }}>
            {stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'}
          </p>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', margin: 0 }}>{tr.ratio}</p>
        </div>

        {/* P&L hero card */}
        <div className="stat-card" style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderInlineStart: `3px solid ${pnlPositive ? '#22c55e' : '#ef4444'}`,
          borderRadius: '12px', padding: '20px',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.portfolioPerformance}</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: pnlPositive ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{pnlPositive ? 'trending_up' : 'trending_down'}</span>
            </div>
          </div>
          <p style={{ fontSize: '34px', fontWeight: '800', color: pnlPositive ? '#22c55e' : '#ef4444', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1 }}>
            {pnlPositive ? '+' : ''}${stats.totalPnl.toLocaleString()}
          </p>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', margin: 0 }}>{tr.totalPnl}</p>
        </div>

        {/* WIN RATE card */}
        <div className="stat-card" style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderInlineStart: '3px solid #22c55e',
          borderRadius: '12px', padding: '20px',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.winRate}</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#22c55e', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>emoji_events</span>
            </div>
          </div>
          <p style={{ fontSize: '38px', fontWeight: '800', color: '#22c55e', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1 }}>
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
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '12px', overflow: 'hidden', marginBottom: '32px',
      }}>
        <div className="trades-section-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ flexShrink: 0 }}>
            <h4 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 4px', letterSpacing: '-0.01em', color: 'var(--text)' }}>{tr.recentTrades}</h4>
            <p style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', margin: 0 }}>{tr.liveActivity}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Time filter — always visible */}
            <div className="trade-filter-pills" style={{ display: 'flex', gap: '2px', background: 'var(--bg3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {[tr.daily, tr.weekly, tr.monthly].map((label, i) => (
                <button key={i} onClick={() => { setTradeTimeFilter(i); setTradePage(0); loadData(0, i) }} style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                  cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
                  background: tradeTimeFilter === i ? '#4a7fff' : 'transparent',
                  color: tradeTimeFilter === i ? '#fff' : 'var(--text3)',
                  transition: 'background 0.15s, color 0.15s', whiteSpace: 'nowrap',
                }}>{label}</button>
              ))}
            </div>
            {/* Pagination arrows — desktop/tablet only */}
            {tradeTotal > 6 && (() => {
              const isRTL      = language === 'he'
              const totalPages = Math.max(1, Math.ceil(tradeTotal / 6))
              const canOlder   = tradePage < totalPages - 1
              const canNewer   = tradePage > 0
              const olderIcon  = isRTL ? 'chevron_right' : 'chevron_left'
              const newerIcon  = isRTL ? 'chevron_left'  : 'chevron_right'
              return (
                <div className="trades-arrows-header" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => { const p = tradePage + 1; setTradePage(p); loadData(p, tradeTimeFilter) }}
                    disabled={!canOlder}
                    style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canOlder ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canOlder ? 1 : 0.25, transition: 'opacity 0.15s' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>{olderIcon}</span>
                  </button>
                  <button
                    onClick={() => { const p = tradePage - 1; setTradePage(p); loadData(p, tradeTimeFilter) }}
                    disabled={!canNewer}
                    style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canNewer ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canNewer ? 1 : 0.25, transition: 'opacity 0.15s' }}
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
              style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 90px 100px', alignItems: 'center', gap: '12px', padding: '14px 8px', borderRadius: '0', marginBottom: idx < trades.length - 1 ? '0' : '0', cursor: 'pointer', transition: 'background 0.12s', borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none' }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
              className="recent-trade-row"
            >
              {/* Pair */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
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
                  padding: '4px 10px', borderRadius: '6px',
                  background: 'var(--bg3)',
                  color: trade.outcome === 'win' ? '#22c55e' : '#ef4444',
                  fontSize: '10px', fontWeight: '700',
                  border: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}>
                  {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom pagination — mobile only */}
        {tradeTotal > 6 && (() => {
          const isRTL      = language === 'he'
          const totalPages = Math.max(1, Math.ceil(tradeTotal / 6))
          const canOlder   = tradePage < totalPages - 1
          const canNewer   = tradePage > 0
          const olderIcon  = isRTL ? 'chevron_right' : 'chevron_left'
          const newerIcon  = isRTL ? 'chevron_left'  : 'chevron_right'
          return (
            <div className="trades-arrows-bottom" style={{ display: 'none', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px 0 16px' }}>
              <button
                onClick={() => { const p = tradePage + 1; setTradePage(p); loadData(p, tradeTimeFilter) }}
                disabled={!canOlder}
                style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canOlder ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canOlder ? 1 : 0.25, transition: 'opacity 0.15s' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>{olderIcon}</span>
              </button>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)' }}>
                {tradePage + 1} / {totalPages}
              </span>
              <button
                onClick={() => { const p = tradePage - 1; setTradePage(p); loadData(p, tradeTimeFilter) }}
                disabled={!canNewer}
                style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canNewer ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canNewer ? 1 : 0.25, transition: 'opacity 0.15s' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>{newerIcon}</span>
              </button>
            </div>
          )
        })()}

      </section>

      {/* ── EQUITY CURVE ── */}
      <section className="equity-section" style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '12px', padding: '28px',
        overflow: 'hidden', position: 'relative', marginBottom: '32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', position: 'relative', zIndex: 1 }}>
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
                contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Heebo', color: 'var(--text)' }}
                formatter={(v: any) => [`$${v}`, tr.cumulativePnl]}
              />
              <Area type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={2} fill="url(#equityGrad)" strokeLinecap="butt" dot={false} activeDot={{ r: 5, fill: PRIMARY, stroke: 'var(--bg2)', strokeWidth: 2 }} />
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
          .stat-card { padding: 16px !important; border-radius: 12px !important; }

          /* Trade rows: hide RR + Date */
          .recent-trade-row { grid-template-columns: 1fr 110px 90px !important; gap: 8px !important; padding: 12px 10px !important; }
          .trade-col-rr { display: none !important; }
          .trade-col-date { display: none !important; }
          .trade-filter-pills button { font-size: 9px !important; padding: 3px 8px !important; }

          /* Portfolio section */
          .portfolio-stats-row { grid-template-columns: 1fr 1fr 1fr !important; gap: 10px !important; }

          /* Equity */
          .equity-section { padding: 20px !important; border-radius: 12px !important; }
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

          /* Trades header — single row, no wrap */
          .trades-section-header { padding: 16px !important; flex-wrap: nowrap !important; }
          .trade-filter-pills button { font-size: 9px !important; padding: 3px 7px !important; }

          /* Arrows: hide from header, show at bottom */
          .trades-arrows-header { display: none !important; }
          .trades-arrows-bottom { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
